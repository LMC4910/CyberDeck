package main

import (
	"bufio"
	"context"
	"encoding/json"
	"io"
	"os"
	"sync"
	"time"

	"github.com/shishir/cyberdeck/engine/pluginhost/ipcproto"
)

func main() {
	run(os.Stdin, os.Stdout, newProvider())
}

// run executes the plugin lifecycle: register the notification.count state, start
// the per-OS listener (which pushes count changes on add/clear), and publish the
// current count on a cadence (so reconnecting devices + the engine state pump always
// have a fresh value) until stdin closes. There are no actions: V1 is read-only.
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
			States:      []string{stCount},
			Contributes: contributes(),
		},
	})

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// The listener pushes a fresh absolute count whenever the action center changes
	// (add/clear). Publish immediately so a count change reaches the deck without
	// waiting for the next cadence tick. Where the OS restricts access, startListener
	// is a documented no-op and the cadence below keeps publishing 0.
	startListener(ctx, func(n int) {
		prov.setCount(n)
		publish(w, prov)
	})

	go publishLoop(w, prov, ctx)

	for sc.Scan() {
		// Read loop: V1 has no actions, but draining stdin keeps the watchdog fed and
		// lets us exit cleanly when the host closes the pipe.
		var m ipcproto.Message
		if err := json.Unmarshal(sc.Bytes(), &m); err != nil {
			continue
		}
	}
}

// publishLoop publishes the current count periodically + a heartbeat.
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

func publish(w *msgWriter, prov *provider) {
	w.write(ipcproto.Message{Type: ipcproto.MsgStateUpdate,
		State: &ipcproto.StatePayload{ID: stCount, Value: prov.snapshot()}})
}

// contributes declares no actions (V1 is count-only) but keeps the same shape the
// host expects so registration is uniform across plugins.
func contributes() json.RawMessage {
	b, _ := json.Marshal(map[string]any{"actions": []any{}})
	return b
}

// msgWriter serialises concurrent writes to stdout (listener callback + publish loop).
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
