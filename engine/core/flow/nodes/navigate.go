package nodes

import "github.com/shishir/cyberdeck/engine/core/flow"

// navigateNode emits a navigation directive to the triggering session (PROJ-163):
// params may carry {page} and/or {profile}. With no sink wired it is a no-op.
type navigateNode struct{ d Deps }

func (nav navigateNode) Run(_ *flow.RunContext, n flow.Node) (string, error) {
	if nav.d.Navigate != nil {
		target := map[string]any{}
		if page := stringParam(n, "page"); page != "" {
			target["page"] = page
		}
		if profile := stringParam(n, "profile"); profile != "" {
			target["profile"] = profile
		}
		nav.d.Navigate.Navigate(target)
	}
	return "next", nil
}
