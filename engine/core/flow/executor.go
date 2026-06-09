package flow

import (
	"context"
	"errors"
	"fmt"
)

// DefaultMaxIterations caps the steps in a single run (anti-runaway, 2D §8).
const DefaultMaxIterations = 1000

// StopLabel is returned by a `stop` node to end the run regardless of edges.
const StopLabel = "__stop__"

// DefaultMaxConcurrent bounds concurrent async runs.
const DefaultMaxConcurrent = 16

// Run/flow lifecycle event topics (consumed by audit, PROJ-127).
const (
	TopicFlowRun       = "flow.run"
	TopicFlowCompleted = "flow.completed"
	TopicFlowFailed    = "flow.failed"
)

// Sentinel run errors.
var (
	ErrRunawayLoop = errors.New("flow: iteration cap exceeded (runaway)")
	ErrNoHandler   = errors.New("flow: no handler for node kind")
	ErrNoEntry     = errors.New("flow: no entry node")
)

// NodeRunner executes one node and returns the edge label to follow next ("" =
// default "next" edge). The core node implementations are PROJ-203; the executor
// just drives them. A returned error fails the run.
type NodeRunner interface {
	Run(rc *RunContext, node Node) (next string, err error)
}

// Emitter receives flow lifecycle events (a thin seam over the event bus, PROJ-162;
// nil = no-op).
type Emitter interface {
	Emit(topic string, payload map[string]any)
}

// RunResult summarises a finished run.
type RunResult struct {
	FlowID     string
	Completed  bool
	Iterations int
	Err        error
}

// Executor runs flows step by step over a registry of node handlers.
type Executor struct {
	handlers map[string]NodeRunner
	emit     Emitter
	maxIter  int
	sem      chan struct{}
}

// ExecutorOption configures an Executor.
type ExecutorOption func(*Executor)

// WithHandler registers a node-kind handler.
func WithHandler(kind string, r NodeRunner) ExecutorOption {
	return func(e *Executor) { e.handlers[kind] = r }
}

// Register adds (or replaces) a node-kind handler after construction. The core
// node handlers (PROJ-203) are wired this way without the executor importing them.
func (e *Executor) Register(kind string, r NodeRunner) { e.handlers[kind] = r }

// WithEmitter wires flow lifecycle events.
func WithEmitter(em Emitter) ExecutorOption {
	return func(e *Executor) { e.emit = em }
}

// WithMaxIterations sets the per-run step cap.
func WithMaxIterations(n int) ExecutorOption {
	return func(e *Executor) {
		if n > 0 {
			e.maxIter = n
		}
	}
}

// WithMaxConcurrent bounds concurrent async runs.
func WithMaxConcurrent(n int) ExecutorOption {
	return func(e *Executor) {
		if n > 0 {
			e.sem = make(chan struct{}, n)
		}
	}
}

// NewExecutor builds an executor.
func NewExecutor(opts ...ExecutorOption) *Executor {
	e := &Executor{
		handlers: map[string]NodeRunner{},
		maxIter:  DefaultMaxIterations,
		sem:      make(chan struct{}, DefaultMaxConcurrent),
	}
	for _, o := range opts {
		o(e)
	}
	return e
}

// Run executes a flow synchronously from its entry node, following next/branch
// edges, with cancellation, loop-cap, and safe failure handling. A node error or
// panic fails the run (audited) but never crashes the engine.
func (e *Executor) Run(ctx context.Context, flow *Flow, resolver exprResolver, vars VarWriter, trigger map[string]any) *RunResult {
	res := &RunResult{FlowID: flow.ID}
	e.fire(TopicFlowRun, flow, nil)

	entry := entryNode(flow)
	if entry == nil {
		res.Err = ErrNoEntry
		e.fire(TopicFlowFailed, flow, res.Err)
		return res
	}

	rc := newRunContext(ctx, trigger, resolver, vars)
	current := entry
	for current != nil {
		if err := ctx.Err(); err != nil { // cancellation
			res.Err = err
			e.fire(TopicFlowFailed, flow, err)
			return res
		}
		res.Iterations++
		if res.Iterations > e.maxIter {
			res.Err = ErrRunawayLoop
			e.fire(TopicFlowFailed, flow, res.Err)
			return res
		}

		handler, ok := e.handlers[current.Kind]
		if !ok {
			res.Err = fmt.Errorf("%w: %q", ErrNoHandler, current.Kind)
			e.fire(TopicFlowFailed, flow, res.Err)
			return res
		}

		next, err := runHandler(handler, rc, *current)
		if err != nil {
			res.Err = fmt.Errorf("flow: node %q failed: %w", current.ID, err)
			e.fire(TopicFlowFailed, flow, res.Err)
			return res
		}
		if next == StopLabel { // a `stop` node ends the run regardless of edges
			break
		}
		current = nextNode(flow, current.ID, next)
	}

	res.Completed = true
	e.fire(TopicFlowCompleted, flow, nil)
	return res
}

// exprResolver is the global read view (states + vars) the executor passes into a
// run context for expression evaluation — any states+vars source satisfies it.
type exprResolver interface {
	Lookup(token string) (any, bool)
}

// Start runs a flow asynchronously, respecting the concurrency bound. The returned
// channel yields the result once. Acquiring a slot honours ctx cancellation.
func (e *Executor) Start(ctx context.Context, flow *Flow, resolver exprResolver, vars VarWriter, trigger map[string]any) (<-chan *RunResult, error) {
	select {
	case e.sem <- struct{}{}:
	case <-ctx.Done():
		return nil, ctx.Err()
	}
	out := make(chan *RunResult, 1)
	go func() {
		defer func() { <-e.sem }()
		out <- e.Run(ctx, flow, resolver, vars, trigger)
	}()
	return out, nil
}

// runHandler invokes a node handler, converting a panic into an error so a faulty
// node never crashes the engine (NFR-07).
func runHandler(h NodeRunner, rc *RunContext, node Node) (next string, err error) {
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("flow: node handler panicked: %v", r)
		}
	}()
	return h.Run(rc, node)
}

func (e *Executor) fire(topic string, flow *Flow, runErr error) {
	if e.emit == nil {
		return
	}
	payload := map[string]any{"flowId": flow.ID}
	if runErr != nil {
		payload["error"] = runErr.Error()
	}
	e.emit.Emit(topic, payload)
}

// entryNode returns the first node with no incoming edge; if every node has an
// incoming edge (a cycle), it falls back to the first declared node.
func entryNode(f *Flow) *Node {
	if len(f.Nodes) == 0 {
		return nil
	}
	incoming := make(map[string]bool, len(f.Edges))
	for _, e := range f.Edges {
		incoming[e.To] = true
	}
	for i := range f.Nodes {
		if !incoming[f.Nodes[i].ID] {
			return &f.Nodes[i]
		}
	}
	return &f.Nodes[0]
}

// nextNode follows the edge from fromID with the given label ("" → "next"). Returns
// nil when there is no matching outgoing edge (the run ends).
func nextNode(f *Flow, fromID, label string) *Node {
	want := label
	if want == "" {
		want = "next"
	}
	for _, e := range f.Edges {
		if e.From != fromID {
			continue
		}
		edgeLabel := e.Label
		if edgeLabel == "" {
			edgeLabel = "next"
		}
		if edgeLabel == want {
			return node(f, e.To)
		}
	}
	return nil
}

func node(f *Flow, id string) *Node {
	for i := range f.Nodes {
		if f.Nodes[i].ID == id {
			return &f.Nodes[i]
		}
	}
	return nil
}
