package session_test

import (
	"testing"
	"time"

	"github.com/shishir/cyberdeck/engine/core/layout"
	"github.com/shishir/cyberdeck/engine/core/registry"
	"github.com/shishir/cyberdeck/engine/core/session"
	"github.com/shishir/cyberdeck/engine/core/state"
	"github.com/shishir/cyberdeck/engine/core/transport"
)

func newServer(t *testing.T) *session.Server {
	t.Helper()
	return session.NewServer(
		transport.NewFanout(),
		layout.DefaultProfile(),
		state.New(),
		fakeLookup{m: map[string]registry.ActionDescriptor{}},
		&recInvoker{calls: make(chan string, 1)},
		&recAuditor{},
		testLogger(),
	)
}

// waitFor reads dev envelopes until one matches, or fails on timeout.
func waitFor(t *testing.T, dev *transport.EncryptedSession, match func(transport.Envelope) bool, d time.Duration) transport.Envelope {
	t.Helper()
	deadline := time.After(d)
	for {
		select {
		case env := <-dev.Received():
			if match(env) {
				return env
			}
		case <-deadline:
			t.Fatal("timed out waiting for expected envelope")
		}
	}
}

func TestHeartbeatPingPong(t *testing.T) {
	eng, dev, hr := pairedSessions(t, "{}")
	defer func() { _ = eng.Close() }()
	defer func() { _ = dev.Close() }()

	newServer(t).Serve(eng, hr)

	if err := dev.Send(transport.Envelope{
		V: 1, Ch: transport.ChannelControl, Type: "ping"}); err != nil {
		t.Fatalf("ping: %v", err)
	}
	env := waitFor(t, dev, func(e transport.Envelope) bool {
		return e.Ch == transport.ChannelControl && e.Type == "pong"
	}, 2*time.Second)
	if env.Type != "pong" {
		t.Errorf("got %q, want pong", env.Type)
	}
}

func TestResyncReservesSnapshot(t *testing.T) {
	eng, dev, hr := pairedSessions(t, "{}")
	defer func() { _ = eng.Close() }()
	defer func() { _ = dev.Close() }()

	newServer(t).Serve(eng, hr)

	// Consume the initial snapshot, then request a resync and expect a second one.
	waitFor(t, dev, func(e transport.Envelope) bool { return e.Type == "layout.snapshot" },
		2*time.Second)
	if err := dev.Send(transport.Envelope{
		V: 1, Ch: transport.ChannelControl, Type: "resync"}); err != nil {
		t.Fatalf("resync: %v", err)
	}
	waitFor(t, dev, func(e transport.Envelope) bool { return e.Type == "layout.snapshot" },
		2*time.Second)
}

func TestReaperClosesIdleSession(t *testing.T) {
	eng, dev, hr := pairedSessions(t, "{}")
	defer func() { _ = dev.Close() }()

	srv := newServer(t)
	srv.SetHeartbeatTimeout(200 * time.Millisecond)
	srv.Serve(eng, hr)

	// No ping is ever sent → the engine reaps the silent session.
	select {
	case <-eng.Done():
	case <-time.After(3 * time.Second):
		t.Fatal("reaper did not close the idle session")
	}
}

func TestCloseDeviceTearsDownSession(t *testing.T) {
	eng, dev, hr := pairedSessions(t, "{}")
	defer func() { _ = dev.Close() }()

	srv := newServer(t)
	srv.Serve(eng, hr)

	if !srv.CloseDevice("dev") {
		t.Fatal("CloseDevice should report the session was present")
	}
	select {
	case <-eng.Done():
	case <-time.After(2 * time.Second):
		t.Fatal("CloseDevice did not tear the session down")
	}
	if srv.CloseDevice("dev") {
		t.Error("second CloseDevice should report no session")
	}
}
