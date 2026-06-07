package transport

import (
	"context"
	"errors"
	"io"
	"net"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// Compile-time interface conformance.
var (
	_ TransportEndpoint = (*LanEndpoint)(nil)
	_ ConnectionManager = (*Manager)(nil)
)

// --- test doubles ---

type fakeConn struct {
	closed bool
}

func (c *fakeConn) Read([]byte) (int, error)    { return 0, io.EOF }
func (c *fakeConn) Write(p []byte) (int, error) { return len(p), nil }
func (c *fakeConn) Close() error                { c.closed = true; return nil }

type fakeEndpoint struct {
	info    EndpointInfo
	dialErr error
	conn    *fakeConn
}

func (f *fakeEndpoint) Dial(context.Context) (Conn, error) {
	if f.dialErr != nil {
		return nil, f.dialErr
	}
	return f.conn, nil
}
func (f *fakeEndpoint) Describe() EndpointInfo { return f.info }

type fakeResolver struct {
	eps []TransportEndpoint
	err error
}

func (r fakeResolver) Resolve(context.Context, string) ([]TransportEndpoint, error) {
	return r.eps, r.err
}

type fakeSession struct{ uuid string }

func (s fakeSession) DeviceUUID() string { return s.uuid }
func (s fakeSession) Close() error       { return nil }

type fakeHandshaker struct {
	err   error
	calls int
}

func (h *fakeHandshaker) Handshake(_ context.Context, uuid string, _ Conn, _ EndpointInfo) (Session, error) {
	h.calls++
	if h.err != nil {
		return nil, h.err
	}
	return fakeSession{uuid: uuid}, nil
}

func ep(source CandidateSource, dialErr error) *fakeEndpoint {
	return &fakeEndpoint{
		info:    EndpointInfo{Kind: KindLAN, Address: source.String(), Source: source},
		dialErr: dialErr,
		conn:    &fakeConn{},
	}
}

// --- tests ---

func TestResolveOrdering(t *testing.T) {
	// Resolver returns candidates out of priority order; Resolve must order them
	// last-known-ip → mdns → active-scan (2A §2).
	r := fakeResolver{eps: []TransportEndpoint{
		ep(SourceActiveScan, nil),
		ep(SourceLastKnownIP, nil),
		ep(SourceMDNS, nil),
	}}
	m := NewManager(r, &fakeHandshaker{})
	got, err := m.Resolve(context.Background(), "dev")
	if err != nil {
		t.Fatalf("Resolve: %v", err)
	}
	want := []CandidateSource{SourceLastKnownIP, SourceMDNS, SourceActiveScan}
	if len(got) != len(want) {
		t.Fatalf("got %d candidates, want %d", len(got), len(want))
	}
	for i, w := range want {
		if got[i].Describe().Source != w {
			t.Errorf("candidate[%d] source = %s, want %s", i, got[i].Describe().Source, w)
		}
	}
}

func TestLanEndpointDial(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	defer func() { _ = ln.Close() }()
	go func() {
		conn, err := ln.Accept()
		if err != nil {
			return
		}
		_, _ = io.Copy(conn, conn) // echo
		_ = conn.Close()
	}()

	e := NewLanEndpoint(ln.Addr().String(), SourceLastKnownIP)
	conn, err := e.Dial(context.Background())
	if err != nil {
		t.Fatalf("Dial: %v", err)
	}
	defer func() { _ = conn.Close() }()

	if _, err := conn.Write([]byte("ping")); err != nil {
		t.Fatalf("write: %v", err)
	}
	buf := make([]byte, 4)
	if _, err := io.ReadFull(conn, buf); err != nil {
		t.Fatalf("read: %v", err)
	}
	if string(buf) != "ping" {
		t.Errorf("echo = %q, want ping", buf)
	}
}

func TestOpenSuccess(t *testing.T) {
	hs := &fakeHandshaker{}
	m := NewManager(fakeResolver{eps: []TransportEndpoint{ep(SourceLastKnownIP, nil)}}, hs)

	sess, err := m.Open(context.Background(), "dev-1")
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	if sess.DeviceUUID() != "dev-1" {
		t.Errorf("session uuid = %q, want dev-1", sess.DeviceUUID())
	}
	if hs.calls != 1 {
		t.Errorf("handshake calls = %d, want 1", hs.calls)
	}
}

func TestOpenFallsBackPastDialFailure(t *testing.T) {
	bad := ep(SourceLastKnownIP, errors.New("connection refused"))
	good := ep(SourceMDNS, nil)
	hs := &fakeHandshaker{}
	m := NewManager(fakeResolver{eps: []TransportEndpoint{bad, good}}, hs)

	sess, err := m.Open(context.Background(), "dev-2")
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	if sess == nil {
		t.Fatal("nil session")
	}
	// Handshake only attempted for the candidate that dialed successfully.
	if hs.calls != 1 {
		t.Errorf("handshake calls = %d, want 1", hs.calls)
	}
}

func TestOpenHandshakeFailureClosesConnAndTriesNext(t *testing.T) {
	first := ep(SourceLastKnownIP, nil)
	second := ep(SourceMDNS, nil)
	hs := &fakeHandshaker{err: errors.New("not trusted")}
	m := NewManager(fakeResolver{eps: []TransportEndpoint{first, second}}, hs)

	_, err := m.Open(context.Background(), "dev-3")
	if err == nil {
		t.Fatal("Open succeeded, want error after all handshakes fail")
	}
	if hs.calls != 2 {
		t.Errorf("handshake calls = %d, want 2 (both candidates tried)", hs.calls)
	}
	if !first.conn.closed || !second.conn.closed {
		t.Error("dialed conns not closed after handshake failure")
	}
}

func TestOpenNoEndpoints(t *testing.T) {
	m := NewManager(fakeResolver{eps: nil}, &fakeHandshaker{})
	if _, err := m.Open(context.Background(), "dev-x"); err == nil {
		t.Fatal("Open with no endpoints = nil error, want error")
	}
}

// TestNoEndpointKindLeakAboveManager is the structural guard for ADR-0010 /
// TA-EP-1: no package in the engine outside core/transport may reference the
// endpoint-kind identifiers, i.e. nothing above the ConnectionManager branches
// on transport kind.
func TestNoEndpointKindLeakAboveManager(t *testing.T) {
	engineRoot, err := filepath.Abs(filepath.Join("..", ".."))
	if err != nil {
		t.Fatalf("abs: %v", err)
	}
	transportDir := filepath.Join(engineRoot, "core", "transport")
	forbidden := []string{"EndpointKind", "transport.Kind"}

	walkErr := filepath.WalkDir(engineRoot, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		if !strings.HasSuffix(path, ".go") {
			return nil
		}
		if strings.HasPrefix(path, transportDir) {
			return nil // the seam itself is allowed to know the kind
		}
		b, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		for _, tok := range forbidden {
			if strings.Contains(string(b), tok) {
				t.Errorf("transport-kind leak: %s references %q (TA-EP-1: no kind branch above the ConnectionManager)", path, tok)
			}
		}
		return nil
	})
	if walkErr != nil {
		t.Fatalf("walk: %v", walkErr)
	}
}
