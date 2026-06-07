// Package crypto provides CyberDeck's session crypto primitives (2E §4 / 2A §5.3
// / ADR-0009): forward-secret X25519 key agreement, HKDF key derivation, and an
// authenticated AEAD for record encryption, plus Ed25519 signing for the
// handshake. It uses only vetted implementations (Go stdlib + golang.org/x/crypto
// + filippo.io/edwards25519) — no hand-rolled primitives.
package crypto

import (
	"crypto/ecdh"
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha512"
	"errors"
	"fmt"

	"filippo.io/edwards25519"
)

// GenerateX25519 generates a fresh X25519 keypair (used for per-session ephemeral
// keys, and available for static keys).
func GenerateX25519() (*ecdh.PrivateKey, error) {
	return ecdh.X25519().GenerateKey(rand.Reader)
}

// X25519 performs the Diffie-Hellman computation between a private key and a peer
// public key, returning the 32-byte shared secret.
func X25519(self *ecdh.PrivateKey, peer *ecdh.PublicKey) ([]byte, error) {
	if self == nil || peer == nil {
		return nil, errors.New("crypto: nil key in X25519")
	}
	return self.ECDH(peer)
}

// X25519FromEd25519Seed derives the long-term X25519 private key from an Ed25519
// seed, using the standard conversion (the low 32 bytes of SHA-512(seed), clamped
// per RFC 7748) — the same derivation as libsodium's
// crypto_sign_ed25519_sk_to_curve25519.
func X25519FromEd25519Seed(seed []byte) (*ecdh.PrivateKey, error) {
	if len(seed) != ed25519.SeedSize {
		return nil, fmt.Errorf("crypto: bad ed25519 seed length %d", len(seed))
	}
	h := sha512.Sum512(seed)
	scalar := make([]byte, 32)
	copy(scalar, h[:32])
	// Clamp (RFC 7748 §5).
	scalar[0] &= 248
	scalar[31] &= 127
	scalar[31] |= 64
	return ecdh.X25519().NewPrivateKey(scalar)
}

// X25519PublicFromEd25519 converts an Ed25519 public key to the corresponding
// X25519 (Montgomery) public key, using the vetted edwards25519 implementation.
// The result equals the public key of X25519FromEd25519Seed for the same identity.
func X25519PublicFromEd25519(pub ed25519.PublicKey) (*ecdh.PublicKey, error) {
	if len(pub) != ed25519.PublicKeySize {
		return nil, fmt.Errorf("crypto: bad ed25519 public key length %d", len(pub))
	}
	p, err := new(edwards25519.Point).SetBytes(pub)
	if err != nil {
		return nil, fmt.Errorf("crypto: decode ed25519 public key: %w", err)
	}
	return ecdh.X25519().NewPublicKey(p.BytesMontgomery())
}
