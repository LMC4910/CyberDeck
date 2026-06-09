package flow

import (
	"context"
	"sync"
	"testing"
	"time"
)

// --- fakes ---

type call struct {
	flowID  string
	trigger map[string]any
}

type fakeRunner struct{ calls chan call }

func newFakeRunner() *fakeRunner { return &fakeRunner{calls: make(chan call, 64)} }

func (r *fakeRunner) RunFlow(_ context.Context, id string, t map[string]any) error {
	r.calls <- call{id, t}
	return nil
}

// waitFire returns the next fire, or ok=false on timeout.
func (r *fakeRunner) waitFire(d time.Duration) (call, bool) {
	select {
	case c := <-r.calls:
		return c, true
	case <-time.After(d):
		return call{}, false
	}
}

type fakeBus struct {
	mu   sync.Mutex
	subs map[string][]chan BusEvent
}

func newFakeBus() *fakeBus { return &fakeBus{subs: map[string][]chan BusEvent{}} }

func (b *fakeBus) Subscribe(topic string) (<-chan BusEvent, func()) {
	ch := make(chan BusEvent, 32)
	b.mu.Lock()
	b.subs[topic] = append(b.subs[topic], ch)
	b.mu.Unlock()
	return ch, func() {}
}

func (b *fakeBus) emit(topic string, payload any) {
	b.mu.Lock()
	chans := append([]chan BusEvent(nil), b.subs[topic]...)
	b.mu.Unlock()
	for _, ch := range chans {
		ch <- BusEvent{Topic: topic, Payload: payload}
	}
}

// --- manual ---

func TestManualTriggerFires(t *testing.T) {
	r := newFakeRunner()
	m := NewTriggerManager(context.Background(), r, newFakeBus())
	if err := m.Arm(&Flow{ID: "f", Trigger: Trigger{Kind: TriggerManual}}); err != nil {
		t.Fatal(err)
	}
	if err := m.FireManual("f", map[string]any{"slot": "tap"}); err != nil {
		t.Fatal(err)
	}
	c, ok := r.waitFire(time.Second)
	if !ok || c.flowID != "f" || c.trigger["kind"] != TriggerManual || c.trigger["slot"] != "tap" {
		t.Errorf("manual fire = %+v (ok=%v)", c, ok)
	}
}

func TestFireManualUnarmedOrWrongKind(t *testing.T) {
	r := newFakeRunner()
	m := NewTriggerManager(context.Background(), r, newFakeBus())
	if err := m.FireManual("nope", nil); err == nil {
		t.Error("FireManual on an unarmed flow should error")
	}
	_ = m.Arm(&Flow{ID: "e", Trigger: Trigger{Kind: TriggerEvent, Config: map[string]any{"event": "x"}}})
	if err := m.FireManual("e", nil); err == nil {
		t.Error("FireManual on an event-armed flow should error")
	}
}

// --- event ---

func TestEventTriggerFires(t *testing.T) {
	r := newFakeRunner()
	bus := newFakeBus()
	m := NewTriggerManager(context.Background(), r, bus)
	if err := m.Arm(&Flow{ID: "f", Trigger: Trigger{
		Kind: TriggerEvent, Config: map[string]any{"event": "plugin.started"}}}); err != nil {
		t.Fatal(err)
	}
	bus.emit("plugin.started", map[string]any{"id": "telemetry"})
	c, ok := r.waitFire(time.Second)
	if !ok || c.flowID != "f" || c.trigger["event"] != "plugin.started" {
		t.Errorf("event fire = %+v (ok=%v)", c, ok)
	}
}

func TestEventTriggerNeedsConfig(t *testing.T) {
	m := NewTriggerManager(context.Background(), newFakeRunner(), newFakeBus())
	if err := m.Arm(&Flow{ID: "f", Trigger: Trigger{Kind: TriggerEvent}}); err == nil {
		t.Error("event trigger without config.event should error")
	}
}

// --- stateChange: edge + debounce ---

func TestStateChangeEdgeTriggered(t *testing.T) {
	r := newFakeRunner()
	bus := newFakeBus()
	m := NewTriggerManager(context.Background(), r, bus)
	if err := m.Arm(&Flow{ID: "f", Trigger: Trigger{
		Kind: TriggerStateChange, Config: map[string]any{"stateId": "x", "expr": "x > 85"}}}); err != nil {
		t.Fatal(err)
	}

	// baseline false → prime (no fire), then false→true crossing → one fire.
	bus.emit(TopicStateChanged, StateChangedPayload{ID: "x", Value: 50.0})
	bus.emit(TopicStateChanged, StateChangedPayload{ID: "x", Value: 90.0})
	if c, ok := r.waitFire(time.Second); !ok || c.trigger["stateId"] != "x" {
		t.Fatalf("expected one fire on the crossing, got %+v (ok=%v)", c, ok)
	}

	// staying true must NOT re-fire (edge, not level).
	bus.emit(TopicStateChanged, StateChangedPayload{ID: "x", Value: 91.0})
	if _, ok := r.waitFire(150 * time.Millisecond); ok {
		t.Error("a still-true condition must not re-fire (edge-trigger)")
	}

	// a change to an unrelated state is ignored (scoped to stateId "x").
	bus.emit(TopicStateChanged, StateChangedPayload{ID: "y", Value: 99.0})
	if _, ok := r.waitFire(150 * time.Millisecond); ok {
		t.Error("a change to an unrelated state must not fire a scoped trigger")
	}
}

func TestStateChangeDebounced(t *testing.T) {
	r := newFakeRunner()
	bus := newFakeBus()

	var clk struct {
		mu sync.Mutex
		t  time.Time
	}
	clk.t = time.Unix(0, 0)
	now := func() time.Time { clk.mu.Lock(); defer clk.mu.Unlock(); return clk.t }
	advance := func(d time.Duration) { clk.mu.Lock(); clk.t = clk.t.Add(d); clk.mu.Unlock() }

	m := NewTriggerManager(context.Background(), r, bus,
		WithTriggerClock(now), WithDebounce(100*time.Millisecond))
	if err := m.Arm(&Flow{ID: "f", Trigger: Trigger{
		Kind: TriggerStateChange, Config: map[string]any{"expr": "x > 85"}}}); err != nil {
		t.Fatal(err)
	}
	low := func() { bus.emit(TopicStateChanged, StateChangedPayload{ID: "x", Value: 50.0}) }
	high := func() { bus.emit(TopicStateChanged, StateChangedPayload{ID: "x", Value: 90.0}) }

	// First crossing fires (at clock T0).
	low()
	high()
	if _, ok := r.waitFire(time.Second); !ok {
		t.Fatal("first crossing should fire")
	}

	// Second crossing within the debounce window (clock unchanged) → suppressed.
	low()
	high()
	if _, ok := r.waitFire(150 * time.Millisecond); ok {
		t.Error("a crossing within the debounce window must be suppressed")
	}

	// After the debounce window elapses, a fresh crossing fires again.
	advance(500 * time.Millisecond)
	low()
	high()
	if _, ok := r.waitFire(time.Second); !ok {
		t.Error("a crossing after the debounce window should fire")
	}
}

// --- schedule reserved + unknown + disarm ---

func TestScheduleReservedNeverFires(t *testing.T) {
	r := newFakeRunner()
	bus := newFakeBus()
	m := NewTriggerManager(context.Background(), r, bus)
	if err := m.Arm(&Flow{ID: "f", Trigger: Trigger{
		Kind: TriggerSchedule, Config: map[string]any{"cron": "*/5 * * * *"}}}); err != nil {
		t.Fatal(err)
	}
	if k, ok := m.Kind("f"); !ok || k != TriggerSchedule {
		t.Errorf("schedule trigger should be stored, got %q ok=%v", k, ok)
	}
	if cfg, ok := m.Config("f"); !ok || cfg["cron"] != "*/5 * * * *" {
		t.Errorf("schedule config should be retained, got %v ok=%v", cfg, ok)
	}
	// No scheduler in V1: nothing fires, even as the bus churns.
	bus.emit(TopicStateChanged, nil)
	if _, ok := r.waitFire(150 * time.Millisecond); ok {
		t.Error("a reserved schedule trigger must not fire in V1")
	}
}

func TestUnknownTriggerRejected(t *testing.T) {
	m := NewTriggerManager(context.Background(), newFakeRunner(), newFakeBus())
	if err := m.Arm(&Flow{ID: "f", Trigger: Trigger{Kind: "telepathy"}}); err == nil {
		t.Error("an unknown trigger kind should be rejected")
	}
}

func TestDisarmStopsFiring(t *testing.T) {
	r := newFakeRunner()
	bus := newFakeBus()
	m := NewTriggerManager(context.Background(), r, bus)
	_ = m.Arm(&Flow{ID: "f", Trigger: Trigger{
		Kind: TriggerEvent, Config: map[string]any{"event": "e"}}})
	m.Disarm("f")
	if _, ok := m.Kind("f"); ok {
		t.Error("disarmed flow should no longer be armed")
	}
	bus.emit("e", nil)
	if _, ok := r.waitFire(150 * time.Millisecond); ok {
		t.Error("a disarmed event trigger must not fire")
	}
}
