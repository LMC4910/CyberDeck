//go:build windows

package main

import "context"

// startListener (Windows) — DEGRADED STUB in V1.
//
// The clean way to count action-center notifications on Windows is the WinRT
// Windows.UI.Notifications.Management.UserNotificationListener API
// (GetNotificationsAsync + NotificationChanged). That requires:
//   - a live WinRT/COM projection (no stdlib support; pure-Go WinRT projection is
//     non-trivial and would pull a heavyweight cgo/COM dependency into this
//     standalone module), and
//   - the userNotificationListener capability + an explicit, interactive user
//     consent prompt (UserNotificationListenerAccessStatus). Without granted access
//     the API returns Denied and yields nothing.
//
// Rather than ship a fragile half-bound COM path, V1 degrades to "unavailable":
// the listener is a no-op and notification.count stays at 0 (the publish loop in
// main.go keeps emitting it so the state is always present, just zero). Real WinRT
// UserNotificationListener binding is a tracked follow-up. This mirrors the volume
// plugin's V1 stance (stateful-only on Windows) — the contract is honest, not faked.
func startListener(_ context.Context, _ func(int)) {
	// no-op: action-center access unavailable in V1
}
