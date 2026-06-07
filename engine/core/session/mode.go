// Package session implements the engine's per-device session and profile model
// (TRD 2B §5 / ADR-0002). Sessions are isolated — two sessions never share mutable
// state — which is the "no confusion which device" guarantee and lets two devices
// show different profiles simultaneously.
package session

// Mode is a session's interaction mode. The designer flips a session to edit mode
// for live authoring/preview (PROJ-212); everything else runs in runtime mode.
type Mode string

const (
	ModeRuntime Mode = "runtime"
	ModeEdit    Mode = "edit"
)

// Valid reports whether m is a known mode.
func (m Mode) Valid() bool { return m == ModeRuntime || m == ModeEdit }
