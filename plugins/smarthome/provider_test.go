package main

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

// TestToggleFamilyFlipsAndPersists checks that every .toggle action flips and
// persists the bound boolean in local-state mode (ha nil).
func TestToggleFamilyFlipsAndPersists(t *testing.T) {
	p := newProvider(nil)
	for _, id := range toggleStateIDs {
		before, _, _ := p.snapshot()
		want := !before[id]
		if err := p.execute(id+toggleSuffix, nil); err != nil {
			t.Fatalf("execute %s: %v", id+toggleSuffix, err)
		}
		after, _, _ := p.snapshot()
		if after[id] != want {
			t.Errorf("%s: got %v, want %v", id, after[id], want)
		}
		// Flip again → back to original (persists across calls).
		if err := p.execute(id+toggleSuffix, nil); err != nil {
			t.Fatalf("execute %s (2): %v", id+toggleSuffix, err)
		}
		if again, _, _ := p.snapshot(); again[id] != before[id] {
			t.Errorf("%s: second toggle did not restore original", id)
		}
	}
}

func TestUnknownActionErrors(t *testing.T) {
	p := newProvider(nil)
	if err := p.execute("home.bogus.toggle", nil); err == nil {
		t.Error("unknown toggle should error")
	}
	if err := p.execute("totally.unrelated", nil); err == nil {
		t.Error("unrelated action should error")
	}
}

func TestUnknownSceneErrors(t *testing.T) {
	p := newProvider(nil)
	if err := p.execute("home.scene.bogus", nil); err == nil {
		t.Error("unknown scene should error")
	}
	// Known scenes succeed (momentary, no state change, no HA).
	for _, s := range scenes {
		if err := p.execute(scenePrefix+s, nil); err != nil {
			t.Errorf("scene %s should succeed: %v", s, err)
		}
	}
}

func TestSceneDoesNotChangeState(t *testing.T) {
	p := newProvider(nil)
	before, _, _ := p.snapshot()
	if err := p.execute("home.scene.movie", nil); err != nil {
		t.Fatal(err)
	}
	after, _, _ := p.snapshot()
	for k, v := range before {
		if after[k] != v {
			t.Errorf("scene changed state %s: %v → %v", k, v, after[k])
		}
	}
}

func TestNewHAClientFromEnv(t *testing.T) {
	// Absent creds → nil.
	t.Setenv("CYBERDECK_HA_URL", "")
	t.Setenv("CYBERDECK_HA_TOKEN", "")
	if c := newHAClientFromEnv(); c != nil {
		t.Error("expected nil client when creds absent")
	}

	// URL but no token → nil.
	t.Setenv("CYBERDECK_HA_URL", "http://ha.local:8123")
	t.Setenv("CYBERDECK_HA_TOKEN", "")
	if c := newHAClientFromEnv(); c != nil {
		t.Error("expected nil client when token absent")
	}

	// Full creds + entity map → parsed client.
	t.Setenv("CYBERDECK_HA_URL", "http://ha.local:8123/")
	t.Setenv("CYBERDECK_HA_TOKEN", "tok123")
	t.Setenv("CYBERDECK_HA_ENTITYMAP", `{"home.lights.ceiling":"light.ceiling","home.tv":"media_player.tv"}`)
	c := newHAClientFromEnv()
	if c == nil {
		t.Fatal("expected non-nil client with full creds")
	}
	if c.base != "http://ha.local:8123" {
		t.Errorf("base = %q, want trailing slash trimmed", c.base)
	}
	if c.token != "tok123" {
		t.Errorf("token = %q", c.token)
	}
	if e, ok := c.entityFor("home.lights.ceiling"); !ok || e != "light.ceiling" {
		t.Errorf("entityFor(ceiling) = (%q, %v)", e, ok)
	}
	if _, ok := c.entityFor("home.unmapped"); ok {
		t.Error("unmapped control id should not resolve")
	}
}

// TestHARequestShaping stands up a fake HA server and asserts a .toggle of a
// mapped light produces POST /api/services/light/turn_on with the entity_id and
// bearer auth header.
func TestHARequestShaping(t *testing.T) {
	type got struct {
		method string
		path   string
		auth   string
		body   map[string]string
	}
	recv := make(chan got, 1)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var b map[string]string
		raw, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(raw, &b)
		recv <- got{method: r.Method, path: r.URL.Path, auth: r.Header.Get("Authorization"), body: b}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("{}"))
	}))
	defer srv.Close()

	c := &haClient{
		base:      srv.URL,
		token:     "tok123",
		hc:        &http.Client{Timeout: 5 * time.Second},
		entityMap: map[string]string{stLightsCeil: "light.ceiling"},
	}
	p := newProvider(c)
	// Ceiling defaults off → toggling turns it on.
	if err := p.execute(stLightsCeil+toggleSuffix, nil); err != nil {
		t.Fatalf("execute: %v", err)
	}

	select {
	case g := <-recv:
		if g.method != http.MethodPost {
			t.Errorf("method = %s, want POST", g.method)
		}
		if g.path != "/api/services/light/turn_on" {
			t.Errorf("path = %s, want /api/services/light/turn_on", g.path)
		}
		if g.auth != "Bearer tok123" {
			t.Errorf("auth = %q, want Bearer tok123", g.auth)
		}
		if g.body["entity_id"] != "light.ceiling" {
			t.Errorf("entity_id = %q, want light.ceiling", g.body["entity_id"])
		}
	case <-time.After(2 * time.Second):
		t.Fatal("no request received")
	}
}

func TestHAStatesRefresh(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/states" {
			http.NotFound(w, r)
			return
		}
		_, _ = w.Write([]byte(`[
			{"entity_id":"light.ceiling","state":"on"},
			{"entity_id":"sensor.power","state":"123.5"}
		]`))
	}))
	defer srv.Close()

	c := &haClient{
		base:  srv.URL,
		token: "tok",
		hc:    &http.Client{Timeout: 5 * time.Second},
		entityMap: map[string]string{
			stLightsCeil: "light.ceiling",
			stEnergyNow:  "sensor.power",
		},
	}
	p := newProvider(c)
	p.refreshFromHA()
	state, energyW, energyOK := p.snapshot()
	if !state[stLightsCeil] {
		t.Error("ceiling should be on after refresh")
	}
	if !energyOK || energyW != 123.5 {
		t.Errorf("energy = (%v, %v), want (123.5, true)", energyW, energyOK)
	}
}
