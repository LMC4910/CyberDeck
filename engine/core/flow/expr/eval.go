package expr

import (
	"fmt"
	"math"
)

// Context resolves a state/var token to its typed value. ok=false means the token
// is unavailable, which the evaluator treats as a safe default (nil) — never a
// crash. It is intentionally the ONLY external surface the evaluator touches.
type Context interface {
	Lookup(token string) (value any, ok bool)
}

// MapContext is a simple map-backed Context (states + vars merged by the caller).
type MapContext map[string]any

// Lookup implements Context.
func (m MapContext) Lookup(token string) (any, bool) {
	v, ok := m[token]
	return v, ok
}

// Eval parses and evaluates an expression against a context.
func Eval(src string, ctx Context) (any, error) {
	e, err := Parse(src)
	if err != nil {
		return nil, err
	}
	return EvalAST(e, ctx)
}

// EvalAST evaluates a parsed expression. Values are float64 | string | bool | nil.
func EvalAST(e Expr, ctx Context) (any, error) {
	switch n := e.(type) {
	case Literal:
		return n.Value, nil
	case Ident:
		if ctx != nil {
			if v, ok := ctx.Lookup(n.Name); ok {
				return v, nil
			}
		}
		return nil, nil // unavailable token → safe default
	case Unary:
		return evalUnary(n, ctx)
	case Binary:
		return evalBinary(n, ctx)
	default:
		return nil, fmt.Errorf("expr: unknown node %T", e)
	}
}

func evalUnary(n Unary, ctx Context) (any, error) {
	v, err := EvalAST(n.X, ctx)
	if err != nil {
		return nil, err
	}
	switch n.Op {
	case "!":
		return !truthy(v), nil
	case "-":
		if v == nil {
			return nil, nil
		}
		num, ok := asNum(v)
		if !ok {
			return nil, fmt.Errorf("expr: unary '-' needs a number, got %T", v)
		}
		return -num, nil
	default:
		return nil, fmt.Errorf("expr: unknown unary %q", n.Op)
	}
}

func evalBinary(n Binary, ctx Context) (any, error) {
	// Boolean operators short-circuit.
	if n.Op == "&&" || n.Op == "||" {
		l, err := EvalAST(n.L, ctx)
		if err != nil {
			return nil, err
		}
		if n.Op == "&&" && !truthy(l) {
			return false, nil
		}
		if n.Op == "||" && truthy(l) {
			return true, nil
		}
		r, err := EvalAST(n.R, ctx)
		if err != nil {
			return nil, err
		}
		return truthy(r), nil
	}

	l, err := EvalAST(n.L, ctx)
	if err != nil {
		return nil, err
	}
	r, err := EvalAST(n.R, ctx)
	if err != nil {
		return nil, err
	}

	switch n.Op {
	case "==":
		return equals(l, r), nil
	case "!=":
		return !equals(l, r), nil
	case "<", "<=", ">", ">=":
		// Unavailable operand → safe default false (no crash).
		ln, lok := asNum(l)
		rn, rok := asNum(r)
		if l == nil || r == nil {
			return false, nil
		}
		if !lok || !rok {
			return nil, fmt.Errorf("expr: comparison needs numbers, got %T and %T", l, r)
		}
		switch n.Op {
		case "<":
			return ln < rn, nil
		case "<=":
			return ln <= rn, nil
		case ">":
			return ln > rn, nil
		default:
			return ln >= rn, nil
		}
	case "+":
		if l == nil || r == nil {
			return nil, nil
		}
		ls, lIsStr := l.(string)
		rs, rIsStr := r.(string)
		if lIsStr && rIsStr {
			return ls + rs, nil
		}
		ln, lok := asNum(l)
		rn, rok := asNum(r)
		if lok && rok {
			return ln + rn, nil
		}
		return nil, fmt.Errorf("expr: '+' needs two numbers or two strings, got %T and %T", l, r)
	case "-", "*", "/", "%":
		if l == nil || r == nil {
			return nil, nil
		}
		ln, lok := asNum(l)
		rn, rok := asNum(r)
		if !lok || !rok {
			return nil, fmt.Errorf("expr: %q needs numbers, got %T and %T", n.Op, l, r)
		}
		switch n.Op {
		case "-":
			return ln - rn, nil
		case "*":
			return ln * rn, nil
		case "/":
			if rn == 0 {
				return nil, fmt.Errorf("expr: division by zero")
			}
			return ln / rn, nil
		default:
			if rn == 0 {
				return nil, fmt.Errorf("expr: modulo by zero")
			}
			return math.Mod(ln, rn), nil
		}
	default:
		return nil, fmt.Errorf("expr: unknown operator %q", n.Op)
	}
}

func truthy(v any) bool {
	switch x := v.(type) {
	case bool:
		return x
	case float64:
		return x != 0
	case string:
		return x != ""
	case nil:
		return false
	default:
		return false
	}
}

func equals(l, r any) bool {
	if l == nil || r == nil {
		return l == nil && r == nil
	}
	if ln, lok := asNum(l); lok {
		if rn, rok := asNum(r); rok {
			return ln == rn
		}
		return false
	}
	switch lv := l.(type) {
	case string:
		rv, ok := r.(string)
		return ok && lv == rv
	case bool:
		rv, ok := r.(bool)
		return ok && lv == rv
	default:
		return false
	}
}

func asNum(v any) (float64, bool) {
	switch n := v.(type) {
	case float64:
		return n, true
	case float32:
		return float64(n), true
	case int:
		return float64(n), true
	case int64:
		return float64(n), true
	default:
		return 0, false
	}
}
