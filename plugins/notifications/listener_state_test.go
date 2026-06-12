package main

import (
	"bytes"
	"context"
	"sync"
	"testing"

	"github.com/shishir/cyberdeck/engine/pluginhost/ipcproto"
)

// decodeStateUpdates parses every newline-delimited IPC message in buf and returns
// the value of each notification.count stateUpdate, in order.
func decodeStateUpdates(t *testing.T, buf []byte) []int {
	t.Helper()
	var counts []int
	for _, line := range bytes.Split(buf, []byte("\n")) {
		if len(bytes.TrimSpace(line)) == 0 {
			continue
		}
		m, err := ipcproto.Decode(line)
		if err != nil {
			t.Fatalf("decode %q: %v", line, err)
		}
		if m.Type != ipcproto.MsgStateUpdate || m.State == nil {
			continue
		}
		if m.State.ID != stCount {
			t.Fatalf("stateUpdate id = %q, want %q", m.State.ID, stCount)
		}
		// JSON numbers decode to float64 through the any field.
		n, ok := m.State.Value.(float64)
		if !ok {
			t.Fatalf("count value %v (%T) is not numeric", m.State.Value, m.State.Value)
		}
		counts = append(counts, int(n))
	}
	return counts
}

// TestListenerCallbackPublishesCount is the listener->state integration test: it
// drives the exact callback main.go installs into startListener (setCount + publish)
// and asserts each listener event surfaces as a notification.count stateUpdate on the
// IPC wire with the right value. This covers the testable seam; the real per-OS
// listeners are documented no-op stubs in V1 (see listener_<goos>.go).
func TestListenerCallbackPublishesCount(t *testing.T) {
	var out bytes.Buffer
	w := &msgWriter{w: &out}
	prov := newProvider()

	// This is the callback wired in run(): a listener push updates the authoritative
	// count and immediately publishes it.
	onChange := func(n int) {
		prov.setCount(n)
		publish(w, prov)
	}

	onChange(3) // three notifications arrive
	onChange(5) // two more
	onChange(0) // action center cleared

	got := decodeStateUpdates(t, out.Bytes())
	want := []int{3, 5, 0}
	if len(got) != len(want) {
		t.Fatalf("published counts = %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("published counts = %v, want %v", got, want)
		}
	}
}

// TestPublishReflectsSnapshot asserts a bare publish emits exactly one stateUpdate
// carrying the provider's current snapshot (the cadence path in publishLoop).
func TestPublishReflectsSnapshot(t *testing.T) {
	var out bytes.Buffer
	w := &msgWriter{w: &out}
	prov := newProvider()
	prov.setCount(7)

	publish(w, prov)

	got := decodeStateUpdates(t, out.Bytes())
	if len(got) != 1 || got[0] != 7 {
		t.Fatalf("published counts = %v, want [7]", got)
	}
}

// TestStartListenerStubIsSafe documents the V1 contract: the per-OS listener is a
// no-op stub, so wiring it must not panic, must not publish, and must respect ctx.
// (Where a real listener lands, this still holds: it must not emit before an event.)
func TestStartListenerStubIsSafe(t *testing.T) {
	var out bytes.Buffer
	w := &msgWriter{w: &out}
	prov := newProvider()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	var once sync.Once
	called := false
	startListener(ctx, func(n int) {
		once.Do(func() { called = true })
		prov.setCount(n)
		publish(w, prov)
	})

	if called {
		t.Error("stub listener invoked the callback; V1 stub must be a no-op")
	}
	if out.Len() != 0 {
		t.Errorf("stub listener published %d bytes; want none", out.Len())
	}
}
