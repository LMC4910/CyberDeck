package state

// RingBuffer is a fixed-size, in-memory ring of numeric samples for KindSeries
// states (e.g. a 60-sample sparkline window). When full, the oldest sample is
// evicted. Series buffers are never persisted (ADR-0014, TB-ST-3).
//
// RingBuffer is not safe for concurrent use on its own; the store holds its lock
// around all access, and hands out only snapshots.
type RingBuffer struct {
	buf   []float64
	start int // index of the oldest sample
	count int // number of valid samples
}

// NewRingBuffer creates a ring of the given capacity (minimum 1).
func NewRingBuffer(capacity int) *RingBuffer {
	if capacity < 1 {
		capacity = 1
	}
	return &RingBuffer{buf: make([]float64, capacity)}
}

// Cap returns the buffer capacity.
func (r *RingBuffer) Cap() int { return len(r.buf) }

// Len returns the number of valid samples currently held.
func (r *RingBuffer) Len() int { return r.count }

// Push appends a sample, evicting the oldest when full.
func (r *RingBuffer) Push(v float64) {
	if r.count < len(r.buf) {
		r.buf[(r.start+r.count)%len(r.buf)] = v
		r.count++
		return
	}
	// full: overwrite oldest and advance start
	r.buf[r.start] = v
	r.start = (r.start + 1) % len(r.buf)
}

// Last returns the most recent sample and whether one exists.
func (r *RingBuffer) Last() (float64, bool) {
	if r.count == 0 {
		return 0, false
	}
	return r.buf[(r.start+r.count-1)%len(r.buf)], true
}

// Values returns the samples oldest→newest as a fresh slice.
func (r *RingBuffer) Values() []float64 {
	out := make([]float64, r.count)
	for i := 0; i < r.count; i++ {
		out[i] = r.buf[(r.start+i)%len(r.buf)]
	}
	return out
}

// snapshot returns a deep copy of the buffer.
func (r *RingBuffer) snapshot() *RingBuffer {
	cp := &RingBuffer{
		buf:   make([]float64, len(r.buf)),
		start: r.start,
		count: r.count,
	}
	copy(cp.buf, r.buf)
	return cp
}
