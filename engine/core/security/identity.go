// Identity: the engine's long-lived cryptographic identity (2E §2 / ADR-0008,
// ADR-0016). It exists from first launch with NO account: an Ed25519 signing
// keypair plus a random 128-bit UUID. The private seed is stored only in the OS
// secret store (PROJ-121) — never in SQLite, config, or logs. Loss of the private
// key is an identity reset (no escrow, ADR-0016).
package security

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"

	"github.com/shishir/cyberdeck/engine/core/security/secretstore"
	"github.com/shishir/cyberdeck/engine/internal/secrets"
)

// Secret-store key for the Ed25519 private seed (32 bytes).
const secretKeySigningSeed = "identity.signing.seed"

// PublicStore keys for non-secret identity material.
const (
	pubKeyUUID      = "identity.uuid"
	pubKeyLabel     = "identity.label"
	pubKeySigningPK = "identity.signing.public"
)

// PublicStore persists non-secret identity material (UUID, label, public key).
// PROJ-113's repo_meta / repo_devices will back this; it is injected here so the
// identity module does not depend on the not-yet-built repository layer.
type PublicStore interface {
	GetString(key string) (value string, ok bool, err error)
	SetString(key, value string) error
}

// Identity is the engine's long-lived identity. The private seed is held as a
// redaction-safe Secret, so no field of Identity can leak the key via fmt/log.
type Identity struct {
	UUID          string
	Label         string
	signingPublic ed25519.PublicKey
	seed          secrets.Secret // 32-byte Ed25519 seed
}

// LoadOrCreate loads the engine identity if present, else creates it on first
// launch. It is idempotent: subsequent calls return the same identity. It needs
// no account (account-independent — ADR-0016).
func LoadOrCreate(sec secretstore.SecretStore, pub PublicStore, label string) (*Identity, error) {
	uuid, ok, err := pub.GetString(pubKeyUUID)
	if err != nil {
		return nil, fmt.Errorf("identity: read uuid: %w", err)
	}
	if ok {
		return load(sec, pub, uuid)
	}
	return create(sec, pub, label)
}

func create(sec secretstore.SecretStore, pub PublicStore, label string) (*Identity, error) {
	pubKey, privKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return nil, fmt.Errorf("identity: generate keypair: %w", err)
	}
	uuid, err := newUUIDv4()
	if err != nil {
		return nil, fmt.Errorf("identity: generate uuid: %w", err)
	}
	seed := secrets.New(privKey.Seed())

	// Private seed → secret store ONLY. Public material → public store.
	if err := sec.Set(secretKeySigningSeed, seed); err != nil {
		return nil, fmt.Errorf("identity: store private seed: %w", err)
	}
	if err := pub.SetString(pubKeyUUID, uuid); err != nil {
		return nil, fmt.Errorf("identity: store uuid: %w", err)
	}
	if err := pub.SetString(pubKeyLabel, label); err != nil {
		return nil, fmt.Errorf("identity: store label: %w", err)
	}
	if err := pub.SetString(pubKeySigningPK, base64.StdEncoding.EncodeToString(pubKey)); err != nil {
		return nil, fmt.Errorf("identity: store public key: %w", err)
	}

	return &Identity{UUID: uuid, Label: label, signingPublic: pubKey, seed: seed}, nil
}

func load(sec secretstore.SecretStore, pub PublicStore, uuid string) (*Identity, error) {
	label, _, err := pub.GetString(pubKeyLabel)
	if err != nil {
		return nil, fmt.Errorf("identity: read label: %w", err)
	}
	pkB64, ok, err := pub.GetString(pubKeySigningPK)
	if err != nil {
		return nil, fmt.Errorf("identity: read public key: %w", err)
	}
	if !ok {
		return nil, errors.New("identity: uuid present but public key missing (corrupt identity)")
	}
	pubKey, err := base64.StdEncoding.DecodeString(pkB64)
	if err != nil {
		return nil, fmt.Errorf("identity: decode public key: %w", err)
	}
	if len(pubKey) != ed25519.PublicKeySize {
		return nil, fmt.Errorf("identity: bad public key length %d", len(pubKey))
	}

	seed, err := sec.Get(secretKeySigningSeed)
	if err != nil {
		// No escrow: a missing private key is an identity reset, not a soft error.
		return nil, fmt.Errorf("identity: private seed unavailable (identity reset): %w", err)
	}
	if seed.Len() != ed25519.SeedSize {
		return nil, fmt.Errorf("identity: bad seed length %d", seed.Len())
	}

	return &Identity{UUID: uuid, Label: label, signingPublic: ed25519.PublicKey(pubKey), seed: seed}, nil
}

// SigningPublicKey returns the Ed25519 public key (safe to share/advertise).
func (i *Identity) SigningPublicKey() ed25519.PublicKey {
	return i.signingPublic
}

// Sign signs msg with the engine's Ed25519 private key (used for handshake nonce
// signatures, PROJ-123).
func (i *Identity) Sign(msg []byte) []byte {
	priv := ed25519.NewKeyFromSeed(i.seed.Reveal())
	return ed25519.Sign(priv, msg)
}

// Verify checks a signature against this identity's public key.
func (i *Identity) Verify(msg, sig []byte) bool {
	return ed25519.Verify(i.signingPublic, msg, sig)
}

// SigningSeed returns the 32-byte Ed25519 seed as a redaction-safe Secret, for
// the crypto suite (PROJ-122) to derive the X25519 ECDH key from. Callers must
// not log or persist it outside the secret store.
func (i *Identity) SigningSeed() secrets.Secret {
	return i.seed
}

// String renders the identity without leaking the private seed.
func (i *Identity) String() string {
	return fmt.Sprintf("Identity{uuid=%s label=%q signingPublic=%s seed=%s}",
		i.UUID, i.Label, base64.StdEncoding.EncodeToString(i.signingPublic), i.seed)
}

// newUUIDv4 generates a random RFC-4122 v4 UUID (128 bits of randomness).
func newUUIDv4() (string, error) {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	b[6] = (b[6] & 0x0f) | 0x40 // version 4
	b[8] = (b[8] & 0x3f) | 0x80 // variant 10
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16]), nil
}
