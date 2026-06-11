package session_test

import (
	"context"
	"encoding/json"
	"net"
	"sync"
	"testing"
	"time"

	"github.com/shishir/cyberdeck/engine/core/layout"
	"github.com/shishir/cyberdeck/engine/core/registry"
	"github.com/shishir/cyberdeck/engine/core/session"
	"github.com/shishir/cyberdeck/engine/core/state"
	"github.com/shishir/cyberdeck/engine/core/transport"
)

// --- fakes for the server's collaborators ---

type fakeLookup struct{ m map[string]registry.ActionDescriptor }

func (l fakeLookup) Action(id string) (registry.ActionDescriptor, bool) {
	d, ok := l.m[id]
	return d, ok
}

type recInvoker struct{ calls chan string }

func (r *recInvoker) Invoke(_ context.Context, id string, _ json.RawMessage) error {
	r.calls <- id
	return nil
}

type recAuditor struct {
	mu     sync.Mutex
	events []string
}

func (a *recAuditor) Audit(event string, _ map[string]any) {
	a.mu.Lock()
	a.events = append(a.events, event)
	a.mu.Unlock()
}

func (a *recAuditor) has(event string) bool {
	a.mu.Lock()
	defer a.mu.Unlock()
	for _, e := range a.events {
		if e == event {
			return true
		}
	}
	return false
}

// pairedSessions completes a real handshake over a pipe and returns the two
// encrypted-session ends + the handshake result (perms can be overridden first).
func pairedSessions(t *testing.T, perms string) (eng, dev *transport.EncryptedSession, hr *session.HandshakeResult) {
	t.Helper()
	srv, engineID := engineServer(t, tokenAuth{want: "t"})
	serverConn, clientConn := net.Pipe()
	done := make(chan *session.HandshakeResult, 1)
	errc := make(chan error, 1)
	go func() {
		r, err := session.ServerHandshake(context.Background(), serverConn, srv)
		if err != nil {
			errc <- err
			return
		}
		done <- r
	}()
	deviceKeys, _ := runDevice(t, clientConn, engineID.SigningPublicKey(), "dev", "t")
	select {
	case err := <-errc:
		t.Fatalf("handshake: %v", err)
	case hr = <-done:
	}
	if perms != "" {
		hr.PermissionsJSON = perms
	}
	eng, err := transport.NewEncryptedSession(serverConn, hr.Keys, false, "dev")
	if err != nil {
		t.Fatalf("engine session: %v", err)
	}
	dev, err = transport.NewEncryptedSession(clientConn, deviceKeys, true, "dev")
	if err != nil {
		t.Fatalf("device session: %v", err)
	}
	return eng, dev, hr
}

func TestServerServesDeckAndDispatches(t *testing.T) {
	eng, dev, hr := pairedSessions(t, `{"allowPowerActions":true,"allowedCategories":["power"]}`)
	defer func() { _ = eng.Close() }()
	defer func() { _ = dev.Close() }()

	store := state.New()
	_ = store.Set("system.cpu.percent", 42.0)
	_ = store.Set("system.ram.percent", 30.0)

	invoker := &recInvoker{calls: make(chan string, 4)}
	audit := &recAuditor{}
	lookup := fakeLookup{m: map[string]registry.ActionDescriptor{
		"power.lock": {ID: "power.lock", Label: "Lock", Category: "power"},
	}}
	srv := session.NewServer(transport.NewFanout(), layout.DefaultProfile(), store, lookup, invoker, audit, testLogger())
	srv.Serve(eng, hr)

	// The device receives the layout snapshot, then state deltas.
	sawSnapshot, sawState := false, false
	deadline := time.After(2 * time.Second)
	for (!sawSnapshot || !sawState) && true {
		select {
		case env := <-dev.Received():
			switch env.Type {
			case "layout.snapshot":
				sawSnapshot = true
			case "state.delta":
				sawState = true
			}
		case <-deadline:
			t.Fatalf("missing initial push (snapshot=%v state=%v)", sawSnapshot, sawState)
		}
		if sawSnapshot && sawState {
			break
		}
	}

	// The device taps a button → the engine authorizes + dispatches the action.
	payload, _ := json.Marshal(map[string]any{"actionId": "power.lock"})
	if err := dev.Send(transport.Envelope{V: 1, Ch: transport.ChannelControl, Type: "interaction", Payload: payload}); err != nil {
		t.Fatalf("device send: %v", err)
	}
	select {
	case id := <-invoker.calls:
		if id != "power.lock" {
			t.Errorf("dispatched %q, want power.lock", id)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("interaction was not dispatched")
	}
	if !audit.has("interaction.executed") {
		t.Error("expected interaction.executed audit event")
	}
}

func TestServerDeniesUnauthorizedAction(t *testing.T) {
	eng, dev, hr := pairedSessions(t, `{"allowPowerActions":false,"allowedCategories":[]}`)
	defer func() { _ = eng.Close() }()
	defer func() { _ = dev.Close() }()

	invoker := &recInvoker{calls: make(chan string, 1)}
	audit := &recAuditor{}
	lookup := fakeLookup{m: map[string]registry.ActionDescriptor{
		"power.shutdown": {ID: "power.shutdown", Label: "Shutdown", Category: "power", Destructive: true},
	}}
	srv := session.NewServer(transport.NewFanout(), layout.DefaultProfile(), state.New(), lookup, invoker, audit, testLogger())
	srv.Serve(eng, hr)

	// Drain the initial push.
	drain := time.After(300 * time.Millisecond)
drainLoop:
	for {
		select {
		case <-dev.Received():
		case <-drain:
			break drainLoop
		}
	}

	payload, _ := json.Marshal(map[string]any{"actionId": "power.shutdown"})
	_ = dev.Send(transport.Envelope{V: 1, Ch: transport.ChannelControl, Type: "interaction", Payload: payload})

	select {
	case id := <-invoker.calls:
		t.Fatalf("unauthorized action %q must NOT dispatch", id)
	case <-time.After(400 * time.Millisecond):
		// good — not dispatched
	}
	if !audit.has("interaction.denied") {
		t.Error("expected interaction.denied audit event")
	}
}
