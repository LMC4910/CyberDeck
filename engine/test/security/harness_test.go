// Package security_test holds the engine's end-to-end security test suite
// (PROJ-300). These are black-box tests over the real handshake (core/security)
// and the real encrypted transport (core/transport): they establish a genuine
// paired session the way the Flutter interop test does (client/test/
// engine_interop_test.dart), then attack it — sniffing the wire, tampering the
// handshake, presenting an untrusted device, and scanning every at-rest surface
// for a leaked secret.
//
// The harness here mirrors core/security/pairing_test.go and
// core/transport/session_test.go so the attack tests share one faithful
// device⇄engine setup.
package security_test

import (
	"bytes"
	"context"
	"crypto/ecdh"
	"crypto/ed25519"
	"crypto/rand"
	"net"
	"sync"
	"testing"

	"github.com/shishir/cyberdeck/engine/core/security"
	"github.com/shishir/cyberdeck/engine/core/security/crypto"
	"github.com/shishir/cyberdeck/engine/core/security/secretstore"
	"github.com/shishir/cyberdeck/engine/core/transport"
)

// memPublicStore is the non-secret identity store used to build an engine
// identity in tests (mirrors core/security/identity_test.go).
type memPublicStore struct {
	mu sync.Mutex
	m  map[string]string
}

func newMemPublicStore() *memPublicStore { return &memPublicStore{m: map[string]string{}} }

func (s *memPublicStore) GetString(key string) (string, bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	v, ok := s.m[key]
	return v, ok, nil
}

func (s *memPublicStore) SetString(key, value string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.m[key] = value
	return nil
}

// fakeTrust is the in-memory TrustStore the engine pairs against. It records
// which devices are known and which are revoked, exactly like the real device
// repository slice the wiring layer adapts (core/security/pairing_test.go).
type fakeTrust struct {
	mu      sync.Mutex
	records map[string]security.TrustRecord
	exists  map[string]bool
	revoked map[string]bool
}

func newFakeTrust() *fakeTrust {
	return &fakeTrust{
		records: map[string]security.TrustRecord{},
		exists:  map[string]bool{},
		revoked: map[string]bool{},
	}
}

func (t *fakeTrust) Status(_ context.Context, uuid string) (bool, bool, string, error) {
	t.mu.Lock()
	defer t.mu.Unlock()
	return t.exists[uuid], t.revoked[uuid], t.records[uuid].PermissionsJSON, nil
}

func (t *fakeTrust) Save(_ context.Context, rec security.TrustRecord) error {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.records[rec.UUID] = rec
	t.exists[rec.UUID] = true
	return nil
}

// device is a paired client's key material.
type device struct {
	uuid string
	pub  ed25519.PublicKey
	priv ed25519.PrivateKey
}

func newDevice(t *testing.T, uuid string) device {
	t.Helper()
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("device keygen: %v", err)
	}
	return device{uuid: uuid, pub: pub, priv: priv}
}

// newEngine builds an engine identity + pairing server with the given trust
// store. A token issuer authorizes new devices, mirroring the live engine.
func newEngine(t *testing.T, trust security.TrustStore) (*security.PairingServer, *security.Identity, *security.TokenIssuer) {
	t.Helper()
	id, err := security.LoadOrCreate(secretstore.NewMemoryStore(), newMemPublicStore(), "engine")
	if err != nil {
		t.Fatalf("engine identity: %v", err)
	}
	issuer := security.NewTokenIssuer()
	srv, err := security.NewPairingServer(id, issuer, trust)
	if err != nil {
		t.Fatalf("NewPairingServer: %v", err)
	}
	return srv, id, issuer
}

// handshakeResult is the outcome of a completed pairing handshake from the
// device's point of view: both sides' identical session keys and the engine's
// final proof message.
type handshakeResult struct {
	serverHello security.ServerHello
	pairResult  security.PairResult
	engineKeys  *crypto.SessionKeys
	deviceKeys  *crypto.SessionKeys
	nonceD      []byte // device nonce the device actually signed/used
}

// runHandshake drives a complete, honest four-message pairing exchange between
// dev and srv and returns the derived session keys for both peers. Optional
// hooks let an attack test tamper with the in-flight messages; a nil hook leaves
// the message untouched.
func runHandshake(
	t *testing.T,
	ctx context.Context,
	srv *security.PairingServer,
	dev device,
	token string,
	tamperServerHello func(*security.ServerHello),
	tamperKeyConfirm func(*security.KeyConfirm),
) (handshakeResult, error) {
	t.Helper()

	hs := srv.NewHandshake()
	sh, err := hs.OnClientHello(ctx, security.ClientHello{
		DeviceUUID:      dev.uuid,
		DevicePublicKey: dev.pub,
		ProtoVersion:    1,
		Token:           token,
	})
	if err != nil {
		return handshakeResult{}, err
	}

	// A MITM may rewrite the ServerHello the device sees before it derives keys
	// and signs. The device then proceeds against the tampered view.
	seenSH := sh
	if tamperServerHello != nil {
		tamperServerHello(&seenSH)
	}

	devEph, err := crypto.GenerateX25519()
	if err != nil {
		t.Fatalf("device ephemeral: %v", err)
	}
	nonceD := make([]byte, 32)
	if _, err := rand.Read(nonceD); err != nil {
		t.Fatalf("device nonce: %v", err)
	}

	kc := security.KeyConfirm{
		NonceD:                nonceD,
		DeviceEphemeralPublic: devEph.PublicKey().Bytes(),
		// Device signs over (nonceE ‖ nonceD) of the ServerHello it actually saw.
		SigD: ed25519.Sign(dev.priv, crypto.ConcatNonces(seenSH.NonceE, nonceD)),
	}
	if tamperKeyConfirm != nil {
		tamperKeyConfirm(&kc)
	}

	pr, engineKeys, err := hs.OnKeyConfirm(ctx, kc)
	if err != nil {
		return handshakeResult{}, err
	}

	// Device derives its own copy of the session keys from the (possibly
	// tampered) ServerHello it saw — the same computation the real client runs.
	devStatic, err := crypto.X25519FromEd25519Seed(dev.priv.Seed())
	if err != nil {
		t.Fatalf("device static key: %v", err)
	}
	engStaticPub, err := crypto.X25519PublicFromEd25519(seenSH.EnginePublicKey)
	if err != nil {
		return handshakeResult{}, err
	}
	engEphPub, err := ecdh.X25519().NewPublicKey(seenSH.EngineEphemeralPublic)
	if err != nil {
		return handshakeResult{}, err
	}
	deviceKeys, err := crypto.DeriveSessionKeys(crypto.Agreement{
		StaticSelfPriv:    devStatic,
		StaticPeerPub:     engStaticPub,
		EphemeralSelfPriv: devEph,
		EphemeralPeerPub:  engEphPub,
		NonceInitiator:    nonceD,
		NonceResponder:    seenSH.NonceE,
	})
	if err != nil {
		return handshakeResult{}, err
	}

	return handshakeResult{
		serverHello: sh,
		pairResult:  pr,
		engineKeys:  engineKeys,
		deviceKeys:  deviceKeys,
		nonceD:      nonceD,
	}, nil
}

// pairedSession runs an honest handshake (consuming a freshly issued token) and
// returns a live encrypted session for each peer over an in-memory pipe, plus a
// tee that captures every byte the device writes to the wire. The device is the
// transport initiator, the engine the responder — matching NewEncryptedSession's
// role convention and the live deck.
func pairedSession(t *testing.T, srv *security.PairingServer, issuer *security.TokenIssuer, dev device) (deviceSess, engineSess *transport.EncryptedSession, wire *teeConn) {
	t.Helper()
	ctx := context.Background()

	token, err := issuer.Issue(true)
	if err != nil {
		t.Fatalf("issue token: %v", err)
	}
	hr, err := runHandshake(t, ctx, srv, dev, token, nil, nil)
	if err != nil {
		t.Fatalf("handshake: %v", err)
	}
	if !bytes.Equal(hr.deviceKeys.InitiatorToResponder, hr.engineKeys.InitiatorToResponder) {
		t.Fatal("device and engine derived different session keys")
	}

	cDev, cEng := net.Pipe()
	wire = &teeConn{Conn: cDev}

	deviceSess, err = transport.NewEncryptedSession(wire, hr.deviceKeys, true, "engine")
	if err != nil {
		t.Fatalf("device session: %v", err)
	}
	engineSess, err = transport.NewEncryptedSession(cEng, hr.engineKeys, false, dev.uuid)
	if err != nil {
		t.Fatalf("engine session: %v", err)
	}
	return deviceSess, engineSess, wire
}

// teeConn wraps a net.Conn and captures everything written to the wire (mirrors
// core/transport/session_test.go's teeConn).
type teeConn struct {
	net.Conn
	mu  sync.Mutex
	buf bytes.Buffer
}

func (t *teeConn) Write(p []byte) (int, error) {
	t.mu.Lock()
	t.buf.Write(p)
	t.mu.Unlock()
	return t.Conn.Write(p)
}

func (t *teeConn) captured() []byte {
	t.mu.Lock()
	defer t.mu.Unlock()
	return append([]byte(nil), t.buf.Bytes()...)
}
