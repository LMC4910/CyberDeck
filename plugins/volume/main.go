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

const (
	stVolume = "system.volume"
	stMuted  = "system.muted"
)

// appStateID is the published state id for a per-app channel (e.g. media.volume.spotify).
func appStateID(channel string) string { return "media.volume." + channel }

func main() {
	var c osVolume // dry-run → no OS calls; otherwise the real per-OS controller
	if os.Getenv("CYBERDECK_VOLUME_DRYRUN") != "" {
		c = noopVolume{}
	} else {
		c = newOSVolume()
	}
	run(os.Stdin, os.Stdout, newProvider(c))
}

// run executes the plugin lifecycle: register states + actions, publish the current
// volume/mute on a cadence, and handle volume actions until stdin closes.
func run(in *os.File, out *os.File, prov *provider) {
	defer func() { _ = prov.close() }() // release the app-volume helper on shutdown
	w := &msgWriter{w: out}

	sc := bufio.NewScanner(in)
	sc.Buffer(make([]byte, 0, 64*1024), 1<<20)
	if !sc.Scan() { // wait for host init
		return
	}

	states := []string{stVolume, stMuted}
	for _, ch := range appChannels {
		states = append(states, appStateID(ch))
	}
	w.write(ipcproto.Message{
		Type: ipcproto.MsgRegister,
		Register: &ipcproto.RegisterPayload{
			States:      states,
			Contributes: contributes(),
		},
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

// publishLoop refreshes state from the real OS volume then publishes the current
// volume/mute periodically (so reconnecting devices and the engine state pump always
// have fresh values, and the slider tracks changes made by other apps) + a heartbeat.
func publishLoop(w *msgWriter, prov *provider, ctx context.Context) {
	t := time.NewTicker(time.Second)
	defer t.Stop()
	prov.syncFromOS()
	publish(w, prov)
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			prov.syncFromOS()
			w.write(ipcproto.Message{Type: ipcproto.MsgHeartbeat})
			publish(w, prov)
		}
	}
}

func publish(w *msgWriter, prov *provider) {
	vol, muted := prov.snapshot()
	w.write(ipcproto.Message{Type: ipcproto.MsgStateUpdate,
		State: &ipcproto.StatePayload{ID: stVolume, Value: vol}})
	w.write(ipcproto.Message{Type: ipcproto.MsgStateUpdate,
		State: &ipcproto.StatePayload{ID: stMuted, Value: muted}})
	for ch, v := range prov.appSnapshot() {
		w.write(ipcproto.Message{Type: ipcproto.MsgStateUpdate,
			State: &ipcproto.StatePayload{ID: appStateID(ch), Value: v}})
	}
}

func contributes() json.RawMessage {
	b, _ := json.Marshal(map[string]any{"actions": []registry.ActionDescriptor{
		{ID: actVolumeSet, Label: "Set Volume", Category: "volume",
			Params: []registry.Param{{Name: "value", Type: registry.ParamInt}}},
		{ID: actVolumeMute, Label: "Toggle Mute", Category: "volume"},
		{ID: actAppVolumeSet, Label: "Set App Volume", Category: "volume",
			Params: []registry.Param{{Name: "value", Type: registry.ParamInt}}},
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
