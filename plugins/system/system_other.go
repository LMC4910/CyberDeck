//go:build !windows

// Non-Windows system controller: performance-plan switching, recycle-bin and
// temp-cache ops have no portable cross-platform implementation here yet, so they
// report unavailable (the mode cards stay un-highlighted; utilities are no-ops).
package main

func newSysControl() sysControl { return noopControl{} }
