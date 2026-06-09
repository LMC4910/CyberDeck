package flow

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/shishir/cyberdeck/engine/core/flow/expr"
)

// Trigger kinds (2D §6). manual/event/stateChange are live in V1; schedule is a
// reserved field — accepted and stored but with no scheduler (consumer is Phase 3).
const (
	TriggerManual      = "manual"
	TriggerEvent       = "event"
	TriggerStateChange = "stateChange"
	TriggerSchedule    = "schedule"
)

// TopicStateChanged mirrors eventbus.TopicStateChanged; declared here so the flow
// package stays decoupled from the eventbus package (the wiring layer bridges them).
const TopicStateChanged = "state.changed"

// DefaultDebounce guards a stateChange trigger against firing storms while a
// condition flaps around its threshold.
const DefaultDebounce = 250 * time.Millisecond

// BusEvent is the minimal view of an event-bus message a trigger consumes.
type BusEvent struct {
	Topic   string
	Payload any
}

// StateChangedPayload is the state.changed event payload a stateChange trigger
// reads: the changed state's id and its new value. The wiring layer adapts the
// state package's change event to this (keeping flow decoupled from state).
type StateChangedPayload struct {
	ID    string
	Value any
}

// Subscriber is the event-bus subscription seam (PROJ-162): subscribe to a topic,
// receive events, and cancel. Injected so the flow package does not import the
// concrete bus; the wiring layer adapts eventbus.Bus to this interface.
type Subscriber interface {
	Subscribe(topic string) (events <-chan BusEvent, cancel func())
}

// FlowRunner fires a flow run (a seam over the executor; typically Executor.Start
// keyed by flow id). A non-nil error means the run could not be started.
type FlowRunner interface {
	RunFlow(ctx context.Context, flowID string, trigger map[string]any) error
}

// TriggerManager arms a flow's trigger and fires the flow when it activates:
//   - manual       → FireManual(flowID) (bound to an interaction slot upstream).
//   - event        → a named engine event on the bus.
//   - stateChange  → state.changed events, evaluated against a sandboxed expr,
//     edge-triggered (fires once on the false→true crossing) and debounced.
//   - schedule     → config accepted + stored, never fires in V1 (reserved).
type TriggerManager struct {
	ctx      context.Context
	runner   FlowRunner
	bus      Subscriber
	resolver expr.Context // global states + vars, for stateChange evaluation
	debounce time.Duration
	now      func() time.Time

	mu    sync.Mutex
	armed map[string]*armed // flowID → armed trigger
}

type armed struct {
	flowID string
	kind   string
	cancel func() // unsubscribe + stop the consumer goroutine (nil for manual/schedule)
	config map[string]any
}

// TriggerOption configures a TriggerManager.
type TriggerOption func(*TriggerManager)

// WithDebounce sets the stateChange debounce window.
func WithDebounce(d time.Duration) TriggerOption {
	return func(m *TriggerManager) {
		if d > 0 {
			m.debounce = d
		}
	}
}

// WithTriggerClock injects the clock used for debounce (testing).
func WithTriggerClock(now func() time.Time) TriggerOption {
	return func(m *TriggerManager) {
		if now != nil {
			m.now = now
		}
	}
}

// WithResolver sets the global read view used to evaluate stateChange expressions.
func WithResolver(r expr.Context) TriggerOption {
	return func(m *TriggerManager) { m.resolver = r }
}

// NewTriggerManager builds a trigger manager. ctx bounds the lifetime of all armed
// subscriptions and the flow runs they start.
func NewTriggerManager(ctx context.Context, runner FlowRunner, bus Subscriber, opts ...TriggerOption) *TriggerManager {
	m := &TriggerManager{
		ctx:      ctx,
		runner:   runner,
		bus:      bus,
		debounce: DefaultDebounce,
		now:      time.Now,
		armed:    map[string]*armed{},
	}
	for _, o := range opts {
		o(m)
	}
	return m
}

// Arm registers and activates a flow's trigger. Re-arming a flow first disarms the
// previous registration. An unknown trigger kind is rejected.
func (m *TriggerManager) Arm(f *Flow) error {
	switch f.Trigger.Kind {
	case TriggerManual, TriggerEvent, TriggerStateChange, TriggerSchedule:
	default:
		return fmt.Errorf("flow: unknown trigger kind %q", f.Trigger.Kind)
	}
	m.Disarm(f.ID)

	a := &armed{flowID: f.ID, kind: f.Trigger.Kind, config: f.Trigger.Config}

	switch f.Trigger.Kind {
	case TriggerEvent:
		topic, _ := f.Trigger.Config["event"].(string)
		if topic == "" {
			return fmt.Errorf("flow %q: event trigger needs config.event", f.ID)
		}
		a.cancel = m.consume(topic, a, func(BusEvent) (bool, map[string]any) {
			return true, map[string]any{"event": topic}
		})
	case TriggerStateChange:
		condition, _ := f.Trigger.Config["expr"].(string)
		stateID, _ := f.Trigger.Config["stateId"].(string)
		edge := &edgeState{}
		a.cancel = m.consume(TopicStateChanged, a, func(ev BusEvent) (bool, map[string]any) {
			sc, ok := ev.Payload.(StateChangedPayload)
			if !ok {
				return false, nil
			}
			if stateID != "" && sc.ID != stateID {
				return false, nil // scoped to a specific state
			}
			return m.evalStateChange(condition, sc, edge), map[string]any{"stateId": sc.ID, "value": sc.Value}
		})
	case TriggerManual, TriggerSchedule:
		// manual fires via FireManual; schedule is reserved (no consumer in V1).
	}

	m.mu.Lock()
	m.armed[f.ID] = a
	m.mu.Unlock()
	return nil
}

// Disarm cancels a flow's trigger registration (idempotent).
func (m *TriggerManager) Disarm(flowID string) {
	m.mu.Lock()
	a := m.armed[flowID]
	delete(m.armed, flowID)
	m.mu.Unlock()
	if a != nil && a.cancel != nil {
		a.cancel()
	}
}

// Kind reports a flow's armed trigger kind (and whether it is armed). A reserved
// schedule trigger is armed/stored even though it never fires in V1.
func (m *TriggerManager) Kind(flowID string) (string, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	a, ok := m.armed[flowID]
	if !ok {
		return "", false
	}
	return a.kind, true
}

// Config returns the stored trigger config for an armed flow. For a reserved
// schedule trigger this is where the parsed cron/interval is retained (no consumer
// fires it in V1).
func (m *TriggerManager) Config(flowID string) (map[string]any, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	a, ok := m.armed[flowID]
	if !ok {
		return nil, false
	}
	return a.config, true
}

// FireManual fires a flow whose armed trigger is manual (e.g. from an interaction
// slot). It is a no-op error if the flow is not armed as manual.
func (m *TriggerManager) FireManual(flowID string, payload map[string]any) error {
	m.mu.Lock()
	a := m.armed[flowID]
	m.mu.Unlock()
	if a == nil || a.kind != TriggerManual {
		return fmt.Errorf("flow %q: no manual trigger armed", flowID)
	}
	trig := map[string]any{"kind": TriggerManual}
	for k, v := range payload {
		trig[k] = v
	}
	return m.runner.RunFlow(m.ctx, flowID, trig)
}

// consume subscribes to a topic and, for each event, calls decide → if it returns
// fire=true, starts the flow run with the supplied trigger payload. Returns a
// cancel that unsubscribes and stops the goroutine.
func (m *TriggerManager) consume(topic string, a *armed, decide func(BusEvent) (bool, map[string]any)) func() {
	events, unsub := m.bus.Subscribe(topic)
	done := make(chan struct{})
	go func() {
		for {
			select {
			case <-m.ctx.Done():
				return
			case ev, ok := <-events:
				if !ok {
					return
				}
				if fire, payload := decide(ev); fire {
					trig := map[string]any{"kind": a.kind}
					for k, v := range payload {
						trig[k] = v
					}
					_ = m.runner.RunFlow(m.ctx, a.flowID, trig)
				}
			case <-done:
				return
			}
		}
	}()
	return func() {
		close(done)
		unsub()
	}
}

// edgeState tracks the previous condition value (edge detection) and the last fire
// time (debounce) for a stateChange trigger. Owned by a single consumer goroutine.
type edgeState struct {
	wasTrue  bool
	lastFire time.Time
	primed   bool
}

// stateEventContext evaluates an expression with the changed state's value layered
// over the global resolver: the changed token resolves to the event's value, and
// any other token falls back to the global states/vars view.
type stateEventContext struct {
	id    string
	value any
	base  expr.Context
}

func (c stateEventContext) Lookup(token string) (any, bool) {
	if token == c.id {
		return c.value, true
	}
	if c.base != nil {
		return c.base.Lookup(token)
	}
	return nil, false
}

// evalStateChange evaluates the condition and applies edge-trigger + debounce: it
// returns true only on a false→true transition that is also outside the debounce
// window. A non-boolean / unavailable result is treated as false (expr safe default).
func (m *TriggerManager) evalStateChange(condition string, sc StateChangedPayload, e *edgeState) bool {
	v, err := expr.Eval(condition, stateEventContext{id: sc.ID, value: sc.Value, base: m.resolver})
	truthy := false
	if err == nil {
		if b, ok := v.(bool); ok {
			truthy = b
		}
	}
	defer func() { e.wasTrue, e.primed = truthy, true }()

	// Edge, not level: fire only on an observed false→true transition. The first
	// event after arming only establishes the baseline (primes) — a condition that
	// is already true at arm time is not a "crossing" and does not fire.
	rising := truthy && e.primed && !e.wasTrue
	if !rising {
		return false
	}
	now := m.now()
	if e.primed && !e.lastFire.IsZero() && now.Sub(e.lastFire) < m.debounce {
		return false // within debounce window — suppress the storm
	}
	e.lastFire = now
	return true
}
