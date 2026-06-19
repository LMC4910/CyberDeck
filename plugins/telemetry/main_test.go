package main

import (
	"io"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/shishir/cyberdeck/engine/pluginhost"

	"github.com/shishir/cyberdeck/plugins/telemetry/providers"
)

// TestMain re-execs this test binary as the telemetry plugin when
// CYBERDECK_TELEMETRY_PLUGIN is set, so the host can launch it as a real
// subprocess (no separately built binary). Fast cadences exercise the pipeline
// quickly.
func TestMain(m *testing.M) {
	if os.Getenv("CYBERDECK_TELEMETRY_PLUGIN") != "" {
		fast := 20 * time.Millisecond
		run(os.Stdin, os.Stdout, providers.New(), providers.NewGPU(),
			Cadences{CPU: fast, RAM: fast, Net: fast, Disk: fast, Uptime: fast, GPU: fast, Process: fast},
			10*time.Millisecond)
		return
	}
	os.Exit(m.Run())
}

type recordingSetter struct {
	mu sync.Mutex
	m  map[string]any
}

func (s *recordingSetter) Set(id string, v any) error {
	s.mu.Lock()
	s.m[id] = v
	s.mu.Unlock()
	return nil
}

func (s *recordingSetter) get(id string) (any, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	v, ok := s.m[id]
	return v, ok
}

// TestPluginEndToEndViaHost launches the plugin as a real subprocess through the
// engine's plugin host and asserts a typed system.* state flows through the IPC
// boundary into the engine's state setter (P1-AC-04 pipeline; the IPC gate also
// proves the plugin only publishes states it declared).
func TestPluginEndToEndViaHost(t *testing.T) {
	setter := &recordingSetter{m: make(map[string]any)}
	h := pluginhost.NewHost(
		pluginhost.WithStateSetter(setter),
		pluginhost.WithHeartbeatTimeout(3*time.Second),
	)
	p, err := h.Launch(pluginhost.LaunchSpec{
		Name:   "telemetry",
		Path:   os.Args[0],
		Env:    []string{"CYBERDECK_TELEMETRY_PLUGIN=1"},
		Stderr: io.Discard,
	})
	if err != nil {
		t.Fatalf("Launch: %v", err)
	}
	defer func() { _ = p.Close() }()

	select {
	case rp := <-p.Registered():
		if len(rp.States) != len(systemStates()) {
			t.Errorf("registered states = %v, want %v", rp.States, systemStates())
		}
	case <-time.After(5 * time.Second):
		t.Fatal("plugin did not register")
	}

	// system.info is published once at startup as a map of host details; assert it
	// reaches the setter through the real subprocess→IPC→host→store path.
	if v, ok := waitForState(setter, stateSystemInfo, 5*time.Second); !ok {
		t.Fatalf("%s never reached the state setter", stateSystemInfo)
	} else if _, isMap := v.(map[string]any); !isMap {
		t.Fatalf("%s = %v (%T), want a map", stateSystemInfo, v, v)
	}

	// system.processes is published periodically as a list of {name,cpu} maps.
	if v, ok := waitForState(setter, stateProcesses, 5*time.Second); !ok {
		t.Fatalf("%s never reached the state setter", stateProcesses)
	} else if _, isList := v.([]any); !isList {
		t.Fatalf("%s = %v (%T), want a list", stateProcesses, v, v)
	}

	// system.uptime is reliable on any host; assert it reaches the state setter as
	// a positive number through the real subprocess→IPC→host→store path.
	if v, ok := waitForState(setter, stateUptime, 5*time.Second); !ok {
		t.Fatalf("%s never reached the state setter", stateUptime)
	} else if f, isNum := v.(float64); !isNum || f <= 0 {
		t.Fatalf("%s = %v (%T), want positive number", stateUptime, v, v)
	}
}

// TestComputeHealthScore proves the derived health score: a cool, idle machine
// scores 100; load/heat deduct; and with no readable metric at all it returns
// ok=false (so the ring shows "--" rather than a fabricated number).
func TestComputeHealthScore(t *testing.T) {
	// Idle + cool → perfect score.
	if got, ok := computeHealth(allAvailable(), allGPU(), nil); !ok || got != 100 {
		t.Errorf("idle health = (%v, %v), want (100, true)", got, ok)
	}

	// Hot + heavily loaded → deductions: cpu (95-75)*0.5=10, ram (95-80)*0.7=10.5,
	// gpu load (95-85)*0.3=3, gpu temp (90-78)*0.6=7.2 → 100-30.7 = 69.3 → 69.
	hot := allAvailable()
	hot.cpu, hot.ram = 95, 95
	hotGPU := allGPU()
	hotGPU.load, hotGPU.temp = 95, 90
	if got, ok := computeHealth(hot, hotGPU, nil); !ok || got != 69 {
		t.Errorf("loaded health = (%v, %v), want (69, true)", got, ok)
	}

	// No metric available at all → no real basis → ok=false.
	none := allAvailable()
	none.cpuOK, none.ramOK = false, false
	if _, ok := computeHealth(none, unavailableGPU{}, nil); ok {
		t.Error("health with no readable metric should be unavailable (ok=false)")
	}
}

// waitForState polls the setter until id appears or the timeout elapses.
func waitForState(s *recordingSetter, id string, timeout time.Duration) (any, bool) {
	deadline := time.Now().Add(timeout)
	for {
		if v, ok := s.get(id); ok {
			return v, true
		}
		if time.Now().After(deadline) {
			return nil, false
		}
		time.Sleep(20 * time.Millisecond)
	}
}
