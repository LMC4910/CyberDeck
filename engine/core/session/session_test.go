package session

import (
	"testing"

	"github.com/shishir/cyberdeck/engine/core/security"
)

func TestSessionIsolation(t *testing.T) {
	m := NewManager()
	a := m.Create("dev-a", security.Permissions{AllowedCategories: []string{"media"}})
	b := m.Create("dev-b", security.Permissions{AllowedCategories: []string{"system"}})

	a.SetActiveProfile(&Profile{ID: "game", Label: "Gaming"})
	b.SetActiveProfile(&Profile{ID: "work", Label: "Work"})
	a.Subscriptions().Add("system.cpu.temp")
	a.SetMode(ModeEdit)

	// The two sessions must not share state.
	if b.ActiveProfile().ID == a.ActiveProfile().ID {
		t.Error("sessions share active profile")
	}
	if b.Subscriptions().Contains("system.cpu.temp") {
		t.Error("subscription leaked from session a into b")
	}
	if b.Mode() != ModeRuntime {
		t.Errorf("session b mode = %s, want runtime (a's edit-mode flip leaked)", b.Mode())
	}
	if a.Permissions().AllowedCategories[0] == b.Permissions().AllowedCategories[0] {
		t.Error("sessions share permission snapshot")
	}
}

func TestManagerTeardown(t *testing.T) {
	m := NewManager()
	m.Create("dev-1", security.Permissions{})
	if m.Count() != 1 {
		t.Fatalf("count = %d, want 1", m.Count())
	}
	if !m.Teardown("dev-1") {
		t.Error("Teardown reported no session, want true")
	}
	if _, ok := m.Get("dev-1"); ok {
		t.Error("session still present after teardown")
	}
	if m.Teardown("dev-1") {
		t.Error("second Teardown reported a session, want false")
	}
	if m.Count() != 0 {
		t.Errorf("count = %d, want 0", m.Count())
	}
}

func TestModeDefaultsAndFlip(t *testing.T) {
	s := NewManager().Create("d", security.Permissions{})
	if s.Mode() != ModeRuntime {
		t.Errorf("default mode = %s, want runtime", s.Mode())
	}
	s.SetMode(ModeEdit)
	if s.Mode() != ModeEdit || !s.Mode().Valid() {
		t.Errorf("mode after flip = %s", s.Mode())
	}
}

func TestActivationFieldAndInertHook(t *testing.T) {
	rule := &ActivationRule{Kind: "appFocus", Match: "Cyberpunk2077.exe"}
	p := &Profile{ID: "game", Label: "Gaming", ActivationRule: rule, Pages: []string{"page_dash", "page_stats"}}

	// Field round-trips on the profile.
	if p.ActivationRule.Kind != "appFocus" || p.ActivationRule.Match != "Cyberpunk2077.exe" {
		t.Errorf("activation rule not held: %+v", p.ActivationRule)
	}
	if len(p.Pages) != 2 {
		t.Errorf("pages = %v, want 2", p.Pages)
	}

	// The hook is inert in V1: never auto-switches, regardless of signal.
	res := EvaluateActivation(rule, "Cyberpunk2077.exe")
	if res.ShouldSwitch {
		t.Error("EvaluateActivation auto-switched in V1; the hook must be inert")
	}
}
