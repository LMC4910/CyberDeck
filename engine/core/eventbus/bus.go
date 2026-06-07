package eventbus

import (
	"log"
	"sync"
)

// DefaultQueueSize is the per-subscriber buffer depth.
const DefaultQueueSize = 64

// Bus is an in-process, topic-based publish/subscribe hub. All operations are
// safe for concurrent use. Publish is non-blocking: if a subscriber's bounded
// queue is full, the event is dropped for that subscriber and the overflow is
// reported — a slow consumer can never block a producer or another subscriber.
type Bus struct {
	mu         sync.Mutex
	subs       map[Topic]map[*subscription]struct{}
	queueSize  int
	onOverflow func(topic Topic, ev Event)
	closed     bool
}

type subscription struct {
	ch chan Event
}

// Option configures a Bus.
type Option func(*Bus)

// WithQueueSize sets the per-subscriber buffer depth (min 1).
func WithQueueSize(n int) Option {
	return func(b *Bus) {
		if n > 0 {
			b.queueSize = n
		}
	}
}

// WithOverflowHandler sets the callback invoked when an event is dropped for a
// full subscriber. The default logs a warning.
func WithOverflowHandler(fn func(topic Topic, ev Event)) Option {
	return func(b *Bus) {
		if fn != nil {
			b.onOverflow = fn
		}
	}
}

// New creates a Bus.
func New(opts ...Option) *Bus {
	b := &Bus{
		subs:      make(map[Topic]map[*subscription]struct{}),
		queueSize: DefaultQueueSize,
		onOverflow: func(topic Topic, _ Event) {
			log.Printf("WARNING eventbus: subscriber queue full on topic %q; dropping event", topic)
		},
	}
	for _, o := range opts {
		o(b)
	}
	return b
}

// Subscribe returns a receive channel for the topic and an unsubscribe function.
// The channel is closed by unsubscribe (or Close). The unsubscribe func is
// idempotent.
func (b *Bus) Subscribe(topic Topic) (<-chan Event, func()) {
	b.mu.Lock()
	defer b.mu.Unlock()

	sub := &subscription{ch: make(chan Event, b.queueSize)}
	if b.closed {
		close(sub.ch)
		return sub.ch, func() {}
	}
	if b.subs[topic] == nil {
		b.subs[topic] = make(map[*subscription]struct{})
	}
	b.subs[topic][sub] = struct{}{}

	var once sync.Once
	unsub := func() {
		once.Do(func() {
			b.mu.Lock()
			defer b.mu.Unlock()
			if set, ok := b.subs[topic]; ok {
				if _, present := set[sub]; present {
					delete(set, sub)
					close(sub.ch)
				}
				if len(set) == 0 {
					delete(b.subs, topic)
				}
			}
		})
	}
	return sub.ch, unsub
}

// Publish delivers an event to every subscriber of its topic, in publish order,
// without blocking. Subscribers whose queue is full have the event dropped (and
// the overflow handler called).
func (b *Bus) Publish(topic Topic, payload any) {
	ev := Event{Topic: topic, Payload: payload}
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.closed {
		return
	}
	for sub := range b.subs[topic] {
		select {
		case sub.ch <- ev:
		default:
			b.onOverflow(topic, ev)
		}
	}
}

// Close shuts the bus, closing all subscriber channels. Further Publish calls are
// no-ops and Subscribe returns a closed channel.
func (b *Bus) Close() {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.closed {
		return
	}
	b.closed = true
	for topic, set := range b.subs {
		for sub := range set {
			close(sub.ch)
		}
		delete(b.subs, topic)
	}
}
