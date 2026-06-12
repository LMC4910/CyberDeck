//go:build linux

package main

import "context"

// startListener (Linux) — DEGRADED STUB in V1.
//
// There is no single portable source of the "action center" notification count on
// Linux: notifications flow over the org.freedesktop.Notifications D-Bus interface,
// but that interface is fire-and-forget (Notify / NotificationClosed signals) and
// does not expose a stored count — the persistent list lives inside whichever
// desktop shell (GNOME Shell, KDE Plasma, mako, dunst, …) owns the name, each with
// its own private store and no common count query. Snooping the session bus to tally
// Notify minus NotificationClosed signals only works while we are running and only
// for notifications sent after we connect, and pulls a D-Bus dependency into this
// standalone module.
//
// V1 therefore degrades to "unavailable": the listener is a no-op and
// notification.count stays at 0 (still published every tick by main.go). A D-Bus
// signal-tally listener (shell-specific where a count query exists) is a tracked
// follow-up.
func startListener(_ context.Context, _ func(int)) {
	// no-op: no portable action-center count source in V1
}
