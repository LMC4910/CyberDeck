package main

import (
	"sync"
	"testing"
)

// row builds a feed row with the given category (title/body/icon/color don't matter
// for filter/count tests).
func row(category string) map[string]any {
	return map[string]any{"title": "t", "body": "b", "time": "now",
		"icon": "app", "color": "purple", "category": category}
}

func TestSetFeedSetsCount(t *testing.T) {
	p := newProvider()
	if got := p.snapshotCount(); got != 0 {
		t.Fatalf("initial count = %d, want 0", got)
	}
	p.setFeed([]map[string]any{row("apps"), row("system"), row("alerts")})
	if got := p.snapshotCount(); got != 3 {
		t.Errorf("count = %d, want 3", got)
	}
	if got := len(p.snapshotView()); got != 3 {
		t.Errorf("view len = %d, want 3 (no filter)", got)
	}
	// A later feed replaces, it does not accumulate.
	p.setFeed([]map[string]any{row("apps")})
	if got := p.snapshotCount(); got != 1 {
		t.Errorf("count = %d, want 1", got)
	}
}

func TestFilterViewSelectsByCategory(t *testing.T) {
	p := newProvider()
	p.setFeed([]map[string]any{row("apps"), row("apps"), row("system"), row("alerts")})

	cases := map[string]int{"all": 4, "": 4, "apps": 2, "system": 1, "alerts": 1}
	for f, want := range cases {
		p.setFilter(f)
		if got := len(p.snapshotView()); got != want {
			t.Errorf("filter %q view len = %d, want %d", f, got, want)
		}
		// Filtering never changes the count.
		if got := p.snapshotCount(); got != 4 {
			t.Errorf("filter %q count = %d, want 4 (unchanged)", f, got)
		}
	}
}

func TestViewIsNonNilAndCategoryMatches(t *testing.T) {
	p := newProvider()
	p.setFeed([]map[string]any{row("apps"), row("system")})
	p.setFilter("system")
	v := p.snapshotView()
	if v == nil {
		t.Fatal("view returned nil; want non-nil slice")
	}
	if len(v) != 1 || v[0]["category"] != "system" {
		t.Fatalf("filtered view = %v, want one system row", v)
	}
	// An empty result is still a non-nil empty slice (marshals as []).
	p.setFilter("alerts")
	if v := p.snapshotView(); v == nil || len(v) != 0 {
		t.Fatalf("empty filtered view = %v, want non-nil empty slice", v)
	}
}

func TestMarkAllReadClearsEverything(t *testing.T) {
	p := newProvider()
	p.setFeed([]map[string]any{row("apps"), row("system")})
	p.setFilter("apps")
	if err := p.execute(actMarkAllRead); err != nil {
		t.Fatalf("markAllRead: %v", err)
	}
	if got := p.snapshotCount(); got != 0 {
		t.Errorf("count after markAllRead = %d, want 0", got)
	}
	if got := p.snapshotView(); len(got) != 0 {
		t.Errorf("view after markAllRead = %v, want empty", got)
	}
}

func TestClearResetsFilter(t *testing.T) {
	p := newProvider()
	p.setFeed([]map[string]any{row("apps")})
	p.setFilter("system")
	p.clear()
	// After clear, a fresh feed must show with no residual filter.
	p.setFeed([]map[string]any{row("apps"), row("system")})
	if got := len(p.snapshotView()); got != 2 {
		t.Errorf("view after clear+setFeed = %d, want 2 (filter reset)", got)
	}
}

func TestExecuteFiltersSetActiveFilter(t *testing.T) {
	p := newProvider()
	p.setFeed([]map[string]any{row("apps"), row("system"), row("alerts")})
	for _, tc := range []struct {
		action string
		want   int
	}{
		{actFilterAll, 3},
		{actFilterApps, 1},
		{actFilterSystem, 1},
		{actFilterAlerts, 1},
	} {
		if err := p.execute(tc.action); err != nil {
			t.Fatalf("execute %q: %v", tc.action, err)
		}
		if got := len(p.snapshotView()); got != tc.want {
			t.Errorf("after %q view len = %d, want %d", tc.action, got, tc.want)
		}
	}
}

func TestUnknownActionErrors(t *testing.T) {
	p := newProvider()
	if err := p.execute("notifications.bogus"); err == nil {
		t.Error("execute(unknown) = nil, want error")
	}
}

func TestHistoryReturnsOK(t *testing.T) {
	p := newProvider()
	p.setFeed([]map[string]any{row("apps")})
	if err := p.execute(actHistory); err != nil {
		t.Errorf("history = %v, want nil (honest ack)", err)
	}
	// history is a no-op placeholder: the view is unchanged.
	if got := len(p.snapshotView()); got != 1 {
		t.Errorf("view after history = %d, want 1 (unchanged)", got)
	}
}

func TestInferCategory(t *testing.T) {
	cases := []struct {
		app, title, body, want string
	}{
		{"Slack", "New message", "hey there", "apps"},
		{"Windows Update", "Restart needed", "", "system"},
		{"Microsoft Defender", "Threat detected", "virus found", "alerts"},
		{"Settings", "Battery low", "", "system"},
		{"Discord", "DM", "ping", "apps"},
	}
	for _, c := range cases {
		if got := inferCategory(c.app, c.title, c.body); got != c.want {
			t.Errorf("inferCategory(%q,%q,%q) = %q, want %q", c.app, c.title, c.body, got, c.want)
		}
	}
}

func TestToRowShape(t *testing.T) {
	r := toRow(rawNote{App: "Slack", Title: "Hi", Body: "world"})
	for _, k := range []string{"title", "body", "time", "icon", "color", "category"} {
		if _, ok := r[k]; !ok {
			t.Errorf("row missing key %q: %v", k, r)
		}
	}
	if r["category"] != "apps" || r["icon"] != "app" || r["color"] != "purple" {
		t.Errorf("app row = %v, want apps/app/purple", r)
	}
	// Title falls back to the app name when no toast title text is present.
	r2 := toRow(rawNote{App: "Slack", Title: "", Body: "x"})
	if r2["title"] != "Slack" {
		t.Errorf("title fallback = %v, want app name", r2["title"])
	}
}

// TestConcurrentMutationRace exercises the mutex under -race: a writer goroutine
// mutates feed + filter while a reader snapshots count + view.
func TestConcurrentMutationRace(t *testing.T) {
	p := newProvider()
	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		defer wg.Done()
		for i := 0; i < 1000; i++ {
			p.setFeed([]map[string]any{row("apps"), row("system")})
			p.setFilter("apps")
			p.clear()
		}
	}()
	go func() {
		defer wg.Done()
		for i := 0; i < 1000; i++ {
			_ = p.snapshotCount()
			_ = p.snapshotView()
		}
	}()
	wg.Wait()
}
