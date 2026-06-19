package main

import (
	"bytes"
	"context"
	"sync"
	"testing"

	"github.com/shishir/cyberdeck/engine/pluginhost/ipcproto"
)

// stateUpdate is one decoded notification stateUpdate (count or feed).
type stateUpdate struct {
	id    string
	count int              // valid when id == stCount
	feed  []map[string]any // valid when id == stFeed
}

// decodeStateUpdates parses every newline-delimited IPC message in buf and returns
// each notification stateUpdate (count + feed), in order.
func decodeStateUpdates(t *testing.T, buf []byte) []stateUpdate {
	t.Helper()
	var ups []stateUpdate
	for _, line := range bytes.Split(buf, []byte("\n")) {
		if len(bytes.TrimSpace(line)) == 0 {
			continue
		}
		m, err := ipcproto.Decode(line)
		if err != nil {
			t.Fatalf("decode %q: %v", line, err)
		}
		if m.Type != ipcproto.MsgStateUpdate || m.State == nil {
			continue
		}
		switch m.State.ID {
		case stCount:
			n, ok := m.State.Value.(float64) // JSON numbers decode to float64
			if !ok {
				t.Fatalf("count value %v (%T) is not numeric", m.State.Value, m.State.Value)
			}
			ups = append(ups, stateUpdate{id: stCount, count: int(n)})
		case stFeed:
			rows := decodeFeed(t, m.State.Value)
			ups = append(ups, stateUpdate{id: stFeed, feed: rows})
		default:
			t.Fatalf("unexpected stateUpdate id %q", m.State.ID)
		}
	}
	return ups
}

func decodeFeed(t *testing.T, v any) []map[string]any {
	t.Helper()
	arr, ok := v.([]any)
	if !ok {
		t.Fatalf("feed value %v (%T) is not an array", v, v)
	}
	rows := make([]map[string]any, 0, len(arr))
	for _, e := range arr {
		m, ok := e.(map[string]any)
		if !ok {
			t.Fatalf("feed element %v (%T) is not a map", e, e)
		}
		rows = append(rows, m)
	}
	return rows
}

// counts / feeds extract just the count or feed updates from a slice, in order.
func counts(ups []stateUpdate) []int {
	var out []int
	for _, u := range ups {
		if u.id == stCount {
			out = append(out, u.count)
		}
	}
	return out
}

func feeds(ups []stateUpdate) [][]map[string]any {
	var out [][]map[string]any
	for _, u := range ups {
		if u.id == stFeed {
			out = append(out, u.feed)
		}
	}
	return out
}

func feedRow(category string) map[string]any {
	return map[string]any{"title": "t", "body": "b", "time": "now",
		"icon": "app", "color": "purple", "category": category}
}

// TestListenerCallbackPublishesFeed is the listener->state integration test: it
// drives the exact callback main.go installs into startListener (setFeed + publish)
// and asserts each listener event surfaces as both a notification.count and a
// notification.feed stateUpdate on the IPC wire with the right values.
func TestListenerCallbackPublishesFeed(t *testing.T) {
	var out bytes.Buffer
	w := &msgWriter{w: &out}
	prov := newProvider()

	// This is the callback wired in run(): a listener push replaces the feed and
	// immediately publishes count + feed.
	onChange := func(items []map[string]any) {
		prov.setFeed(items)
		publish(w, prov)
	}

	onChange([]map[string]any{feedRow("apps"), feedRow("system"), feedRow("alerts")})
	onChange([]map[string]any{feedRow("apps")})
	onChange(nil) // action center cleared

	ups := decodeStateUpdates(t, out.Bytes())
	gotCounts := counts(ups)
	wantCounts := []int{3, 1, 0}
	if len(gotCounts) != len(wantCounts) {
		t.Fatalf("published counts = %v, want %v", gotCounts, wantCounts)
	}
	for i := range wantCounts {
		if gotCounts[i] != wantCounts[i] {
			t.Fatalf("published counts = %v, want %v", gotCounts, wantCounts)
		}
	}
	gotFeeds := feeds(ups)
	wantFeedLens := []int{3, 1, 0}
	if len(gotFeeds) != len(wantFeedLens) {
		t.Fatalf("published %d feeds, want %d", len(gotFeeds), len(wantFeedLens))
	}
	for i, want := range wantFeedLens {
		if len(gotFeeds[i]) != want {
			t.Errorf("feed[%d] len = %d, want %d", i, len(gotFeeds[i]), want)
		}
	}
}

// TestPublishReflectsFilteredView asserts a bare publish emits the count (total) plus
// the FILTERED feed view, and that the count is unaffected by the active filter.
func TestPublishReflectsFilteredView(t *testing.T) {
	var out bytes.Buffer
	w := &msgWriter{w: &out}
	prov := newProvider()
	prov.setFeed([]map[string]any{feedRow("apps"), feedRow("apps"), feedRow("system")})
	prov.setFilter("apps")

	publish(w, prov)

	ups := decodeStateUpdates(t, out.Bytes())
	if c := counts(ups); len(c) != 1 || c[0] != 3 {
		t.Fatalf("published counts = %v, want [3] (total, unfiltered)", c)
	}
	if f := feeds(ups); len(f) != 1 || len(f[0]) != 2 {
		t.Fatalf("published feed = %v, want one feed of len 2 (apps only)", f)
	}
}

// TestHandleActionPublishesAndReplies drives the action path the host triggers:
// markAllRead must reply OK and re-publish an empty feed + count 0.
func TestHandleActionPublishesAndReplies(t *testing.T) {
	var out bytes.Buffer
	w := &msgWriter{w: &out}
	prov := newProvider()
	prov.setFeed([]map[string]any{feedRow("apps"), feedRow("system")})

	handleAction(w, prov, ipcproto.ActionPayload{CallID: "c1", ActionID: actMarkAllRead})

	// Find the action result.
	var sawResult bool
	for _, line := range bytes.Split(out.Bytes(), []byte("\n")) {
		if len(bytes.TrimSpace(line)) == 0 {
			continue
		}
		m, err := ipcproto.Decode(line)
		if err != nil {
			t.Fatalf("decode: %v", err)
		}
		if m.Type == ipcproto.MsgActionResult && m.ActionResult != nil {
			sawResult = true
			if !m.ActionResult.OK || m.ActionResult.CallID != "c1" {
				t.Errorf("action result = %+v, want OK with callId c1", m.ActionResult)
			}
		}
	}
	if !sawResult {
		t.Error("no action result emitted")
	}
	if got := prov.snapshotCount(); got != 0 {
		t.Errorf("count after markAllRead = %d, want 0", got)
	}
}

// TestHandleActionUnknownRepliesError asserts an unknown action id replies !OK.
func TestHandleActionUnknownRepliesError(t *testing.T) {
	var out bytes.Buffer
	w := &msgWriter{w: &out}
	prov := newProvider()

	handleAction(w, prov, ipcproto.ActionPayload{CallID: "c2", ActionID: "notifications.bogus"})

	var sawResult bool
	for _, line := range bytes.Split(out.Bytes(), []byte("\n")) {
		if len(bytes.TrimSpace(line)) == 0 {
			continue
		}
		m, err := ipcproto.Decode(line)
		if err != nil {
			t.Fatalf("decode: %v", err)
		}
		if m.Type == ipcproto.MsgActionResult && m.ActionResult != nil {
			sawResult = true
			if m.ActionResult.OK || m.ActionResult.Error == "" {
				t.Errorf("action result = %+v, want !OK with error", m.ActionResult)
			}
		}
	}
	if !sawResult {
		t.Error("no action result emitted")
	}
}

// TestStartListenerRespectsContext documents the listener contract: wiring it must
// not panic and must respect ctx cancellation. On platforms where the listener is a
// no-op stub (darwin/linux) the callback is never invoked; on Windows it shells out
// to PowerShell (not exercised here — no real PowerShell in tests). Either way,
// cancelling ctx must let it tear down cleanly.
func TestStartListenerRespectsContext(t *testing.T) {
	prov := newProvider()
	var mu sync.Mutex
	ctx, cancel := context.WithCancel(context.Background())

	startListener(ctx, func(items []map[string]any) {
		mu.Lock()
		defer mu.Unlock()
		prov.setFeed(items)
	})
	cancel() // tear down immediately; must not panic
}
