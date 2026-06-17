package main

import (
	"bufio"
	"context"
	"encoding/json"
	"io"
	"os"
	"sync"
	"time"

	"github.com/shishir/cyberdeck/engine/core/registry"
	"github.com/shishir/cyberdeck/engine/pluginhost/ipcproto"
)

// Published state ids.
const (
	stFanCPU   = "fan.cpu.percent"
	stFanCase1 = "fan.case1.percent"
	stFanAuto  = "fan.auto"
)

// perfModeState returns the state id reflecting whether mode is active.
func perfModeState(mode string) string { return "performance.mode." + mode }

func main() {
	var c sysControl // dry-run → no real OS ops; otherwise the per-OS controller
	if os.Getenv("CYBERDECK_SYSTEM_DRYRUN") != "" {
		c = noopControl{}
	} else {
		c = newSysControl()
	}
	run(os.Stdin, os.Stdout, newProvider(c))
}

func run(in *os.File, out *os.File, prov *provider) {
	w := &msgWriter{w: out}

	sc := bufio.NewScanner(in)
	sc.Buffer(make([]byte, 0, 64*1024), 1<<20)
	if !sc.Scan() { // wait for host init
		return
	}

	states := []string{stFanCPU, stFanCase1, stFanAuto}
	for _, m := range perfModes {
		states = append(states, perfModeState(m))
	}
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
	cpu, case1, auto := prov.fanSnapshot()
	w.write(ipcproto.Message{Type: ipcproto.MsgStateUpdate,
		State: &ipcproto.StatePayload{ID: stFanCPU, Value: cpu}})
	w.write(ipcproto.Message{Type: ipcproto.MsgStateUpdate,
		State: &ipcproto.StatePayload{ID: stFanCase1, Value: case1}})
	w.write(ipcproto.Message{Type: ipcproto.MsgStateUpdate,
		State: &ipcproto.StatePayload{ID: stFanAuto, Value: auto}})

	// Reflect the active performance mode (only when the OS reports one).
	if active := prov.activeMode(); active != "" {
		for _, m := range perfModes {
			w.write(ipcproto.Message{Type: ipcproto.MsgStateUpdate,
				State: &ipcproto.StatePayload{ID: perfModeState(m), Value: m == active}})
		}
	}
}

func contributes() json.RawMessage {
	b, _ := json.Marshal(map[string]any{"actions": []registry.ActionDescriptor{
		{ID: actPerfSilent, Label: "Silent Mode", Category: "performance"},
		{ID: actPerfBalanced, Label: "Balanced Mode", Category: "performance"},
		{ID: actPerfPerformance, Label: "Performance Mode", Category: "performance"},
		{ID: actPerfTurbo, Label: "Turbo Mode", Category: "performance"},
		{ID: actClearCache, Label: "Clear Cache", Category: "system"},
		{ID: actEmptyRecycleBin, Label: "Empty Recycle Bin", Category: "system"},
		{ID: actFanSetCPU, Label: "CPU Fan Speed", Category: "fan", Params: []registry.Param{{Name: "value", Type: registry.ParamInt}}},
		{ID: actFanSetCase1, Label: "Case Fan Speed", Category: "fan", Params: []registry.Param{{Name: "value", Type: registry.ParamInt}}},
		{ID: actFanToggleAuto, Label: "Auto Fan Control", Category: "fan"},
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
