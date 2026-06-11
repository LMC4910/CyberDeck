package session_test

import (
	"context"
	"crypto/ecdh"
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net"
	"testing"
	"time"

	"github.com/shishir/cyberdeck/engine/core/security"
	"github.com/shishir/cyberdeck/engine/core/security/crypto"
	"github.com/shishir/cyberdeck/engine/core/security/secretstore"
	"github.com/shishir/cyberdeck/engine/core/session"
	"github.com/shishir/cyberdeck/engine/core/transport"
)

// --- test doubles (engine side) ---

type memPublicStore struct{ m map[string]string }

func (s *memPublicStore) GetString(k string) (string, bool, error) {
	v, ok := s.m[k]
	return v, ok, nil
}
func (s *memPublicStore) SetString(k, v string) error { s.m[k] = v; return nil }

type tokenAuth struct {
	want string
	err  error
}

func (a tokenAuth) Authorize(_ context.Context, h security.ClientHello) error {
	if a.err != nil {
		return a.err
	}
	if h.Token != a.want {
		return errors.New("bad token")
	}
	return nil
}

type memTrust struct{ saved map[string]security.TrustRecord }

func (t *memTrust) Status(context.Context, string) (bool, bool, error) { return false, false, nil }
func (t *memTrust) Save(_ context.Context, rec security.TrustRecord) error {
	t.saved[rec.UUID] = rec
	return nil
}

func engineServer(t *testing.T, auth security.PairingAuthorizer) (*security.PairingServer, *security.Identity) {
	t.Helper()
	id, err := security.LoadOrCreate(secretstore.NewMemoryStore(), &memPublicStore{m: map[string]string{}}, "engine")
	if err != nil {
		t.Fatalf("engine identity: %v", err)
	}
	srv, err := security.NewPairingServer(id, auth, &memTrust{saved: map[string]security.TrustRecord{}})
	if err != nil {
		t.Fatalf("pairing server: %v", err)
	}
	return srv, id
}

// --- device emulation: byte-for-byte what client/lib/net/pairing.dart writes ---

type deviceWire struct {
	conn   transport.Conn
	framer *transport.Framer
}

func (d deviceWire) write(t *testing.T, m map[string]any) {
	t.Helper()
	raw, err := json.Marshal(m)
	if err != nil {
		t.Fatalf("device marshal: %v", err)
	}
	if err := d.framer.Write(d.conn, raw); err != nil {
		t.Fatalf("device write: %v", err)
	}
}

func (d deviceWire) read(t *testing.T) map[string]any {
	t.Helper()
	raw, err := d.framer.Read(d.conn)
	if err != nil {
		t.Fatalf("device read: %v", err)
	}
	var m map[string]any
	if err := json.Unmarshal(raw, &m); err != nil {
		t.Fatalf("device unmarshal: %v", err)
	}
	return m
}

func b64(t *testing.T, m map[string]any, k string) []byte {
	t.Helper()
	s, _ := m[k].(string)
	raw, err := base64.StdEncoding.DecodeString(s)
	if err != nil {
		t.Fatalf("device base64 %q: %v", k, err)
	}
	return raw
}

// runDevice plays the full device side of the handshake (the initiator) and returns
// the device-derived session keys. It mirrors pairing.dart step for step.
func runDevice(t *testing.T, conn transport.Conn, enginePub ed25519.PublicKey, uuid, token string) (*crypto.SessionKeys, ed25519.PublicKey) {
	t.Helper()
	d := deviceWire{conn: conn, framer: transport.NewFramer(0)}

	devPub, devPriv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("device keygen: %v", err)
	}

	d.write(t, map[string]any{
		"type":            "clientHello",
		"deviceUuid":      uuid,
		"devicePublicKey": base64.StdEncoding.EncodeToString(devPub),
		"protoVersion":    1,
		"token":           token,
	})

	hello := d.read(t)
	if hello["type"] != "serverHello" {
		t.Fatalf("expected serverHello, got %v (%v)", hello["type"], hello["error"])
	}
	nonceE := b64(t, hello, "nonceE")
	engineEph := b64(t, hello, "engineEphemeralPublic")

	nonceD := make([]byte, 32)
	if _, err := rand.Read(nonceD); err != nil {
		t.Fatal(err)
	}
	devEph, err := ecdh.X25519().GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	sigD := crypto.Sign(devPriv, crypto.ConcatNonces(nonceE, nonceD))
	d.write(t, map[string]any{
		"type":                  "keyConfirm",
		"nonceD":                base64.StdEncoding.EncodeToString(nonceD),
		"deviceEphemeralPublic": base64.StdEncoding.EncodeToString(devEph.PublicKey().Bytes()),
		"sigD":                  base64.StdEncoding.EncodeToString(sigD),
	})

	result := d.read(t)
	if result["type"] != "pairResult" {
		t.Fatalf("expected pairResult, got %v (%v)", result["type"], result["error"])
	}
	sigE := b64(t, result, "sigE")
	if !crypto.Verify(enginePub, crypto.ConcatNonces(nonceD, nonceE), sigE) {
		t.Fatal("engine signature did not verify")
	}

	staticSelf, err := crypto.X25519FromEd25519Seed(devPriv.Seed())
	if err != nil {
		t.Fatal(err)
	}
	staticPeer, err := crypto.X25519PublicFromEd25519(enginePub)
	if err != nil {
		t.Fatal(err)
	}
	engineEphPub, err := ecdh.X25519().NewPublicKey(engineEph)
	if err != nil {
		t.Fatal(err)
	}
	keys, err := crypto.DeriveSessionKeys(crypto.Agreement{
		StaticSelfPriv:    staticSelf,
		StaticPeerPub:     staticPeer,
		EphemeralSelfPriv: devEph,
		EphemeralPeerPub:  engineEphPub,
		NonceInitiator:    nonceD,
		NonceResponder:    nonceE,
	})
	if err != nil {
		t.Fatalf("device derive keys: %v", err)
	}
	return keys, devPub
}

// --- tests ---

// TestHandshakeInteropAndEncryptedExchange is the real proof the live wire works:
// the engine ServerHandshake and a faithful device emulation (the pairing.dart wire
// format) complete the exchange over a pipe, derive matching keys, and then exchange
// an AEAD-encrypted envelope in both directions.
func TestHandshakeInteropAndEncryptedExchange(t *testing.T) {
	srv, engineID := engineServer(t, tokenAuth{want: "good-token"})
	serverConn, clientConn := net.Pipe()

	type res struct {
		hr  *session.HandshakeResult
		err error
	}
	done := make(chan res, 1)
	go func() {
		hr, err := session.ServerHandshake(context.Background(), serverConn, srv)
		done <- res{hr, err}
	}()

	deviceKeys, _ := runDevice(t, clientConn, engineID.SigningPublicKey(), "device-1", "good-token")
	r := <-done
	if r.err != nil {
		t.Fatalf("ServerHandshake: %v", r.err)
	}
	if r.hr.DeviceUUID != "device-1" {
		t.Errorf("deviceUUID = %q, want device-1", r.hr.DeviceUUID)
	}

	// Open both encrypted sessions over the same pipe and exchange a message each way.
	engSess, err := transport.NewEncryptedSession(serverConn, r.hr.Keys, false, "device-1")
	if err != nil {
		t.Fatalf("engine session: %v", err)
	}
	defer func() { _ = engSess.Close() }()
	devSess, err := transport.NewEncryptedSession(clientConn, deviceKeys, true, "device-1")
	if err != nil {
		t.Fatalf("device session: %v", err)
	}
	defer func() { _ = devSess.Close() }()

	// device → engine
	if err := devSess.Send(transport.Envelope{V: 1, Ch: transport.ChannelControl, Type: "ping"}); err != nil {
		t.Fatalf("device send: %v", err)
	}
	select {
	case env := <-engSess.Received():
		if env.Type != "ping" {
			t.Errorf("engine got %q, want ping", env.Type)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("engine did not receive the device message (keys/framing mismatch)")
	}

	// engine → device
	if err := engSess.Send(transport.Envelope{V: 1, Ch: transport.ChannelState, Type: "state.delta"}); err != nil {
		t.Fatalf("engine send: %v", err)
	}
	select {
	case env := <-devSess.Received():
		if env.Type != "state.delta" {
			t.Errorf("device got %q, want state.delta", env.Type)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("device did not receive the engine message")
	}
}

func TestHandshakeRejectsBadToken(t *testing.T) {
	srv, engineID := engineServer(t, tokenAuth{want: "good-token"})
	serverConn, clientConn := net.Pipe()

	done := make(chan error, 1)
	go func() {
		_, err := session.ServerHandshake(context.Background(), serverConn, srv)
		done <- err
	}()

	// Device sends a wrong token; it should receive an {type:"error"} frame.
	d := deviceWire{conn: clientConn, framer: transport.NewFramer(0)}
	devPub, _, _ := ed25519.GenerateKey(rand.Reader)
	_ = engineID
	d.write(t, map[string]any{
		"type":            "clientHello",
		"deviceUuid":      "device-x",
		"devicePublicKey": base64.StdEncoding.EncodeToString(devPub),
		"protoVersion":    1,
		"token":           "wrong",
	})
	reply := d.read(t)
	if reply["type"] != "error" {
		t.Fatalf("expected error frame, got %v", reply["type"])
	}
	if err := <-done; err == nil {
		t.Fatal("ServerHandshake should fail on a bad token")
	}
}

func TestHandshakeRejectsBadDeviceSignature(t *testing.T) {
	srv, engineID := engineServer(t, tokenAuth{want: "t"})
	serverConn, clientConn := net.Pipe()

	done := make(chan error, 1)
	go func() {
		_, err := session.ServerHandshake(context.Background(), serverConn, srv)
		done <- err
	}()

	d := deviceWire{conn: clientConn, framer: transport.NewFramer(0)}
	devPub, _, _ := ed25519.GenerateKey(rand.Reader)
	d.write(t, map[string]any{
		"type":            "clientHello",
		"deviceUuid":      "device-y",
		"devicePublicKey": base64.StdEncoding.EncodeToString(devPub),
		"protoVersion":    1,
		"token":           "t",
	})
	hello := d.read(t)
	if hello["type"] != "serverHello" {
		t.Fatalf("expected serverHello, got %v", hello["type"])
	}
	_ = engineID
	// Send a keyConfirm with a garbage signature → engine must reject.
	nonceD := make([]byte, 32)
	devEph, _ := ecdh.X25519().GenerateKey(rand.Reader)
	d.write(t, map[string]any{
		"type":                  "keyConfirm",
		"nonceD":                base64.StdEncoding.EncodeToString(nonceD),
		"deviceEphemeralPublic": base64.StdEncoding.EncodeToString(devEph.PublicKey().Bytes()),
		"sigD":                  base64.StdEncoding.EncodeToString(make([]byte, ed25519.SignatureSize)),
	})
	reply := d.read(t)
	if reply["type"] != "error" {
		t.Fatalf("expected error frame on bad signature, got %v", reply["type"])
	}
	if err := <-done; err == nil {
		t.Fatal("ServerHandshake should fail on a bad device signature")
	}
}
