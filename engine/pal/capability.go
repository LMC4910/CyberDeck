package pal

// Capability convention (2G §3 / ADR-0007): capability interface methods return
// `(value, ok)`. ok=false means the capability is currently unavailable — a
// NORMAL return, not an error: a bound state simply reads "--", nothing panics.
//
// PAL owns *which* provider answers and its priority; the plugin host (2F) owns
// execution and isolation. A provider lives inside a plugin process.

// Provider is one ordered provider of capability T. Probe must be cheap and
// side-effect-free; it reports whether this provider can currently serve.
type Provider[T any] interface {
	// Name identifies the provider (for diagnostics / BoundName).
	Name() string
	// Probe reports current availability (cheap, side-effect-free).
	Probe() bool
	// Capability returns the capability implementation this provider exposes.
	Capability() T
}
