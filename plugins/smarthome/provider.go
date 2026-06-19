// Command smarthome is the first-party CyberDeck smart-home plugin: it drives
// Home Assistant over REST when configured (CYBERDECK_HA_URL/TOKEN), and otherwise
// falls back to persistent in-memory local-state so the UI toggles flip and stick
// without a backend. Every action either flips a bound boolean (the *.toggle
// family) or fires a momentary scene (home.scene.*). When HA is wired the same
// action is mirrored to the mapped entity via the REST service API; HA being
// unreachable never crashes the plugin — it just keeps the last local-state.
package main

import (
	"encoding/json"
	"fmt"
	"strings"
	"sync"
)

// Published state ids (all booleans EXCEPT stEnergyNow which is a number and is
// published only when a real HA energy sensor value is available).
const (
	stRoomLiving   = "home.room.living"
	stRoomBedroom  = "home.room.bedroom"
	stRoomKitchen  = "home.room.kitchen"
	stRoomOffice   = "home.room.office"
	stRoomBathroom = "home.room.bathroom"
	stLightsCeil   = "home.lights.ceiling"
	stLightsFloor  = "home.lights.floor"
	stTV           = "home.tv"
	stSpeaker      = "home.speaker"
	stAC           = "home.ac"
	stCoffee       = "home.coffee"
	stAutoSunset   = "home.auto.sunset"
	stEnergyNow    = "home.energy.now"
)

// toggleSuffix is appended to a state id to form its action id.
const toggleSuffix = ".toggle"

// scenePrefix identifies the momentary scene actions.
const scenePrefix = "home.scene."

// toggleStateIDs are the boolean state ids that have a corresponding .toggle action.
var toggleStateIDs = []string{
	stRoomLiving, stRoomBedroom, stRoomKitchen, stRoomOffice, stRoomBathroom,
	stLightsCeil, stLightsFloor, stTV, stSpeaker, stAC, stCoffee, stAutoSunset,
}

// scenes are the known momentary scene keys (suffix of home.scene.<key>).
var scenes = []string{"goodnight", "movie", "party", "focus", "morning", "away"}

// provider applies actions and owns the smart-home local-state. When ha is non-nil
// actions are mirrored to Home Assistant; the local-state is always authoritative
// for publishing (refreshed best-effort from HA in the publish loop).
type provider struct {
	mu       sync.Mutex
	state    map[string]bool // state id → on/off
	energyW  float64         // last energy-now reading (watts)
	energyOK bool            // whether a real energy reading is available
	ha       *haClient       // optional HA client (nil → pure local-state)
}

// newProvider builds a provider with sensible defaults. ha may be nil.
func newProvider(ha *haClient) *provider {
	return &provider{
		ha: ha,
		state: map[string]bool{
			// Some rooms on, others off.
			stRoomLiving:   true,
			stRoomBedroom:  false,
			stRoomKitchen:  true,
			stRoomOffice:   false,
			stRoomBathroom: false,
			// Lights / devices.
			stLightsCeil:  false,
			stLightsFloor: true,
			stTV:          false,
			stSpeaker:     true,
			stAC:          false,
			stCoffee:      false,
			stAutoSunset:  true,
		},
	}
}

// snapshot returns a copy of the boolean state plus the latest energy reading.
func (p *provider) snapshot() (map[string]bool, float64, bool) {
	p.mu.Lock()
	defer p.mu.Unlock()
	out := make(map[string]bool, len(p.state))
	for k, v := range p.state {
		out[k] = v
	}
	return out, p.energyW, p.energyOK
}

// execute applies an action. The .toggle family flips a bound boolean (and mirrors
// to HA when wired); home.scene.* fires a momentary scene; anything else errors.
func (p *provider) execute(actionID string, _ json.RawMessage) error {
	switch {
	case strings.HasSuffix(actionID, toggleSuffix):
		id := strings.TrimSuffix(actionID, toggleSuffix)
		p.mu.Lock()
		_, known := p.state[id]
		if !known {
			p.mu.Unlock()
			return fmt.Errorf("unknown action %q", actionID)
		}
		p.state[id] = !p.state[id]
		on := p.state[id]
		p.mu.Unlock()
		if p.ha != nil {
			if domain, entity, ok := p.ha.domainEntityFor(id); ok {
				service := "turn_off"
				if on {
					service = "turn_on"
				}
				if err := p.ha.callService(domain, service, entity); err != nil {
					return err
				}
			}
		}
		return nil

	case strings.HasPrefix(actionID, scenePrefix):
		key := strings.TrimPrefix(actionID, scenePrefix)
		if !validScene(key) {
			return fmt.Errorf("unknown action %q", actionID)
		}
		// Momentary: no local state change.
		if p.ha != nil {
			if entity, ok := p.ha.entityFor(actionID); ok {
				if err := p.ha.callService("scene", "turn_on", entity); err != nil {
					return err
				}
			}
		}
		return nil

	default:
		return fmt.Errorf("unknown action %q", actionID)
	}
}

// validScene reports whether key is a known scene.
func validScene(key string) bool {
	for _, s := range scenes {
		if s == key {
			return true
		}
	}
	return false
}
