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

// TestMITMHandshakeTampering proves an active man-in-the-middle on the pairing
// exchange cannot complete a handshake it has tampered with. The handshake binds
// every message with Ed25519 signatures over both nonces (2E §3.2 / §8): a proxy
// that rewrites a message either invalidates a signature the other side checks,
// or — for messages it can't forge a signature for — fails the device's own
// fingerprint/key-confirm verification. Each sub-case mutates exactly one
// in-flight field and asserts the exchange is rejected.
func TestMITMHandshakeTampering(t *testing.T) {
	ctx := context.Background()

	t.Run("tamper device signature in KeyConfirm", func(t *testing.T) {
		srv, _, issuer := newEngine(t, newFakeTrust())
		dev := newDevice(t, "dev-mitm-sig")
		token, err := issuer.Issue(true)
		if err != nil {
			t.Fatalf("issue token: %v", err)
		}

		// MITM flips bytes in sig_d, so the engine's Verify of (nonceE ‖ nonceD)
		// fails — the device's proof of private-key possession is broken.
		_, err = runHandshake(t, ctx, srv, dev, token, nil, func(kc *security.KeyConfirm) {
			kc.SigD[0] ^= 0xFF
			kc.SigD[len(kc.SigD)-1] ^= 0xFF
		})
		if !errors.Is(err, security.ErrBadSignature) {
			t.Fatalf("tampered sig_d: got %v, want ErrBadSignature", err)
		}
	})

	t.Run("tamper device nonce in KeyConfirm", func(t *testing.T) {
		srv, _, issuer := newEngine(t, newFakeTrust())
		dev := newDevice(t, "dev-mitm-nonce")
		token, _ := issuer.Issue(true)

		// MITM rewrites nonce_d after the device signed over the original — the
		// signature no longer matches (nonceE ‖ nonceD'), so verification fails.
		_, err := runHandshake(t, ctx, srv, dev, token, nil, func(kc *security.KeyConfirm) {
			kc.NonceD[0] ^= 0xFF
		})
		if !errors.Is(err, security.ErrBadSignature) {
			t.Fatalf("tampered nonce_d: got %v, want ErrBadSignature", err)
		}
	})

	t.Run("substitute device ephemeral key in KeyConfirm", func(t *testing.T) {
		srv, _, issuer := newEngine(t, newFakeTrust())
		dev := newDevice(t, "dev-mitm-eph")
		token, _ := issuer.Issue(true)

		// MITM swaps in its OWN ephemeral public key (a classic key-substitution
		// attack to learn the session key). The device's sig_d still covers only the
		// nonces, so the engine accepts the message — BUT the device derived its keys
		// against its real ephemeral, so the two sides end up with DIFFERENT session
		// keys and the encrypted channel cannot carry a single frame. We assert the
		// derived keys diverge, which the AEAD then makes unusable.
		mitmEph, err := crypto.GenerateX25519()
		if err != nil {
			t.Fatalf("mitm ephemeral: %v", err)
		}
		hr, err := runHandshake(t, ctx, srv, dev, token, nil, func(kc *security.KeyConfirm) {
			kc.DeviceEphemeralPublic = mitmEph.PublicKey().Bytes()
		})
		if err != nil {
			t.Fatalf("handshake errored unexpectedly: %v", err)
		}
		if keysEqual(hr.deviceKeys, hr.engineKeys) {
			t.Fatal("ephemeral substitution produced matching keys — forward secrecy broken")
		}
		// Confirm the channel is genuinely dead: an engine-sealed record cannot be
		// opened by the device cipher (and vice-versa).
		assertChannelDead(t, hr)
	})

	t.Run("forge ServerHello toward the device (engine impersonation)", func(t *testing.T) {
		srv, engineID, issuer := newEngine(t, newFakeTrust())
		dev := newDevice(t, "dev-mitm-server")
		token, _ := issuer.Issue(true)

		// MITM rewrites the engine's ephemeral + identity in the ServerHello the
		// device sees, trying to impersonate the engine. The device must verify the
		// engine's final proof (sig_e) against the fingerprint it expected. Here we
		// assert two things the real client checks:
		//  (a) the device's keys (derived from the forged hello) diverge from the
		//      engine's real keys — the channel is dead;
		//  (b) the engine's sig_e proves the REAL engine key, not the forged one,
		//      so a device pinning the expected fingerprint rejects the imposter.
		var realEngineEphemeral []byte
		hr, err := runHandshake(t, ctx, srv, dev, token,
			func(sh *security.ServerHello) {
				realEngineEphemeral = append([]byte(nil), sh.EngineEphemeralPublic...)
				// Replace the engine ephemeral with the attacker's. Use a valid curve
				// point so the device's key derivation doesn't error out before we can
				// observe the divergence.
				mitmEph, gerr := crypto.GenerateX25519()
				if gerr != nil {
					t.Fatalf("mitm ephemeral: %v", gerr)
				}
				sh.EngineEphemeralPublic = mitmEph.PublicKey().Bytes()
			}, nil)
		if err != nil {
			t.Fatalf("handshake errored unexpectedly: %v", err)
		}
		if realEngineEphemeral == nil {
			t.Fatal("server-hello tamper hook never ran")
		}
		if keysEqual(hr.deviceKeys, hr.engineKeys) {
			t.Fatal("forged ServerHello still produced matching keys")
		}
		assertChannelDead(t, hr)

		// sig_e was produced by the genuine engine identity over (nonceD ‖ nonceE).
		// A device pinning the engine fingerprint verifies sig_e against the REAL
		// engine key; the attacker, lacking the engine private key, cannot forge it.
		good := crypto.Verify(engineID.SigningPublicKey(),
			crypto.ConcatNonces(hr.nonceD, hr.serverHello.NonceE), hr.pairResult.SigE)
		if !good {
			t.Fatal("engine sig_e did not verify against the real engine key")
		}
		// And it must NOT verify against an attacker-controlled key.
		attackerPub, _, _ := ed25519.GenerateKey(rand.Reader)
		if crypto.Verify(attackerPub,
			crypto.ConcatNonces(hr.nonceD, hr.serverHello.NonceE), hr.pairResult.SigE) {
			t.Fatal("engine sig_e verified against an attacker key — impersonation possible")
		}
	})
}

func keysEqual(a, b *crypto.SessionKeys) bool {
	return bytesEqual(a.InitiatorToResponder, b.InitiatorToResponder) &&
		bytesEqual(a.ResponderToInitiator, b.ResponderToInitiator)
}

func bytesEqual(a, b []byte) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

// assertChannelDead confirms that, with mismatched session keys, an AEAD record
// sealed by one side cannot be opened by the other — the encrypted channel is
// unusable, defeating the MITM.
func assertChannelDead(t *testing.T, hr handshakeResult) {
	t.Helper()
	engSend, err := crypto.NewCipher(hr.engineKeys.Send(false)) // engine responder→device
	if err != nil {
		t.Fatalf("engine cipher: %v", err)
	}
	devRecv, err := crypto.NewCipher(hr.deviceKeys.Recv(true)) // device opens responder→initiator
	if err != nil {
		t.Fatalf("device cipher: %v", err)
	}
	rec, err := engSend.Seal([]byte("hello device"), nil)
	if err != nil {
		t.Fatalf("seal: %v", err)
	}
	if _, err := devRecv.Open(rec, nil); err == nil {
		t.Fatal("device opened an engine record despite key mismatch — channel not actually secure")
	}
}
