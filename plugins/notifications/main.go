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

func main() {
	run(os.Stdin, os.Stdout, newProvider())
}

// run executes the plugin lifecycle: register the notification.count + notification.feed
// states, start the per-OS listener (which pushes the FULL feed on change), and publish
// the current count + filtered feed on a cadence (so reconnecting devices + the engine
// state pump always have a fresh value) until stdin closes. Incoming MsgInvokeAction
// messages drive the filters / mark-all-read / history actions.
func run(in *os.File, out *os.File, prov *provider) {
	w := &msgWriter{w: out}

	sc := bufio.NewScanner(in)
	sc.Buffer(make([]byte, 0, 64*1024), 1<<20)
	if !sc.Scan() { // wait for host init
		return
	}

	w.write(ipcproto.Message{
		Type: ipcproto.MsgRegister,
		Register: &ipcproto.RegisterPayload{
			States:      []string{stCount, stFeed},
			Contributes: contributes(),
		},
	})

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// The listener pushes the FULL set of action-center rows whenever it changes.
	// Publish immediately so a change reaches the deck without waiting for the next
	// cadence tick. Where the OS restricts access, startListener is a documented
	// no-op and the cadence below keeps publishing an empty feed + count 0.
	startListener(ctx, func(items []map[string]any) {
		prov.setFeed(items)
		publish(w, prov)
	})

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

// handleAction runs one action, replies with its result, then re-publishes so the
// new count/feed view reaches the deck immediately (mirror plugins/system).
func handleAction(w *msgWriter, prov *provider, a ipcproto.ActionPayload) {
	err := prov.execute(a.ActionID)
	res := ipcproto.ActionResultPayload{CallID: a.CallID, OK: err == nil}
	if err != nil {
		res.Error = err.Error()
	}
	w.write(ipcproto.Message{Type: ipcproto.MsgActionResult, ActionResult: &res})
	publish(w, prov)
}

// publishLoop publishes the current count + feed periodically + a heartbeat.
func publishLoop(w *msgWriter, prov *provider, ctx context.Context) {
	t := time.NewTicker(time.Second)
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

// publish emits both states: the total unread count and the filtered feed view.
func publish(w *msgWriter, prov *provider) {
	w.write(ipcproto.Message{Type: ipcproto.MsgStateUpdate,
		State: &ipcproto.StatePayload{ID: stCount, Value: prov.snapshotCount()}})
	w.write(ipcproto.Message{Type: ipcproto.MsgStateUpdate,
		State: &ipcproto.StatePayload{ID: stFeed, Value: prov.snapshotView()}})
}

// contributes declares the six notification actions (Category "notification") in the
// same shape the host expects, so registration is uniform across plugins.
func contributes() json.RawMessage {
	b, _ := json.Marshal(map[string]any{"actions": []registry.ActionDescriptor{
		{ID: actMarkAllRead, Label: "Mark All Read", Category: "notification"},
		{ID: actFilterAll, Label: "All Notifications", Category: "notification"},
		{ID: actFilterApps, Label: "App Notifications", Category: "notification"},
		{ID: actFilterSystem, Label: "System Notifications", Category: "notification"},
		{ID: actFilterAlerts, Label: "Alerts", Category: "notification"},
		{ID: actHistory, Label: "History", Category: "notification"},
	}})
	return b
}

// msgWriter serialises concurrent writes to stdout (listener callback + publish loop +
// action handlers).
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
