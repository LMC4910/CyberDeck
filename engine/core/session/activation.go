package session

// ActivationRule declares when a profile should auto-activate (e.g. on app focus).
// In V1 the rule is stored and the evaluation hook exists, but the consumer that
// actually auto-switches is Phase 2 (Doc 0 §12 foundation seam).
type ActivationRule struct {
	Kind  string `json:"kind"`  // e.g. "appFocus"
	Match string `json:"match"` // e.g. "Cyberpunk2077.exe"
}

// ActivationResult is the outcome of evaluating an activation rule.
type ActivationResult struct {
	ShouldSwitch bool
	ProfileID    string
}

// EvaluateActivation is the V1-inert evaluation hook. It exists so the foundation
// seam is in place, but it never triggers an auto-switch — the auto-switch
// consumer arrives in Phase 2. It always returns no-switch.
func EvaluateActivation(_ *ActivationRule, _ any) ActivationResult {
	return ActivationResult{ShouldSwitch: false}
}
