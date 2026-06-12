//go:build linux

package service

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

// New returns the systemd-backed manager.
func New(def Definition, run RunFunc) (Manager, error) {
	return &systemdManager{def: def.withDefaults(), run: run}, nil
}

type systemdManager struct {
	def Definition
	run RunFunc
}

// unitPath is the system-wide systemd unit location for the rendered service.
func (m *systemdManager) unitPath() string {
	return filepath.Join("/etc/systemd/system", systemdUnitName(m.def.Name))
}

// Install writes the systemd unit, reloads the daemon, then enables + starts it so
// the engine stays up (Restart=on-failure) and starts at boot.
func (m *systemdManager) Install() error {
	if err := os.WriteFile(m.unitPath(), []byte(renderSystemdUnit(m.def)), 0o644); err != nil {
		return fmt.Errorf("service: write unit: %w", err)
	}
	if out, err := exec.Command("systemctl", "daemon-reload").CombinedOutput(); err != nil {
		return fmt.Errorf("service: systemctl daemon-reload: %w: %s", err, out)
	}
	if out, err := exec.Command("systemctl", "enable", "--now", systemdUnitName(m.def.Name)).CombinedOutput(); err != nil {
		return fmt.Errorf("service: systemctl enable --now: %w: %s", err, out)
	}
	return nil
}

// Uninstall stops + disables the unit and removes the unit file.
func (m *systemdManager) Uninstall() error {
	unit := systemdUnitName(m.def.Name)
	_, _ = exec.Command("systemctl", "disable", "--now", unit).CombinedOutput()
	if err := os.Remove(m.unitPath()); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("service: remove unit: %w", err)
	}
	_, _ = exec.Command("systemctl", "daemon-reload").CombinedOutput()
	return nil
}

// Run executes the engine directly: systemd runs the process itself and sends
// SIGTERM to stop it (handled by the engine's signal handling), so the stop
// channel here is never closed.
func (m *systemdManager) Run() error {
	return m.run(make(chan struct{}))
}
