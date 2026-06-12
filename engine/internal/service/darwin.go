//go:build darwin

package service

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

// New returns the launchd-backed manager.
func New(def Definition, run RunFunc) (Manager, error) {
	return &launchdManager{def: def.withDefaults(), run: run}, nil
}

type launchdManager struct {
	def Definition
	run RunFunc
}

// plistPath is the per-user LaunchAgent location for the rendered plist.
func (m *launchdManager) plistPath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("service: resolve home dir: %w", err)
	}
	return filepath.Join(home, "Library", "LaunchAgents", launchdLabel(m.def.Name)+".plist"), nil
}

// Install writes the LaunchAgent plist and loads it so launchd keeps the engine
// running (RunAtLoad + KeepAlive) independent of the UI.
func (m *launchdManager) Install() error {
	p, err := m.plistPath()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
		return fmt.Errorf("service: create LaunchAgents dir: %w", err)
	}
	if err := os.WriteFile(p, []byte(renderLaunchdPlist(m.def)), 0o644); err != nil {
		return fmt.Errorf("service: write plist: %w", err)
	}
	if out, err := exec.Command("launchctl", "load", p).CombinedOutput(); err != nil {
		return fmt.Errorf("service: launchctl load: %w: %s", err, out)
	}
	return nil
}

// Uninstall unloads the LaunchAgent and removes its plist.
func (m *launchdManager) Uninstall() error {
	p, err := m.plistPath()
	if err != nil {
		return err
	}
	// Unload first (ignore error if it was never loaded), then remove the file.
	_, _ = exec.Command("launchctl", "unload", p).CombinedOutput()
	if err := os.Remove(p); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("service: remove plist: %w", err)
	}
	return nil
}

// Run executes the engine directly: launchd runs the process itself and sends
// SIGTERM to stop it, which the engine's signal handling already turns into a
// graceful shutdown, so the stop channel here is never closed.
func (m *launchdManager) Run() error {
	return m.run(make(chan struct{}))
}
