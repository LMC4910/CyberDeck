package transport

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"

	"github.com/shishir/cyberdeck/engine/core/security/crypto"
)

// ErrSessionClosed is returned by Send after the session has torn down.
var ErrSessionClosed = errors.New("transport: session closed")

// Session is an authenticated, encrypted, multiplexed connection (2A §4/§5 / 2E
// §4). Post-handshake (PROJ-123 hands over the derived keys) every frame's payload
// is AEAD-encrypted with per-direction nonce counters. Reader and writer
// goroutines own the conn; teardown (on drop, tamper, or Close) cancels both and
// frees resources with no goroutine leak. It implements the transport.Session
// seam from PROJ-140 (DeviceUUID / Close).
type EncryptedSession struct {
	conn       Conn
	send       *crypto.Cipher // writer-goroutine only (monotonic nonce)
	recv       *crypto.Cipher // reader-goroutine only
	ser        Serializer
	framer     *Framer
	deviceUUID string

	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup

	outbound chan Envelope
	inbound  chan Envelope
	done     chan struct{}

	shutOnce   sync.Once
	errOnce    sync.Once
	err        error
	userClosed atomic.Bool
}

// SessionOption configures a Session.
type SessionOption func(*EncryptedSession)

// WithSerializer overrides the envelope serializer (default JSON).
func WithSerializer(s Serializer) SessionOption {
	return func(sess *EncryptedSession) {
		if s != nil {
			sess.ser = s
		}
	}
}

// WithFramer overrides the framer (default DefaultMaxFrameSize).
func WithFramer(f *Framer) SessionOption {
	return func(sess *EncryptedSession) {
		if f != nil {
			sess.framer = f
		}
	}
}

// NewSession builds an encrypted session over conn using the handshake-derived
// session keys. isInitiator selects the send/receive key direction (the device is
// the initiator, the engine the responder).
func NewEncryptedSession(conn Conn, keys *crypto.SessionKeys, isInitiator bool, deviceUUID string, opts ...SessionOption) (*EncryptedSession, error) {
	if conn == nil || keys == nil {
		return nil, errors.New("transport: NewEncryptedSession requires conn and keys")
	}
	send, err := crypto.NewCipher(keys.Send(isInitiator))
	if err != nil {
		return nil, err
	}
	recv, err := crypto.NewCipher(keys.Recv(isInitiator))
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithCancel(context.Background())
	s := &EncryptedSession{
		conn: conn, send: send, recv: recv,
		ser: JSONSerializer{}, framer: NewFramer(0), deviceUUID: deviceUUID,
		ctx: ctx, cancel: cancel,
		outbound: make(chan Envelope, 64),
		inbound:  make(chan Envelope, 64),
		done:     make(chan struct{}),
	}
	for _, o := range opts {
		o(s)
	}

	s.wg.Add(2)
	go s.readLoop()
	go s.writeLoop()
	// When both loops exit, close inbound and signal done.
	go func() {
		s.wg.Wait()
		close(s.inbound)
		close(s.done)
	}()
	return s, nil
}

// DeviceUUID returns the paired device's UUID (transport.Session).
func (s *EncryptedSession) DeviceUUID() string { return s.deviceUUID }

// Send queues an envelope for encrypted transmission. It returns ErrSessionClosed
// once the session is tearing down.
func (s *EncryptedSession) Send(env Envelope) error {
	select {
	case <-s.ctx.Done():
		return ErrSessionClosed
	case s.outbound <- env:
		return nil
	}
}

// Received returns the stream of decrypted inbound envelopes. It is closed on
// teardown. (Per-channel demux with backpressure policies is PROJ-143.)
func (s *EncryptedSession) Received() <-chan Envelope { return s.inbound }

// Done is closed when the session has fully torn down.
func (s *EncryptedSession) Done() <-chan struct{} { return s.done }

// Err returns the teardown cause (nil for a clean Close).
func (s *EncryptedSession) Err() error {
	if s.userClosed.Load() {
		return nil
	}
	return s.err
}

// Close tears the session down cleanly and waits for its goroutines to exit (no
// leak). Idempotent.
func (s *EncryptedSession) Close() error {
	s.userClosed.Store(true)
	s.shutdown()
	<-s.done
	return nil
}

func (s *EncryptedSession) shutdown() {
	s.shutOnce.Do(func() {
		s.cancel()
		_ = s.conn.Close() // unblocks a reader blocked in framer.Read
	})
}

// fail records the first teardown cause and shuts the session down.
func (s *EncryptedSession) fail(err error) {
	s.errOnce.Do(func() { s.err = err })
	s.shutdown()
}

func (s *EncryptedSession) readLoop() {
	defer s.wg.Done()
	for {
		record, err := s.framer.Read(s.conn)
		if err != nil {
			s.fail(err) // EOF on clean close, or read error
			return
		}
		plain, err := s.recv.Open(record, nil)
		if err != nil {
			s.fail(err) // AEAD auth failure (tamper) → tear down
			return
		}
		env, err := s.ser.Unmarshal(plain)
		if err != nil {
			s.fail(err)
			return
		}
		select {
		case <-s.ctx.Done():
			return
		case s.inbound <- env:
		}
	}
}

func (s *EncryptedSession) writeLoop() {
	defer s.wg.Done()
	for {
		select {
		case <-s.ctx.Done():
			return
		case env := <-s.outbound:
			plain, err := s.ser.Marshal(env)
			if err != nil {
				s.fail(err)
				return
			}
			record, err := s.send.Seal(plain, nil)
			if err != nil {
				s.fail(err)
				return
			}
			if err := s.framer.Write(s.conn, record); err != nil {
				s.fail(err)
				return
			}
		}
	}
}
