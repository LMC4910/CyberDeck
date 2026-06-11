package state

// This file defines the two outbound seams the store writes to. Per the PROJ-160
// implementation notes, the event bus (PROJ-162) and the fan-out (PROJ-150) may
// not exist yet, so the store depends only on these interfaces and uses no-op
// implementations by default; real implementations are injected later.

// StateChangedEvent is emitted on the event bus whenever a state value changes.
// Threshold checks and flow stateChange triggers consume it (2B §4).
type StateChangedEvent struct {
	ID        string
	Kind      StateKind
	ValueType string
	Value     any
	UpdatedAt int64
	Source    string
}

// EventEmitter is the event-bus seam (PROJ-162). The store emits state.changed.
type EventEmitter interface {
	EmitStateChanged(ev StateChangedEvent)
}

// Delta is a single changed-state record enqueued for client fan-out (2A state
// channel). Only changed states are enqueued — the delta-suppression that drives
// the ~80% idle-traffic reduction (TB-ST-2).
type Delta struct {
	ID        string `json:"id"`
	Value     any    `json:"value"`
	UpdatedAt int64  `json:"updatedAt"`
}

// DeltaSink is the fan-out seam (PROJ-150). The store enqueues deltas for the
// per-session subscription filtering and broadcast that fan-out owns.
type DeltaSink interface {
	EnqueueDelta(d Delta)
}

// nopEmitter / nopSink are the defaults used before PROJ-162/PROJ-150 are wired.
type nopEmitter struct{}

func (nopEmitter) EmitStateChanged(StateChangedEvent) {}

type nopSink struct{}

func (nopSink) EnqueueDelta(Delta) {}
