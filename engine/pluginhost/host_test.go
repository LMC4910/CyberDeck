package pluginhost

import (
	"bufio"
	"bytes"
	"io"
	"log"
	"os"
	"sync"
	"testing"
	"time"
)

// TestMain re-execs this test binary as a plugin when CYBERDECK_TESTPLUGIN is set,
// so the host can launch a real subprocess without a separate built binary.
func TestMain(m *testing.M) {
	if mode := os.Getenv("CYBERDECK_TESTPLUGIN"); mode != "" {
		testPluginMain(mode)
		return
	}
	os.Exit(m.Run())
}

// testPluginMain is the in-test plugin fixture. modes: normal | hang | crash.
func testPluginMain(mode string) {
	out := os.Stdout
	write := func(m Message) {
		if b, err := encodeMessage(m); err == nil {
			_, _ = out.Write(b)
		}
	}
	in := bufio.NewScanner(os.Stdin)
	in.Buffer(make([]byte, 0, 64*1024), 1<<20)

	if !in.Scan() { // wait for init
		return
	}
	write(Message{Type: MsgRegister, Register: &RegisterPayload{States: []string{"test.state"}}})
	write(Message{Type: MsgStateUpdate, State: &StatePayload{ID: "test.state", Value: 42.0}})
	write(Message{Type: MsgLog, Log: &LogPayload{Level: "info", Msg: "hello from plugin"}})

	if mode == "rogue" {
		// Publish a state the plugin never declared → host must reject + audit.
		write(Message{Type: MsgStateUpdate, State: &StatePayload{ID: "undeclared.secret", Value: 99.0}})
	}

	switch mode {
	case "crash":
		os.Exit(2)
	case "panic":
		panic("induced plugin panic") // genuine panic → process dies (P1-AC-13)
	case "hang":
		select {} // never heartbeat, never read → host must detect + kill
	}

	// normal: heartbeat until stdin closes.
	done := make(chan struct{})
	go func() {
		t := time.NewTicker(15 * time.Millisecond)
		defer t.Stop()
		for {
			select {
			case <-done:
				return
			case <-t.C:
				write(Message{Type: MsgHeartbeat})
			}
		}
	}()
	for in.Scan() {
	}
	close(done)
}

// syncBuf is a concurrency-safe buffer for capturing logger output.
type syncBuf struct {
	mu sync.Mutex
	b  bytes.Buffer
}

func (s *syncBuf) Write(p []byte) (int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.b.Write(p)
}
func (s *syncBuf) String() string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.b.String()
}

type recSetter struct {
	mu sync.Mutex
	m  map[string]any
}

func newRecSetter() *recSetter { return &recSetter{m: make(map[string]any)} }
func (s *recSetter) Set(id string, v any) error {
	s.mu.Lock()
	s.m[id] = v
	s.mu.Unlock()
	return nil
}
func (s *recSetter) get(id string) (any, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	v, ok := s.m[id]
	return v, ok
}

func spec(mode string) LaunchSpec {
	return LaunchSpec{Name: "test." + mode, Path: os.Args[0], Env: []string{"CYBERDECK_TESTPLUGIN=" + mode}, Stderr: io.Discard}
}

func eventually(t *testing.T, d time.Duration, cond func() bool, msg string) {
	t.Helper()
	deadline := time.Now().Add(d)
	for time.Now().Before(deadline) {
		if cond() {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatal(msg)
}

func TestLaunchInitRegisterStateUpdateLog(t *testing.T) {
	setter := newRecSetter()
	var logs syncBuf
	h := NewHost(
		WithStateSetter(setter),
		WithLogger(log.New(&logs, "", 0)),
		WithHeartbeatTimeout(150*time.Millisecond),
	)
	p, err := h.Launch(spec("normal"))
	if err != nil {
		t.Fatalf("Launch: %v", err)
	}
	defer func() { _ = p.Close() }()

	select {
	case rp := <-p.Registered():
		if len(rp.States) != 1 || rp.States[0] != "test.state" {
			t.Errorf("register payload = %+v", rp)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("plugin did not register")
	}

	eventually(t, 5*time.Second, func() bool {
		v, ok := setter.get("test.state")
		return ok && v == 42.0
	}, "stateUpdate not applied to the state setter")

	eventually(t, 5*time.Second, func() bool {
		return bytes.Contains([]byte(logs.String()), []byte("hello from plugin"))
	}, "plugin log not captured")

	if !p.Healthy() {
		t.Error("plugin reported unhealthy while heartbeating")
	}
}

func TestHeartbeatDetectsHung(t *testing.T) {
	h := NewHost(WithHeartbeatTimeout(100 * time.Millisecond))
	p, err := h.Launch(spec("hang"))
	if err != nil {
		t.Fatalf("Launch: %v", err)
	}
	defer func() { _ = p.Close() }()

	select {
	case <-p.Unhealthy():
		// detected
	case <-time.After(5 * time.Second):
		t.Fatal("host did not detect the hung plugin")
	}
}

func TestPluginCrashObservedEngineSurvives(t *testing.T) {
	h := NewHost(WithStateSetter(newRecSetter()), WithHeartbeatTimeout(200*time.Millisecond))
	p, err := h.Launch(spec("crash"))
	if err != nil {
		t.Fatalf("Launch: %v", err)
	}
	defer func() { _ = p.Close() }()

	select {
	case <-p.Exited():
	case <-time.After(5 * time.Second):
		t.Fatal("crashed plugin exit not observed")
	}
	if p.ExitErr() == nil {
		t.Error("expected non-nil exit error for a non-zero exit code")
	}
	// The host (this test process) is still running — a plugin crash did not take
	// down the engine.
}
