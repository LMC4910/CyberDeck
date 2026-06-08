package pluginhost

import (
	"sync"
	"testing"
	"time"
)

func TestAllowNetworkLevels(t *testing.T) {
	cases := []struct {
		granted, requested string
		want               bool
	}{
		{"none", "none", true},
		{"none", "localhost", false},
		{"none", "outbound", false},
		{"localhost", "localhost", true},
		{"localhost", "none", true},
		{"localhost", "outbound", false},
		{"outbound", "outbound", true},
		{"outbound", "localhost", true},
		{"", "localhost", false}, // unset = none
	}
	for _, c := range cases {
		if got := AllowNetwork(c.granted, c.requested); got != c.want {
			t.Errorf("AllowNetwork(%q,%q) = %v, want %v", c.granted, c.requested, got, c.want)
		}
	}
}

func TestAllowFilesystemLevels(t *testing.T) {
	cases := []struct {
		granted, requested string
		want               bool
	}{
		{"none", "none", true},
		{"none", "own-dir", false},
		{"own-dir", "own-dir", true},
		{"own-dir", "none", true},
		{"", "own-dir", false},
	}
	for _, c := range cases {
		if got := AllowFilesystem(c.granted, c.requested); got != c.want {
			t.Errorf("AllowFilesystem(%q,%q) = %v, want %v", c.granted, c.requested, got, c.want)
		}
	}
}

type recDenier struct {
	mu    sync.Mutex
	calls [][3]string
}

func (d *recDenier) PluginDenied(p, k, det string) {
	d.mu.Lock()
	d.calls = append(d.calls, [3]string{p, k, det})
	d.mu.Unlock()
}
func (d *recDenier) has(kind, detail string) bool {
	d.mu.Lock()
	defer d.mu.Unlock()
	for _, c := range d.calls {
		if c[1] == kind && c[2] == detail {
			return true
		}
	}
	return false
}

func TestUndeclaredStateRejectedAndAudited(t *testing.T) {
	setter := newRecSetter()
	denier := &recDenier{}
	h := NewHost(WithStateSetter(setter), WithAuditDenier(denier), WithHeartbeatTimeout(200*time.Millisecond))
	p, err := h.Launch(spec("rogue"))
	if err != nil {
		t.Fatalf("Launch: %v", err)
	}
	defer func() { _ = p.Close() }()

	// The declared state is accepted.
	eventually(t, 5*time.Second, func() bool {
		v, ok := setter.get("test.state")
		return ok && v == 42.0
	}, "declared state not applied")

	// The undeclared state is rejected (never reaches the setter) and audited.
	eventually(t, 5*time.Second, func() bool {
		return denier.has("state", "undeclared.secret")
	}, "undeclared-state denial not audited")

	if _, ok := setter.get("undeclared.secret"); ok {
		t.Error("undeclared state was applied to the state store (boundary not enforced)")
	}
}

func TestCheckNetworkFilesystemAuditsDenial(t *testing.T) {
	denier := &recDenier{}
	h := NewHost(WithAuditDenier(denier), WithLogger(quietHost().logger))
	// A plugin granted only localhost network and NO filesystem access.
	p := &Plugin{name: "p", host: h, perms: ManifestPermissions{Network: "localhost", Filesystem: "none"}}

	if !p.CheckNetwork("localhost") {
		t.Error("granted localhost network wrongly denied")
	}
	if p.CheckNetwork("outbound") {
		t.Error("over-grant outbound network wrongly allowed")
	}
	if !denier.has("network", "outbound") {
		t.Error("network over-access not audited")
	}
	if p.CheckFilesystem("own-dir") {
		t.Error("filesystem over-access (own-dir) wrongly allowed for a none-grant plugin")
	}
	if !denier.has("filesystem", "own-dir") {
		t.Error("filesystem over-access not audited")
	}
}
