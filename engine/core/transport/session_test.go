package transport

import (
	"bytes"
	"io"
	"net"
	"runtime"
	"sync"
	"testing"
	"time"

	"github.com/shishir/cyberdeck/engine/core/security/crypto"
)

func testKeys() *crypto.SessionKeys {
	return &crypto.SessionKeys{
		InitiatorToResponder: bytes.Repeat([]byte{0x11}, 32),
		ResponderToInitiator: bytes.Repeat([]byte{0x22}, 32),
	}
}

// teeConn wraps a net.Conn, capturing everything written (the wire bytes).
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

// rdConn is a Conn that reads from a fixed reader and discards writes (for the
// tamper test).
type rdConn struct{ r io.Reader }

func (c *rdConn) Read(p []byte) (int, error)  { return c.r.Read(p) }
func (c *rdConn) Write(p []byte) (int, error) { return len(p), nil }
func (c *rdConn) Close() error                { return nil }

func TestSessionEncryptedRoundTripNoPlaintext(t *testing.T) {
	c1, c2 := net.Pipe()
	tee := &teeConn{Conn: c1}
	keys := testKeys()

	a, err := NewEncryptedSession(tee, keys, true, "engine")
	if err != nil {
		t.Fatalf("NewSession A: %v", err)
	}
	b, err := NewEncryptedSession(c2, keys, false, "device")
	if err != nil {
		t.Fatalf("NewSession B: %v", err)
	}
	defer func() { _ = a.Close() }()
	defer func() { _ = b.Close() }()

	const marker = "PLAINTEXT-MARKER-PAYLOAD-1234"
	if err := a.Send(Envelope{V: ProtocolVersion, Ch: ChannelState, Type: "state.delta", Seq: 1, Payload: []byte(marker)}); err != nil {
		t.Fatalf("Send: %v", err)
	}

	select {
	case got, ok := <-b.Received():
		if !ok {
			t.Fatal("inbound channel closed before message")
		}
		if string(got.Payload) != marker || got.Ch != ChannelState || got.Seq != 1 {
			t.Errorf("round-trip envelope wrong: %+v", got)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("timed out waiting for round-trip message")
	}

	// The marker plaintext must NOT appear in the bytes that crossed the wire.
	if bytes.Contains(tee.captured(), []byte(marker)) {
		t.Fatal("plaintext payload found on the wire — encryption failed")
	}
}

func TestSessionTeardownNoLeak(t *testing.T) {
	baseline := runtime.NumGoroutine()
	c1, c2 := net.Pipe()
	defer func() { _ = c2.Close() }()

	s, err := NewEncryptedSession(c1, testKeys(), true, "x")
	if err != nil {
		t.Fatalf("NewSession: %v", err)
	}
	if err := s.Close(); err != nil {
		t.Fatalf("Close: %v", err)
	}
	select {
	case <-s.Done():
	case <-time.After(2 * time.Second):
		t.Fatal("session did not report Done after Close")
	}

	// Goroutines should return to baseline (poll briefly for the waiter to exit).
	deadline := time.Now().Add(2 * time.Second)
	for runtime.NumGoroutine() > baseline {
		if time.Now().After(deadline) {
			t.Fatalf("goroutine leak: now=%d baseline=%d", runtime.NumGoroutine(), baseline)
		}
		time.Sleep(10 * time.Millisecond)
	}
	// Close is idempotent.
	if err := s.Close(); err != nil {
		t.Errorf("second Close: %v", err)
	}
}

func TestSessionTamperDetected(t *testing.T) {
	keys := testKeys()

	// Produce a valid encrypted+framed record (sealed with the initiator→responder
	// key, which a responder session decrypts), then corrupt the auth tag.
	sealCipher, _ := crypto.NewCipher(keys.Send(true))
	plain, _ := JSONSerializer{}.Marshal(Envelope{V: ProtocolVersion, Ch: ChannelState, Type: "t", Seq: 1, Payload: []byte("hi")})
	record, _ := sealCipher.Seal(plain, nil)
	var wire bytes.Buffer
	if err := NewFramer(0).Write(&wire, record); err != nil {
		t.Fatalf("frame: %v", err)
	}
	corrupted := wire.Bytes()
	corrupted[len(corrupted)-1] ^= 0xFF // flip a tag byte

	b, err := NewEncryptedSession(&rdConn{r: bytes.NewReader(corrupted)}, keys, false, "device")
	if err != nil {
		t.Fatalf("NewSession: %v", err)
	}
	defer func() { _ = b.Close() }()

	select {
	case <-b.Done():
	case <-time.After(2 * time.Second):
		t.Fatal("session did not tear down on tampered frame")
	}
	if b.Err() == nil {
		t.Error("tampered frame did not produce a session error (AEAD auth should fail)")
	}
	// Nothing should have been delivered.
	if _, ok := <-b.Received(); ok {
		t.Error("a message was delivered despite tamper")
	}
}
