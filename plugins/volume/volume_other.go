//go:build !windows

// Non-Windows volume controller: drives the OS mixer through the clean per-OS CLI
// (Linux amixer, macOS osascript). There is no portable read-back here, so Get()
// reports unsupported and the in-memory state stays authoritative.
package main

import (
	"fmt"
	"os/exec"
	"runtime"
)

type cliVolume struct{}

// newOSVolume returns the real controller for the current (non-Windows) platform.
func newOSVolume() osVolume { return cliVolume{} }

func (cliVolume) SetVolume(v float64) error {
	name, args, ok := setVolumeCommand(v)
	if !ok {
		return nil
	}
	return exec.Command(name, args...).Run()
}

func (cliVolume) SetMute(muted bool) error {
	name, args, ok := setMuteCommand(muted)
	if !ok {
		return nil
	}
	return exec.Command(name, args...).Run()
}

// Get reports unsupported — no clean cross-distro read-back CLI.
func (cliVolume) Get() (float64, bool, bool) { return 0, false, false }

// SetAppVolume is a no-op here (no portable per-app session control); the slider
// still persists its value via the published state.
func (cliVolume) SetAppVolume(string, float64) error { return nil }

func (cliVolume) Close() error { return nil }

// setVolumeCommand returns the per-OS command to set master volume to v%
// (ok=false where there is no clean built-in CLI).
func setVolumeCommand(v float64) (name string, args []string, ok bool) {
	switch runtime.GOOS {
	case "linux":
		return "amixer", []string{"-q", "sset", "Master", fmt.Sprintf("%d%%", int(v))}, true
	case "darwin":
		return "osascript", []string{"-e", fmt.Sprintf("set volume output volume %d", int(v))}, true
	default:
		return "", nil, false
	}
}

func setMuteCommand(muted bool) (name string, args []string, ok bool) {
	switch runtime.GOOS {
	case "linux":
		state := "unmute"
		if muted {
			state = "mute"
		}
		return "amixer", []string{"-q", "sset", "Master", state}, true
	case "darwin":
		return "osascript", []string{"-e", fmt.Sprintf("set volume output muted %t", muted)}, true
	default:
		return "", nil, false
	}
}
