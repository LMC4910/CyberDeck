package security_test

import (
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"errors"
	"testing"

	"github.com/shishir/cyberdeck/engine/core/security"
	"github.com/shishir/cyberdeck/engine/core/security/crypto"
)

// TestRogueDeviceRejected proves a device with no valid trust relationship
// cannot establish a session. Trust is anchored to a single-use pairing token
// for a NEW device and to a stored public key + private-key proof for a KNOWN
// one (2E §3). A rogue is any device that satisfies neither.
func TestRogueDeviceRejected(t *testing.T) {
	ctx := context.Background()

	t.Run("unknown device with no token", func(t *testing.T) {
		srv, _, _ := newEngine(t, newFakeTrust())
		rogue := newDevice(t, "rogue-1")

		// No token issued → the authorizer rejects the unknown device at hello.
		_, err := runHandshake(t, ctx, srv, rogue, "", nil, nil)
		if !errors.Is(err, security.ErrUnauthorized) {
			t.Fatalf("rogue with no token: got %v, want ErrUnauthorized", err)
		}
	})

	t.Run("unknown device with a forged token", func(t *testing.T) {
		srv, _, _ := newEngine(t, newFakeTrust())
		rogue := newDevice(t, "rogue-2")

		// A made-up token the engine never issued must not authorize pairing.
		_, err := runHandshake(t, ctx, srv, rogue, "totally-made-up-token", nil, nil)
		if !errors.Is(err, security.ErrUnauthorized) {
			t.Fatalf("rogue with forged token: got %v, want ErrUnauthorized", err)
		}
	})

	t.Run("replayed (already consumed) token", func(t *testing.T) {
		srv, _, issuer := newEngine(t, newFakeTrust())
		first := newDevice(t, "legit")
		token, err := issuer.Issue(true)
		if err != nil {
			t.Fatalf("issue: %v", err)
		}
		// The legitimate device consumes the single-use token.
		if _, err := runHandshake(t, ctx, srv, first, token, nil, nil); err != nil {
			t.Fatalf("first pairing should succeed: %v", err)
		}
		// A rogue replays the same token — single-use means it's already spent.
		rogue := newDevice(t, "rogue-3")
		_, err = runHandshake(t, ctx, srv, rogue, token, nil, nil)
		if !errors.Is(err, security.ErrUnauthorized) {
			t.Fatalf("replayed token: got %v, want ErrUnauthorized", err)
		}
	})

	t.Run("revoked device cannot reconnect even tokenless", func(t *testing.T) {
		trust := newFakeTrust()
		srv, _, issuer := newEngine(t, trust)
		dev := newDevice(t, "dev-revoked")

		// Pair successfully, then revoke (the kick switch, 2E §5.3).
		token, _ := issuer.Issue(true)
		if _, err := runHandshake(t, ctx, srv, dev, token, nil, nil); err != nil {
			t.Fatalf("initial pairing: %v", err)
		}
		trust.mu.Lock()
		trust.revoked[dev.uuid] = true
		trust.mu.Unlock()

		// A known-but-revoked device is rejected up front (even tokenless), matching
		// the live interop test's final assertion.
		_, err := runHandshake(t, ctx, srv, dev, "", nil, nil)
		if !errors.Is(err, security.ErrRevokedDevice) {
			t.Fatalf("revoked reconnect: got %v, want ErrRevokedDevice", err)
		}
		// And it can't talk its way back in with a fresh token either: a revoked
		// device is refused before authorization is even consulted.
		freshToken, _ := issuer.Issue(true)
		_, err = runHandshake(t, ctx, srv, dev, freshToken, nil, nil)
		if !errors.Is(err, security.ErrRevokedDevice) {
			t.Fatalf("revoked with fresh token: got %v, want ErrRevokedDevice", err)
		}
	})

	t.Run("impostor with the legit device's public key cannot prove possession", func(t *testing.T) {
		trust := newFakeTrust()
		srv, _, issuer := newEngine(t, trust)
		legit := newDevice(t, "shared-uuid")

		// The legitimate device pairs and becomes known/trusted with ITS public key.
		token, _ := issuer.Issue(true)
		if _, err := runHandshake(t, ctx, srv, legit, token, nil, nil); err != nil {
			t.Fatalf("legit pairing: %v", err)
		}

		// A rogue steals the UUID and even advertises the legit device's PUBLIC key
		// (public material an attacker can observe). Tokenless reconnect is allowed for
		// a known device, so the rogue reaches key confirm — but it does NOT hold the
		// legit PRIVATE key, so it cannot produce a sig_d that verifies under that
		// public key. We assert the rogue, lacking the private key, cannot sign and is
		// rejected, while the genuine private-key holder would be accepted.
		hs := srv.NewHandshake()
		sh, err := hs.OnClientHello(ctx, security.ClientHello{
			DeviceUUID:      "shared-uuid",
			DevicePublicKey: legit.pub, // the real (public) device key, replayed
			ProtoVersion:    1,
			Token:           "",
		})
		if err != nil {
			t.Fatalf("OnClientHello unexpectedly rejected: %v", err)
		}

		devEph, _ := crypto.GenerateX25519()
		nonceD := make([]byte, 32)
		_, _ = rand.Read(nonceD)

		// The impostor does not have legit.priv, so the best it can do is sign with
		// some OTHER key. That signature does not verify under legit.pub → rejected.
		_, impostorPriv, err := ed25519.GenerateKey(rand.Reader)
		if err != nil {
			t.Fatalf("impostor keygen: %v", err)
		}
		impostorSig := ed25519.Sign(impostorPriv, crypto.ConcatNonces(sh.NonceE, nonceD))

		_, _, err = hs.OnKeyConfirm(ctx, security.KeyConfirm{
			NonceD:                nonceD,
			DeviceEphemeralPublic: devEph.PublicKey().Bytes(),
			SigD:                  impostorSig,
		})
		if !errors.Is(err, security.ErrBadSignature) {
			t.Fatalf("impostor key confirm: got %v, want ErrBadSignature", err)
		}

		// Positive control: the genuine private-key holder, on the same advertised
		// public key, IS accepted — proving the rejection above is the missing private
		// key, not an unrelated failure.
		hs2 := srv.NewHandshake()
		sh2, err := hs2.OnClientHello(ctx, security.ClientHello{
			DeviceUUID: "shared-uuid", DevicePublicKey: legit.pub, ProtoVersion: 1, Token: "",
		})
		if err != nil {
			t.Fatalf("legit reconnect hello: %v", err)
		}
		nonceD2 := make([]byte, 32)
		_, _ = rand.Read(nonceD2)
		devEph2, _ := crypto.GenerateX25519()
		goodSig := ed25519.Sign(legit.priv, crypto.ConcatNonces(sh2.NonceE, nonceD2))
		if _, _, err := hs2.OnKeyConfirm(ctx, security.KeyConfirm{
			NonceD:                nonceD2,
			DeviceEphemeralPublic: devEph2.PublicKey().Bytes(),
			SigD:                  goodSig,
		}); err != nil {
			t.Fatalf("genuine private-key holder rejected on reconnect: %v", err)
		}
	})
}
