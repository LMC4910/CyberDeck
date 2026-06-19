// Command notifications is the first-party CyberDeck notification plugin
// (PROJ-176). V2 publishes a real action-center FEED plus the unread count and a
// set of actions (mark-all-read, server-side category filters, history ack). The
// feed rows are sourced by a per-OS listener (listener_<goos>.go) that pushes the
// FULL set of rows on change; where the OS restricts programmatic access the
// listener degrades to "unavailable" and the feed stays empty (documented per OS).
// The provider holds the authoritative feed + filter + count and is fully mockable
// so the feed/filter/action logic is unit-testable without any OS hook.
package main

import (
	"fmt"
	"sync"
)

// Published state ids.
const (
	stCount = "notification.count" // total unread notifications (int)
	stFeed  = "notification.feed"  // filtered list of notification rows (see row shape below)
)

// Action ids (Category "notification").
const (
	actMarkAllRead  = "notifications.markAllRead"
	actFilterAll    = "notifications.filter.all"
	actFilterApps   = "notifications.filter.apps"
	actFilterSystem = "notifications.filter.system"
	actFilterAlerts = "notifications.filter.alerts"
	actHistory      = "notifications.history"
)

// A feed row is a map[string]any with this shape:
//
//	{"title": str, "body": str, "time": str, "icon": str, "color": str, "category": "apps"|"system"|"alerts"}
//
// time is a short relative label like "2m"/"1h"; icon/color are chosen heuristically.

// provider holds the authoritative feed, the active server-side filter, and the
// unread count. All access is serialised so the listener goroutine, the publish
// loop, and action handlers never race.
type provider struct {
	mu     sync.Mutex
	full   []map[string]any // every row the listener last reported
	filter string           // ""/"all"/"apps"/"system"/"alerts" — "" and "all" both mean no filter
	count  int              // total unread notifications (== len(full) at setFeed time; not changed by filtering)
}

func newProvider() *provider { return &provider{} }

// setFeed replaces the full feed with items and sets count to len(items). The
// active filter is preserved (the next view() reflects it).
func (p *provider) setFeed(items []map[string]any) {
	p.mu.Lock()
	p.full = items
	p.count = len(items)
	p.mu.Unlock()
}

// setFilter sets the active category filter ("", "all", "apps", "system",
// "alerts"). Filtering changes the published view but never the count.
func (p *provider) setFilter(f string) {
	p.mu.Lock()
	p.filter = f
	p.mu.Unlock()
}

// clear empties the feed, resets the count to 0, and drops the active filter
// (mark-all-read / "clear all").
func (p *provider) clear() {
	p.mu.Lock()
	p.full = nil
	p.count = 0
	p.filter = ""
	p.mu.Unlock()
}

// view returns the feed filtered by the active category. "all"/"" returns every
// row. The result is a fresh slice (callers may publish it without holding the
// lock). Always non-nil so an empty feed marshals as [] rather than null.
func (p *provider) view() []map[string]any {
	p.mu.Lock()
	defer p.mu.Unlock()
	out := make([]map[string]any, 0, len(p.full))
	for _, row := range p.full {
		if p.filter == "" || p.filter == "all" {
			out = append(out, row)
			continue
		}
		if cat, _ := row["category"].(string); cat == p.filter {
			out = append(out, row)
		}
	}
	return out
}

// snapshotCount returns the total unread count (unaffected by filtering).
func (p *provider) snapshotCount() int {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.count
}

// snapshotView is an alias for view(): the filtered rows to publish.
func (p *provider) snapshotView() []map[string]any { return p.view() }

// execute runs an action by id and returns an error for unknown ids. Filters and
// mark-all-read mutate provider state; history is an honest ack (no persistent
// history store, so the caller just re-publishes the current view). The caller
// publishes after execute returns so the change reaches the deck immediately.
func (p *provider) execute(actionID string) error {
	switch actionID {
	case actMarkAllRead:
		p.clear()
	case actFilterAll:
		p.setFilter("all")
	case actFilterApps:
		p.setFilter("apps")
	case actFilterSystem:
		p.setFilter("system")
	case actFilterAlerts:
		p.setFilter("alerts")
	case actHistory:
		// No persistent history store to fabricate. Honest placeholder: ack OK and
		// let the caller re-publish the current view. Documented in manifest/contributes.
	default:
		return fmt.Errorf("unknown action: %s", actionID)
	}
	return nil
}
