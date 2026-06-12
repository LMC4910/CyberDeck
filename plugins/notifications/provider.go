// Command notifications is the first-party CyberDeck notification-count plugin
// (PROJ-176). It publishes notification.count (the number of notifications sitting
// in the OS action center). V1 is count-only: no per-notification content, no
// actions. The count is sourced by a per-OS listener (listener_<goos>.go) that
// pushes updates on add/clear; where the OS restricts programmatic access the
// listener degrades to "unavailable" and the count stays at 0 (documented per OS).
// The provider holds the authoritative count and is fully mockable so the count
// logic is unit-testable without any OS hook.
package main

import "sync"

// stCount is the published state ID: the action-center notification count.
const stCount = "notification.count"

// provider holds the authoritative notification count. All access is serialised so
// the listener goroutine and the publish loop never race.
type provider struct {
	mu    sync.Mutex
	count int
}

func newProvider() *provider { return &provider{} }

// snapshot returns the current count (for publishing). Never negative.
func (p *provider) snapshot() int {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.count
}

// setCount sets the count to an absolute value (the common case: a listener that
// reports the full action-center count). Clamped at 0 — a count is never negative.
func (p *provider) setCount(n int) {
	if n < 0 {
		n = 0
	}
	p.mu.Lock()
	p.count = n
	p.mu.Unlock()
}

// add increments the count by delta (for listeners that only report add/remove
// deltas rather than an absolute total). The result is clamped at 0.
func (p *provider) add(delta int) {
	p.mu.Lock()
	p.count += delta
	if p.count < 0 {
		p.count = 0
	}
	p.mu.Unlock()
}

// clear resets the count to 0 (action center emptied / "clear all").
func (p *provider) clear() {
	p.mu.Lock()
	p.count = 0
	p.mu.Unlock()
}
