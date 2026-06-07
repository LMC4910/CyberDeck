package security

import (
	"bytes"
	"context"
	"crypto/ecdh"
	"crypto/ed25519"
	"crypto/rand"
	"errors"
	"testing"

	"github.com/shishir/cyberdeck/engine/core/security/crypto"
	"github.com/shishir/cyberdeck/engine/core/security/secretstore"
)

// --- test doubles ---

type fakeAuthorizer struct {
	err    error
	called bool
}

func (a *fakeAuthorizer) Authorize(context.Context, ClientHello) error {
	a.called = true
	return a.err
}

type fakeTrust struct {
	records map[string]TrustRecord
	exists  map[string]bool
	revoked map[string]bool
	saveErr error
}

func newFakeTrust() *fakeTrust {
	return &fakeTrust{records: map[string]TrustRecord{}, exists: map[string]bool{}, revoked: map[string]bool{}}
}
func (t *fakeTrust) Status(_ context.Context, uuid string) (bool, bool, error) {
	return t.exists[uuid], t.revoked[uuid], nil
}
func (t *fakeTrust) Save(_ context.Context, rec TrustRecord) error {
	if t.saveErr != nil {
		return t.saveErr
	}
	t.records[rec.UUID] = rec
	return nil
}

// engineFixture builds an engine identity + pairing server with the given seams.
func engineFixture(t *testing.T, auth PairingAuthorizer, trust TrustStore) (*PairingServer, *Identity) {
	t.Helper()
	id, err := LoadOrCreate(secretstore.NewMemoryStore(), newMemPublicStore(), "engine")
	if err != nil {
		t.Fatalf("engine identity: %v", err)
	}
	srv, err := NewPairingServer(id, auth, trust)
	if err != nil {
		t.Fatalf("NewPairingServer: %v", err)
	}
	return srv, id
}

func newDevice(t *testing.T) (ed25519.PublicKey, ed25519.PrivateKey) {
	t.Helper()
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("device keygen: %v", err)
	}
	return pub, priv
}

func randNonce(t *testing.T) []byte {
	t.Helper()
	n := make([]byte, nonceSize)
	if _, err := rand.Read(n); err != nil {
		t.Fatalf("nonce: %v", err)
	}
	return n
}

// --- tests ---

func TestPairingHappyPath(t *testing.T) {
	ctx := context.Background()
	auth := &fakeAuthorizer{}
	trust := newFakeTrust()
	srv, engineID := engineFixture(t, auth, trust)

	devPub, devPriv := newDevice(t)
	hs := srv.NewHandshake()

	sh, err := hs.OnClientHello(ctx, ClientHello{
		DeviceUUID: "dev-1", DevicePublicKey: devPub, ProtoVersion: 1, Token: "tok",
	})
	if err != nil {
		t.Fatalf("OnClientHello: %v", err)
	}
	if !auth.called {
		t.Error("authorizer not consulted")
	}

	devEph, _ := crypto.GenerateX25519()
	nonceD := randNonce(t)
	kc := KeyConfirm{
		NonceD:                nonceD,
		DeviceEphemeralPublic: devEph.PublicKey().Bytes(),
		SigD:                  ed25519.Sign(devPriv, crypto.ConcatNonces(sh.NonceE, nonceD)),
	}
	pr, keys, err := hs.OnKeyConfirm(ctx, kc)
	if err != nil {
		t.Fatalf("OnKeyConfirm: %v", err)
	}

	// Engine proved possession: sig_e over (nonceD ‖ nonceE) verifies.
	if !crypto.Verify(engineID.SigningPublicKey(), crypto.ConcatNonces(nonceD, sh.NonceE), pr.SigE) {
		t.Error("PairResult.SigE did not verify")
	}
	// Trust record written with the device's public key.
	rec, ok := trust.records["dev-1"]
	if !ok {
		t.Fatal("trust record not saved")
	}
	if !bytes.Equal(rec.PublicKey, devPub) {
		t.Error("trust record public key mismatch")
	}

	// Both sides derive identical session keys (forward-secret agreement).
	devStatic, _ := crypto.X25519FromEd25519Seed(devPriv.Seed())
	engStaticPub, _ := crypto.X25519PublicFromEd25519(sh.EnginePublicKey)
	engEphPub, _ := ecdh.X25519().NewPublicKey(sh.EngineEphemeralPublic)
	devKeys, err := crypto.DeriveSessionKeys(crypto.Agreement{
		StaticSelfPriv: devStatic, StaticPeerPub: engStaticPub,
		EphemeralSelfPriv: devEph, EphemeralPeerPub: engEphPub,
		NonceInitiator: nonceD, NonceResponder: sh.NonceE,
	})
	if err != nil {
		t.Fatalf("device derive: %v", err)
	}
	if !bytes.Equal(devKeys.InitiatorToResponder, keys.InitiatorToResponder) ||
		!bytes.Equal(devKeys.ResponderToInitiator, keys.ResponderToInitiator) {
		t.Fatal("device and engine derived different session keys")
	}
	// And an encrypted record flows device→engine.
	devSend, _ := crypto.NewCipher(devKeys.Send(true))
	engRecv, _ := crypto.NewCipher(keys.Recv(false))
	rec2, _ := devSend.Seal([]byte("hello engine"), nil)
	got, err := engRecv.Open(rec2, nil)
	if err != nil || string(got) != "hello engine" {
		t.Errorf("session round-trip failed: %v / %q", err, got)
	}
}

func TestPairingBadToken(t *testing.T) {
	ctx := context.Background()
	trust := newFakeTrust()
	srv, _ := engineFixture(t, &fakeAuthorizer{err: errors.New("expired")}, trust)

	devPub, _ := newDevice(t)
	_, err := srv.NewHandshake().OnClientHello(ctx, ClientHello{
		DeviceUUID: "dev-1", DevicePublicKey: devPub, ProtoVersion: 1, Token: "bad",
	})
	if !errors.Is(err, ErrUnauthorized) {
		t.Errorf("OnClientHello = %v, want ErrUnauthorized", err)
	}
}

func TestPairingRevokedDevice(t *testing.T) {
	ctx := context.Background()
	trust := newFakeTrust()
	trust.exists["dev-1"] = true
	trust.revoked["dev-1"] = true
	srv, _ := engineFixture(t, &fakeAuthorizer{}, trust)

	devPub, _ := newDevice(t)
	_, err := srv.NewHandshake().OnClientHello(ctx, ClientHello{
		DeviceUUID: "dev-1", DevicePublicKey: devPub, ProtoVersion: 1, Token: "tok",
	})
	if !errors.Is(err, ErrRevokedDevice) {
		t.Errorf("OnClientHello = %v, want ErrRevokedDevice", err)
	}
}

func TestPairingBadSignature(t *testing.T) {
	ctx := context.Background()
	trust := newFakeTrust()
	srv, _ := engineFixture(t, &fakeAuthorizer{}, trust)

	devPub, devPriv := newDevice(t)
	hs := srv.NewHandshake()
	sh, err := hs.OnClientHello(ctx, ClientHello{DeviceUUID: "dev-1", DevicePublicKey: devPub, ProtoVersion: 1, Token: "tok"})
	if err != nil {
		t.Fatalf("OnClientHello: %v", err)
	}

	devEph, _ := crypto.GenerateX25519()
	nonceD := randNonce(t)
	// Sign over the WRONG message (swapped nonce order) → must fail verification.
	badSig := ed25519.Sign(devPriv, crypto.ConcatNonces(nonceD, sh.NonceE))
	_, _, err = hs.OnKeyConfirm(ctx, KeyConfirm{NonceD: nonceD, DeviceEphemeralPublic: devEph.PublicKey().Bytes(), SigD: badSig})
	if !errors.Is(err, ErrBadSignature) {
		t.Errorf("OnKeyConfirm = %v, want ErrBadSignature", err)
	}
	if _, ok := trust.records["dev-1"]; ok {
		t.Error("trust record saved despite bad signature")
	}
}

func TestPairingReplayAndOutOfOrder(t *testing.T) {
	ctx := context.Background()
	trust := newFakeTrust()
	srv, _ := engineFixture(t, &fakeAuthorizer{}, trust)
	devPub, devPriv := newDevice(t)

	// OnKeyConfirm before OnClientHello → out of sequence.
	if _, _, err := srv.NewHandshake().OnKeyConfirm(ctx, KeyConfirm{NonceD: randNonce(t)}); !errors.Is(err, ErrHandshakeState) {
		t.Errorf("premature OnKeyConfirm = %v, want ErrHandshakeState", err)
	}

	// Complete handshake 1, capturing its KeyConfirm.
	hs1 := srv.NewHandshake()
	sh1, _ := hs1.OnClientHello(ctx, ClientHello{DeviceUUID: "dev-1", DevicePublicKey: devPub, ProtoVersion: 1, Token: "t"})
	devEph, _ := crypto.GenerateX25519()
	nonceD := randNonce(t)
	kc := KeyConfirm{NonceD: nonceD, DeviceEphemeralPublic: devEph.PublicKey().Bytes(),
		SigD: ed25519.Sign(devPriv, crypto.ConcatNonces(sh1.NonceE, nonceD))}
	if _, _, err := hs1.OnKeyConfirm(ctx, kc); err != nil {
		t.Fatalf("handshake 1 OnKeyConfirm: %v", err)
	}
	// Re-submitting to the completed handshake is rejected.
	if _, _, err := hs1.OnKeyConfirm(ctx, kc); !errors.Is(err, ErrHandshakeState) {
		t.Errorf("replay to completed handshake = %v, want ErrHandshakeState", err)
	}

	// Replaying the captured KeyConfirm into a NEW handshake (fresh nonce_e) fails
	// signature verification — the captured sig is bound to the old nonce_e.
	hs2 := srv.NewHandshake()
	if _, err := hs2.OnClientHello(ctx, ClientHello{DeviceUUID: "dev-1", DevicePublicKey: devPub, ProtoVersion: 1, Token: "t"}); err != nil {
		t.Fatalf("handshake 2 OnClientHello: %v", err)
	}
	if _, _, err := hs2.OnKeyConfirm(ctx, kc); !errors.Is(err, ErrBadSignature) {
		t.Errorf("cross-handshake replay = %v, want ErrBadSignature", err)
	}
}

func TestPairingProtocolVersionAndBadKey(t *testing.T) {
	ctx := context.Background()
	srv, _ := engineFixture(t, &fakeAuthorizer{}, newFakeTrust())
	devPub, _ := newDevice(t)

	if _, err := srv.NewHandshake().OnClientHello(ctx, ClientHello{DeviceUUID: "d", DevicePublicKey: devPub, ProtoVersion: 99, Token: "t"}); !errors.Is(err, ErrProtocolVersion) {
		t.Errorf("bad proto = %v, want ErrProtocolVersion", err)
	}
	if _, err := srv.NewHandshake().OnClientHello(ctx, ClientHello{DeviceUUID: "d", DevicePublicKey: []byte{1, 2, 3}, ProtoVersion: 1, Token: "t"}); !errors.Is(err, ErrBadDeviceKey) {
		t.Errorf("bad device key = %v, want ErrBadDeviceKey", err)
	}
}
