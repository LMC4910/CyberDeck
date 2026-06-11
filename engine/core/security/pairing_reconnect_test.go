package security

import (
	"context"
	"testing"
)

// A known, non-revoked device reconnects WITHOUT a token (PROJ-146): the token
// authorizer is not consulted, and the handshake proceeds (key possession is proven
// later, in OnKeyConfirm).
func TestKnownDeviceReconnectsWithoutToken(t *testing.T) {
	ctx := context.Background()
	auth := &fakeAuthorizer{err: ErrUnauthorized} // would reject if consulted
	trust := newFakeTrust()
	devPub, _ := newDevice(t)
	trust.exists["dev-known"] = true // already paired

	srv, _ := engineFixture(t, auth, trust)
	_, err := srv.NewHandshake().OnClientHello(ctx, ClientHello{
		DeviceUUID:      "dev-known",
		DevicePublicKey: devPub,
		ProtoVersion:    pairingProtoVersion,
		Token:           "", // no token on reconnect
	})
	if err != nil {
		t.Fatalf("known device should reconnect tokenless, got %v", err)
	}
	if auth.called {
		t.Error("a known device must NOT consult the token authorizer")
	}
}

// A new/unknown device still requires a valid token.
func TestNewDeviceStillRequiresToken(t *testing.T) {
	ctx := context.Background()
	auth := &fakeAuthorizer{err: ErrUnauthorized}
	trust := newFakeTrust() // device not known
	devPub, _ := newDevice(t)

	srv, _ := engineFixture(t, auth, trust)
	_, err := srv.NewHandshake().OnClientHello(ctx, ClientHello{
		DeviceUUID:      "dev-new",
		DevicePublicKey: devPub,
		ProtoVersion:    pairingProtoVersion,
		Token:           "bad",
	})
	if err == nil {
		t.Fatal("a new device with a bad token must be rejected")
	}
	if !auth.called {
		t.Error("a new device must consult the token authorizer")
	}
}

// A revoked device is rejected even though it is "known".
func TestRevokedDeviceRejectedOnReconnect(t *testing.T) {
	ctx := context.Background()
	trust := newFakeTrust()
	devPub, _ := newDevice(t)
	trust.exists["dev-revoked"] = true
	trust.revoked["dev-revoked"] = true

	srv, _ := engineFixture(t, &fakeAuthorizer{}, trust)
	_, err := srv.NewHandshake().OnClientHello(ctx, ClientHello{
		DeviceUUID:      "dev-revoked",
		DevicePublicKey: devPub,
		ProtoVersion:    pairingProtoVersion,
		Token:           "",
	})
	if err != ErrRevokedDevice {
		t.Fatalf("revoked device should be rejected with ErrRevokedDevice, got %v", err)
	}
}
