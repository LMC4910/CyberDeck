package flow

import (
	"context"
	"strings"

	"github.com/shishir/cyberdeck/engine/core/flow/expr"
)

// VarWriter persists a global var.* write (PROJ-164). Injected so the flow package
// stays decoupled from the concrete var manager.
type VarWriter interface {
	SetVar(name string, value any) error
}

// RunContext is the per-run scope: node-local variables, read access to global
// states + var.* (via a resolver), the trigger payload, and cancellation. It
// implements expr.Context so conditions evaluate over locals + globals (locals
// shadow globals).
type RunContext struct {
	Ctx     context.Context
	Trigger map[string]any

	locals   map[string]any
	resolver expr.Context // global states + vars (read)
	vars     VarWriter    // global var.* (write)
}

// NewRunContext builds a run context (the executor uses this internally; it is
// exported so node implementations and embedding hosts can construct one — e.g. a
// subflow runner seeding a child run's locals).
func NewRunContext(ctx context.Context, trigger map[string]any, resolver expr.Context, vars VarWriter) *RunContext {
	return newRunContext(ctx, trigger, resolver, vars)
}

func newRunContext(ctx context.Context, trigger map[string]any, resolver expr.Context, vars VarWriter) *RunContext {
	if trigger == nil {
		trigger = map[string]any{}
	}
	return &RunContext{
		Ctx:      ctx,
		Trigger:  trigger,
		locals:   map[string]any{},
		resolver: resolver,
		vars:     vars,
	}
}

// Lookup resolves a token (expr.Context): a local shadows a global; an unknown
// token reports ok=false (the expression evaluator treats that as a safe default).
func (rc *RunContext) Lookup(token string) (any, bool) {
	if v, ok := rc.locals[token]; ok {
		return v, true
	}
	if rc.resolver != nil {
		return rc.resolver.Lookup(token)
	}
	return nil, false
}

// Set writes a variable: `var.*` goes to the global var store (durable), anything
// else is a run-local.
func (rc *RunContext) Set(token string, value any) error {
	if strings.HasPrefix(token, "var.") && rc.vars != nil {
		return rc.vars.SetVar(token, value)
	}
	rc.locals[token] = value
	return nil
}

// Local reads a run-local value.
func (rc *RunContext) Local(name string) (any, bool) {
	v, ok := rc.locals[name]
	return v, ok
}

// Eval evaluates an expression over this run context (locals + globals).
func (rc *RunContext) Eval(condition string) (any, error) {
	return expr.Eval(condition, rc)
}
