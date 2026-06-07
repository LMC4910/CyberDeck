package crypto

import (
	"crypto/cipher"
	"encoding/binary"
	"errors"
	"fmt"
	"math"

	"golang.org/x/crypto/chacha20poly1305"
)

// NonceSize is the ChaCha20-Poly1305 nonce length.
const NonceSize = chacha20poly1305.NonceSize // 12

// Cipher is a one-direction AEAD record cipher. The sender holds a monotonic
// counter that guarantees nonce uniqueness for the lifetime of the key (a nonce
// is NEVER reused, the cardinal AEAD rule). Each sealed record is prefixed with
// its 12-byte nonce so the receiver can open records without sharing counter
// state (robust to the State channel's drop/coalesce behaviour).
type Cipher struct {
	aead    cipher.AEAD
	counter uint64
}

// NewCipher builds a record cipher from a 32-byte key.
func NewCipher(key []byte) (*Cipher, error) {
	if len(key) != chacha20poly1305.KeySize {
		return nil, fmt.Errorf("crypto: bad AEAD key length %d", len(key))
	}
	aead, err := chacha20poly1305.New(key)
	if err != nil {
		return nil, fmt.Errorf("crypto: new AEAD: %w", err)
	}
	return &Cipher{aead: aead}, nil
}

// Seal encrypts plaintext with the next nonce, authenticating additionalData, and
// returns nonce ‖ ciphertext. It errors rather than ever reuse a nonce.
func (c *Cipher) Seal(plaintext, additionalData []byte) ([]byte, error) {
	if c.counter == math.MaxUint64 {
		return nil, errors.New("crypto: nonce space exhausted; rekey required")
	}
	nonce := make([]byte, NonceSize)
	binary.BigEndian.PutUint64(nonce[NonceSize-8:], c.counter)
	c.counter++

	out := c.aead.Seal(nil, nonce, plaintext, additionalData)
	return append(nonce, out...), nil
}

// Open decrypts a nonce-prefixed record produced by Seal, verifying
// additionalData. A tamper of nonce, ciphertext, tag, or additionalData fails.
func (c *Cipher) Open(record, additionalData []byte) ([]byte, error) {
	if len(record) < NonceSize {
		return nil, errors.New("crypto: record shorter than nonce")
	}
	nonce, ct := record[:NonceSize], record[NonceSize:]
	pt, err := c.aead.Open(nil, nonce, ct, additionalData)
	if err != nil {
		return nil, fmt.Errorf("crypto: AEAD open (auth failed): %w", err)
	}
	return pt, nil
}
