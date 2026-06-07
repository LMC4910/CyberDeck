package state

import (
	"fmt"
	"sort"
	"sync"
	"time"
)

// DefaultSeriesCapacity is the ring-buffer size for series states when a
// StateDef does not specify one.
const DefaultSeriesCapacity = 60

// Store is the authoritative in-memory registry of all current state values
// (2B §2). It is safe for concurrent use; it sits on the telemetry hot path, so
// it holds its mutex only for the map work and runs consumer callbacks (emit /
// enqueue) outside the lock.
type Store struct {
	mu     sync.RWMutex
	states map[string]*State
	dirty  map[string]struct{}

	emitter   EventEmitter
	sink      DeltaSink
	seriesCap int
	now       func() int64
}

// Option configures a Store.
type Option func(*Store)

// WithEmitter injects the event-bus emitter (PROJ-162). Default: no-op.
func WithEmitter(e EventEmitter) Option {
	return func(s *Store) {
		if e != nil {
			s.emitter = e
		}
	}
}

// WithDeltaSink injects the fan-out sink (PROJ-150). Default: no-op.
func WithDeltaSink(d DeltaSink) Option {
	return func(s *Store) {
		if d != nil {
			s.sink = d
		}
	}
}

// WithSeriesCapacity sets the default ring-buffer size for series states.
func WithSeriesCapacity(n int) Option {
	return func(s *Store) {
		if n > 0 {
			s.seriesCap = n
		}
	}
}

// WithClock injects a timestamp source (unix millis) for deterministic tests.
func WithClock(now func() int64) Option {
	return func(s *Store) {
		if now != nil {
			s.now = now
		}
	}
}

// New creates a Store. Without injected seams it works standalone (no-op emit /
// enqueue), so it can be built before PROJ-162/PROJ-150 land.
func New(opts ...Option) *Store {
	s := &Store{
		states:    make(map[string]*State),
		dirty:     make(map[string]struct{}),
		emitter:   nopEmitter{},
		sink:      nopSink{},
		seriesCap: DefaultSeriesCapacity,
		now:       func() int64 { return time.Now().UnixMilli() },
	}
	for _, o := range opts {
		o(s)
	}
	return s
}

// Define declares a state's typing before values flow. It is idempotent only in
// that re-defining an existing ID returns an error; providers declare once.
func (s *Store) Define(def StateDef) error {
	if def.ID == "" {
		return fmt.Errorf("state: Define requires a non-empty ID")
	}
	if def.Kind == "" {
		return fmt.Errorf("state: Define(%q) requires a Kind", def.ID)
	}
	vt := def.ValueType
	if vt == "" {
		vt = valueTypeForKind(def.Kind)
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, exists := s.states[def.ID]; exists {
		return fmt.Errorf("state: %q already defined", def.ID)
	}
	st := &State{
		ID:        def.ID,
		Kind:      def.Kind,
		ValueType: vt,
		Unit:      def.Unit,
		Source:    def.Source,
	}
	if def.Kind == KindSeries {
		capacity := def.SeriesCapacity
		if capacity <= 0 {
			capacity = s.seriesCap
		}
		st.Series = NewRingBuffer(capacity)
	}
	s.states[def.ID] = st
	return nil
}

// Set updates the value of a state (2B §2.2). If the value is unchanged it is a
// no-op (delta suppression): no event, no delta. Otherwise it updates the value
// and timestamp, pushes to the ring buffer for series states, marks the state
// dirty, emits state.changed, and enqueues a delta for fan-out.
//
// If the ID was never Defined, Set auto-defines it as a scalar/text/boolean by
// inferring the type from value (a convenience for simple providers); series and
// enum states must be Defined explicitly.
func (s *Store) Set(id string, value any) error {
	if id == "" {
		return fmt.Errorf("state: Set requires a non-empty ID")
	}
	norm, vt, err := normalizeValue(value)
	if err != nil {
		return fmt.Errorf("state: Set(%q): %w", id, err)
	}

	s.mu.Lock()
	st, ok := s.states[id]
	if !ok {
		st = &State{ID: id, Kind: defaultKind(vt), ValueType: vt}
		s.states[id] = st
	} else if st.ValueType != vt {
		s.mu.Unlock()
		return fmt.Errorf("state: Set(%q): type mismatch, state is %s but value is %s",
			id, st.ValueType, vt)
	}

	if st.Value != nil && valuesEqual(st.Value, norm) {
		s.mu.Unlock()
		return nil // delta suppression: unchanged value
	}

	st.Value = norm
	st.UpdatedAt = s.now()
	if st.Kind == KindSeries {
		if st.Series == nil {
			st.Series = NewRingBuffer(s.seriesCap)
		}
		st.Series.Push(norm.(float64))
	}
	s.dirty[id] = struct{}{}

	ev := StateChangedEvent{
		ID:        st.ID,
		Kind:      st.Kind,
		ValueType: st.ValueType,
		Value:     st.Value,
		UpdatedAt: st.UpdatedAt,
		Source:    st.Source,
	}
	d := Delta{ID: st.ID, Value: st.Value, UpdatedAt: st.UpdatedAt}
	s.mu.Unlock()

	// Run consumers outside the lock so a slow subscriber never stalls the hot
	// path or another writer.
	s.emitter.EmitStateChanged(ev)
	s.sink.EnqueueDelta(d)
	return nil
}

// Get returns a copy of the state and whether it exists. Series buffers are
// snapshotted so callers cannot mutate or race the live buffer.
func (s *Store) Get(id string) (State, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	st, ok := s.states[id]
	if !ok {
		return State{}, false
	}
	return st.clone(), true
}

// Snapshot returns copies of all states, sorted by ID for determinism.
func (s *Store) Snapshot() []State {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]State, 0, len(s.states))
	for _, st := range s.states {
		out = append(out, st.clone())
	}
	sort.Slice(out, func(i, j int) bool { return out[i].ID < out[j].ID })
	return out
}

// DrainDirty returns deltas for every state changed since the last drain and
// clears the dirty set. This is the fan-out path's pull point (TB-ST-2).
func (s *Store) DrainDirty() []Delta {
	s.mu.Lock()
	defer s.mu.Unlock()
	if len(s.dirty) == 0 {
		return nil
	}
	out := make([]Delta, 0, len(s.dirty))
	for id := range s.dirty {
		if st, ok := s.states[id]; ok {
			out = append(out, Delta{ID: st.ID, Value: st.Value, UpdatedAt: st.UpdatedAt})
		}
	}
	s.dirty = make(map[string]struct{})
	sort.Slice(out, func(i, j int) bool { return out[i].ID < out[j].ID })
	return out
}

// normalizeValue coerces a supported Go value into its canonical typed form.
// Numbers are normalized to float64 so comparisons and gauges are consistent
// (ADR-0019).
func normalizeValue(v any) (any, string, error) {
	switch x := v.(type) {
	case float64:
		return x, TypeNumber, nil
	case float32:
		return float64(x), TypeNumber, nil
	case int:
		return float64(x), TypeNumber, nil
	case int32:
		return float64(x), TypeNumber, nil
	case int64:
		return float64(x), TypeNumber, nil
	case string:
		return x, TypeString, nil
	case bool:
		return x, TypeBool, nil
	default:
		return nil, "", fmt.Errorf("unsupported value type %T", v)
	}
}

// valuesEqual compares two already-normalized values for delta suppression.
func valuesEqual(a, b any) bool {
	switch av := a.(type) {
	case float64:
		bv, ok := b.(float64)
		return ok && av == bv
	case string:
		bv, ok := b.(string)
		return ok && av == bv
	case bool:
		bv, ok := b.(bool)
		return ok && av == bv
	default:
		return false
	}
}

// defaultKind maps an inferred value type to a kind for auto-defined states.
func defaultKind(vt string) StateKind {
	switch vt {
	case TypeNumber:
		return KindScalar
	case TypeBool:
		return KindBoolean
	default:
		return KindText
	}
}

// valueTypeForKind gives the natural value type for a kind when a StateDef omits
// ValueType.
func valueTypeForKind(k StateKind) string {
	switch k {
	case KindScalar, KindSeries:
		return TypeNumber
	case KindBoolean:
		return TypeBool
	default: // text, enum
		return TypeString
	}
}
