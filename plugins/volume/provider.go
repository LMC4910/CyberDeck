// Command volume is the first-party CyberDeck system-volume plugin (PROJ-174). It
// publishes system.volume (0–100) + system.muted and handles volume.set / volume.mute.
// State is authoritative + published so a slider reflects it end-to-end; an injected
// per-OS [osVolume] controller drives the real OS volume (Windows WASAPI; Linux
// amixer; macOS osascript) and reads it back so the slider mirrors external changes.
// The controller is mockable so tests never touch the real mixer.
package main

import (
	"encoding/json"
	"fmt"
	"sync"
)

// Volume action IDs.
const (
	actVolumeSet    = "volume.set"
	actVolumeMute   = "volume.mute"
	actAppVolumeSet = "volume.app.set"
)

// appChannels are the per-application mixer channels the page exposes; each is
// published as media.volume.<channel> and applied to the matching app's audio
// session (Windows WASAPI).
var appChannels = []string{"spotify", "browser", "discord"}

// osVolume drives and reads the OS master volume + per-app session volume.
// Injectable so tests use a fake and each platform supplies its real controller.
type osVolume interface {
	SetVolume(v float64) error               // master; v in 0..100 (best-effort)
	SetMute(muted bool) error                // best-effort
	Get() (vol float64, muted bool, ok bool) // real read-back; ok=false where unsupported
	SetAppVolume(channel string, v float64) error // per-app session volume (best-effort)
	Close() error                            // release any helper resources
}

// noopVolume is the dry-run / unsupported controller: state-only, no OS calls.
type noopVolume struct{}

func (noopVolume) SetVolume(float64) error            { return nil }
func (noopVolume) SetMute(bool) error                 { return nil }
func (noopVolume) Get() (float64, bool, bool)         { return 0, false, false }
func (noopVolume) SetAppVolume(string, float64) error { return nil }
func (noopVolume) Close() error                       { return nil }

// provider holds the authoritative volume/mute + per-app state and applies changes
// best-effort.
type provider struct {
	mu     sync.Mutex
	volume float64 // 0..100
	muted  bool
	appVol map[string]float64 // per-app channel → 0..100
	ctrl   osVolume
}

func newProvider(c osVolume) *provider {
	if c == nil {
		c = noopVolume{}
	}
	app := make(map[string]float64, len(appChannels))
	for _, ch := range appChannels {
		app[ch] = 50
	}
	return &provider{volume: 50, appVol: app, ctrl: c}
}

// close releases the controller's helper resources (e.g. the app-volume subprocess).
func (p *provider) close() error { return p.ctrl.Close() }

// appSnapshot returns a copy of the per-app channel levels (for publishing).
func (p *provider) appSnapshot() map[string]float64 {
	p.mu.Lock()
	defer p.mu.Unlock()
	out := make(map[string]float64, len(p.appVol))
	for k, v := range p.appVol {
		out[k] = v
	}
	return out
}

// snapshot returns the current volume + mute (for publishing).
func (p *provider) snapshot() (float64, bool) {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.volume, p.muted
}

// syncFromOS refreshes the authoritative state from the real OS volume so the
// slider mirrors changes made by other apps. No-op where Get() is unsupported.
func (p *provider) syncFromOS() {
	v, muted, ok := p.ctrl.Get()
	if !ok {
		return
	}
	p.mu.Lock()
	p.volume = clamp(v, 0, 100)
	p.muted = muted
	p.mu.Unlock()
}

// execute applies a volume action, returning an error only for an unknown action
// (a failed OS apply is best-effort — the state still updates so the UI stays live).
func (p *provider) execute(actionID string, params json.RawMessage) error {
	switch actionID {
	case actVolumeSet:
		var a struct {
			Value float64 `json:"value"`
		}
		_ = json.Unmarshal(params, &a)
		p.set(a.Value)
	case actVolumeMute:
		p.toggleMute()
	case actAppVolumeSet:
		var a struct {
			Value  float64 `json:"value"`
			Target string  `json:"target"` // the app channel (spotify/browser/discord)
		}
		_ = json.Unmarshal(params, &a)
		p.setApp(a.Target, a.Value)
	default:
		return fmt.Errorf("volume: unknown action %q", actionID)
	}
	return nil
}

func (p *provider) setApp(channel string, v float64) {
	if channel == "" {
		return
	}
	v = clamp(v, 0, 100)
	p.mu.Lock()
	p.appVol[channel] = v
	p.mu.Unlock()
	_ = p.ctrl.SetAppVolume(channel, v) // best-effort
}

func (p *provider) set(v float64) {
	v = clamp(v, 0, 100)
	p.mu.Lock()
	p.volume = v
	p.mu.Unlock()
	_ = p.ctrl.SetVolume(v) // best-effort
}

func (p *provider) toggleMute() {
	p.mu.Lock()
	p.muted = !p.muted
	muted := p.muted
	p.mu.Unlock()
	_ = p.ctrl.SetMute(muted) // best-effort
}

func clamp(v, lo, hi float64) float64 {
	return min(max(v, lo), hi)
}
