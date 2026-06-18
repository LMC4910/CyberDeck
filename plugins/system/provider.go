// Command system is the first-party CyberDeck system-utilities plugin: it switches
// the Windows performance mode (power plan), runs maintenance utilities (empty
// recycle bin, clear temp cache), and owns the fan controls as persistent local
// state (software EC fan WRITE isn't portable, so the sliders move and stick while
// real RPM read via LibreHardwareMonitor is a follow-up). The OS controller is
// mockable so tests never touch the real system.
package main

import (
	"encoding/json"
	"fmt"
	"strings"
	"sync"
)

// Action IDs.
const (
	actPerfSilent      = "performance.setMode.silent"
	actPerfBalanced    = "performance.setMode.balanced"
	actPerfPerformance = "performance.setMode.performance"
	actPerfTurbo       = "performance.setMode.turbo"
	actClearCache      = "system.clearCache"
	actEmptyRecycleBin = "system.emptyRecycleBin"
	actFanSetCPU       = "fan.setSpeed.cpu"
	actFanSetCase1     = "fan.setSpeed.case1"
	actFanToggleAuto   = "fan.toggleAuto"

	// Game optimization toggles + profile selection are persistent local state
	// (no portable real backend for GPU overclock / network boost / per-game
	// profiles), reflected live so the UI flips and sticks.
	actGameOptPrefix     = "game.opt.toggle."
	actGameProfilePrefix = "game.profile.set."
)

// optKeyFor maps a toggle id (the action suffix) to its game.opt.<key> state suffix.
var optKeyFor = map[string]string{
	"perf":  "performance",
	"boost": "networkBoost",
	"gpu":   "gpuOverclock",
	"temp":  "tempControl",
}

// gameOptKeys / gameProfiles are the published state suffixes for each family.
var gameOptKeys = []string{"performance", "networkBoost", "gpuOverclock", "tempControl"}
var gameProfiles = []string{"competitive", "aaa", "streaming", "balanced"}

// Performance mode keys (also the suffix of performance.mode.<key> state ids).
const (
	modeSilent      = "silent"
	modeBalanced    = "balanced"
	modePerformance = "performance"
	modeTurbo       = "turbo"
)

var perfModes = []string{modeSilent, modeBalanced, modePerformance, modeTurbo}

// sysControl is the OS-specific surface (real on Windows; no-op elsewhere/tests).
type sysControl interface {
	SetPowerPlan(mode string) error  // mode ∈ perfModes
	ActivePlan() (string, bool)      // active mode key; ok=false if unknown
	EmptyRecycleBin() error
	ClearCache() error
}

// noopControl is the dry-run / unsupported controller.
type noopControl struct{}

func (noopControl) SetPowerPlan(string) error { return nil }
func (noopControl) ActivePlan() (string, bool) { return "", false }
func (noopControl) EmptyRecycleBin() error     { return nil }
func (noopControl) ClearCache() error          { return nil }

// provider applies actions and owns the fan local-state.
type provider struct {
	ctrl sysControl

	mu          sync.Mutex
	fanCPU      float64
	fanCase1    float64
	fanAuto     bool
	gameOpt     map[string]bool // game.opt.<key> → on/off
	gameProfile string          // active game.profile.<id>
}

func newProvider(c sysControl) *provider {
	if c == nil {
		c = noopControl{}
	}
	return &provider{
		ctrl:     c,
		fanCPU:   50,
		fanCase1: 50,
		fanAuto:  true,
		gameOpt: map[string]bool{
			"performance":  true,
			"networkBoost": false,
			"gpuOverclock": false,
			"tempControl":  true,
		},
		gameProfile: "balanced",
	}
}

// gameOptSnapshot returns a copy of the game-optimization toggle state.
func (p *provider) gameOptSnapshot() map[string]bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	out := make(map[string]bool, len(p.gameOpt))
	for k, v := range p.gameOpt {
		out[k] = v
	}
	return out
}

// activeProfile returns the active game profile id.
func (p *provider) activeProfile() string {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.gameProfile
}

// fanSnapshot returns the current fan local-state (for publishing).
func (p *provider) fanSnapshot() (cpu, case1 float64, auto bool) {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.fanCPU, p.fanCase1, p.fanAuto
}

// activeMode returns the active performance mode key, or "" if unknown.
func (p *provider) activeMode() string {
	if m, ok := p.ctrl.ActivePlan(); ok {
		return m
	}
	return ""
}

// execute applies an action, returning an error only for an unknown action or a
// failed real OS op (fan state always succeeds — it's authoritative local state).
func (p *provider) execute(actionID string, params json.RawMessage) error {
	switch actionID {
	case actPerfSilent:
		return p.ctrl.SetPowerPlan(modeSilent)
	case actPerfBalanced:
		return p.ctrl.SetPowerPlan(modeBalanced)
	case actPerfPerformance:
		return p.ctrl.SetPowerPlan(modePerformance)
	case actPerfTurbo:
		return p.ctrl.SetPowerPlan(modeTurbo)
	case actClearCache:
		return p.ctrl.ClearCache()
	case actEmptyRecycleBin:
		return p.ctrl.EmptyRecycleBin()
	case actFanSetCPU:
		p.setFan(&p.fanCPU, params)
	case actFanSetCase1:
		p.setFan(&p.fanCase1, params)
	case actFanToggleAuto:
		p.mu.Lock()
		p.fanAuto = !p.fanAuto
		p.mu.Unlock()
	default:
		// Game optimization toggles + profile selection (prefix-matched).
		switch {
		case strings.HasPrefix(actionID, actGameOptPrefix):
			key := optKeyFor[strings.TrimPrefix(actionID, actGameOptPrefix)]
			if key == "" {
				return fmt.Errorf("system: unknown game toggle %q", actionID)
			}
			p.mu.Lock()
			p.gameOpt[key] = !p.gameOpt[key]
			p.mu.Unlock()
		case strings.HasPrefix(actionID, actGameProfilePrefix):
			p.mu.Lock()
			p.gameProfile = strings.TrimPrefix(actionID, actGameProfilePrefix)
			p.mu.Unlock()
		default:
			return fmt.Errorf("system: unknown action %q", actionID)
		}
	}
	return nil
}

func (p *provider) setFan(field *float64, params json.RawMessage) {
	var a struct {
		Value float64 `json:"value"`
	}
	_ = json.Unmarshal(params, &a)
	v := a.Value
	if v < 0 {
		v = 0
	} else if v > 100 {
		v = 100
	}
	p.mu.Lock()
	*field = v
	p.mu.Unlock()
}
