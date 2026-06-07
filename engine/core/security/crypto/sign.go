package crypto

import "crypto/ed25519"

// Sign produces an Ed25519 signature over msg. Used for the handshake nonce
// signatures (2E §3.2) that prove possession of the long-term private key.
func Sign(priv ed25519.PrivateKey, msg []byte) []byte {
	return ed25519.Sign(priv, msg)
}

// Verify checks an Ed25519 signature over msg against pub.
func Verify(pub ed25519.PublicKey, msg, sig []byte) bool {
	if len(pub) != ed25519.PublicKeySize || len(sig) != ed25519.SignatureSize {
		return false
	}
	return ed25519.Verify(pub, msg, sig)
}

// ConcatNonces joins two nonces in a fixed order for signing, so a signature
// binds both handshake nonces (anti-replay; 2E §8 "signatures bind both nonces").
func ConcatNonces(first, second []byte) []byte {
	out := make([]byte, 0, len(first)+len(second))
	out = append(out, first...)
	out = append(out, second...)
	return out
}
