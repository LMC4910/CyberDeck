package main

import (
	"context"
	"encoding/json"
	"slices"
	"testing"
)

func recordingProvider() (*provider, *[]string) {
	var cmd []string
	p := newProvider(func(_ context.Context, name string, args ...string) error {
		cmd = append([]string{name}, args...)
		return nil
	})
	return p, &cmd
}

func TestLaunchAppOpensTarget(t *testing.T) {
	p, cmd := recordingProvider()
	if err := p.execute(context.Background(), actLaunchApp,
		json.RawMessage(`{"path":"notepad"}`)); err != nil {
		t.Fatalf("execute: %v", err)
	}
	if len(*cmd) == 0 || !slices.Contains(*cmd, "notepad") {
		t.Errorf("opener command = %v, want it to include the target", *cmd)
	}
}

func TestLaunchURLOpensTarget(t *testing.T) {
	p, cmd := recordingProvider()
	if err := p.execute(context.Background(), actLaunchURL,
		json.RawMessage(`{"url":"https://example.com"}`)); err != nil {
		t.Fatalf("execute: %v", err)
	}
	if !slices.Contains(*cmd, "https://example.com") {
		t.Errorf("opener command = %v, want it to include the URL", *cmd)
	}
}

func TestMissingTargetErrors(t *testing.T) {
	p, _ := recordingProvider()
	if err := p.execute(context.Background(), actLaunchApp, json.RawMessage(`{}`)); err == nil {
		t.Error("launch.app with no path should error")
	}
}
