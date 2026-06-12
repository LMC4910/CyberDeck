package security_test

import (
	"bytes"
	"testing"
	"time"

	"github.com/shishir/cyberdeck/engine/core/transport"
)

// TestSniffWireIsCiphertextOnly is P1-AC-03: a passive eavesdropper on the LAN
// link sees only ciphertext. We pair a real device, push a sensitive,
// recognisable payload through the encrypted session, and assert none of the
// plaintext — not the marker, not the channel/type metadata, not any JSON
// envelope structure — ever appears in the bytes that crossed the wire. The only
// thing on the wire is length-prefixed AEAD records.
func TestSniffWireIsCiphertextOnly(t *testing.T) {
	trust := newFakeTrust()
	srv, _, issuer := newEngine(t, trust)
	dev := newDevice(t, "dev-sniff")

	deviceSess, engineSess, wire := pairedSession(t, srv, issuer, dev)
	defer func() { _ = deviceSess.Close() }()
	defer func() { _ = engineSess.Close() }()

	// A payload a sniffer would love to recover in the clear: a token-shaped
	// secret plus structural markers.
	const marker = "SUPER-SECRET-SNIFF-MARKER-deadbeefcafe"
	env := transport.Envelope{
		V:       transport.ProtocolVersion,
		Ch:      transport.ChannelControl,
		Type:    "interaction",
		Seq:     1,
		Payload: []byte(`{"actionId":"system.lock","secret":"` + marker + `"}`),
	}
	if err := deviceSess.Send(env); err != nil {
		t.Fatalf("Send: %v", err)
	}

	// Wait until the engine actually decrypts and delivers it (proving the
	// channel works end-to-end, not that we merely dropped the bytes).
	select {
	case got, ok := <-engineSess.Received():
		if !ok {
			t.Fatal("engine inbound closed before delivery")
		}
		if !bytes.Contains(got.Payload, []byte(marker)) {
			t.Fatalf("engine did not recover the plaintext payload: %q", got.Payload)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("timed out waiting for the engine to receive the message")
	}

	captured := wire.captured()
	if len(captured) == 0 {
		t.Fatal("nothing was captured on the wire")
	}

	// (1) The secret marker must never appear in cleartext on the wire.
	if bytes.Contains(captured, []byte(marker)) {
		t.Fatal("plaintext secret marker found on the wire — encryption failed (P1-AC-03)")
	}

	// (2) Neither must any other plaintext fragment of the message — channel id,
	// inner type, the action id, or JSON structure. Their presence would mean the
	// envelope leaked unencrypted metadata.
	for _, frag := range [][]byte{
		[]byte("system.lock"),
		[]byte("interaction"),
		[]byte(transport.ChannelControl),
		[]byte(`"actionId"`),
		[]byte(`"secret"`),
	} {
		if bytes.Contains(captured, frag) {
			t.Errorf("plaintext fragment %q leaked onto the wire", frag)
		}
	}

	// (3) Structurally, the wire must be exactly a sequence of length-prefixed
	// AEAD records and nothing else — every framed record must decrypt only with
	// the session key (an eavesdropper without it gets nothing). We re-frame-parse
	// the capture and confirm each record is opaque ciphertext of non-trivial size
	// (>= AEAD nonce + tag overhead).
	records := parseFrames(t, captured)
	if len(records) == 0 {
		t.Fatal("no framed records on the wire")
	}
	for i, rec := range records {
		// nonce(12) + at least the Poly1305 tag(16) of overhead.
		if len(rec) < 12+16 {
			t.Errorf("record %d too short to be an AEAD record (%d bytes)", i, len(rec))
		}
		if bytes.Contains(rec, []byte(marker)) {
			t.Errorf("record %d contains plaintext marker", i)
		}
	}
}

// parseFrames splits a captured stream into its length-prefixed frame payloads
// (uint32 big-endian length ‖ payload), matching transport.Framer's wire format.
func parseFrames(t *testing.T, b []byte) [][]byte {
	t.Helper()
	var out [][]byte
	r := bytes.NewReader(b)
	f := transport.NewFramer(0)
	for r.Len() > 0 {
		rec, err := f.Read(r)
		if err != nil {
			t.Fatalf("parse frame %d: %v", len(out), err)
		}
		out = append(out, rec)
	}
	return out
}
