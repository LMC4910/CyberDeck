//go:build !windows

// Non-Windows media controller: no portable transport / now-playing source here, so
// transport is a no-op and now-playing reports unavailable (the card shows its demo
// fallback). A Linux playerctl/MPRIS implementation is a future follow-up.
package main

func newMediaControl() mediaControl { return noopMedia{} }
