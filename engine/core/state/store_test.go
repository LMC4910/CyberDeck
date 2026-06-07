package state

import (
	"sync"
	"sync/atomic"
	"testing"
)

// recordingEmitter / recordingSink are thread-safe test doubles for the seams.
type recordingEmitter struct {
	mu     sync.Mutex
	events []StateChangedEvent
	count  atomic.Int64
}

func (e *recordingEmitter) EmitStateChanged(ev StateChangedEvent) {
	e.count.Add(1)
	e.mu.Lock()
	e.events = append(e.events, ev)
	e.mu.Unlock()
}

type recordingSink struct {
	mu     sync.Mutex
	deltas []Delta
	count  atomic.Int64
}

func (s *recordingSink) EnqueueDelta(d Delta) {
	s.count.Add(1)
	s.mu.Lock()
	s.deltas = append(s.deltas, d)
	s.mu.Unlock()
}

func newTestStore(t *testing.T) (*Store, *recordingEmitter, *recordingSink) {
	t.Helper()
	em := &recordingEmitter{}
	sk := &recordingSink{}
	var tick int64
	st := New(
		WithEmitter(em),
		WithDeltaSink(sk),
		WithClock(func() int64 { tick++; return tick }),
	)
	return st, em, sk
}

func TestSetChangedEmitsAndEnqueues(t *testing.T) {
	st, em, sk := newTestStore(t)

	if err := st.Set("system.cpu.temp", 42.0); err != nil {
		t.Fatalf("Set: %v", err)
	}
	if em.count.Load() != 1 {
		t.Errorf("emit count = %d, want 1", em.count.Load())
	}
	if sk.count.Load() != 1 {
		t.Errorf("delta count = %d, want 1", sk.count.Load())
	}
	got, ok := st.Get("system.cpu.temp")
	if !ok {
		t.Fatal("Get: state missing")
	}
	if got.Value != 42.0 {
		t.Errorf("value = %v, want 42.0", got.Value)
	}
}

func TestDeltaSuppressionUnchanged(t *testing.T) {
	st, em, sk := newTestStore(t)

	if err := st.Set("k", 10.0); err != nil {
		t.Fatalf("Set #1: %v", err)
	}
	// Same value again must be a no-op: no new event, no new delta.
	if err := st.Set("k", 10.0); err != nil {
		t.Fatalf("Set #2: %v", err)
	}
	if em.count.Load() != 1 {
		t.Errorf("emit count = %d, want 1 (second Set suppressed)", em.count.Load())
	}
	if sk.count.Load() != 1 {
		t.Errorf("delta count = %d, want 1 (second Set suppressed)", sk.count.Load())
	}
	// A genuinely different value resumes emission.
	if err := st.Set("k", 11.0); err != nil {
		t.Fatalf("Set #3: %v", err)
	}
	if em.count.Load() != 2 {
		t.Errorf("emit count = %d, want 2 after change", em.count.Load())
	}
}

func TestTypedRoundTrip(t *testing.T) {
	st, _, _ := newTestStore(t)

	if err := st.Set("n", 3); err != nil { // int -> normalized to float64 number
		t.Fatalf("Set int: %v", err)
	}
	if err := st.Set("s", "hello"); err != nil {
		t.Fatalf("Set string: %v", err)
	}
	if err := st.Set("b", true); err != nil {
		t.Fatalf("Set bool: %v", err)
	}

	n, _ := st.Get("n")
	if v, ok := n.Value.(float64); !ok || v != 3.0 {
		t.Errorf("n.Value = %v (%T), want float64 3.0", n.Value, n.Value)
	}
	if n.Kind != KindScalar || n.ValueType != TypeNumber {
		t.Errorf("n kind/type = %s/%s, want scalar/number", n.Kind, n.ValueType)
	}
	sv, _ := st.Get("s")
	if v, ok := sv.Value.(string); !ok || v != "hello" {
		t.Errorf("s.Value = %v (%T), want string hello", sv.Value, sv.Value)
	}
	bv, _ := st.Get("b")
	if v, ok := bv.Value.(bool); !ok || v != true {
		t.Errorf("b.Value = %v (%T), want bool true", bv.Value, bv.Value)
	}
}

func TestTypeMismatchRejected(t *testing.T) {
	st, _, _ := newTestStore(t)
	if err := st.Set("k", 1.0); err != nil {
		t.Fatalf("Set number: %v", err)
	}
	if err := st.Set("k", "now a string"); err == nil {
		t.Error("Set with mismatched type = nil error, want error")
	}
}

func TestSeriesAppendAndEviction(t *testing.T) {
	st, _, _ := newTestStore(t)
	if err := st.Define(StateDef{ID: "net.rx", Kind: KindSeries, SeriesCapacity: 3}); err != nil {
		t.Fatalf("Define series: %v", err)
	}
	for _, v := range []float64{1, 2, 3, 4, 5} {
		if err := st.Set("net.rx", v); err != nil {
			t.Fatalf("Set %v: %v", v, err)
		}
	}
	got, _ := st.Get("net.rx")
	if got.Series == nil {
		t.Fatal("series buffer nil")
	}
	vals := got.Series.Values()
	want := []float64{3, 4, 5} // capacity 3: oldest (1,2) evicted
	if len(vals) != len(want) {
		t.Fatalf("series = %v, want %v", vals, want)
	}
	for i := range want {
		if vals[i] != want[i] {
			t.Fatalf("series = %v, want %v", vals, want)
		}
	}
	if got.Value != 5.0 {
		t.Errorf("latest value = %v, want 5.0", got.Value)
	}
}

func TestSeriesSnapshotIsolation(t *testing.T) {
	st, _, _ := newTestStore(t)
	if err := st.Define(StateDef{ID: "s", Kind: KindSeries, SeriesCapacity: 5}); err != nil {
		t.Fatalf("Define: %v", err)
	}
	_ = st.Set("s", 1.0)
	got, _ := st.Get("s")
	got.Series.Push(999) // mutate the snapshot
	again, _ := st.Get("s")
	if again.Series.Len() != 1 {
		t.Errorf("live buffer mutated via snapshot: len = %d, want 1", again.Series.Len())
	}
}

func TestDrainDirty(t *testing.T) {
	st, _, _ := newTestStore(t)
	_ = st.Set("a", 1.0)
	_ = st.Set("b", 2.0)
	_ = st.Set("a", 1.0) // suppressed, stays as already-dirty single entry

	deltas := st.DrainDirty()
	if len(deltas) != 2 {
		t.Fatalf("drain returned %d deltas, want 2", len(deltas))
	}
	if deltas[0].ID != "a" || deltas[1].ID != "b" {
		t.Errorf("drain order = %s,%s want a,b", deltas[0].ID, deltas[1].ID)
	}
	// Second drain is empty (dirty set cleared).
	if d := st.DrainDirty(); d != nil {
		t.Errorf("second drain = %v, want nil", d)
	}
	// A new change re-populates the dirty set.
	_ = st.Set("a", 7.0)
	if d := st.DrainDirty(); len(d) != 1 || d[0].ID != "a" {
		t.Errorf("post-change drain = %v, want one delta for a", d)
	}
}

func TestSnapshotSortedCopies(t *testing.T) {
	st, _, _ := newTestStore(t)
	_ = st.Set("zeta", 1.0)
	_ = st.Set("alpha", 2.0)
	snap := st.Snapshot()
	if len(snap) != 2 || snap[0].ID != "alpha" || snap[1].ID != "zeta" {
		t.Fatalf("snapshot = %+v, want sorted [alpha, zeta]", snap)
	}
}

func TestDefineDuplicateRejected(t *testing.T) {
	st, _, _ := newTestStore(t)
	if err := st.Define(StateDef{ID: "x", Kind: KindScalar}); err != nil {
		t.Fatalf("Define: %v", err)
	}
	if err := st.Define(StateDef{ID: "x", Kind: KindScalar}); err == nil {
		t.Error("re-Define = nil error, want error")
	}
}

// TestConcurrentSetSafety exercises the store under concurrent writers and a
// reader; run with -race it asserts there are no data races (PROJ-160 AC).
func TestConcurrentSetSafety(t *testing.T) {
	st := New() // no-op seams; this is about store-internal safety
	const writers = 8
	const iters = 1000

	var wg sync.WaitGroup
	for w := 0; w < writers; w++ {
		wg.Add(1)
		go func(w int) {
			defer wg.Done()
			id := "w" + string(rune('A'+w))
			for i := 0; i < iters; i++ {
				_ = st.Set(id, float64(i))
			}
		}(w)
	}
	// concurrent readers / drainers
	wg.Add(1)
	go func() {
		defer wg.Done()
		for i := 0; i < iters; i++ {
			_ = st.Snapshot()
			_ = st.DrainDirty()
		}
	}()
	wg.Wait()

	// Final state of each writer's key is the last iteration value.
	for w := 0; w < writers; w++ {
		id := "w" + string(rune('A'+w))
		got, ok := st.Get(id)
		if !ok {
			t.Fatalf("missing key %s", id)
		}
		if got.Value != float64(iters-1) {
			t.Errorf("%s final = %v, want %v", id, got.Value, float64(iters-1))
		}
	}
}
