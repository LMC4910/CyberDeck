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
	var r runner // nil → real execRunner
	if os.Getenv("CYBERDECK_LAUNCH_DRYRUN") != "" {
		r = func(context.Context, string, ...string) error { return nil }
	}
	run(os.Stdin, os.Stdout, newProvider(r))
}

// run executes the plugin lifecycle: receive init, register the launcher actions,
// then handle invocations until stdin closes.
func run(in *os.File, out *os.File, prov *provider) {
	w := &msgWriter{w: out}

	sc := bufio.NewScanner(in)
	sc.Buffer(make([]byte, 0, 64*1024), 1<<20)
	if !sc.Scan() { // wait for host init
		return
	}

	contributes, err := json.Marshal(map[string]any{"actions": actionDescriptors()})
	if err != nil {
		return
	}
	w.write(ipcproto.Message{
		Type:     ipcproto.MsgRegister,
		Register: &ipcproto.RegisterPayload{Contributes: contributes},
	})

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go heartbeat(w, ctx)

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
	err := prov.execute(context.Background(), a.ActionID, a.Params)
	res := ipcproto.ActionResultPayload{CallID: a.CallID, OK: err == nil}
	if err != nil {
		res.Error = err.Error()
	}
	w.write(ipcproto.Message{Type: ipcproto.MsgActionResult, ActionResult: &res})
}

func heartbeat(w *msgWriter, ctx context.Context) {
	t := time.NewTicker(time.Second)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			w.write(ipcproto.Message{Type: ipcproto.MsgHeartbeat})
		}
	}
}

func actionDescriptors() []registry.ActionDescriptor {
	return []registry.ActionDescriptor{
		{ID: actLaunchApp, Label: "Launch App", Category: "launch",
			Params: []registry.Param{{Name: "path", Type: registry.ParamFile}}},
		{ID: actLaunchURL, Label: "Open URL", Category: "launch",
			Params: []registry.Param{{Name: "url", Type: registry.ParamString}}},
	}
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
