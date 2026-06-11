// Package session is the engine's orchestration layer over transport (plumbing)
// and security (crypto/state machine): it drives the pairing handshake over a raw
// connection, opens the encrypted session, and serves the paired device its layout
// and live state while dispatching its interactions. It is the "front door" that
// turns the built-but-unwired subsystems into a live engine.
package session

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/shishir/cyberdeck/engine/core/security"
	"github.com/shishir/cyberdeck/engine/core/security/crypto"
	"github.com/shishir/cyberdeck/engine/core/transport"
)

// handshakeMaxFrame caps a handshake frame. Handshake messages are small JSON; a
// tight cap rejects a hostile or desynced peer before the encrypted session (which
// uses the larger default frame size) takes over the conn.
const handshakeMaxFrame = 64 << 10 // 64 KiB

// Wire messages — these mirror client/lib/net/pairing.dart exactly: length-prefixed
// JSON frames with a `type` tag and base64-encoded byte fields (Go marshals []byte
// as standard base64, which Dart's base64.decode accepts). The device is the
// initiator; the engine is the responder.

type wireClientHello struct {
	Type            string `json:"type"`
	DeviceUUID      string `json:"deviceUuid"`
	DevicePublicKey []byte `json:"devicePublicKey"`
	ProtoVersion    int    `json:"protoVersion"`
	Token           string `json:"token"`
}

type wireServerHello struct {
	Type                  string `json:"type"`
	EngineUUID            string `json:"engineUuid"`
	EnginePublicKey       []byte `json:"enginePublicKey"`
	NonceE                []byte `json:"nonceE"`
	EngineEphemeralPublic []byte `json:"engineEphemeralPublic"`
}

type wireKeyConfirm struct {
	Type                  string `json:"type"`
	NonceD                []byte `json:"nonceD"`
	DeviceEphemeralPublic []byte `json:"deviceEphemeralPublic"`
	SigD                  []byte `json:"sigD"`
}

type wirePairResult struct {
	Type             string `json:"type"`
	SigE             []byte `json:"sigE"`
	AssignedClass    string `json:"assignedClass"`
	DefaultPermsJSON string `json:"defaultPermsJson"`
}

type wireError struct {
	Type  string `json:"type"`
	Error string `json:"error"`
}

// HandshakeResult is the outcome of a successful engine-side handshake: the derived
// forward-secret session keys plus the paired device's identity and granted perms.
type HandshakeResult struct {
	Keys            *crypto.SessionKeys
	DeviceUUID      string
	PermissionsJSON string
}

// ServerHandshake drives the engine side of the pairing exchange over conn, reading
// and writing length-prefixed JSON frames that match the client wire format. On a
// rejection it sends a {type:"error"} frame to the device and returns the cause;
// the caller closes the conn. On success the conn is left at a frame boundary, ready
// for the encrypted session to take it over.
func ServerHandshake(ctx context.Context, conn transport.Conn, srv *security.PairingServer) (*HandshakeResult, error) {
	framer := transport.NewFramer(handshakeMaxFrame)
	hs := srv.NewHandshake()

	// 1. ClientHello.
	var ch wireClientHello
	if err := readFrame(conn, framer, &ch); err != nil {
		return nil, fmt.Errorf("session: read clientHello: %w", err)
	}
	if ch.Type != "clientHello" {
		_ = writeErr(conn, framer, "expected clientHello")
		return nil, fmt.Errorf("session: expected clientHello, got %q", ch.Type)
	}

	// 2. ServerHello (or reject + error frame).
	sh, err := hs.OnClientHello(ctx, security.ClientHello{
		DeviceUUID:      ch.DeviceUUID,
		DevicePublicKey: ch.DevicePublicKey,
		ProtoVersion:    ch.ProtoVersion,
		Token:           ch.Token,
	})
	if err != nil {
		_ = writeErr(conn, framer, err.Error())
		return nil, fmt.Errorf("session: clientHello rejected: %w", err)
	}
	if err := writeFrame(conn, framer, wireServerHello{
		Type:                  "serverHello",
		EngineUUID:            sh.EngineUUID,
		EnginePublicKey:       sh.EnginePublicKey,
		NonceE:                sh.NonceE,
		EngineEphemeralPublic: sh.EngineEphemeralPublic,
	}); err != nil {
		return nil, fmt.Errorf("session: write serverHello: %w", err)
	}

	// 3. KeyConfirm.
	var kc wireKeyConfirm
	if err := readFrame(conn, framer, &kc); err != nil {
		return nil, fmt.Errorf("session: read keyConfirm: %w", err)
	}
	if kc.Type != "keyConfirm" {
		_ = writeErr(conn, framer, "expected keyConfirm")
		return nil, fmt.Errorf("session: expected keyConfirm, got %q", kc.Type)
	}

	// 4. PairResult + session keys (or reject + error frame).
	pr, keys, err := hs.OnKeyConfirm(ctx, security.KeyConfirm{
		NonceD:                kc.NonceD,
		DeviceEphemeralPublic: kc.DeviceEphemeralPublic,
		SigD:                  kc.SigD,
	})
	if err != nil {
		_ = writeErr(conn, framer, err.Error())
		return nil, fmt.Errorf("session: keyConfirm rejected: %w", err)
	}
	if err := writeFrame(conn, framer, wirePairResult{
		Type:             "pairResult",
		SigE:             pr.SigE,
		AssignedClass:    pr.AssignedClass,
		DefaultPermsJSON: pr.DefaultPermsJSON,
	}); err != nil {
		return nil, fmt.Errorf("session: write pairResult: %w", err)
	}

	return &HandshakeResult{
		Keys:            keys,
		DeviceUUID:      ch.DeviceUUID,
		PermissionsJSON: pr.DefaultPermsJSON,
	}, nil
}

func readFrame(conn transport.Conn, framer *transport.Framer, v any) error {
	raw, err := framer.Read(conn)
	if err != nil {
		return err
	}
	return json.Unmarshal(raw, v)
}

func writeFrame(conn transport.Conn, framer *transport.Framer, v any) error {
	raw, err := json.Marshal(v)
	if err != nil {
		return err
	}
	return framer.Write(conn, raw)
}

func writeErr(conn transport.Conn, framer *transport.Framer, msg string) error {
	return writeFrame(conn, framer, wireError{Type: "error", Error: msg})
}
