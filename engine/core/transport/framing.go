package transport

import (
	"encoding/binary"
	"errors"
	"fmt"
	"io"
)

// DefaultMaxFrameSize caps a single frame's payload (16 MiB). Length-prefix
// framing is used (not newline) so binary-safe ciphertext needs no escaping; the
// (later-encrypted) envelope lives inside the frame (2A §5.1).
const DefaultMaxFrameSize = 16 << 20

// ErrFrameTooLarge is returned when a frame exceeds the configured maximum.
var ErrFrameTooLarge = errors.New("transport: frame exceeds maximum size")

// Framer reads/writes length-prefixed frames (`uint32 length ‖ payload`) with a
// bounded maximum size on both directions.
type Framer struct {
	max int
}

// NewFramer creates a Framer with the given max payload size (≤0 uses the default).
func NewFramer(max int) *Framer {
	if max <= 0 {
		max = DefaultMaxFrameSize
	}
	return &Framer{max: max}
}

// Write emits one length-prefixed frame. Oversize payloads are rejected.
func (f *Framer) Write(w io.Writer, payload []byte) error {
	if len(payload) > f.max {
		return fmt.Errorf("%w (%d > %d)", ErrFrameTooLarge, len(payload), f.max)
	}
	var hdr [4]byte
	binary.BigEndian.PutUint32(hdr[:], uint32(len(payload)))
	if _, err := w.Write(hdr[:]); err != nil {
		return fmt.Errorf("transport: write frame header: %w", err)
	}
	if _, err := w.Write(payload); err != nil {
		return fmt.Errorf("transport: write frame payload: %w", err)
	}
	return nil
}

// Read reads one length-prefixed frame, rejecting a header that claims more than
// the maximum (before allocating).
func (f *Framer) Read(r io.Reader) ([]byte, error) {
	var hdr [4]byte
	if _, err := io.ReadFull(r, hdr[:]); err != nil {
		return nil, err // includes io.EOF on clean close
	}
	n := binary.BigEndian.Uint32(hdr[:])
	if int64(n) > int64(f.max) {
		return nil, fmt.Errorf("%w (%d > %d)", ErrFrameTooLarge, n, f.max)
	}
	buf := make([]byte, n)
	if _, err := io.ReadFull(r, buf); err != nil {
		return nil, fmt.Errorf("transport: read frame payload: %w", err)
	}
	return buf, nil
}
