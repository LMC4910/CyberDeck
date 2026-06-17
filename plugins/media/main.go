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
	stNowPlaying = "media.nowplaying"
	stPlaying    = "media.playing"
)

func main() {
	var c mediaControl // dry-run → no OS calls; otherwise the real per-OS controller
	if os.Getenv("CYBERDECK_MEDIA_DRYRUN") != "" {
		c = noopMedia{}
	} else {
		c = newMediaControl()
	}
	run(os.Stdin, os.Stdout, c)
}

// run executes the plugin lifecycle: register state + actions, publish now-playing
// on a cadence, and handle transport actions until stdin closes.
func run(in *os.File, out *os.File, c mediaControl) {
	defer func() { _ = c.Close() }() // kill the now-playing reader on host shutdown
	w := &msgWriter{w: out}

	sc := bufio.NewScanner(in)
	sc.Buffer(make([]byte, 0, 64*1024), 1<<20)
	if !sc.Scan() { // wait for host init
		return
	}

	w.write(ipcproto.Message{
		Type: ipcproto.MsgRegister,
		Register: &ipcproto.RegisterPayload{
			States:      []string{stNowPlaying, stPlaying},
			Contributes: contributes(),
		},
	})

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go publishLoop(w, c, ctx)

	for sc.Scan() {
		var m ipcproto.Message
		if err := json.Unmarshal(sc.Bytes(), &m); err != nil {
			continue
		}
		if m.Type == ipcproto.MsgInvokeAction && m.Action != nil {
			go handleAction(w, c, *m.Action)
		}
	}
}

func handleAction(w *msgWriter, c mediaControl, a ipcproto.ActionPayload) {
	err := execute(c, a.ActionID)
	res := ipcproto.ActionResultPayload{CallID: a.CallID, OK: err == nil}
	if err != nil {
		res.Error = err.Error()
	}
	w.write(ipcproto.Message{Type: ipcproto.MsgActionResult, ActionResult: &res})
	publish(w, c) // reflect the change quickly
}

// publishLoop publishes now-playing periodically (so reconnecting devices + the
// engine state pump always have fresh values) + a heartbeat.
func publishLoop(w *msgWriter, c mediaControl, ctx context.Context) {
	t := time.NewTicker(2 * time.Second)
	defer t.Stop()
	publish(w, c)
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			w.write(ipcproto.Message{Type: ipcproto.MsgHeartbeat})
			publish(w, c)
		}
	}
}

func publish(w *msgWriter, c mediaControl) {
	np, ok := c.NowPlaying()
	playing := ok && np["playing"] == true
	if ok {
		w.write(ipcproto.Message{Type: ipcproto.MsgStateUpdate,
			State: &ipcproto.StatePayload{ID: stNowPlaying, Value: np}})
	}
	// Always publish the playing flag so the visualizer freezes/unfreezes truthfully.
	w.write(ipcproto.Message{Type: ipcproto.MsgStateUpdate,
		State: &ipcproto.StatePayload{ID: stPlaying, Value: playing}})
}

func contributes() json.RawMessage {
	b, _ := json.Marshal(map[string]any{"actions": []registry.ActionDescriptor{
		{ID: actPlayPause, Label: "Play/Pause", Category: "media"},
		{ID: actNext, Label: "Next Track", Category: "media"},
		{ID: actPrevious, Label: "Previous Track", Category: "media"},
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
