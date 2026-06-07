package vars

import (
	"context"
	"path/filepath"
	"sync/atomic"
	"testing"

	"github.com/shishir/cyberdeck/engine/core/persistence"
	"github.com/shishir/cyberdeck/engine/core/state"
)

type countingSink struct{ n atomic.Int64 }

func (s *countingSink) EnqueueDelta(state.Delta) { s.n.Add(1) }

func openDB(t *testing.T) *persistence.DB {
	t.Helper()
	db, err := persistence.Open(filepath.Join(t.TempDir(), "vars.db"))
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	if err := db.Migrate(context.Background()); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return db
}

func TestSetVarPersistsAndLiveWithFanout(t *testing.T) {
	ctx := context.Background()
	db := openDB(t)
	repo := persistence.NewVariableRepo(db)
	sink := &countingSink{}
	store := state.New(state.WithDeltaSink(sink), state.WithClock(func() int64 { return 1 }))
	m := NewManager(repo, store, WithClock(func() int64 { return 1 }))

	if err := m.SetVar(ctx, "var.mic_muted", true); err != nil {
		t.Fatalf("SetVar: %v", err)
	}

	// Live + bindable: it's in the state store as a typed boolean state.
	st, ok := m.GetVar("var.mic_muted")
	if !ok || st.Value != true || st.Kind != state.KindBoolean {
		t.Errorf("live state = %+v ok=%v, want boolean true", st, ok)
	}
	// Fan-out fired.
	if sink.n.Load() < 1 {
		t.Error("SetVar did not enqueue a delta (no fan-out)")
	}
	// Durable.
	v, err := repo.Get(ctx, "var.mic_muted")
	if err != nil {
		t.Fatalf("repo.Get: %v", err)
	}
	if v.ValueType != "bool" || v.ValueJSON != "true" {
		t.Errorf("persisted var = %+v, want bool/true", v)
	}
}

func TestVarSurvivesRestart(t *testing.T) {
	ctx := context.Background()
	db := openDB(t)
	repo := persistence.NewVariableRepo(db)

	// First run.
	store1 := state.New()
	m1 := NewManager(repo, store1)
	if err := m1.SetVar(ctx, "var.count", 42); err != nil {
		t.Fatalf("SetVar: %v", err)
	}

	// "Restart": a fresh store + manager over the same durable DB.
	store2 := state.New()
	m2 := NewManager(repo, store2)
	if _, ok := store2.Get("var.count"); ok {
		t.Fatal("var present before Load")
	}
	if err := m2.Load(ctx); err != nil {
		t.Fatalf("Load: %v", err)
	}
	st, ok := store2.Get("var.count")
	if !ok || st.Value != 42.0 {
		t.Errorf("after reload = %+v ok=%v, want 42", st, ok)
	}
}

func TestVarTypedFidelity(t *testing.T) {
	ctx := context.Background()
	db := openDB(t)
	repo := persistence.NewVariableRepo(db)

	m1 := NewManager(repo, state.New())
	if err := m1.SetVar(ctx, "var.num", 3.5); err != nil {
		t.Fatal(err)
	}
	if err := m1.SetVar(ctx, "var.str", "hi"); err != nil {
		t.Fatal(err)
	}
	if err := m1.SetVar(ctx, "var.flag", false); err != nil {
		t.Fatal(err)
	}

	// Reload into a fresh store and check each type survives the JSON round-trip.
	store := state.New()
	if err := NewManager(repo, store).Load(ctx); err != nil {
		t.Fatalf("Load: %v", err)
	}
	num, _ := store.Get("var.num")
	if v, ok := num.Value.(float64); !ok || v != 3.5 {
		t.Errorf("var.num = %v (%T), want float64 3.5", num.Value, num.Value)
	}
	str, _ := store.Get("var.str")
	if v, ok := str.Value.(string); !ok || v != "hi" {
		t.Errorf("var.str = %v (%T), want string hi", str.Value, str.Value)
	}
	flag, _ := store.Get("var.flag")
	if v, ok := flag.Value.(bool); !ok || v != false {
		t.Errorf("var.flag = %v (%T), want bool false", flag.Value, flag.Value)
	}
}

func TestSetVarUnsupportedType(t *testing.T) {
	ctx := context.Background()
	m := NewManager(persistence.NewVariableRepo(openDB(t)), state.New())
	if err := m.SetVar(ctx, "var.bad", []int{1, 2}); err == nil {
		t.Error("SetVar with unsupported type succeeded, want error")
	}
}
