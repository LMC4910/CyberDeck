package main

import (
	"bufio"
	"context"
	"encoding/json"
	"io"
	"os"
	"strconv"
	"sync"
	"time"

	"github.com/shishir/cyberdeck/engine/core/registry"
	"github.com/shishir/cyberdeck/engine/pluginhost/ipcproto"
)

func main() {
	var ha *haClient // dry-run → no real HA ops (pure local-state)
	if os.Getenv("CYBERDECK_SMARTHOME_DRYRUN") == "" {
		ha = newHAClientFromEnv()
	}
	run(os.Stdin, os.Stdout, newProvider(ha))
}

func run(in *os.File, out *os.File, prov *provider) {
	w := &msgWriter{w: out}

	sc := bufio.NewScanner(in)
	sc.Buffer(make([]byte, 0, 64*1024), 1<<20)
	if !sc.Scan() { // wait for host init
		return
	}

	// Register every boolean state + the energy reading.
	states := append([]string{}, toggleStateIDs...)
	states = append(states, stEnergyNow)
	w.write(ipcproto.Message{
		Type:     ipcproto.MsgRegister,
		Register: &ipcproto.RegisterPayload{States: states, Contributes: contributes()},
	})

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go publishLoop(w, prov, ctx)

	for sc.Scan() {
		var m ipcproto.Message
		if err := json.Unmarshal(sc.Bytes(), &m); err != nil {
			continue
		}
		if m.Type == ipcproto.MsgInvokeAction && m.Action != nil {
			go handleAction(w, prov, *m.Action)
		}
	}
}

func handleAction(w *msgWriter, prov *provider, a ipcproto.ActionPayload) {
	err := prov.execute(a.ActionID, a.Params)
	res := ipcproto.ActionResultPayload{CallID: a.CallID, OK: err == nil}
	if err != nil {
		res.Error = err.Error()
	}
	w.write(ipcproto.Message{Type: ipcproto.MsgActionResult, ActionResult: &res})
	publish(w, prov) // reflect the change immediately
}

func publishLoop(w *msgWriter, prov *provider, ctx context.Context) {
	t := time.NewTicker(2 * time.Second)
	defer t.Stop()
	publish(w, prov)
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			w.write(ipcproto.Message{Type: ipcproto.MsgHeartbeat})
			publish(w, prov)
		}
	}
}

func publish(w *msgWriter, prov *provider) {
	prov.refreshFromHA() // best-effort; no-op when HA is not wired
	state, energyW, energyOK := prov.snapshot()
	for _, id := range toggleStateIDs {
		w.write(ipcproto.Message{Type: ipcproto.MsgStateUpdate,
			State: &ipcproto.StatePayload{ID: id, Value: state[id]}})
	}
	// Energy is published only when a real HA sensor value is available.
	if energyOK {
		w.write(ipcproto.Message{Type: ipcproto.MsgStateUpdate,
			State: &ipcproto.StatePayload{ID: stEnergyNow, Value: energyW}})
	}
}

// refreshFromHA pulls current entity states from Home Assistant (best-effort) and
// updates the bound booleans + energy reading. On any error it keeps current state.
func (p *provider) refreshFromHA() {
	if p.ha == nil {
		return
	}
	states, err := p.ha.states()
	if err != nil {
		return // keep current local-state
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	for _, id := range toggleStateIDs {
		entity, ok := p.ha.entityFor(id)
		if !ok {
			continue
		}
		if v, present := states[entity]; present {
			p.state[id] = (toStr(v) == "on")
		}
	}
	if entity, ok := p.ha.entityFor(stEnergyNow); ok {
		if v, present := states[entity]; present {
			if f, perr := strconv.ParseFloat(toStr(v), 64); perr == nil {
				p.energyW = f
				p.energyOK = true
			}
		}
	}
}

// toStr coerces an HA state value to its string form.
func toStr(v any) string {
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}

func contributes() json.RawMessage {
	b, _ := json.Marshal(map[string]any{"actions": []registry.ActionDescriptor{
		{ID: stRoomLiving + toggleSuffix, Label: "Living Room", Category: "home"},
		{ID: stRoomBedroom + toggleSuffix, Label: "Bedroom", Category: "home"},
		{ID: stRoomKitchen + toggleSuffix, Label: "Kitchen", Category: "home"},
		{ID: stRoomOffice + toggleSuffix, Label: "Office", Category: "home"},
		{ID: stRoomBathroom + toggleSuffix, Label: "Bathroom", Category: "home"},
		{ID: stLightsCeil + toggleSuffix, Label: "Ceiling Lights", Category: "home"},
		{ID: stLightsFloor + toggleSuffix, Label: "Floor Lamp", Category: "home"},
		{ID: stTV + toggleSuffix, Label: "TV", Category: "home"},
		{ID: stSpeaker + toggleSuffix, Label: "Speaker", Category: "home"},
		{ID: stAC + toggleSuffix, Label: "Air Conditioner", Category: "home"},
		{ID: stCoffee + toggleSuffix, Label: "Coffee Maker", Category: "home"},
		{ID: stAutoSunset + toggleSuffix, Label: "Sunset Automation", Category: "home"},
		{ID: scenePrefix + "goodnight", Label: "Goodnight Scene", Category: "home"},
		{ID: scenePrefix + "movie", Label: "Movie Scene", Category: "home"},
		{ID: scenePrefix + "party", Label: "Party Scene", Category: "home"},
		{ID: scenePrefix + "focus", Label: "Focus Scene", Category: "home"},
		{ID: scenePrefix + "morning", Label: "Morning Scene", Category: "home"},
		{ID: scenePrefix + "away", Label: "Away Scene", Category: "home"},
	}})
	return b
}

// msgWriter serialises concurrent writes to stdout.
type msgWriter struct {
	mu sync.Mutex
	w  io.Writer
}

func (mw *msgWriter) write(m ipcproto.Message) {
	b, err := ipcproto.Encode(m)
	if err != nil {
		return
	}
	mw.mu.Lock()
	_, _ = mw.w.Write(b)
	mw.mu.Unlock()
}
