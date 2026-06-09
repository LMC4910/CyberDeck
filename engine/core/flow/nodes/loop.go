package nodes

import "github.com/shishir/cyberdeck/engine/core/flow"

// loopNode iterates its body. It is graph-driven: the "body" edge enters the loop
// body (which ends by looping back to this node) and the "next" edge exits. Two
// modes — params.count (a fixed integer count) or params.while (a sandboxed boolean
// expression). The per-node iteration counter lives in a run-local; the executor's
// global iteration cap (PROJ-202) is the ultimate runaway guard.
type loopNode struct{}

func (loopNode) Run(rc *flow.RunContext, n flow.Node) (string, error) {
	// while-expression mode takes precedence when present.
	if whileExpr := stringParam(n, "while"); whileExpr != "" {
		v, err := rc.Eval(whileExpr)
		if err != nil {
			return "", err
		}
		if b, ok := v.(bool); ok && b {
			return "body", nil
		}
		return "next", nil
	}

	// count mode: loop params.count times, tracking progress in a run-local.
	count, _ := floatParam(n, "count")
	key := "__loop." + n.ID
	i := 0
	if v, ok := rc.Local(key); ok {
		if f, ok := v.(float64); ok {
			i = int(f)
		}
	}
	if i < int(count) {
		_ = rc.Set(key, float64(i+1))
		return "body", nil
	}
	_ = rc.Set(key, float64(0)) // reset so a re-entered loop runs again
	return "next", nil
}
