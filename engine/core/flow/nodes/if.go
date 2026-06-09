package nodes

import "github.com/shishir/cyberdeck/engine/core/flow"

// ifNode evaluates a sandboxed boolean expression (PROJ-201) and branches: the
// "true" edge when the expression is truthy, otherwise the "false" edge. A
// non-boolean / unavailable result is treated as false (the expr safe default).
// params:{expr}.
type ifNode struct{}

func (ifNode) Run(rc *flow.RunContext, n flow.Node) (string, error) {
	v, err := rc.Eval(stringParam(n, "expr"))
	if err != nil {
		return "", err
	}
	if b, ok := v.(bool); ok && b {
		return "true", nil
	}
	return "false", nil
}
