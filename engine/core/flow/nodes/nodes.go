// Package nodes implements the nine built-in flow node types (2D §3): the
// execution semantics dispatched by the flow executor (PROJ-202). Each node is a
// flow.NodeRunner. This package imports flow (the executor never imports nodes →
// no cycle); the real engine wiring registers these handlers with an executor via
// Register, injecting the security/host/session collaborators through Deps.
//
// The action node is the critical security path: it always authorizes through the
// injected gate (PROJ-125) and audits (PROJ-127) — it never bypasses authorize().
package nodes

import (
	"context"
	"time"

	"github.com/shishir/cyberdeck/engine/core/flow"
)

// ActionGate authorizes an action before dispatch (PROJ-125 authorize()). A
// non-nil error denies execution. Injected so this package stays decoupled from
// the concrete permission model.
type ActionGate interface {
	Authorize(ctx context.Context, actionID string, params map[string]any) error
}

// ActionDispatcher executes an authorized action (built-in or via the plugin host,
// PROJ-130). A non-nil error fails the node (handled by the executor).
type ActionDispatcher interface {
	Dispatch(ctx context.Context, actionID string, params map[string]any) error
}

// Auditor records an audit event (PROJ-127). Every action attempt — allowed,
// denied, or failed — is audited.
type Auditor interface {
	Audit(event string, fields map[string]any)
}

// NavigateSink receives a navigation directive aimed at the triggering session
// (PROJ-163): e.g. {"page": "..."} or {"profile": "..."}.
type NavigateSink interface {
	Navigate(target map[string]any)
}

// SubflowRunner invokes another flow by id at the given recursion depth. The
// implementation enforces the engine-level concurrency/loop policy; this package
// enforces the depth cap before calling.
type SubflowRunner interface {
	RunSubflow(ctx context.Context, flowID string, depth int) error
}

// DefaultMaxSubflowDepth bounds nested subflow invocation (anti-recursion).
const DefaultMaxSubflowDepth = 8

// Deps bundles the collaborators the built-in nodes need. All fields are optional:
// a nil gate/dispatcher/auditor/navigate/subflow makes the corresponding node a
// safe no-op (it still follows its "next" edge) so flows remain runnable in tests
// and minimal hosts. Sleep/Rand default to real implementations when nil.
type Deps struct {
	Gate     ActionGate
	Dispatch ActionDispatcher
	Audit    Auditor
	Navigate NavigateSink
	Subflow  SubflowRunner

	// Sleep is the cancellable delay used by the wait node (nil → real timer).
	Sleep func(ctx context.Context, d time.Duration) error
	// Rand returns a value in [0,n) used by the random node (nil → crypto rand).
	Rand func(n int) int
	// MaxSubflowDepth caps nested subflows (0 → DefaultMaxSubflowDepth).
	MaxSubflowDepth int
}

func (d Deps) maxSubflowDepth() int {
	if d.MaxSubflowDepth > 0 {
		return d.MaxSubflowDepth
	}
	return DefaultMaxSubflowDepth
}

func (d Deps) audit(event string, fields map[string]any) {
	if d.Audit != nil {
		d.Audit.Audit(event, fields)
	}
}

// All returns the nine built-in node handlers keyed by node kind, ready to register
// with an executor.
func All(d Deps) map[string]flow.NodeRunner {
	return map[string]flow.NodeRunner{
		"action":   actionNode{d},
		"if":       ifNode{},
		"setVar":   setVarNode{},
		"wait":     waitNode{d},
		"loop":     loopNode{},
		"navigate": navigateNode{d},
		"random":   randomNode{d},
		"subflow":  subflowNode{d},
		"stop":     stopNode{},
	}
}

// Register wires all nine built-in node handlers into an executor.
func Register(e *flow.Executor, d Deps) {
	for kind, runner := range All(d) {
		e.Register(kind, runner)
	}
}

// --- shared param helpers ---

func stringParam(n flow.Node, key string) string {
	s, _ := n.Params[key].(string)
	return s
}

func mapParam(n flow.Node, key string) map[string]any {
	m, _ := n.Params[key].(map[string]any)
	return m
}

// floatParam coerces a numeric param (JSON numbers decode to float64); ok=false
// when the key is absent or not numeric.
func floatParam(n flow.Node, key string) (float64, bool) {
	switch v := n.Params[key].(type) {
	case float64:
		return v, true
	case int:
		return float64(v), true
	case int64:
		return float64(v), true
	default:
		return 0, false
	}
}
