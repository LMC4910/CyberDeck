package session_test

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/shishir/cyberdeck/engine/core/session"
	"github.com/shishir/cyberdeck/engine/core/state"
	"github.com/shishir/cyberdeck/engine/core/transport"
)

// recordSession satisfies the mux's sessionLike seam, recording outbound envelopes.
type recordSession struct {
	mu   sync.Mutex
	sent []transport.Envelope
	in   chan transport.Envelope
}

func (r *recordSession) Send(e transport.Envelope) error {
	r.mu.Lock()
	r.sent = append(r.sent, e)
	r.mu.Unlock()
	return nil
}
func (r *recordSession) Received() <-chan transport.Envelope { return r.in }

func (r *recordSession) count() int {
	r.mu.Lock()
	defer r.mu.Unlock()
	return len(r.sent)
}

func TestStatePumpFansChangedStateToSubscriber(t *testing.T) {
	store := state.New()
	fanout := transport.NewFanout()

	rec := &recordSession{in: make(chan transport.Envelope)}
	mux := transport.NewChannelMux(rec, 0, 0)
	defer mux.Close()
	fanout.Add(&transport.Subscriber{
		DeviceUUID: "d1",
		Subs:       state.NewSubscriptionSet("system.cpu.percent"),
		Mux:        mux,
	})

	pump := session.NewStatePump(store, fanout, 15*time.Millisecond, testLogger())
	if err := pump.Start(context.Background()); err != nil {
		t.Fatalf("Start: %v", err)
	}
	defer func() { _ = pump.Stop(context.Background()) }()

	// A subscribed state change is fanned out.
	_ = store.Set("system.cpu.percent", 73.0)
	// An unsubscribed state change is filtered (never sent to this device).
	_ = store.Set("system.gpu.percent", 99.0)

	deadline := time.After(2 * time.Second)
	for rec.count() == 0 {
		select {
		case <-deadline:
			t.Fatal("pump did not fan the changed state to the subscriber")
		case <-time.After(10 * time.Millisecond):
		}
	}

	rec.mu.Lock()
	defer rec.mu.Unlock()
	for _, env := range rec.sent {
		if env.Type != "state.delta" || env.Ch != transport.ChannelState {
			t.Errorf("unexpected envelope %+v", env)
		}
	}
}
