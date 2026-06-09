package nodes

import "github.com/shishir/cyberdeck/engine/core/flow"

// setVarNode evaluates an expression and stores it: a `var.*` name writes the
// durable global variable store (PROJ-164), any other name a run-local. params:
// {name, expr}.
type setVarNode struct{}

func (setVarNode) Run(rc *flow.RunContext, n flow.Node) (string, error) {
	v, err := rc.Eval(stringParam(n, "expr"))
	if err != nil {
		return "", err
	}
	if err := rc.Set(stringParam(n, "name"), v); err != nil {
		return "", err
	}
	return "next", nil
}
