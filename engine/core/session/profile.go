package session

// Profile is a named set of pages with an optional activation rule (2B §5.2). A
// session has one active profile at a time; navigation switches page/profile
// within the session.
type Profile struct {
	ID             string
	Label          string
	ActivationRule *ActivationRule // optional; evaluated (inert) by EvaluateActivation
	Pages          []string        // ordered page IDs
}
