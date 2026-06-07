// Package state implements the engine's authoritative, in-memory store of typed
// live state values (TRD 2B §2 / ADR-0019).
//
// Values are stored TYPED, not as formatted strings: system.cpu.temp holds 42.0
// (a number), never "42.0 °C". This lets the flow engine compare numerically
// (system.cpu.temp > 85) and gauges use the raw number; units/precision are a
// render-time concern. Series ring buffers live only in memory and are NEVER
// persisted (ADR-0014, TB-ST-3).
package state

// StateKind classifies a state value (2B §2.1).
type StateKind string

const (
	KindScalar  StateKind = "scalar"  // numeric (e.g. cpu temp)
	KindText    StateKind = "text"    // free string
	KindBoolean StateKind = "boolean" // true/false
	KindEnum    StateKind = "enum"    // one of a fixed set (stored as string)
	KindSeries  StateKind = "series"  // numeric with an in-memory ring buffer
)

// Value types, the wire-neutral type tag of a State's Value.
const (
	TypeNumber = "number"
	TypeString = "string"
	TypeBool   = "bool"
)

// State is one entry in the store (2B §2.1). Value holds the typed native value
// (float64 for numbers, string, or bool). Series is non-nil only for KindSeries.
type State struct {
	ID        string      // "system.cpu.temp"
	Kind      StateKind   // scalar | text | boolean | enum | series
	ValueType string      // number | string | bool
	Unit      string      // presentation hint only ("°C")
	Value     any         // TYPED native value (42.0), not "42.0 °C" (ADR-0019)
	Series    *RingBuffer // non-nil for Kind==series (in-memory only)
	UpdatedAt int64       // last-change timestamp (unix millis)
	Source    string      // "plugin:core.telemetry"
}

// StateDef declares a state's metadata. Providers declare their states (from
// their registry descriptor) so the store knows the typing before values flow.
type StateDef struct {
	ID             string
	Kind           StateKind
	ValueType      string
	Unit           string
	Source         string
	SeriesCapacity int // for KindSeries; 0 uses the store default
}

// clone returns a copy safe to hand to callers: the Series buffer (if any) is
// snapshotted so external code can never mutate or race the live buffer.
func (s *State) clone() State {
	c := *s
	if s.Series != nil {
		c.Series = s.Series.snapshot()
	}
	return c
}
