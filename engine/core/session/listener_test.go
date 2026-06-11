package session_test

import (
	"context"
	"io"
	"log"
	"net"
	"testing"
	"time"

	"github.com/shishir/cyberdeck/engine/core/session"
	"github.com/shishir/cyberdeck/engine/core/transport"
)

func testLogger() *log.Logger { return log.New(io.Discard, "", 0) }

func TestListenerAcceptsAndServesPairedSession(t *testing.T) {
	srv, engineID := engineServer(t, tokenAuth{want: "tok"})

	type served struct {
		sess *transport.EncryptedSession
		hr   *session.HandshakeResult
	}
	got := make(chan served, 1)
	ln := session.NewListener("127.0.0.1:0", srv,
		session.HandlerFunc(func(s *transport.EncryptedSession, hr *session.HandshakeResult) {
			got <- served{s, hr}
		}), testLogger())

	if err := ln.Start(context.Background()); err != nil {
		t.Fatalf("Start: %v", err)
	}
	defer func() { _ = ln.Stop(context.Background()) }()

	conn, err := net.Dial("tcp", ln.Addr())
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	deviceKeys, _ := runDevice(t, conn, engineID.SigningPublicKey(), "dev-listener", "tok")

	var s served
	select {
	case s = <-got:
	case <-time.After(2 * time.Second):
		t.Fatal("handler was not invoked with a paired session")
	}
	if s.hr.DeviceUUID != "dev-listener" {
		t.Errorf("deviceUUID = %q", s.hr.DeviceUUID)
	}
	defer func() { _ = s.sess.Close() }()

	// The served session is live: a device-encrypted message arrives decrypted.
	devSess, err := transport.NewEncryptedSession(conn, deviceKeys, true, "dev-listener")
	if err != nil {
		t.Fatalf("device session: %v", err)
	}
	defer func() { _ = devSess.Close() }()
	if err := devSess.Send(transport.Envelope{V: 1, Ch: transport.ChannelControl, Type: "interaction"}); err != nil {
		t.Fatalf("device send: %v", err)
	}
	select {
	case env := <-s.sess.Received():
		if env.Type != "interaction" {
			t.Errorf("served session got %q, want interaction", env.Type)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("served session did not receive the device message")
	}
}

func TestListenerStopIsClean(t *testing.T) {
	srv, _ := engineServer(t, tokenAuth{want: "x"})
	ln := session.NewListener("127.0.0.1:0", srv,
		session.HandlerFunc(func(*transport.EncryptedSession, *session.HandshakeResult) {}), testLogger())
	if err := ln.Start(context.Background()); err != nil {
		t.Fatalf("Start: %v", err)
	}
	if ln.Addr() == "" {
		t.Error("Addr should report the bound address after Start")
	}
	if err := ln.Stop(context.Background()); err != nil {
		t.Errorf("Stop: %v", err)
	}
	// A second Stop is a no-op.
	if err := ln.Stop(context.Background()); err != nil {
		t.Errorf("second Stop: %v", err)
	}
}
