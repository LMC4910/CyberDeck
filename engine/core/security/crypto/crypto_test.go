package crypto

import (
	"bytes"
	"crypto/ecdh"
	"crypto/ed25519"
	"encoding/hex"
	"testing"
)

func mustHex(t *testing.T, s string) []byte {
	t.Helper()
	b, err := hex.DecodeString(s)
	if err != nil {
		t.Fatalf("bad hex: %v", err)
	}
	return b
}

// --- Known-answer tests against published RFC vectors ---

// KAT: X25519 (RFC 7748 §6.1).
func TestKAT_X25519_RFC7748(t *testing.T) {
	alicePriv := mustHex(t, "77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a")
	alicePub := mustHex(t, "8520f0098930a754748b7ddcb43ef75a0dbf3a0d26381af4eba4a98eaa9b4e6a")
	bobPriv := mustHex(t, "5dab087e624a8a4b79e17f8b83800ee66f3bb1292618b6fd1c2f8b27ff88e0eb")
	bobPub := mustHex(t, "de9edb7d7b7dc1b4d35b61c2ece435373f8343c85b78674dadfc7e146f882b4f")
	shared := mustHex(t, "4a5d9d5ba4ce2de1728e3bf480350f25e07e21c947d19e3376f09b3c1e161742")

	aPriv, err := ecdh.X25519().NewPrivateKey(alicePriv)
	if err != nil {
		t.Fatalf("alice priv: %v", err)
	}
	if !bytes.Equal(aPriv.PublicKey().Bytes(), alicePub) {
		t.Error("derived Alice public key != RFC vector")
	}
	bPub, err := ecdh.X25519().NewPublicKey(bobPub)
	if err != nil {
		t.Fatalf("bob pub: %v", err)
	}
	got, err := X25519(aPriv, bPub)
	if err != nil {
		t.Fatalf("X25519: %v", err)
	}
	if !bytes.Equal(got, shared) {
		t.Errorf("shared secret != RFC vector:\n got %x\nwant %x", got, shared)
	}
	// And symmetrically from Bob's side.
	bPriv, _ := ecdh.X25519().NewPrivateKey(bobPriv)
	aPub, _ := ecdh.X25519().NewPublicKey(alicePub)
	got2, _ := X25519(bPriv, aPub)
	if !bytes.Equal(got2, shared) {
		t.Error("reverse ECDH disagreed with RFC shared secret")
	}
}

// KAT: HKDF-SHA256 (RFC 5869 Test Case 1).
func TestKAT_HKDF_RFC5869(t *testing.T) {
	ikm := mustHex(t, "0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b")
	salt := mustHex(t, "000102030405060708090a0b0c")
	info := mustHex(t, "f0f1f2f3f4f5f6f7f8f9")
	want := mustHex(t, "3cb25f25faacd57a90434f64d0362f2a"+
		"2d2d0a90cf1a5a4c5db02d56ecc4c5bf"+
		"34007208d5b887185865")

	got, err := HKDF(ikm, salt, string(info), 42)
	if err != nil {
		t.Fatalf("HKDF: %v", err)
	}
	if !bytes.Equal(got, want) {
		t.Errorf("HKDF OKM != RFC vector:\n got %x\nwant %x", got, want)
	}
}

// KAT: ChaCha20-Poly1305 AEAD (RFC 8439 §2.8.2).
func TestKAT_ChaCha20Poly1305_RFC8439(t *testing.T) {
	key := mustHex(t, "808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9f")
	nonce := mustHex(t, "070000004041424344454647")
	aad := mustHex(t, "50515253c0c1c2c3c4c5c6c7")
	plaintext := []byte("Ladies and Gentlemen of the class of '99: " +
		"If I could offer you only one tip for the future, sunscreen would be it.")
	wantCT := mustHex(t,
		"d31a8d34648e60db7b86afbc53ef7ec2"+
			"a4aded51296e08fea9e2b5a736ee62d6"+
			"3dbea45e8ca9671282fafb69da92728b"+
			"1a71de0a9e060b2905d6a5b67ecd3b36"+
			"92ddbd7f2d778b8c9803aee328091b58"+
			"fab324e4fad675945585808b4831d7bc"+
			"3ff4def08e4b7a9de576d26586cec64b"+
			"6116")
	wantTag := mustHex(t, "1ae10b594f09e26a7e902ecbd0600691")

	c, err := NewCipher(key)
	if err != nil {
		t.Fatalf("NewCipher: %v", err)
	}
	// Seal with the RFC nonce directly via the underlying AEAD (the wrapper's
	// counter-nonce is exercised separately below).
	out := c.aead.Seal(nil, nonce, plaintext, aad)
	gotCT, gotTag := out[:len(out)-16], out[len(out)-16:]
	if !bytes.Equal(gotCT, wantCT) {
		t.Errorf("ciphertext != RFC vector:\n got %x\nwant %x", gotCT, wantCT)
	}
	if !bytes.Equal(gotTag, wantTag) {
		t.Errorf("tag != RFC vector:\n got %x\nwant %x", gotTag, wantTag)
	}
}

// --- Ed25519 → X25519 conversion correctness ---

func TestEd25519ToX25519Consistency(t *testing.T) {
	pub, priv, err := ed25519.GenerateKey(nil)
	if err != nil {
		t.Fatalf("gen: %v", err)
	}
	xPriv, err := X25519FromEd25519Seed(priv.Seed())
	if err != nil {
		t.Fatalf("seed->x25519: %v", err)
	}
	xPubFromEd, err := X25519PublicFromEd25519(pub)
	if err != nil {
		t.Fatalf("ed pub->x25519: %v", err)
	}
	// The public key derived from the Ed25519 public must equal the public key
	// of the X25519 private derived from the seed.
	if !bytes.Equal(xPriv.PublicKey().Bytes(), xPubFromEd.Bytes()) {
		t.Error("Ed25519->X25519 public/private derivations disagree")
	}
	// And an ECDH between this static key and a fresh peer round-trips both ways.
	peer, _ := GenerateX25519()
	s1, _ := X25519(xPriv, peer.PublicKey())
	s2, _ := X25519(peer, xPubFromEd)
	if !bytes.Equal(s1, s2) {
		t.Error("static-key ECDH not symmetric across the conversion")
	}
}

// --- Session-key agreement (forward secrecy) ---

// buildAgreements wires a full initiator/responder agreement from two identities
// and fresh ephemerals, returning each side's derived keys.
func buildAgreements(t *testing.T) (initKeys, respKeys *SessionKeys, nonceI, nonceR []byte) {
	t.Helper()
	_, iSeed, _ := ed25519.GenerateKey(nil)
	_, rSeed, _ := ed25519.GenerateKey(nil)
	iStatic, _ := X25519FromEd25519Seed(iSeed.Seed())
	rStatic, _ := X25519FromEd25519Seed(rSeed.Seed())
	iEph, _ := GenerateX25519()
	rEph, _ := GenerateX25519()
	nonceI = []byte("nonce-initiator-0001")
	nonceR = []byte("nonce-responder-0001")

	ik, err := DeriveSessionKeys(Agreement{
		StaticSelfPriv: iStatic, StaticPeerPub: rStatic.PublicKey(),
		EphemeralSelfPriv: iEph, EphemeralPeerPub: rEph.PublicKey(),
		NonceInitiator: nonceI, NonceResponder: nonceR,
	})
	if err != nil {
		t.Fatalf("initiator derive: %v", err)
	}
	rk, err := DeriveSessionKeys(Agreement{
		StaticSelfPriv: rStatic, StaticPeerPub: iStatic.PublicKey(),
		EphemeralSelfPriv: rEph, EphemeralPeerPub: iEph.PublicKey(),
		NonceInitiator: nonceI, NonceResponder: nonceR,
	})
	if err != nil {
		t.Fatalf("responder derive: %v", err)
	}
	return ik, rk, nonceI, nonceR
}

func TestSessionKeysAgreeAndRoundTrip(t *testing.T) {
	ik, rk, _, _ := buildAgreements(t)

	if !bytes.Equal(ik.InitiatorToResponder, rk.InitiatorToResponder) ||
		!bytes.Equal(ik.ResponderToInitiator, rk.ResponderToInitiator) {
		t.Fatal("the two peers derived different session keys")
	}

	// initiator encrypts → responder decrypts.
	sendC, _ := NewCipher(ik.Send(true))
	recvC, _ := NewCipher(rk.Recv(false))
	msg := []byte("system.cpu.temp=42.0")
	ad := []byte("state")
	rec, err := sendC.Seal(msg, ad)
	if err != nil {
		t.Fatalf("Seal: %v", err)
	}
	got, err := recvC.Open(rec, ad)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	if !bytes.Equal(got, msg) {
		t.Errorf("round-trip mismatch: got %q want %q", got, msg)
	}
}

func TestDistinctSessionsDeriveDistinctKeys(t *testing.T) {
	ik1, _, _, _ := buildAgreements(t)
	ik2, _, _, _ := buildAgreements(t)
	if bytes.Equal(ik1.InitiatorToResponder, ik2.InitiatorToResponder) {
		t.Error("two sessions derived identical keys (forward secrecy broken)")
	}
}

// --- AEAD tamper detection & nonce uniqueness ---

func TestAEADTamperDetected(t *testing.T) {
	key := bytes.Repeat([]byte{0x42}, 32)
	enc, _ := NewCipher(key)
	ad := []byte("layout")
	rec, err := enc.Seal([]byte("op:move widget"), ad)
	if err != nil {
		t.Fatalf("Seal: %v", err)
	}

	// Tamper the ciphertext body.
	bad := bytes.Clone(rec)
	bad[len(bad)-1] ^= 0x01
	if _, err := newOpener(t, key).Open(bad, ad); err == nil {
		t.Error("tampered ciphertext opened without error")
	}
	// Tamper the nonce.
	bad2 := bytes.Clone(rec)
	bad2[0] ^= 0x01
	if _, err := newOpener(t, key).Open(bad2, ad); err == nil {
		t.Error("tampered nonce opened without error")
	}
	// Tamper the additional data.
	if _, err := newOpener(t, key).Open(rec, []byte("state")); err == nil {
		t.Error("wrong additionalData opened without error")
	}
	// Wrong key.
	if _, err := newOpener(t, bytes.Repeat([]byte{0x43}, 32)).Open(rec, ad); err == nil {
		t.Error("wrong key opened without error")
	}
	// Correct everything still works.
	if _, err := newOpener(t, key).Open(rec, ad); err != nil {
		t.Errorf("valid record failed to open: %v", err)
	}
}

func newOpener(t *testing.T, key []byte) *Cipher {
	t.Helper()
	c, err := NewCipher(key)
	if err != nil {
		t.Fatalf("NewCipher: %v", err)
	}
	return c
}

func TestNonceUniquenessAcrossSeals(t *testing.T) {
	enc, _ := NewCipher(bytes.Repeat([]byte{0x7}, 32))
	seen := map[string]bool{}
	for i := 0; i < 1000; i++ {
		rec, err := enc.Seal([]byte("x"), nil)
		if err != nil {
			t.Fatalf("Seal #%d: %v", i, err)
		}
		nonce := string(rec[:NonceSize])
		if seen[nonce] {
			t.Fatalf("nonce reused at iteration %d", i)
		}
		seen[nonce] = true
	}
}

func TestSignVerify(t *testing.T) {
	pub, priv, _ := ed25519.GenerateKey(nil)
	msg := ConcatNonces([]byte("nonce-e"), []byte("nonce-d"))
	sig := Sign(priv, msg)
	if !Verify(pub, msg, sig) {
		t.Error("valid signature did not verify")
	}
	if Verify(pub, []byte("other"), sig) {
		t.Error("signature verified over wrong message")
	}
	otherPub, _, _ := ed25519.GenerateKey(nil)
	if Verify(otherPub, msg, sig) {
		t.Error("signature verified under wrong public key")
	}
}
