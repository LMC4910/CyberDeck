package eventbus

import (
	"sync"
	"sync/atomic"
	"testing"
)

const testTopic Topic = "state.changed"

func TestPublishOrderingAndFanout(t *testing.T) {
	bus := New(WithQueueSize(128))
	defer bus.Close()

	chA, _ := bus.Subscribe(testTopic)
	chB, _ := bus.Subscribe(testTopic)

	const n = 50
	for i := 0; i < n; i++ {
		bus.Publish(testTopic, i)
	}

	check := func(name string, ch <-chan Event) {
		for i := 0; i < n; i++ {
			ev := <-ch
			if ev.Payload.(int) != i {
				t.Fatalf("%s: event %d out of order, got %v", name, i, ev.Payload)
			}
		}
	}
	check("A", chA)
	check("B", chB)
}

// TestSlowConsumerIsolation proves Publish never blocks on a full subscriber, the
// overflow is reported, and each subscriber has its own independent queue.
func TestSlowConsumerIsolation(t *testing.T) {
	var overflow atomic.Int64
	bus := New(WithQueueSize(5), WithOverflowHandler(func(Topic, Event) { overflow.Add(1) }))
	defer bus.Close()

	chA, _ := bus.Subscribe(testTopic) // never drained until the end
	chB, _ := bus.Subscribe(testTopic) // also not drained — independent queue

	// Fill both queues exactly.
	for i := 0; i < 5; i++ {
		bus.Publish(testTopic, i)
	}
	if overflow.Load() != 0 {
		t.Fatalf("unexpected overflow while filling: %d", overflow.Load())
	}
	// Two more publishes overflow both subscribers (2 subs × 2 events = 4 drops),
	// and crucially these calls return — Publish does not block on full queues.
	bus.Publish(testTopic, 99)
	bus.Publish(testTopic, 100)
	if got := overflow.Load(); got != 4 {
		t.Fatalf("overflow count = %d, want 4", got)
	}

	// A's queue still holds the first 5 in order (overflowed events dropped).
	for i := 0; i < 5; i++ {
		if ev := <-chA; ev.Payload.(int) != i {
			t.Fatalf("A out of order at %d: %v", i, ev.Payload)
		}
	}
	// B is independent and likewise holds its own first 5.
	for i := 0; i < 5; i++ {
		if ev := <-chB; ev.Payload.(int) != i {
			t.Fatalf("B out of order at %d: %v", i, ev.Payload)
		}
	}
}

func TestUnsubscribeClosesChannel(t *testing.T) {
	bus := New()
	defer bus.Close()
	ch, unsub := bus.Subscribe(testTopic)

	bus.Publish(testTopic, 1)
	if ev := <-ch; ev.Payload.(int) != 1 {
		t.Fatalf("got %v, want 1", ev.Payload)
	}
	unsub()
	if _, ok := <-ch; ok {
		t.Error("channel not closed after unsubscribe")
	}
	unsub() // idempotent — must not panic
	bus.Publish(testTopic, 2) // must not panic (no subscribers)
}

func TestTopicIsolation(t *testing.T) {
	bus := New()
	defer bus.Close()
	chA, _ := bus.Subscribe(Topic("a"))

	bus.Publish(Topic("b"), "for-b")
	bus.Publish(Topic("a"), "for-a")

	ev := <-chA
	if ev.Payload != "for-a" {
		t.Errorf("topic a received %v, want for-a (topic b leaked?)", ev.Payload)
	}
	if len(chA) != 0 {
		t.Errorf("topic a queue should be empty, has %d", len(chA))
	}
}

func TestClosedBus(t *testing.T) {
	bus := New()
	bus.Close()
	bus.Publish(testTopic, 1) // no-op, no panic
	ch, _ := bus.Subscribe(testTopic)
	if _, ok := <-ch; ok {
		t.Error("subscribe after close should return a closed channel")
	}
}

// TestConcurrentPublishSubscribe exercises the bus under concurrent producers and
// churn; run with -race it asserts no data races.
func TestConcurrentPublishSubscribe(t *testing.T) {
	bus := New(WithQueueSize(16))
	defer bus.Close()

	var wg sync.WaitGroup
	// Churning subscribers.
	for i := 0; i < 4; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < 100; j++ {
				ch, unsub := bus.Subscribe(testTopic)
				go func() {
					for range ch {
					}
				}()
				unsub()
			}
		}()
	}
	// Concurrent publishers.
	for i := 0; i < 4; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < 500; j++ {
				bus.Publish(testTopic, j)
			}
		}()
	}
	wg.Wait()
}
