package pluginhost

import (
	"io"
	"log"
	"sync"
	"testing"
	"time"
)

func quietHost() *Host {
	return NewHost(WithLogger(log.New(io.Discard, "", 0)), WithHeartbeatTimeout(150*time.Millisecond))
}

type unavailableRec struct {
	mu  sync.Mutex
	ids []string
}

func (r *unavailableRec) mark(id string) {
	r.mu.Lock()
	r.ids = append(r.ids, id)
	r.mu.Unlock()
}
func (r *unavailableRec) snapshot() []string {
	r.mu.Lock()
	defer r.mu.Unlock()
	return append([]string(nil), r.ids...)
}

func TestSupervisorRestartsThenFaults(t *testing.T) {
	rec := &unavailableRec{}
	sup := NewSupervisor(quietHost(), spec("crash"),
		WithMaxRestarts(2),
		WithBackoff(func(int) time.Duration { return 0 }),
		WithSetUnavailable(rec.mark),
	)
	if err := sup.Start(); err != nil {
		t.Fatalf("Start: %v", err)
	}
	defer sup.Stop()

	select {
	case <-sup.Faulted():
	case <-time.After(10 * time.Second):
		t.Fatal("crash-looping plugin never faulted")
	}
	if sup.Status() != StatusFaulted {
		t.Errorf("status = %s, want FAULTED", sup.Status())
	}
	if sup.Restarts() != 2 {
		t.Errorf("restarts = %d, want 2 (maxRestarts)", sup.Restarts())
	}
	// Faulted plugin's declared state is marked unavailable; contributions remain
	// registered (we never unregister).
	ids := rec.snapshot()
	if len(ids) != 1 || ids[0] != "test.state" {
		t.Errorf("unavailable states = %v, want [test.state]", ids)
	}
}

func TestEngineSurvivesInducedPanic(t *testing.T) { // P1-AC-13
	sup := NewSupervisor(quietHost(), spec("panic"),
		WithMaxRestarts(1),
		WithBackoff(func(int) time.Duration { return 0 }),
	)
	if err := sup.Start(); err != nil {
		t.Fatalf("Start: %v", err)
	}
	defer sup.Stop()

	select {
	case <-sup.Faulted():
	case <-time.After(10 * time.Second):
		t.Fatal("panicking plugin never faulted")
	}
	// Reaching here proves the engine (this test process) survived the induced
	// plugin panics — a plugin crash never takes down the engine (NFR-07).
	if sup.Status() != StatusFaulted {
		t.Errorf("status = %s, want FAULTED", sup.Status())
	}
}

func TestSupervisorNormalStaysReady(t *testing.T) {
	sup := NewSupervisor(quietHost(), spec("normal"),
		WithMaxRestarts(2),
		WithBackoff(func(int) time.Duration { return 0 }),
	)
	if err := sup.Start(); err != nil {
		t.Fatalf("Start: %v", err)
	}
	defer sup.Stop()

	// Give it time to (not) misbehave.
	select {
	case <-sup.Faulted():
		t.Fatal("healthy plugin faulted unexpectedly")
	case <-time.After(500 * time.Millisecond):
	}
	if sup.Status() != StatusReady {
		t.Errorf("status = %s, want READY", sup.Status())
	}
	if sup.Restarts() != 0 {
		t.Errorf("restarts = %d, want 0", sup.Restarts())
	}
}
