package main

import (
	"bytes"
	"context"
	"strings"
	"testing"
)

func TestRunPrintsVersion(t *testing.T) {
	var buf bytes.Buffer
	if err := run(context.Background(), []string{"--version"}, &buf); err != nil {
		t.Fatalf("run --version: %v", err)
	}
	out := buf.String()
	if !strings.Contains(out, "CyberDeck engine") || !strings.Contains(out, version) {
		t.Errorf("version output = %q", out)
	}
}

// TestRunConsoleBootsAndShutsDown drives a full console run with a pre-cancelled
// context: it boots to READY then immediately shuts down (deterministic).
func TestRunConsoleBootsAndShutsDown(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel() // signal already delivered

	var buf bytes.Buffer
	if err := run(ctx, []string{"--console", "--config", "does-not-exist.json"}, &buf); err != nil {
		t.Fatalf("run --console: %v", err)
	}
	out := buf.String()
	for _, want := range []string{"console mode", "boot:", "READY", "shutdown signal received", "shutdown: complete"} {
		if !strings.Contains(out, want) {
			t.Errorf("output missing %q\n---\n%s", want, out)
		}
	}
}

func TestRunServiceModeSelected(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	var buf bytes.Buffer
	if err := run(ctx, []string{"--service", "--config", "none.json"}, &buf); err != nil {
		t.Fatalf("run --service: %v", err)
	}
	if !strings.Contains(buf.String(), "service mode") {
		t.Errorf("service mode not selected: %s", buf.String())
	}
}

func TestRunBadFlag(t *testing.T) {
	var buf bytes.Buffer
	if err := run(context.Background(), []string{"--nonexistent"}, &buf); err == nil {
		t.Error("unknown flag should return an error")
	}
}
