package nodes

import (
	"errors"

	"github.com/shishir/cyberdeck/engine/core/flow"
)

// ErrSubflowDepthExceeded is returned when nested subflow invocation passes the
// depth cap (anti-recursion).
var ErrSubflowDepthExceeded = errors.New("flow: subflow depth cap exceeded")

// subflowNode invokes another flow by id (params.flowId), depth-capped. The current
// depth is carried in a run-local seeded by the parent run; this node enforces the
// cap before invoking and passes the incremented depth to the child run. With no
// runner wired it is a no-op.
type subflowNode struct{ d Deps }

func (s subflowNode) Run(rc *flow.RunContext, n flow.Node) (string, error) {
	if s.d.Subflow == nil {
		return "next", nil
	}
	depth := 0
	if v, ok := rc.Local("__subflow.depth"); ok {
		if f, ok := v.(float64); ok {
			depth = int(f)
		}
	}
	if depth >= s.d.maxSubflowDepth() {
		return "", ErrSubflowDepthExceeded
	}
	if err := s.d.Subflow.RunSubflow(rc.Ctx, stringParam(n, "flowId"), depth+1); err != nil {
		return "", err
	}
	return "next", nil
}
