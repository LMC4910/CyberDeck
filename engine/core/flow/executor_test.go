package flow

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/shishir/cyberdeck/engine/core/flow/expr"
)

// --- test node handlers ---

type noopRunner struct{ log *[]string }

func (r noopRunner) Run(_ *RunContext, n Node) (string, error) {
	*r.log = append(*r.log, n.ID)
	return "next", nil
}

type ifRunner struct{ log *[]string }

func (r ifRunner) Run(rc *RunContext, n Node) (string, error) {
	*r.log = append(*r.log, n.ID)
	cond, _ := n.Params["cond"].(string)
	v, err := rc.Eval(cond)
	if err != nil {
		return "", err
	}
	if b, ok := v.(bool); ok && b {
		return "true", nil
	}
	return "false", nil
}

type setLocalRunner struct{ log *[]string }

func (r setLocalRunner) Run(rc *RunContext, n Node) (string, error) {
	*r.log = append(*r.log, n.ID)
	name, _ := n.Params["name"].(string)
	return "next", rc.Set(name, n.Params["value"])
}

type failRunner struct{}

func (failRunner) Run(_ *RunContext, _ Node) (string, error) {
	return "", errors.New("boom")
}

type panicRunner struct{}

func (panicRunner) Run(_ *RunContext, _ Node) (string, error) { panic("kaboom") }

type blockRunner struct{ started chan struct{} }

func (r blockRunner) Run(rc *RunContext, _ Node) (string, error) {
	close(r.started)
	<-rc.Ctx.Done()
	return "", rc.Ctx.Err()
}

type recEmit struct{ topics []string }

func (e *recEmit) Emit(topic string, _ map[string]any) { e.topics = append(e.topics, topic) }

// --- tests ---

func TestRunHappyPath(t *testing.T) {
	var log []string
	em := &recEmit{}
	e := NewExecutor(WithHandler("noop", noopRunner{&log}), WithEmitter(em))
	f := &Flow{ID: "f", Trigger: Trigger{Kind: "manual"},
		Nodes: []Node{{ID: "A", Kind: "noop"}, {ID: "B", Kind: "noop"}},
		Edges: []Edge{{From: "A", To: "B", Label: "next"}}}

	res := e.Run(context.Background(), f, nil, nil, nil)
	if !res.Completed || res.Err != nil {
		t.Fatalf("run = %+v", res)
	}
	if len(log) != 2 || log[0] != "A" || log[1] != "B" {
		t.Errorf("path = %v, want [A B]", log)
	}
	if em.topics[0] != TopicFlowRun || em.topics[len(em.topics)-1] != TopicFlowCompleted {
		t.Errorf("events = %v", em.topics)
	}
}

func TestRunBranch(t *testing.T) {
	var log []string
	e := NewExecutor(
		WithHandler("if", ifRunner{&log}),
		WithHandler("noop", noopRunner{&log}),
	)
	f := &Flow{ID: "f", Trigger: Trigger{Kind: "manual"},
		Nodes: []Node{
			{ID: "C", Kind: "if", Params: map[string]any{"cond": "x > 1"}},
			{ID: "T", Kind: "noop"},
			{ID: "F", Kind: "noop"},
		},
		Edges: []Edge{{From: "C", To: "T", Label: "true"}, {From: "C", To: "F", Label: "false"}}}

	res := e.Run(context.Background(), f, expr.MapContext{"x": 5.0}, nil, nil)
	if !res.Completed {
		t.Fatalf("run = %+v", res)
	}
	if len(log) != 2 || log[1] != "T" {
		t.Errorf("branch path = %v, want [C T]", log)
	}
}

func TestRunNodeFailureEngineSurvives(t *testing.T) {
	em := &recEmit{}
	e := NewExecutor(WithHandler("fail", failRunner{}), WithEmitter(em))
	f := &Flow{ID: "f", Trigger: Trigger{Kind: "manual"}, Nodes: []Node{{ID: "A", Kind: "fail"}}}

	res := e.Run(context.Background(), f, nil, nil, nil)
	if res.Completed || res.Err == nil {
		t.Fatalf("expected a failed run, got %+v", res)
	}
	if em.topics[len(em.topics)-1] != TopicFlowFailed {
		t.Errorf("expected flow.failed, got %v", em.topics)
	}
	// The test process (engine) is still running — failure didn't crash it.
}

func TestRunNodePanicRecovered(t *testing.T) {
	e := NewExecutor(WithHandler("panic", panicRunner{}))
	f := &Flow{ID: "f", Trigger: Trigger{Kind: "manual"}, Nodes: []Node{{ID: "A", Kind: "panic"}}}
	res := e.Run(context.Background(), f, nil, nil, nil)
	if res.Err == nil {
		t.Fatal("a panicking node must fail the run, not crash the engine")
	}
}

func TestRunCancellation(t *testing.T) {
	br := blockRunner{started: make(chan struct{})}
	e := NewExecutor(WithHandler("block", br))
	f := &Flow{ID: "f", Trigger: Trigger{Kind: "manual"}, Nodes: []Node{{ID: "A", Kind: "block"}}}

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan *RunResult, 1)
	go func() { done <- e.Run(ctx, f, nil, nil, nil) }()
	<-br.started
	cancel()
	select {
	case res := <-done:
		if !errors.Is(res.Err, context.Canceled) {
			t.Errorf("err = %v, want context.Canceled", res.Err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("cancellation did not stop the run promptly")
	}
}

func TestRunLoopCap(t *testing.T) {
	var log []string
	e := NewExecutor(WithHandler("noop", noopRunner{&log}), WithMaxIterations(5))
	f := &Flow{ID: "f", Trigger: Trigger{Kind: "manual"},
		Nodes: []Node{{ID: "A", Kind: "noop"}},
		Edges: []Edge{{From: "A", To: "A", Label: "next"}}} // self-loop

	res := e.Run(context.Background(), f, nil, nil, nil)
	if !errors.Is(res.Err, ErrRunawayLoop) {
		t.Fatalf("err = %v, want ErrRunawayLoop", res.Err)
	}
	if res.Iterations != 6 {
		t.Errorf("iterations = %d, want 6 (cap 5 + the over-limit step)", res.Iterations)
	}
}

func TestRunLocalVarFlowsToExpr(t *testing.T) {
	var log []string
	e := NewExecutor(
		WithHandler("setLocal", setLocalRunner{&log}),
		WithHandler("if", ifRunner{&log}),
		WithHandler("noop", noopRunner{&log}),
	)
	f := &Flow{ID: "f", Trigger: Trigger{Kind: "manual"},
		Nodes: []Node{
			{ID: "A", Kind: "setLocal", Params: map[string]any{"name": "y", "value": 7.0}},
			{ID: "B", Kind: "if", Params: map[string]any{"cond": "y == 7"}},
			{ID: "T", Kind: "noop"},
		},
		Edges: []Edge{{From: "A", To: "B", Label: "next"}, {From: "B", To: "T", Label: "true"}}}

	res := e.Run(context.Background(), f, nil, nil, nil)
	if !res.Completed {
		t.Fatalf("run = %+v", res)
	}
	if len(log) != 3 || log[2] != "T" {
		t.Errorf("path = %v, want [A B T] (local read by expr)", log)
	}
}

func TestStartAsync(t *testing.T) {
	var log []string
	e := NewExecutor(WithHandler("noop", noopRunner{&log}), WithMaxConcurrent(2))
	f := &Flow{ID: "f", Trigger: Trigger{Kind: "manual"}, Nodes: []Node{{ID: "A", Kind: "noop"}}}
	ch, err := e.Start(context.Background(), f, nil, nil, nil)
	if err != nil {
		t.Fatalf("Start: %v", err)
	}
	res := <-ch
	if !res.Completed {
		t.Errorf("async run = %+v", res)
	}
}
