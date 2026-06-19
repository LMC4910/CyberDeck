package main

import "strings"

// rawNote is the OS-independent input to row mapping: an app name plus the
// notification title/body. Per-OS listeners populate it from their native source
// (e.g. WinRT AppInfo.DisplayName + toast text bindings on Windows, decoded from the
// PowerShell JSON). The Go side owns category/icon/color inference so the heuristics
// are unit-testable without any OS hook; toRow is the single source of truth.
type rawNote struct {
	App   string `json:"app"`
	Title string `json:"title"`
	Body  string `json:"body"`
}

// toRow maps a raw notification (app/title/body) to the canonical feed row shape:
//
//	{"title": str, "body": str, "time": str, "icon": str, "color": str, "category": str}
//
// category is inferred from the app/title text (Windows/update/security -> system or
// alerts; everything else -> apps). time is a fixed short relative label ("now")
// because the WinRT listener does not expose a reliable per-notification timestamp;
// it is a short label by contract, not a fabricated age.
func toRow(n rawNote) map[string]any {
	cat := inferCategory(n.App, n.Title, n.Body)
	icon, color := iconColorFor(cat)
	title := n.Title
	if title == "" {
		title = n.App
	}
	return map[string]any{
		"title":    title,
		"body":     n.Body,
		"time":     "now",
		"icon":     icon,
		"color":    color,
		"category": cat,
	}
}

// inferCategory classifies a notification into "apps", "system", or "alerts" from
// its app name / text. Security/critical wording -> alerts; OS/update wording ->
// system; anything else -> apps (the common case for a third-party app toast).
func inferCategory(app, title, body string) string {
	hay := strings.ToLower(app + " " + title + " " + body)
	for _, kw := range []string{"alert", "warning", "critical", "security", "virus", "threat", "defender", "firewall"} {
		if strings.Contains(hay, kw) {
			return "alerts"
		}
	}
	for _, kw := range []string{"windows", "update", "system", "microsoft", "settings", "battery", "storage", "disk"} {
		if strings.Contains(hay, kw) {
			return "system"
		}
	}
	return "apps"
}

// iconColorFor returns the heuristic icon name + color for a category.
func iconColorFor(category string) (icon, color string) {
	switch category {
	case "system":
		return "settings", "blue"
	case "alerts":
		return "alert", "red"
	default: // apps
		return "app", "purple"
	}
}
