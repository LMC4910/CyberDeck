package security

import (
	"context"
	"encoding/json"
	"testing"
	"time"
)

func TestTokenIssueValidateSingleUse(t *testing.T) {
	iss := NewTokenIssuer()
	tok, err := iss.Issue(true)
	if err != nil {
		t.Fatalf("Issue: %v", err)
	}
	if tok == "" {
		t.Fatal("expected a non-empty token")
	}
	if err := iss.Validate(tok); err != nil {
		t.Errorf("first Validate = %v, want nil", err)
	}
	if err := iss.Validate(tok); err == nil {
		t.Error("second Validate must fail (single-use)")
	}
}

func TestTokenNonPrivilegedRefused(t *testing.T) {
	iss := NewTokenIssuer()
	if _, err := iss.Issue(false); err == nil {
		t.Error("Issue(false) must be refused (privileged-only)")
	}
}

func TestTokenExpiry(t *testing.T) {
	now := time.Unix(1000, 0)
	iss := NewTokenIssuer(WithTokenTTL(time.Minute), WithTokenClock(func() time.Time { return now }))
	tok, _ := iss.Issue(true)
	now = now.Add(2 * time.Minute) // past TTL
	if err := iss.Validate(tok); err == nil {
		t.Error("an expired token must not validate")
	}
}

func TestTokenAuthorizeConsumes(t *testing.T) {
	iss := NewTokenIssuer()
	tok, _ := iss.Issue(true)
	if err := iss.Authorize(context.Background(), ClientHello{Token: tok}); err != nil {
		t.Errorf("Authorize = %v, want nil", err)
	}
	if err := iss.Authorize(context.Background(), ClientHello{Token: tok}); err == nil {
		t.Error("Authorize must reject a reused token")
	}
	if err := iss.Authorize(context.Background(), ClientHello{Token: "never-issued"}); err == nil {
		t.Error("Authorize must reject an unknown token")
	}
}

func TestPairingPayloadJSONShape(t *testing.T) {
	p := PairingPayload{Addresses: []string{"192.168.1.20"}, Port: 8765, Token: "tok", FP: "abcd"}
	s, err := p.JSON()
	if err != nil {
		t.Fatal(err)
	}
	var m map[string]any
	if err := json.Unmarshal([]byte(s), &m); err != nil {
		t.Fatalf("payload is not valid JSON: %v", err)
	}
	for _, k := range []string{"addresses", "port", "token", "fp"} {
		if _, ok := m[k]; !ok {
			t.Errorf("payload JSON missing key %q (client requires it): %s", k, s)
		}
	}
	if m["token"] != "tok" || m["fp"] != "abcd" {
		t.Errorf("payload fields = %v", m)
	}

	// BuildPairingPayload should assemble without error on this host.
	if _, err := BuildPairingPayload(8765, "tok", "abcd"); err != nil {
		t.Errorf("BuildPairingPayload: %v", err)
	}
}
