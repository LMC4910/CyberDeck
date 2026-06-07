package security

import (
	"context"
	"crypto/ecdh"
	"crypto/ed25519"
	"crypto/rand"
	"errors"
	"fmt"
	"io"
	"time"

	"github.com/shishir/cyberdeck/engine/core/security/crypto"
)

// Pairing handshake — engine (server) half (2E §3.2 / ADR-0008/0009). The client
// half (QR scan + device-side state machine) is PROJ-180; token issuance is
// PROJ-124. This implements the four-message exchange that proves the device
// holds its private key, authorizes it (single-use token or local PIN, via the
// injected PairingAuthorizer), and on success writes a trust record and derives
// forward-secret session keys.

const pairingProtoVersion = 1

// nonceSize is the handshake nonce length in bytes.
const nonceSize = 32

// Sentinel errors so callers/tests can distinguish rejection reasons.
var (
	ErrProtocolVersion = errors.New("pairing: unsupported protocol version")
	ErrUnauthorized    = errors.New("pairing: authorization failed (bad/expired token or denied PIN)")
	ErrRevokedDevice   = errors.New("pairing: device is revoked")
	ErrBadDeviceKey    = errors.New("pairing: invalid device public key")
	ErrBadSignature    = errors.New("pairing: signature verification failed")
	ErrHandshakeState  = errors.New("pairing: message out of sequence")
)

// ClientHello is the device's opening message.
type ClientHello struct {
	DeviceUUID      string
	DevicePublicKey []byte // device Ed25519 public key
	ProtoVersion    int
	Token           string // single-use pairing token or PIN reference
}

// ServerHello is the engine's reply carrying its identity, a fresh nonce, and its
// per-session ephemeral X25519 public key (forward secrecy).
type ServerHello struct {
	EngineUUID            string
	EnginePublicKey       []byte // engine Ed25519 public key
	NonceE                []byte
	EngineEphemeralPublic []byte // X25519
}

// KeyConfirm is the device proving possession of its private key and providing its
// ephemeral X25519 public key.
type KeyConfirm struct {
	NonceD                []byte
	DeviceEphemeralPublic []byte // X25519
	SigD                  []byte // Sign(privD, nonceE ‖ nonceD)
}

// PairResult is the engine's final message proving its own key possession.
type PairResult struct {
	SigE             []byte // Sign(privE, nonceD ‖ nonceE)
	AssignedClass    string
	DefaultPermsJSON string
}

// TrustRecord is what pairing persists on success (the subset of the devices
// table pairing owns).
type TrustRecord struct {
	UUID            string
	PublicKey       []byte
	DeviceClass     string
	PermissionsJSON string
	PairedAt        int64
}

// TrustStore is the slice of the device repository (PROJ-113) that pairing needs.
// A small adapter bridges it to persistence.DeviceRepo at wiring time (PROJ-105),
// keeping this package independent of persistence.
type TrustStore interface {
	// Status reports whether a device record exists and whether it is revoked.
	Status(ctx context.Context, uuid string) (exists, revoked bool, err error)
	// Save writes (or refreshes) a trust record for a successfully paired device.
	Save(ctx context.Context, rec TrustRecord) error
}

// PairingAuthorizer decides whether a ClientHello is authorized — a single-use
// token (PROJ-124) or a local PIN approval. It consumes the token on success.
type PairingAuthorizer interface {
	Authorize(ctx context.Context, hello ClientHello) error
}

// PairingServer mints engine-side handshakes.
type PairingServer struct {
	identity      *Identity
	authorizer    PairingAuthorizer
	trust         TrustStore
	defaultPerms  string
	now           func() int64
	rand          io.Reader
	engineStaticX *ecdh.PrivateKey
}

// PairingOption configures a PairingServer.
type PairingOption func(*PairingServer)

// WithDefaultPermissions sets the permissions JSON granted to a newly paired device.
func WithDefaultPermissions(json string) PairingOption {
	return func(s *PairingServer) { s.defaultPerms = json }
}

// WithPairingClock injects a timestamp source (unix millis) for tests.
func WithPairingClock(now func() int64) PairingOption {
	return func(s *PairingServer) {
		if now != nil {
			s.now = now
		}
	}
}

// WithPairingRand injects a randomness source for tests.
func WithPairingRand(r io.Reader) PairingOption {
	return func(s *PairingServer) {
		if r != nil {
			s.rand = r
		}
	}
}

// NewPairingServer builds the engine-side pairing server. The engine's long-term
// X25519 key is derived once from its Ed25519 identity seed.
func NewPairingServer(id *Identity, auth PairingAuthorizer, trust TrustStore, opts ...PairingOption) (*PairingServer, error) {
	if id == nil || auth == nil || trust == nil {
		return nil, errors.New("pairing: identity, authorizer, and trust store are required")
	}
	staticX, err := crypto.X25519FromEd25519Seed(id.SigningSeed().Reveal())
	if err != nil {
		return nil, fmt.Errorf("pairing: derive engine static key: %w", err)
	}
	s := &PairingServer{
		identity:      id,
		authorizer:    auth,
		trust:         trust,
		defaultPerms:  `{"allowPowerActions":false,"allowedCategories":[],"deniedActions":[],"allowEditTrigger":false}`,
		now:           func() int64 { return time.Now().UnixMilli() },
		rand:          rand.Reader,
		engineStaticX: staticX,
	}
	for _, o := range opts {
		o(s)
	}
	return s, nil
}

type handshakeState int

const (
	stateInit handshakeState = iota
	stateAwaitKeyConfirm
	stateDone
	stateFailed
)

// Handshake is one in-progress engine-side pairing exchange. It is single-use and
// not safe for concurrent calls (one device, one sequence).
type Handshake struct {
	srv    *PairingServer
	state  handshakeState
	hello  ClientHello
	nonceE []byte
	engEph *ecdh.PrivateKey
}

// NewHandshake starts a fresh engine-side handshake.
func (s *PairingServer) NewHandshake() *Handshake {
	return &Handshake{srv: s, state: stateInit}
}

// OnClientHello processes the device's opening message and returns the engine's
// ServerHello. It authorizes the device and rejects revoked devices up front.
func (h *Handshake) OnClientHello(ctx context.Context, hello ClientHello) (ServerHello, error) {
	if h.state != stateInit {
		h.state = stateFailed
		return ServerHello{}, ErrHandshakeState
	}
	if hello.ProtoVersion != pairingProtoVersion {
		h.state = stateFailed
		return ServerHello{}, ErrProtocolVersion
	}
	if len(hello.DevicePublicKey) != ed25519.PublicKeySize {
		h.state = stateFailed
		return ServerHello{}, ErrBadDeviceKey
	}

	// Reject a known-revoked device before doing any work.
	exists, revoked, err := h.srv.trust.Status(ctx, hello.DeviceUUID)
	if err != nil {
		h.state = stateFailed
		return ServerHello{}, fmt.Errorf("pairing: trust status: %w", err)
	}
	if exists && revoked {
		h.state = stateFailed
		return ServerHello{}, ErrRevokedDevice
	}

	// Authorize (single-use token / local PIN). Consumes the token on success.
	if err := h.srv.authorizer.Authorize(ctx, hello); err != nil {
		h.state = stateFailed
		return ServerHello{}, fmt.Errorf("%w: %v", ErrUnauthorized, err)
	}

	nonceE := make([]byte, nonceSize)
	if _, err := io.ReadFull(h.srv.rand, nonceE); err != nil {
		h.state = stateFailed
		return ServerHello{}, fmt.Errorf("pairing: nonce: %w", err)
	}
	engEph, err := ecdh.X25519().GenerateKey(h.srv.rand)
	if err != nil {
		h.state = stateFailed
		return ServerHello{}, fmt.Errorf("pairing: ephemeral key: %w", err)
	}

	h.hello = hello
	h.nonceE = nonceE
	h.engEph = engEph
	h.state = stateAwaitKeyConfirm

	return ServerHello{
		EngineUUID:            h.srv.identity.UUID,
		EnginePublicKey:       h.srv.identity.SigningPublicKey(),
		NonceE:                nonceE,
		EngineEphemeralPublic: engEph.PublicKey().Bytes(),
	}, nil
}

// OnKeyConfirm verifies the device's signature (proving private-key possession),
// derives the forward-secret session keys, writes the trust record, and returns
// the engine's PairResult. The device is the handshake initiator.
func (h *Handshake) OnKeyConfirm(ctx context.Context, kc KeyConfirm) (PairResult, *crypto.SessionKeys, error) {
	if h.state != stateAwaitKeyConfirm {
		h.state = stateFailed
		return PairResult{}, nil, ErrHandshakeState
	}
	if len(kc.NonceD) != nonceSize {
		h.state = stateFailed
		return PairResult{}, nil, fmt.Errorf("pairing: bad device nonce length")
	}

	// Verify sig_d over (nonceE ‖ nonceD) — proves the device holds its private key
	// and binds both nonces (anti-replay).
	signed := crypto.ConcatNonces(h.nonceE, kc.NonceD)
	if !crypto.Verify(h.hello.DevicePublicKey, signed, kc.SigD) {
		h.state = stateFailed
		return PairResult{}, nil, ErrBadSignature
	}

	// Derive forward-secret session keys: device is initiator, engine responder.
	devEphPub, err := ecdh.X25519().NewPublicKey(kc.DeviceEphemeralPublic)
	if err != nil {
		h.state = stateFailed
		return PairResult{}, nil, fmt.Errorf("pairing: bad device ephemeral key: %w", err)
	}
	devStaticPub, err := crypto.X25519PublicFromEd25519(h.hello.DevicePublicKey)
	if err != nil {
		h.state = stateFailed
		return PairResult{}, nil, fmt.Errorf("pairing: device static key: %w", err)
	}
	keys, err := crypto.DeriveSessionKeys(crypto.Agreement{
		StaticSelfPriv:    h.srv.engineStaticX,
		StaticPeerPub:     devStaticPub,
		EphemeralSelfPriv: h.engEph,
		EphemeralPeerPub:  devEphPub,
		NonceInitiator:    kc.NonceD,  // device initiated
		NonceResponder:    h.nonceE,   // engine responded
	})
	if err != nil {
		h.state = stateFailed
		return PairResult{}, nil, fmt.Errorf("pairing: derive session keys: %w", err)
	}

	// Persist the trust record (2E §2.3).
	rec := TrustRecord{
		UUID:            h.hello.DeviceUUID,
		PublicKey:       h.hello.DevicePublicKey,
		DeviceClass:     "",
		PermissionsJSON: h.srv.defaultPerms,
		PairedAt:        h.srv.now(),
	}
	if err := h.srv.trust.Save(ctx, rec); err != nil {
		h.state = stateFailed
		return PairResult{}, nil, fmt.Errorf("pairing: save trust record: %w", err)
	}

	// Engine proves its own key possession: sig_e over (nonceD ‖ nonceE).
	sigE := h.srv.identity.Sign(crypto.ConcatNonces(kc.NonceD, h.nonceE))
	h.state = stateDone

	return PairResult{
		SigE:             sigE,
		AssignedClass:    "",
		DefaultPermsJSON: h.srv.defaultPerms,
	}, keys, nil
}
