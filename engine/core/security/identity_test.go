package security

import (
	"bytes"
	"encoding/base64"
	"strings"
	"testing"

	"github.com/shishir/cyberdeck/engine/core/security/secretstore"
	"github.com/shishir/cyberdeck/engine/internal/secrets"
)

// memPublicStore is an in-memory PublicStore for tests (stands in for the
// SQLite/meta-backed store from PROJ-113).
type memPublicStore struct {
	m map[string]string
}

func newMemPublicStore() *memPublicStore { return &memPublicStore{m: map[string]string{}} }

func (s *memPublicStore) GetString(k string) (string, bool, error) {
	v, ok := s.m[k]
	return v, ok, nil
}
func (s *memPublicStore) SetString(k, v string) error {
	s.m[k] = v
	return nil
}

func TestCreateThenLoad(t *testing.T) {
	sec := secretstore.NewMemoryStore()
	pub := newMemPublicStore()

	id1, err := LoadOrCreate(sec, pub, "engine-1")
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	// Second call loads the same identity (idempotent).
	id2, err := LoadOrCreate(sec, pub, "engine-1")
	if err != nil {
		t.Fatalf("load: %v", err)
	}

	if id1.UUID != id2.UUID {
		t.Errorf("UUID changed across reload: %s vs %s", id1.UUID, id2.UUID)
	}
	if id1.UUID == "" {
		t.Error("empty UUID")
	}
	if !bytes.Equal(id1.SigningPublicKey(), id2.SigningPublicKey()) {
		t.Error("public key changed across reload")
	}
}

func TestSignVerifyAcrossReload(t *testing.T) {
	sec := secretstore.NewMemoryStore()
	pub := newMemPublicStore()

	id1, err := LoadOrCreate(sec, pub, "e")
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	id2, err := LoadOrCreate(sec, pub, "e") // loaded from stores
	if err != nil {
		t.Fatalf("load: %v", err)
	}

	msg := []byte("handshake-nonce")
	sig := id2.Sign(msg)
	if !id1.Verify(msg, sig) {
		t.Error("signature from reloaded identity did not verify against original public key")
	}
	if id2.Verify([]byte("tampered"), sig) {
		t.Error("verify accepted a tampered message")
	}
}

func TestPrivateSeedOnlyInSecretStore(t *testing.T) {
	sec := secretstore.NewMemoryStore()
	pub := newMemPublicStore()

	if _, err := LoadOrCreate(sec, pub, "e"); err != nil {
		t.Fatalf("create: %v", err)
	}

	// The secret store holds the 32-byte Ed25519 seed.
	seed, err := sec.Get(secretKeySigningSeed)
	if err != nil {
		t.Fatalf("seed not in secret store: %v", err)
	}
	if seed.Len() != 32 {
		t.Errorf("seed length = %d, want 32", seed.Len())
	}

	// The public store must NOT contain the seed in any form.
	seedB64 := base64.StdEncoding.EncodeToString(seed.Reveal())
	seedRaw := string(seed.Reveal())
	for k, v := range pub.m {
		if strings.Contains(v, seedB64) || strings.Contains(v, seedRaw) {
			t.Errorf("public store key %q leaked the private seed", k)
		}
	}
	// And the public store DOES have the public material.
	if _, ok := pub.m[pubKeyUUID]; !ok {
		t.Error("public store missing uuid")
	}
	if _, ok := pub.m[pubKeySigningPK]; !ok {
		t.Error("public store missing public key")
	}
}

func TestIdentityStringRedactsSeed(t *testing.T) {
	sec := secretstore.NewMemoryStore()
	pub := newMemPublicStore()
	id, err := LoadOrCreate(sec, pub, "e")
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	seed, _ := sec.Get(secretKeySigningSeed)
	seedB64 := base64.StdEncoding.EncodeToString(seed.Reveal())

	s := id.String()
	if strings.Contains(s, seedB64) {
		t.Errorf("Identity.String leaked the seed: %s", s)
	}
	if !strings.Contains(s, secrets.Redacted) {
		t.Errorf("Identity.String = %q, want it to redact the seed with %q", s, secrets.Redacted)
	}
}

func TestIdentityResetWhenSeedMissing(t *testing.T) {
	sec := secretstore.NewMemoryStore()
	pub := newMemPublicStore()
	if _, err := LoadOrCreate(sec, pub, "e"); err != nil {
		t.Fatalf("create: %v", err)
	}
	// Simulate private-key loss: delete the seed but keep public material.
	if err := sec.Delete(secretKeySigningSeed); err != nil {
		t.Fatalf("delete seed: %v", err)
	}
	if _, err := LoadOrCreate(sec, pub, "e"); err == nil {
		t.Error("LoadOrCreate succeeded with missing private seed, want identity-reset error")
	}
}
