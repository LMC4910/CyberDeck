// Command volume is the first-party CyberDeck system-volume plugin (PROJ-174). It
// publishes system.volume (0–100) + system.muted and handles volume.set / volume.mute.
// State is authoritative + published so a slider reflects it end-to-end; the per-OS
// apply hook actually drives the OS volume where a clean CLI exists (Linux amixer,
// macOS osascript). On Windows it is stateful-only in V1 (real WASAPI control is a
// follow-up). Commands are mockable so tests never touch the real mixer.
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"runtime"
	"sync"

	"os/exec"
)

// Volume action IDs.
const (
	actVolumeSet  = "volume.set"
	actVolumeMute = "volume.mute"
)

// runner executes an OS command (injectable for tests).
type runner func(ctx context.Context, name string, args ...string) error

func execRunner(ctx context.Context, name string, args ...string) error {
	return exec.CommandContext(ctx, name, args...).Run()
}

// provider holds the authoritative volume/mute state and applies changes best-effort.
type provider struct {
	mu     sync.Mutex
	volume float64 // 0..100
	muted  bool
	run    runner
}

func newProvider(r runner) *provider {
	if r == nil {
		r = execRunner
	}
	return &provider{volume: 50, run: r}
}

// snapshot returns the current volume + mute (for publishing).
func (p *provider) snapshot() (float64, bool) {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.volume, p.muted
}

// execute applies a volume action, returning an error only for an unknown action
// (a failed OS apply is best-effort — the state still updates so the UI stays live).
func (p *provider) execute(ctx context.Context, actionID string, params json.RawMessage) error {
	switch actionID {
	case actVolumeSet:
		var a struct {
			Value float64 `json:"value"`
		}
		_ = json.Unmarshal(params, &a)
		p.set(ctx, a.Value)
	case actVolumeMute:
		p.toggleMute(ctx)
	default:
		return fmt.Errorf("volume: unknown action %q", actionID)
	}
	return nil
}

func (p *provider) set(ctx context.Context, v float64) {
	v = clamp(v, 0, 100)
	p.mu.Lock()
	p.volume = v
	p.mu.Unlock()
	if name, args, ok := setVolumeCommand(v); ok {
		_ = p.run(ctx, name, args...)
	}
}

func (p *provider) toggleMute(ctx context.Context) {
	p.mu.Lock()
	p.muted = !p.muted
	muted := p.muted
	p.mu.Unlock()
	if name, args, ok := setMuteCommand(muted); ok {
		_ = p.run(ctx, name, args...)
	}
}

func clamp(v, lo, hi float64) float64 {
	return min(max(v, lo), hi)
}

// setVolumeCommand returns the per-OS command to set master volume to v% (ok=false
// where there is no clean built-in CLI — Windows in V1).
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
