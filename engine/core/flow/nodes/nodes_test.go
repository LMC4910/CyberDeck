package nodes_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/shishir/cyberdeck/engine/core/flow"
	"github.com/shishir/cyberdeck/engine/core/flow/expr"
	"github.com/shishir/cyberdeck/engine/core/flow/nodes"
)

// --- fakes ---

type recGate struct {
	actionID string
	params   map[string]any
	err      error
}

func (g *recGate) Authorize(_ context.Context, id string, p map[string]any) error {
	g.actionID, g.params = id, p
	return g.err
}

type recDispatch struct {
	called   bool
	actionID string
	err      error
}

func (d *recDispatch) Dispatch(_ context.Context, id string, _ map[string]any) error {
	d.called, d.actionID = true, id
	return d.err
}

type recAudit struct{ events []string }

func (a *recAudit) Audit(event string, _ map[string]any) { a.events = append(a.events, event) }

func (a *recAudit) has(event string) bool {
	for _, e := range a.events {
		if e == event {
			return true
		}
	}
	return false
}

type recNav struct{ targets []map[string]any }

func (n *recNav) Navigate(t map[string]any) { n.targets = append(n.targets, t) }

type recSubflow struct {
	flowID string
	depth  int
	called bool
	err    error
}

func (s *recSubflow) RunSubflow(_ context.Context, id string, depth int) error {
	s.called, s.flowID, s.depth = true, id, depth
	return s.err
}

// varStore is both the global var writer and the read resolver (shared state).
type varStore map[string]any

func (s varStore) SetVar(name string, v any) error { s[name] = v; return nil }
func (s varStore) Lookup(token string) (any, bool) { v, ok := s[token]; return v, ok }

// recRunner is a test terminal node that logs visits (to trace executor paths).
type recRunner struct{ log *[]string }

func (r recRunner) Run(_ *flow.RunContext, n flow.Node) (string, error) {
	*r.log = append(*r.log, n.ID)
	return "next", nil
}

func newRC() *flow.RunContext {
	return flow.NewRunContext(context.Background(), nil, nil, nil)
}

func runner(t *testing.T, d nodes.Deps, kind string) flow.NodeRunner {
	t.Helper()
	r, ok := nodes.All(d)[kind]
	if !ok {
		t.Fatalf("no handler for kind %q", kind)
	}
	return r
}

// --- action: gated + audited (critical security path) ---

func TestActionAuthorizedDispatchesAndAudits(t *testing.T) {
	gate := &recGate{}
	disp := &recDispatch{}
	audit := &recAudit{}
	d := nodes.Deps{Gate: gate, Dispatch: disp, Audit: audit}

	next, err := runner(t, d, "action").Run(newRC(), flow.Node{
		ID:   "a1",
		Kind: "action",
		Params: map[string]any{
			"actionId": "power.shutdown",
			"params":   map[string]any{"force": true},
		},
	})
	if err != nil || next != "next" {
		t.Fatalf("action = (%q, %v), want (next, nil)", next, err)
	}
	if gate.actionID != "power.shutdown" || gate.params["force"] != true {
		t.Errorf("gate saw %q %v", gate.actionID, gate.params)
	}
	if !disp.called || disp.actionID != "power.shutdown" {
		t.Errorf("dispatch = %+v, want called with power.shutdown", disp)
	}
	if !audit.has("flow.action.executed") {
		t.Errorf("audit = %v, want flow.action.executed", audit.events)
	}
}

func TestActionDeniedNotDispatched(t *testing.T) {
	gate := &recGate{err: errors.New("permission denied")}
	disp := &recDispatch{}
	audit := &recAudit{}
	d := nodes.Deps{Gate: gate, Dispatch: disp, Audit: audit}

	_, err := runner(t, d, "action").Run(newRC(), flow.Node{
		ID: "a1", Kind: "action", Params: map[string]any{"actionId": "power.shutdown"},
	})
	if err == nil {
		t.Fatal("denied action must fail the node")
	}
	if disp.called {
		t.Error("denied action must NOT be dispatched")
	}
	if !audit.has("flow.action.denied") {
		t.Errorf("audit = %v, want flow.action.denied", audit.events)
	}
}

func TestActionDispatchFailureAudited(t *testing.T) {
	disp := &recDispatch{err: errors.New("boom")}
	audit := &recAudit{}
	d := nodes.Deps{Dispatch: disp, Audit: audit}
	if _, err := runner(t, d, "action").Run(newRC(), flow.Node{
		ID: "a1", Kind: "action", Params: map[string]any{"actionId": "x"},
	}); err == nil {
		t.Fatal("dispatch failure must fail the node")
	}
	if !audit.has("flow.action.failed") {
		t.Errorf("audit = %v, want flow.action.failed", audit.events)
	}
}

// --- if ---

func TestIfBranchesTrueFalse(t *testing.T) {
	rc := flow.NewRunContext(context.Background(), nil, expr.MapContext{"x": 5.0}, nil)
	next, err := runner(t, nodes.Deps{}, "if").Run(rc, flow.Node{
		ID: "c", Kind: "if", Params: map[string]any{"expr": "x > 1"},
	})
	if err != nil || next != "true" {
		t.Errorf("x>1 → (%q,%v), want (true,nil)", next, err)
	}
	rc = flow.NewRunContext(context.Background(), nil, expr.MapContext{"x": 0.0}, nil)
	next, _ = runner(t, nodes.Deps{}, "if").Run(rc, flow.Node{
		ID: "c", Kind: "if", Params: map[string]any{"expr": "x > 1"},
	})
	if next != "false" {
		t.Errorf("x=0 → %q, want false", next)
	}
}

// --- setVar ---

func TestSetVarWritesGlobalVar(t *testing.T) {
	store := varStore{}
	rc := flow.NewRunContext(context.Background(), nil, store, store)
	_, err := runner(t, nodes.Deps{}, "setVar").Run(rc, flow.Node{
		ID: "s", Kind: "setVar", Params: map[string]any{"name": "var.count", "expr": "1 + 2"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if store["var.count"] != 3.0 {
		t.Errorf("var.count = %v, want 3", store["var.count"])
	}
}

func TestSetVarLocalReadByExpr(t *testing.T) {
	rc := newRC()
	if _, err := runner(t, nodes.Deps{}, "setVar").Run(rc, flow.Node{
		ID: "s", Kind: "setVar", Params: map[string]any{"name": "y", "expr": "7"},
	}); err != nil {
		t.Fatal(err)
	}
	// The local is visible to a later expression in the same run.
	v, err := rc.Eval("y == 7")
	if err != nil || v != true {
		t.Errorf("y==7 → (%v,%v), want (true,nil)", v, err)
	}
}

// --- wait ---

func TestWaitDelaysThenContinues(t *testing.T) {
	var slept time.Duration
	d := nodes.Deps{Sleep: func(_ context.Context, dur time.Duration) error { slept = dur; return nil }}
	next, err := runner(t, d, "wait").Run(newRC(), flow.Node{
		ID: "w", Kind: "wait", Params: map[string]any{"ms": 250.0},
	})
	if err != nil || next != "next" {
		t.Fatalf("wait = (%q,%v)", next, err)
	}
	if slept != 250*time.Millisecond {
		t.Errorf("slept = %v, want 250ms", slept)
	}
}

func TestWaitCancellable(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	rc := flow.NewRunContext(ctx, nil, nil, nil)
	done := make(chan error, 1)
	go func() {
		_, err := runner(t, nodes.Deps{}, "wait").Run(rc, flow.Node{
			ID: "w", Kind: "wait", Params: map[string]any{"ms": 60000.0},
		})
		done <- err
	}()
	cancel()
	select {
	case err := <-done:
		if !errors.Is(err, context.Canceled) {
			t.Errorf("err = %v, want context.Canceled", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("wait did not honour cancellation promptly")
	}
}

// --- navigate ---

func TestNavigateEmitsDirective(t *testing.T) {
	nav := &recNav{}
	d := nodes.Deps{Navigate: nav}
	_, err := runner(t, d, "navigate").Run(newRC(), flow.Node{
		ID: "n", Kind: "navigate", Params: map[string]any{"page": "home"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(nav.targets) != 1 || nav.targets[0]["page"] != "home" {
		t.Errorf("targets = %v, want [{page:home}]", nav.targets)
	}
}

// --- random ---

func TestRandomPicksBranch(t *testing.T) {
	d := nodes.Deps{Rand: func(int) int { return 1 }} // deterministic
	next, err := runner(t, d, "random").Run(newRC(), flow.Node{
		ID: "r", Kind: "random", Params: map[string]any{"branches": []any{"a", "b", "c"}},
	})
	if err != nil || next != "b" {
		t.Errorf("random = (%q,%v), want (b,nil)", next, err)
	}
}

func TestRandomNoBranchesFollowsNext(t *testing.T) {
	next, _ := runner(t, nodes.Deps{}, "random").Run(newRC(), flow.Node{ID: "r", Kind: "random"})
	if next != "next" {
		t.Errorf("empty random → %q, want next", next)
	}
}

// --- subflow: depth cap ---

func TestSubflowInvokesAtIncrementedDepth(t *testing.T) {
	sub := &recSubflow{}
	d := nodes.Deps{Subflow: sub}
	_, err := runner(t, d, "subflow").Run(newRC(), flow.Node{
		ID: "sf", Kind: "subflow", Params: map[string]any{"flowId": "f2"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if !sub.called || sub.flowID != "f2" || sub.depth != 1 {
		t.Errorf("subflow = %+v, want called f2 depth 1", sub)
	}
}

func TestSubflowDepthCapEnforced(t *testing.T) {
	sub := &recSubflow{}
	d := nodes.Deps{Subflow: sub, MaxSubflowDepth: 4}
	rc := newRC()
	_ = rc.Set("__subflow.depth", float64(4)) // at the cap
	_, err := runner(t, d, "subflow").Run(rc, flow.Node{
		ID: "sf", Kind: "subflow", Params: map[string]any{"flowId": "f2"},
	})
	if !errors.Is(err, nodes.ErrSubflowDepthExceeded) {
		t.Errorf("err = %v, want ErrSubflowDepthExceeded", err)
	}
	if sub.called {
		t.Error("subflow at the depth cap must NOT invoke")
	}
}

// --- stop ---

func TestStopReturnsStopLabel(t *testing.T) {
	next, err := runner(t, nodes.Deps{}, "stop").Run(newRC(), flow.Node{ID: "s", Kind: "stop"})
	if err != nil || next != flow.StopLabel {
		t.Errorf("stop = (%q,%v), want (%q,nil)", next, err, flow.StopLabel)
	}
}

// --- executor integration: edge-following for loop / stop ---

func TestLoopCountIteratesBodyNTimes(t *testing.T) {
	var log []string
	e := flow.NewExecutor(flow.WithMaxIterations(100))
	nodes.Register(e, nodes.Deps{})
	e.Register("rec", recRunner{&log})

	f := &flow.Flow{ID: "f", Trigger: flow.Trigger{Kind: "manual"},
		Nodes: []flow.Node{
			{ID: "L", Kind: "loop", Params: map[string]any{"count": 3.0}},
			{ID: "B", Kind: "rec"},
			{ID: "D", Kind: "rec"},
		},
		Edges: []flow.Edge{
			{From: "L", To: "B", Label: "body"},
			{From: "B", To: "L", Label: "next"},
			{From: "L", To: "D", Label: "next"},
		}}

	res := e.Run(context.Background(), f, nil, nil, nil)
	if !res.Completed {
		t.Fatalf("run = %+v", res)
	}
	bodies := 0
	for _, id := range log {
		if id == "B" {
			bodies++
		}
	}
	if bodies != 3 {
		t.Errorf("body ran %d times, want 3 (log %v)", bodies, log)
	}
	if log[len(log)-1] != "D" {
		t.Errorf("loop did not exit to D (log %v)", log)
	}
}

func TestLoopWhileExpr(t *testing.T) {
	store := varStore{}
	e := flow.NewExecutor(flow.WithMaxIterations(100))
	nodes.Register(e, nodes.Deps{})

	f := &flow.Flow{ID: "f", Trigger: flow.Trigger{Kind: "manual"},
		Nodes: []flow.Node{
			{ID: "I", Kind: "setVar", Params: map[string]any{"name": "var.i", "expr": "0"}},
			{ID: "L", Kind: "loop", Params: map[string]any{"while": "var.i < 3"}},
			{ID: "INC", Kind: "setVar", Params: map[string]any{"name": "var.i", "expr": "var.i + 1"}},
			{ID: "D", Kind: "stop"},
		},
		Edges: []flow.Edge{
			{From: "I", To: "L", Label: "next"},
			{From: "L", To: "INC", Label: "body"},
			{From: "INC", To: "L", Label: "next"},
			{From: "L", To: "D", Label: "next"},
		}}

	res := e.Run(context.Background(), f, store, store, nil)
	if !res.Completed {
		t.Fatalf("run = %+v", res)
	}
	if store["var.i"] != 3.0 {
		t.Errorf("var.i = %v, want 3 (while-loop should run 3×)", store["var.i"])
	}
}

func TestStopEndsRunBeforeNextEdge(t *testing.T) {
	var log []string
	e := flow.NewExecutor()
	nodes.Register(e, nodes.Deps{})
	e.Register("rec", recRunner{&log})

	f := &flow.Flow{ID: "f", Trigger: flow.Trigger{Kind: "manual"},
		Nodes: []flow.Node{
			{ID: "S", Kind: "stop"},
			{ID: "X", Kind: "rec"},
		},
		Edges: []flow.Edge{{From: "S", To: "X", Label: "next"}}}

	res := e.Run(context.Background(), f, nil, nil, nil)
	if !res.Completed {
		t.Fatalf("run = %+v", res)
	}
	if len(log) != 0 {
		t.Errorf("stop should end the run; X ran anyway (log %v)", log)
	}
}
