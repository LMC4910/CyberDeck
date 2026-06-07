package transport

import (
	"context"
	"sync"
)

// Three logical channels multiplex one session (2A §6 / ADR-0011), differing by
// cadence and durability — not by socket. Each has a distinct backpressure policy
// so a per-second CPU update (State, droppable) can never block or pollute a
// layout op (Layout, durable, ordered):
//
//   - State:   coalesce by state-id, latest-wins, older dropped (a slow client
//     gets the latest value, not a backlog).
//   - Layout:  ordered and lossless — never dropped (gap→resync is PROJ-149).
//   - Preview: bounded, drop-oldest-on-overflow, never blocks (pure UX nicety).

// DefaultPreviewDepth bounds the preview queue.
const DefaultPreviewDepth = 8

// stateQueue coalesces envelopes by state-id, keeping the latest per id in
// first-seen order.
type stateQueue struct {
	mu     sync.Mutex
	order  []string
	latest map[string]Envelope
}

func newStateQueue() *stateQueue { return &stateQueue{latest: make(map[string]Envelope)} }

func (q *stateQueue) push(id string, env Envelope) {
	q.mu.Lock()
	defer q.mu.Unlock()
	if _, ok := q.latest[id]; !ok {
		q.order = append(q.order, id)
	}
	q.latest[id] = env
}

func (q *stateQueue) drain() []Envelope {
	q.mu.Lock()
	defer q.mu.Unlock()
	out := make([]Envelope, 0, len(q.order))
	for _, id := range q.order {
		out = append(out, q.latest[id])
	}
	q.order = nil
	q.latest = make(map[string]Envelope)
	return out
}

// layoutQueue is an ordered, lossless FIFO — it never drops.
type layoutQueue struct {
	mu    sync.Mutex
	items []Envelope
}

func (q *layoutQueue) push(env Envelope) {
	q.mu.Lock()
	q.items = append(q.items, env)
	q.mu.Unlock()
}

func (q *layoutQueue) drain() []Envelope {
	q.mu.Lock()
	defer q.mu.Unlock()
	out := q.items
	q.items = nil
	return out
}

// previewQueue is a bounded ring that drops the oldest on overflow.
type previewQueue struct {
	mu      sync.Mutex
	items   []Envelope
	max     int
	dropped int
}

func newPreviewQueue(max int) *previewQueue {
	if max < 1 {
		max = DefaultPreviewDepth
	}
	return &previewQueue{max: max}
}

func (q *previewQueue) push(env Envelope) {
	q.mu.Lock()
	defer q.mu.Unlock()
	q.items = append(q.items, env)
	for len(q.items) > q.max {
		q.items = q.items[1:] // drop oldest, keep latest
		q.dropped++
	}
}

func (q *previewQueue) drain() []Envelope {
	q.mu.Lock()
	defer q.mu.Unlock()
	out := q.items
	q.items = nil
	return out
}

// sessionLike is the part of EncryptedSession the mux needs.
type sessionLike interface {
	Send(Envelope) error
	Received() <-chan Envelope
}

// ChannelMux applies the per-channel send policies over a session and demuxes
// inbound envelopes by channel. seq is assigned per channel on enqueue.
type ChannelMux struct {
	sess    sessionLike
	seq     *SeqCounter
	state   *stateQueue
	layout  *layoutQueue
	preview *previewQueue

	inState   chan Envelope
	inLayout  chan Envelope
	inPreview chan Envelope
	inControl chan Envelope

	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup
}

// NewChannelMux builds a mux over a session and starts the inbound demux.
func NewChannelMux(sess sessionLike, previewDepth, inboundDepth int) *ChannelMux {
	if inboundDepth < 1 {
		inboundDepth = 64
	}
	ctx, cancel := context.WithCancel(context.Background())
	m := &ChannelMux{
		sess: sess, seq: NewSeqCounter(),
		state: newStateQueue(), layout: &layoutQueue{}, preview: newPreviewQueue(previewDepth),
		inState:   make(chan Envelope, inboundDepth),
		inLayout:  make(chan Envelope, inboundDepth),
		inPreview: make(chan Envelope, inboundDepth),
		inControl: make(chan Envelope, inboundDepth),
		ctx:       ctx, cancel: cancel,
	}
	m.wg.Add(1)
	go m.demuxLoop()
	return m
}

// SendState enqueues a State update, coalescing by state-id (latest wins).
func (m *ChannelMux) SendState(stateID string, env Envelope) {
	env.Ch = ChannelState
	env.Seq = m.seq.Next(ChannelState)
	m.state.push(stateID, env)
}

// SendLayout enqueues a Layout op (ordered, lossless).
func (m *ChannelMux) SendLayout(env Envelope) {
	env.Ch = ChannelLayout
	env.Seq = m.seq.Next(ChannelLayout)
	m.layout.push(env)
}

// SendPreview enqueues a Preview frame (drop-oldest on overflow).
func (m *ChannelMux) SendPreview(env Envelope) {
	env.Ch = ChannelPreview
	env.Seq = m.seq.Next(ChannelPreview)
	m.preview.push(env)
}

// Flush drains the queues to the session in priority order: Layout (lossless)
// first, then coalesced State, then Preview. Returns the first send error.
func (m *ChannelMux) Flush() error {
	for _, env := range m.layout.drain() {
		if err := m.sess.Send(env); err != nil {
			return err
		}
	}
	for _, env := range m.state.drain() {
		if err := m.sess.Send(env); err != nil {
			return err
		}
	}
	for _, env := range m.preview.drain() {
		if err := m.sess.Send(env); err != nil {
			return err
		}
	}
	return nil
}

// Inbound accessors (per-channel receive streams).
func (m *ChannelMux) StateInbound() <-chan Envelope   { return m.inState }
func (m *ChannelMux) LayoutInbound() <-chan Envelope  { return m.inLayout }
func (m *ChannelMux) PreviewInbound() <-chan Envelope { return m.inPreview }
func (m *ChannelMux) ControlInbound() <-chan Envelope { return m.inControl }

// Close stops the demux loop.
func (m *ChannelMux) Close() {
	m.cancel()
	m.wg.Wait()
}

func (m *ChannelMux) demuxLoop() {
	defer m.wg.Done()
	in := m.sess.Received()
	for {
		select {
		case <-m.ctx.Done():
			return
		case env, ok := <-in:
			if !ok {
				return
			}
			m.route(env)
		}
	}
}

func (m *ChannelMux) route(env Envelope) {
	switch env.Ch {
	case ChannelLayout:
		m.deliverLossless(m.inLayout, env)
	case ChannelControl:
		m.deliverLossless(m.inControl, env)
	case ChannelState:
		m.deliverDroppable(m.inState, env)
	case ChannelPreview:
		m.deliverDroppable(m.inPreview, env)
	}
}

// deliverLossless blocks until the envelope is delivered (or the mux closes), so
// Layout/Control are never dropped.
func (m *ChannelMux) deliverLossless(ch chan Envelope, env Envelope) {
	select {
	case ch <- env:
	case <-m.ctx.Done():
	}
}

// deliverDroppable delivers if there's room, else drops (State/Preview policy).
func (m *ChannelMux) deliverDroppable(ch chan Envelope, env Envelope) {
	select {
	case ch <- env:
	default:
	}
}
