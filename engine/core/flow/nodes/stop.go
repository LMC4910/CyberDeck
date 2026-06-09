package nodes

import "github.com/shishir/cyberdeck/engine/core/flow"

// stopNode ends the run immediately, regardless of any outgoing edges (it returns
// the executor's StopLabel sentinel).
type stopNode struct{}

func (stopNode) Run(_ *flow.RunContext, _ flow.Node) (string, error) {
	return flow.StopLabel, nil
}
