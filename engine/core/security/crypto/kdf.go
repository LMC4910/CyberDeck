package crypto

import (
	"crypto/ecdh"
	"crypto/hkdf"
	"crypto/sha256"
	"errors"
	"fmt"
)

// AEADKeySize is the ChaCha20-Poly1305 key length.
const AEADKeySize = 32

// sessionInfo is the HKDF info string binding derived keys to this protocol use.
const sessionInfo = "cyberdeck/session/v1 chacha20poly1305"

// HKDF derives keyLen bytes from ikm using HKDF-SHA256 with the given salt/info.
func HKDF(ikm, salt []byte, info string, keyLen int) ([]byte, error) {
	return hkdf.Key(sha256.New, ikm, salt, info, keyLen)
}

// SessionKeys holds the two directional AEAD keys for a session. Both peers derive
// the identical pair; each uses the key matching its send/receive direction.
type SessionKeys struct {
	InitiatorToResponder []byte // 32-byte key for initiator→responder records
	ResponderToInitiator []byte // 32-byte key for responder→initiator records
}

// Agreement is the input to session-key derivation. The static keys bind the keys
// to the paired identities; the per-session ephemerals provide forward secrecy
// (2A §5.3). The nonces bind the keys to this handshake transcript.
type Agreement struct {
	StaticSelfPriv    *ecdh.PrivateKey
	StaticPeerPub     *ecdh.PublicKey
	EphemeralSelfPriv *ecdh.PrivateKey
	EphemeralPeerPub  *ecdh.PublicKey
	NonceInitiator    []byte
	NonceResponder    []byte
}

// DeriveSessionKeys computes the forward-secret directional keys from an ECDH
// agreement. IKM = DH(ephemeral) ‖ DH(static); salt = nonceInitiator ‖
// nonceResponder; the two 32-byte keys are HKDF-expanded from there. Because ECDH
// is symmetric and the salt ordering is fixed (initiator then responder), both
// peers derive the identical SessionKeys regardless of which side calls this.
func DeriveSessionKeys(a Agreement) (*SessionKeys, error) {
	if a.StaticSelfPriv == nil || a.StaticPeerPub == nil ||
		a.EphemeralSelfPriv == nil || a.EphemeralPeerPub == nil {
		return nil, errors.New("crypto: incomplete agreement (nil key)")
	}
	if len(a.NonceInitiator) == 0 || len(a.NonceResponder) == 0 {
		return nil, errors.New("crypto: agreement requires both handshake nonces")
	}

	dhEph, err := X25519(a.EphemeralSelfPriv, a.EphemeralPeerPub)
	if err != nil {
		return nil, fmt.Errorf("crypto: ephemeral ECDH: %w", err)
	}
	dhStatic, err := X25519(a.StaticSelfPriv, a.StaticPeerPub)
	if err != nil {
		return nil, fmt.Errorf("crypto: static ECDH: %w", err)
	}

	ikm := make([]byte, 0, len(dhEph)+len(dhStatic))
	ikm = append(ikm, dhEph...)
	ikm = append(ikm, dhStatic...)

	salt := make([]byte, 0, len(a.NonceInitiator)+len(a.NonceResponder))
	salt = append(salt, a.NonceInitiator...)
	salt = append(salt, a.NonceResponder...)

	okm, err := HKDF(ikm, salt, sessionInfo, AEADKeySize*2)
	if err != nil {
		return nil, fmt.Errorf("crypto: HKDF: %w", err)
	}
	return &SessionKeys{
		InitiatorToResponder: okm[:AEADKeySize],
		ResponderToInitiator: okm[AEADKeySize:],
	}, nil
}

// Send returns the key this peer encrypts with, given its role.
func (k *SessionKeys) Send(isInitiator bool) []byte {
	if isInitiator {
		return k.InitiatorToResponder
	}
	return k.ResponderToInitiator
}

// Recv returns the key this peer decrypts with, given its role.
func (k *SessionKeys) Recv(isInitiator bool) []byte {
	if isInitiator {
		return k.ResponderToInitiator
	}
	return k.InitiatorToResponder
}
