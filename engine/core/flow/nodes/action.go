package nodes

import "github.com/shishir/cyberdeck/engine/core/flow"

// actionNode dispatches a registered action through the permission gate (PROJ-125)
// and audit (PROJ-127). Authorization is mandatory and never bypassed: a denied
// action is audited and fails the node. params:{actionId, params}.
type actionNode struct{ d Deps }

func (a actionNode) Run(rc *flow.RunContext, n flow.Node) (string, error) {
	actionID := stringParam(n, "actionId")
	params := mapParam(n, "params")
	fields := map[string]any{"actionId": actionID, "node": n.ID}

	if a.d.Gate != nil {
		if err := a.d.Gate.Authorize(rc.Ctx, actionID, params); err != nil {
			a.d.audit("flow.action.denied", fields)
			return "", err
		}
	}
	if a.d.Dispatch != nil {
		if err := a.d.Dispatch.Dispatch(rc.Ctx, actionID, params); err != nil {
			a.d.audit("flow.action.failed", fields)
			return "", err
		}
	}
	a.d.audit("flow.action.executed", fields)
	return "next", nil
}
