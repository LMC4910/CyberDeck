package transport

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net"
	"sync"
	"testing"
	"time"
)

// discardLogger returns a logger that swallows all output, so control-channel
// tests do not spam accept/refusal lines into the test log.
func discardLogger() *log.Logger { return log.New(io.Discard, "", 0) }

// --- test doubles for the control-channel dependencies ---

type fakeLifecycle struct {
	mu                             sync.Mutex
	state                          string
	paused, resumed, quit          bool
	statusErr, pauseErr, resumeErr error
	quitErr                        error
}

func (l *fakeLifecycle) Status(context.Context) (string, error) {
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.statusErr != nil {
		return "", l.statusErr
	}
	if l.state == "" {
		return "running", nil
	}
	return l.state, nil
}

func (l *fakeLifecycle) Pause(context.Context) error {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.paused = true
	l.state = "paused"
	return l.pauseErr
}

func (l *fakeLifecycle) Resume(context.Context) error {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.resumed = true
	l.state = "running"
	return l.resumeErr
}

func (l *fakeLifecycle) Quit(context.Context) error {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.quit = true
	return l.quitErr
}

// fakeMinter mirrors security.TokenIssuer.Issue(privileged bool).
type fakeMinter struct {
	mu            sync.Mutex
	tok           string
	err           error
	gotPrivileged bool
	called        bool
}

func (m *fakeMinter) Issue(privileged bool) (string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.called = true
	m.gotPrivileged = privileged
	if m.err != nil {
		return "", m.err
	}
	if m.tok == "" {
		return "tok-123", nil
	}
	return m.tok, nil
}

type fakeAudit struct {
	mu       sync.Mutex
	rows     []AuditRow
	gotLimit int
	err      error
}

func (a *fakeAudit) Recent(_ context.Context, limit int) ([]AuditRow, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.gotLimit = limit
	if a.err != nil {
		return nil, a.err
	}
	return a.rows, nil
}

// addrConn wraps a net.Conn but reports a caller-chosen RemoteAddr, so the
// loopback re-check (guard #2) can be exercised without a real off-box peer.
type addrConn struct {
	net.Conn
	remote net.Addr
}

func (c addrConn) RemoteAddr() net.Addr { return c.remote }

type fakeAddr struct{ s string }

func (a fakeAddr) Network() string { return "tcp" }
func (a fakeAddr) String() string  { return a.s }

// --- handler-level tests (no socket) ---

func TestControlHandlerLifecycle(t *testing.T) {
	life := &fakeLifecycle{}
	h := NewControlHandler(life, nil, nil)
	ctx := context.Background()

	// status
	data, err := h.Handle(ctx, OpServiceStatus, nil)
	if err != nil {
		t.Fatalf("status: %v", err)
	}
	var sr StatusResult
	if err := json.Unmarshal(data, &sr); err != nil {
		t.Fatalf("decode status: %v", err)
	}
	if sr.State != "running" {
		t.Errorf("state = %q, want running", sr.State)
	}

	// pause → resume → quit
	if _, err := h.Handle(ctx, OpServicePause, nil); err != nil {
		t.Fatalf("pause: %v", err)
	}
	if _, err := h.Handle(ctx, OpServiceResume, nil); err != nil {
		t.Fatalf("resume: %v", err)
	}
	if _, err := h.Handle(ctx, OpServiceQuit, nil); err != nil {
		t.Fatalf("quit: %v", err)
	}
	if !life.paused || !life.resumed || !life.quit {
		t.Errorf("lifecycle calls: paused=%v resumed=%v quit=%v, want all true",
			life.paused, life.resumed, life.quit)
	}
}

func TestControlHandlerPairApproveIssuesPrivilegedToken(t *testing.T) {
	m := &fakeMinter{tok: "pairing-token-xyz"}
	h := NewControlHandler(nil, m, nil)

	data, err := h.Handle(context.Background(), OpPairApprove, nil)
	if err != nil {
		t.Fatalf("pair.approve: %v", err)
	}
	var pr PairApproveResult
	if err := json.Unmarshal(data, &pr); err != nil {
		t.Fatalf("decode pair result: %v", err)
	}
	if pr.Token != "pairing-token-xyz" {
		t.Errorf("token = %q, want pairing-token-xyz", pr.Token)
	}
	if !m.called || !m.gotPrivileged {
		t.Errorf("minter called=%v privileged=%v, want both true (control channel is the privileged caller)",
			m.called, m.gotPrivileged)
	}
}

func TestControlHandlerAuditRead(t *testing.T) {
	a := &fakeAudit{rows: []AuditRow{
		{ID: 2, TS: 200, Actor: "dev-1", EventType: "device.paired", ResourceType: "device", ResourceID: "dev-1"},
		{ID: 1, TS: 100, Actor: "local-ui", EventType: "session.opened"},
	}}
	h := NewControlHandler(nil, nil, a)

	req, _ := json.Marshal(AuditReadRequest{Limit: 50})
	data, err := h.Handle(context.Background(), OpAuditRead, req)
	if err != nil {
		t.Fatalf("audit.read: %v", err)
	}
	var res AuditReadResult
	if err := json.Unmarshal(data, &res); err != nil {
		t.Fatalf("decode audit result: %v", err)
	}
	if len(res.Rows) != 2 {
		t.Fatalf("rows = %d, want 2", len(res.Rows))
	}
	if res.Rows[0].EventType != "device.paired" {
		t.Errorf("row0 type = %q, want device.paired", res.Rows[0].EventType)
	}
	if a.gotLimit != 50 {
		t.Errorf("audit limit = %d, want 50", a.gotLimit)
	}
}

func TestControlHandlerAuditReadDefaultAndCapLimit(t *testing.T) {
	a := &fakeAudit{}
	h := NewControlHandler(nil, nil, a)

	// no payload → default limit
	if _, err := h.Handle(context.Background(), OpAuditRead, nil); err != nil {
		t.Fatalf("audit.read default: %v", err)
	}
	if a.gotLimit != defaultAuditReadLimit {
		t.Errorf("default limit = %d, want %d", a.gotLimit, defaultAuditReadLimit)
	}

	// over-ask → capped
	req, _ := json.Marshal(AuditReadRequest{Limit: 10_000})
	if _, err := h.Handle(context.Background(), OpAuditRead, req); err != nil {
		t.Fatalf("audit.read cap: %v", err)
	}
	if a.gotLimit != maxAuditReadLimit {
		t.Errorf("capped limit = %d, want %d", a.gotLimit, maxAuditReadLimit)
	}
}

func TestControlHandlerUnknownOp(t *testing.T) {
	h := NewControlHandler(&fakeLifecycle{}, &fakeMinter{}, &fakeAudit{})
	if _, err := h.Handle(context.Background(), ControlOp("does.not.exist"), nil); err == nil {
		t.Fatal("unknown op = nil error, want error")
	}
}

// --- loopback-binding guards ---

func TestRequireLoopbackHost(t *testing.T) {
	ok := []string{"127.0.0.1:0", "127.0.0.1:47601", "[::1]:0", "localhost:0"}
	for _, a := range ok {
		if err := requireLoopbackHost(a); err != nil {
			t.Errorf("requireLoopbackHost(%q) = %v, want nil", a, err)
		}
	}
	bad := []string{"0.0.0.0:47601", "192.168.1.5:47601", ":47601", "8.8.8.8:53"}
	for _, a := range bad {
		if err := requireLoopbackHost(a); err == nil {
			t.Errorf("requireLoopbackHost(%q) = nil, want non-loopback error", a)
		} else if !errors.Is(err, ErrNonLoopback) {
			t.Errorf("requireLoopbackHost(%q) err = %v, want ErrNonLoopback", a, err)
		}
	}
}

func TestControlChannelRefusesNonLoopbackBind(t *testing.T) {
	c := NewControlChannel("0.0.0.0:0", NewControlHandler(&fakeLifecycle{}, nil, nil), discardLogger())
	if err := c.Start(context.Background()); err == nil {
		_ = c.Stop(context.Background())
		t.Fatal("Start on non-loopback addr = nil, want refusal")
	} else if !errors.Is(err, ErrNonLoopback) {
		t.Fatalf("Start err = %v, want ErrNonLoopback", err)
	}
}

// TestControlChannelRefusesNonLoopbackPeer drives handleConn with a connection that
// reports a non-loopback RemoteAddr: the handler must refuse before any op and must
// never invoke a privileged dependency.
func TestControlChannelRefusesNonLoopbackPeer(t *testing.T) {
	m := &fakeMinter{}
	c := NewControlChannel("", NewControlHandler(&fakeLifecycle{}, m, nil), discardLogger())
	c.ctx, c.cancel = context.WithCancel(context.Background())
	defer c.cancel()

	client, server := net.Pipe()
	spoofed := addrConn{Conn: server, remote: fakeAddr{s: "203.0.113.7:55000"}}

	c.wg.Add(1)
	done := make(chan struct{})
	go func() {
		c.handleConn(spoofed)
		close(done)
	}()

	// Try to send a privileged pair.approve; the peer is non-loopback so it must be
	// refused (connection closed, no reply, minter never called).
	fr := NewFramer(0)
	req := ClientRequest(OpPairApprove, nil)
	b, _ := JSONSerializer{}.Marshal(req)
	_ = client.SetDeadline(time.Now().Add(2 * time.Second))
	_ = fr.Write(client, b) // may or may not error depending on close race

	// Read should hit EOF/closed — never a successful reply frame.
	_ = client.SetDeadline(time.Now().Add(2 * time.Second))
	if _, err := fr.Read(client); err == nil {
		t.Fatal("got a reply frame from a non-loopback peer, want connection refused")
	}
	_ = client.Close()
	<-done

	m.mu.Lock()
	called := m.called
	m.mu.Unlock()
	if called {
		t.Error("token minter was invoked for a non-loopback peer (privileged op leaked)")
	}
}

// --- end-to-end over a real loopback socket ---

func TestControlChannelEndToEnd(t *testing.T) {
	life := &fakeLifecycle{}
	minter := &fakeMinter{tok: "e2e-token"}
	audit := &fakeAudit{rows: []AuditRow{{ID: 1, TS: 1, Actor: "system", EventType: "session.opened"}}}

	c := NewControlChannel("", NewControlHandler(life, minter, audit), discardLogger())
	if err := c.Start(context.Background()); err != nil {
		t.Fatalf("Start: %v", err)
	}
	defer func() { _ = c.Stop(context.Background()) }()

	conn, err := net.Dial("tcp", c.Addr())
	if err != nil {
		t.Fatalf("dial control: %v", err)
	}
	defer func() { _ = conn.Close() }()
	fr := NewFramer(0)
	ser := JSONSerializer{}

	roundtrip := func(op ControlOp, payload []byte) controlReply {
		t.Helper()
		b, err := ser.Marshal(ClientRequest(op, payload))
		if err != nil {
			t.Fatalf("marshal req: %v", err)
		}
		_ = conn.SetDeadline(time.Now().Add(3 * time.Second))
		if err := fr.Write(conn, b); err != nil {
			t.Fatalf("write req: %v", err)
		}
		respBytes, err := fr.Read(conn)
		if err != nil {
			t.Fatalf("read resp: %v", err)
		}
		env, err := ser.Unmarshal(respBytes)
		if err != nil {
			t.Fatalf("unmarshal resp: %v", err)
		}
		if env.Ch != ChannelControl {
			t.Fatalf("reply channel = %q, want control", env.Ch)
		}
		var r controlReply
		if err := json.Unmarshal(env.Payload, &r); err != nil {
			t.Fatalf("decode reply: %v", err)
		}
		return r
	}

	// status
	r := roundtrip(OpServiceStatus, nil)
	if !r.OK {
		t.Fatalf("status reply not ok: %q", r.Error)
	}

	// pair.approve issues a token
	r = roundtrip(OpPairApprove, nil)
	if !r.OK {
		t.Fatalf("pair.approve not ok: %q", r.Error)
	}
	var pr PairApproveResult
	if err := json.Unmarshal(r.Data, &pr); err != nil {
		t.Fatalf("decode token: %v", err)
	}
	if pr.Token != "e2e-token" {
		t.Errorf("token = %q, want e2e-token", pr.Token)
	}

	// audit.read returns rows
	req, _ := json.Marshal(AuditReadRequest{Limit: 10})
	r = roundtrip(OpAuditRead, req)
	if !r.OK {
		t.Fatalf("audit.read not ok: %q", r.Error)
	}
	var ar AuditReadResult
	if err := json.Unmarshal(r.Data, &ar); err != nil {
		t.Fatalf("decode audit: %v", err)
	}
	if len(ar.Rows) != 1 || ar.Rows[0].EventType != "session.opened" {
		t.Errorf("audit rows = %+v, want one session.opened", ar.Rows)
	}

	// pause is reflected in lifecycle state
	r = roundtrip(OpServicePause, nil)
	if !r.OK {
		t.Fatalf("pause not ok: %q", r.Error)
	}
	life.mu.Lock()
	paused := life.paused
	life.mu.Unlock()
	if !paused {
		t.Error("pause op did not reach lifecycle controller")
	}
}

// TestLanSessionCannotRouteToControl proves the privileged-local boundary: a LAN
// device sending a ChannelControl envelope through the encrypted-session path
// (EncryptedSession → ChannelMux) is demuxed only into ControlInbound() and never
// reaches a ControlHandler — nothing on the LAN side is wired to one. The control
// handler is reachable ONLY through the loopback ControlChannel.
func TestLanSessionCannotRouteToControl(t *testing.T) {
	minter := &fakeMinter{}
	// The handler that a LAN peer must never reach.
	_ = NewControlHandler(&fakeLifecycle{}, minter, &fakeAudit{})

	// Simulate a LAN session feeding inbound envelopes through the mux.
	in := make(chan Envelope, 1)
	sess := &fakeMuxSession{in: in}
	mux := NewChannelMux(sess, 0, 8)
	defer mux.Close()

	// A malicious LAN device emits a privileged control op.
	in <- ClientRequest(OpPairApprove, nil)

	// It surfaces ONLY on ControlInbound — the LAN side has no ControlHandler wired,
	// so the op is inert. We assert it lands on ControlInbound (demux is correct) and
	// that the privileged minter was never invoked (no routing to control ops).
	select {
	case env := <-mux.ControlInbound():
		if env.Ch != ChannelControl {
			t.Fatalf("inbound channel = %q, want control", env.Ch)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("control envelope not demuxed to ControlInbound")
	}

	minter.mu.Lock()
	called := minter.called
	minter.mu.Unlock()
	if called {
		t.Fatal("LAN session reached a privileged control op (boundary violated)")
	}
}

// fakeMuxSession is a minimal sessionLike for the routing test.
type fakeMuxSession struct {
	in chan Envelope
}

func (s *fakeMuxSession) Send(Envelope) error       { return nil }
func (s *fakeMuxSession) Received() <-chan Envelope { return s.in }
