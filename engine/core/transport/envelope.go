package transport

import "sync"

// ProtocolVersion is the wire envelope version (Master §6.3).
const ProtocolVersion = 1

// Channel identifies the logical channel an envelope rides (2A §6 / ADR-0011).
type Channel string

const (
	ChannelState   Channel = "state"   // delta state updates, coalesced/droppable
	ChannelLayout  Channel = "layout"  // versioned ops, ordered/lossless
	ChannelPreview Channel = "preview" // drag ghosts, drop-on-overflow
	ChannelControl Channel = "control" // loopback-only privileged ops
)

// Envelope is the shared wire envelope (Master §6.3). Payload carries the
// already-encoded inner message bytes (opaque to the transport), so the envelope
// is codec-agnostic. seq is per-channel monotonic, enabling gap detection (§7.4).
type Envelope struct {
	V       int     `json:"v"`
	Ch      Channel `json:"ch"`
	Type    string  `json:"type"`
	Seq     uint64  `json:"seq"`
	TS      int64   `json:"ts"`
	Payload []byte  `json:"payload"`
}

// SeqCounter issues per-channel monotonic sequence numbers (starting at 1). Safe
// for concurrent use.
type SeqCounter struct {
	mu   sync.Mutex
	seqs map[Channel]uint64
}

// NewSeqCounter creates an empty per-channel sequence counter.
func NewSeqCounter() *SeqCounter {
	return &SeqCounter{seqs: make(map[Channel]uint64)}
}

// Next returns the next sequence number for the channel (1, 2, 3, …),
// independently per channel.
func (s *SeqCounter) Next(ch Channel) uint64 {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.seqs[ch]++
	return s.seqs[ch]
}
