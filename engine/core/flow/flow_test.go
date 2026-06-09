package flow

import (
	"context"
	"errors"
	"testing"

	"github.com/shishir/cyberdeck/engine/core/persistence"
	"github.com/shishir/cyberdeck/engine/core/registry"
)

func ptrF(f float64) *float64 { return &f }

func testRegistry(t *testing.T) *registry.Registry {
	t.Helper()
	reg := registry.New()
	err := reg.Merge(context.Background(), registry.Contributions{
		Source: "test",
		FlowNodes: []registry.FlowNodeDescriptor{
			{Kind: "delay", Label: "Delay", ExecHandle: "core.delay", Params: []registry.Param{
				{Name: "ms", Type: registry.ParamInt, Required: true, Min: ptrF(0)},
			}},
			{Kind: "if", Label: "If", ExecHandle: "core.if", Params: []registry.Param{
				{Name: "cond", Type: registry.ParamString, Required: true},
			}},
			{Kind: "branch", Label: "Branch", ExecHandle: "core.branch", Params: []registry.Param{
				{Name: "mode", Type: registry.ParamChoice, Required: true, Choices: []string{"a", "b"}},
			}},
		},
	})
	if err != nil {
		t.Fatalf("merge registry: %v", err)
	}
	return reg
}

type memWF struct{ m map[string]persistence.Workflow }

func newMemWF() *memWF { return &memWF{m: map[string]persistence.Workflow{}} }

func (s *memWF) Get(_ context.Context, id string) (persistence.Workflow, error) {
	w, ok := s.m[id]
	if !ok {
		return persistence.Workflow{}, persistence.ErrNotFound
	}
	return w, nil
}
func (s *memWF) Insert(_ context.Context, w persistence.Workflow) error {
	s.m[w.ID] = w
	return nil
}
func (s *memWF) Update(_ context.Context, w persistence.Workflow) error {
	s.m[w.ID] = w
	return nil
}

func validFlow() *Flow {
	return &Flow{
		ID:      "flow1",
		Label:   "Morning",
		Trigger: Trigger{Kind: "manual"},
		Nodes: []Node{
			{ID: "n1", Kind: "delay", Params: map[string]any{"ms": 100}},
			{ID: "n2", Kind: "if", Params: map[string]any{"cond": "x > 1"}},
		},
		Edges: []Edge{{From: "n1", To: "n2", Label: "next"}},
	}
}

func TestSaveLoadRoundTripAndVersion(t *testing.T) {
	st := NewStore(newMemWF(), testRegistry(t), WithClock(func() int64 { return 5 }))
	ctx := context.Background()

	v1, err := st.Save(ctx, validFlow())
	if err != nil {
		t.Fatalf("save: %v", err)
	}
	if v1 != 1 {
		t.Errorf("first save version = %d, want 1", v1)
	}

	got, err := st.Load(ctx, "flow1")
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	if got.Version != 1 || got.Label != "Morning" || len(got.Nodes) != 2 ||
		got.Trigger.Kind != "manual" || got.Edges[0].To != "n2" {
		t.Errorf("round-trip mismatch: %+v", got)
	}

	v2, err := st.Save(ctx, validFlow())
	if err != nil {
		t.Fatalf("re-save: %v", err)
	}
	if v2 != 2 {
		t.Errorf("second save version = %d, want 2", v2)
	}
}

func TestRejectInvalidFlows(t *testing.T) {
	reg := testRegistry(t)
	cases := map[string]struct {
		mutate func(*Flow)
		want   error
	}{
		"no trigger":      {func(f *Flow) { f.Trigger.Kind = "" }, ErrNoTrigger},
		"unknown kind":    {func(f *Flow) { f.Nodes[0].Kind = "bogus" }, ErrUnknownNode},
		"missing required": {func(f *Flow) { f.Nodes[0].Params = map[string]any{} }, ErrBadParam},
		"below min":       {func(f *Flow) { f.Nodes[0].Params = map[string]any{"ms": -5} }, ErrBadParam},
		"dangling edge":   {func(f *Flow) { f.Edges = []Edge{{From: "n1", To: "ghost"}} }, ErrDanglingEdge},
		"dup id":          {func(f *Flow) { f.Nodes[1].ID = "n1" }, ErrDuplicateNode},
	}
	for name, c := range cases {
		t.Run(name, func(t *testing.T) {
			st := NewStore(newMemWF(), reg)
			f := validFlow()
			c.mutate(f)
			if _, err := st.Save(context.Background(), f); !errors.Is(err, c.want) {
				t.Errorf("Save = %v, want %v", err, c.want)
			}
		})
	}
}

func TestInvalidFlowNotPersisted(t *testing.T) {
	store := newMemWF()
	st := NewStore(store, testRegistry(t))
	f := validFlow()
	f.Nodes[0].Kind = "bogus"
	if _, err := st.Save(context.Background(), f); err == nil {
		t.Fatal("expected validation error")
	}
	if _, ok := store.m["flow1"]; ok {
		t.Error("an invalid flow must not be persisted")
	}
}

func TestChoiceParamValidation(t *testing.T) {
	st := NewStore(newMemWF(), testRegistry(t))
	f := validFlow()
	f.Nodes = []Node{{ID: "b", Kind: "branch", Params: map[string]any{"mode": "z"}}}
	f.Edges = nil
	if _, err := st.Save(context.Background(), f); !errors.Is(err, ErrBadParam) {
		t.Errorf("invalid choice = %v, want ErrBadParam", err)
	}
	f.Nodes[0].Params["mode"] = "a"
	if _, err := st.Save(context.Background(), f); err != nil {
		t.Errorf("valid choice rejected: %v", err)
	}
}

func TestFlowJSONRoundTrip(t *testing.T) {
	f := validFlow()
	f.Version = 3
	b, err := f.JSON()
	if err != nil {
		t.Fatalf("JSON: %v", err)
	}
	back, err := ParseFlow(b)
	if err != nil {
		t.Fatalf("ParseFlow: %v", err)
	}
	if back.Version != 3 || len(back.Nodes) != 2 || back.Nodes[0].Kind != "delay" {
		t.Errorf("did not survive round-trip: %+v", back)
	}
}
