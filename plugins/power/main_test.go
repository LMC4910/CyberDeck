package main

import (
	"context"
	"encoding/json"
	"io"
	"os"
	"testing"
	"time"

	"github.com/shishir/cyberdeck/engine/core/registry"
	"github.com/shishir/cyberdeck/engine/pluginhost"
)

// TestMain re-execs this test binary as the power plugin (dry-run: no real power
// commands) when CYBERDECK_POWER_PLUGIN is set, so the host can launch it as a real
// subprocess.
func TestMain(m *testing.M) {
	if os.Getenv("CYBERDECK_POWER_PLUGIN") != "" {
		run(os.Stdin, os.Stdout, newProvider(func(context.Context, string, ...string) error { return nil }))
		return
	}
	os.Exit(m.Run())
}

func TestDispatchViaHost(t *testing.T) {
	h := pluginhost.NewHost(pluginhost.WithHeartbeatTimeout(3 * time.Second))
	p, err := h.Launch(pluginhost.LaunchSpec{
		Name:   "power",
		Path:   os.Args[0],
		Env:    []string{"CYBERDECK_POWER_PLUGIN=1"},
		Stderr: io.Discard,
	})
	if err != nil {
		t.Fatalf("Launch: %v", err)
	}
	defer func() { _ = p.Close() }()

	// Registered with the six actions + correct destructive flags.
	select {
	case rp := <-p.Registered():
		var c struct {
			Actions []registry.ActionDescriptor `json:"actions"`
		}
		if err := json.Unmarshal(rp.Contributes, &c); err != nil {
			t.Fatalf("contributes: %v", err)
		}
		if len(c.Actions) != len(allActions) {
			t.Fatalf("registered %d actions, want %d", len(c.Actions), len(allActions))
		}
		byID := map[string]registry.ActionDescriptor{}
		for _, a := range c.Actions {
			byID[a.ID] = a
		}
		if !byID[actShutdown].Destructive {
			t.Error("shutdown should be flagged destructive (2-tap, P1-AC-06)")
		}
		if byID[actLock].Destructive {
			t.Error("lock should not be destructive")
		}
	case <-time.After(5 * time.Second):
		t.Fatal("plugin did not register")
	}

	ctx := context.Background()

	// A supported action dispatches and succeeds (dry-run).
	res, err := p.Invoke(ctx, actLock, nil)
	if err != nil {
		t.Fatalf("invoke lock: %v", err)
	}
	if !res.OK {
		t.Errorf("lock result not ok: %s", res.Error)
	}

	// A destructive action also dispatches (dry-run — does not power off CI).
	if r, _ := p.Invoke(ctx, actShutdown, nil); !r.OK {
		t.Errorf("shutdown (dry-run) result not ok: %s", r.Error)
	}

	// An unsupported action returns a failed result, not a hang/crash.
	if r, _ := p.Invoke(ctx, "system.bogus", nil); r.OK {
		t.Error("an unsupported action should report failure")
	}
}
