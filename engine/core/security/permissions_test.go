package security

import "testing"

// actionDesc is a test ActionDescriptor.
type actionDesc struct {
	id          string
	category    string
	destructive bool
}

func (a actionDesc) ActionID() string    { return a.id }
func (a actionDesc) Category() string    { return a.category }
func (a actionDesc) IsDestructive() bool { return a.destructive }

func TestAuthorizeTruthTable(t *testing.T) {
	mediaPerms := Permissions{
		AllowPowerActions: false,
		AllowedCategories: []string{"media", "home"},
		DeniedActions:     []string{"media.nuke"},
	}
	powerPerms := Permissions{
		AllowPowerActions: true,
		AllowedCategories: []string{"system"},
	}

	cases := []struct {
		name       string
		ctx        AuthContext
		action     actionDesc
		wantAllow  bool
		wantReason Reason
	}{
		{
			name:      "all gates pass → allow",
			ctx:       AuthContext{Authenticated: true, Perms: mediaPerms},
			action:    actionDesc{id: "media.play", category: "media"},
			wantAllow: true, wantReason: ReasonOK,
		},
		{
			name:      "not authenticated → reject",
			ctx:       AuthContext{Authenticated: false, Perms: mediaPerms},
			action:    actionDesc{id: "media.play", category: "media"},
			wantAllow: false, wantReason: ReasonUnauthenticated,
		},
		{
			name:      "revoked → reject",
			ctx:       AuthContext{Authenticated: true, Revoked: true, Perms: mediaPerms},
			action:    actionDesc{id: "media.play", category: "media"},
			wantAllow: false, wantReason: ReasonUnauthenticated,
		},
		{
			name:      "category not allowed → reject",
			ctx:       AuthContext{Authenticated: true, Perms: mediaPerms},
			action:    actionDesc{id: "system.reboot", category: "system"},
			wantAllow: false, wantReason: ReasonCategory,
		},
		{
			name:      "empty allowedCategories → reject (fail-closed)",
			ctx:       AuthContext{Authenticated: true, Perms: Permissions{}},
			action:    actionDesc{id: "media.play", category: "media"},
			wantAllow: false, wantReason: ReasonCategory,
		},
		{
			name:      "explicitly denied action → reject",
			ctx:       AuthContext{Authenticated: true, Perms: mediaPerms},
			action:    actionDesc{id: "media.nuke", category: "media"},
			wantAllow: false, wantReason: ReasonDenied,
		},
		{
			name:      "destructive without allowPowerActions → reject (P1-AC-07)",
			ctx:       AuthContext{Authenticated: true, Perms: mediaPerms},
			action:    actionDesc{id: "media.delete", category: "media", destructive: true},
			wantAllow: false, wantReason: ReasonDestructive,
		},
		{
			name:      "destructive with allowPowerActions → allow",
			ctx:       AuthContext{Authenticated: true, Perms: powerPerms},
			action:    actionDesc{id: "system.reboot", category: "system", destructive: true},
			wantAllow: true, wantReason: ReasonOK,
		},
	}

	for _, c := range cases {
		got := Authorize(c.ctx, c.action)
		if got.Allowed != c.wantAllow || got.Reason != c.wantReason {
			t.Errorf("%s: Authorize = {allowed:%v reason:%q}, want {allowed:%v reason:%q}",
				c.name, got.Allowed, got.Reason, c.wantAllow, c.wantReason)
		}
	}
}

// TestAuthorizeCheckOrder confirms earlier gates take precedence (a revoked device
// with an otherwise-forbidden action is rejected for being revoked first).
func TestAuthorizeCheckOrder(t *testing.T) {
	ctx := AuthContext{Authenticated: true, Revoked: true, Perms: Permissions{}}
	got := Authorize(ctx, actionDesc{id: "x", category: "none", destructive: true})
	if got.Reason != ReasonUnauthenticated {
		t.Errorf("check order: reason = %q, want %q (revocation checked first)", got.Reason, ReasonUnauthenticated)
	}
}

func TestParsePermissions(t *testing.T) {
	p, err := ParsePermissions(`{"allowPowerActions":true,"allowedCategories":["media"],"deniedActions":["x"],"allowEditTrigger":true}`)
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if !p.AllowPowerActions || len(p.AllowedCategories) != 1 || p.AllowedCategories[0] != "media" ||
		len(p.DeniedActions) != 1 || !p.AllowEditTrigger {
		t.Errorf("parsed perms unexpected: %+v", p)
	}
	// Empty string → fail-closed zero value.
	z, err := ParsePermissions("")
	if err != nil || z.AllowPowerActions || len(z.AllowedCategories) != 0 {
		t.Errorf("empty parse = %+v, %v; want zero perms", z, err)
	}
	// Malformed JSON → error.
	if _, err := ParsePermissions("{bad"); err == nil {
		t.Error("malformed permissions JSON accepted, want error")
	}
}
