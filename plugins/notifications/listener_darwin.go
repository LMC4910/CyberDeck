//go:build darwin

package main

import "context"

// startListener (macOS) — DEGRADED STUB.
//
// macOS does not expose a public, sandbox-safe API for reading another process's
// Notification Center contents. The notification database
// (~/Library/Group Containers/group.com.apple.usernoted/db2/db) is private,
// SIP/TCC-protected, and its schema changes between OS releases; reading it is
// unsupported and would break on signed/sandboxed builds. There is no public
// AppKit/UserNotifications API to enumerate the system-wide delivered notifications
// for arbitrary apps.
//
// This therefore degrades to "unavailable": the listener is a no-op and the feed
// stays empty (count 0), still published every tick by main.go. A future version
// could surface notifications this app itself posts via
// UNUserNotificationCenter.getDeliveredNotifications, which is the only supported
// path — tracked as a follow-up.
func startListener(_ context.Context, _ func([]map[string]any)) {
	// no-op: system-wide Notification Center access unavailable
}
