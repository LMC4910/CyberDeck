// Command telemetry is the first-party CyberDeck telemetry plugin (PROJ-171). It
// runs out-of-process and speaks the host↔plugin IPC protocol (ipcproto) over
// stdio: it receives init, registers its typed system.* states, then publishes
// cadenced telemetry (CPU/RAM/net at 1s, disk at 10s, uptime at 60s) plus
// high-usage threshold events, until the host closes stdin.
package main

import (
	"bufio"
	"context"
	"os"
	"time"

	"github.com/shishir/cyberdeck/engine/pal"
	"github.com/shishir/cyberdeck/engine/pluginhost/ipcproto"

	"github.com/shishir/cyberdeck/plugins/telemetry/providers"
)

// High-usage thresholds (percent).
const (
	cpuWarnPercent = 85.0
	ramWarnPercent = 90.0
)

func main() {
	cad := DefaultCadences()
	tick := time.Second
	if os.Getenv("CYBERDECK_TELEMETRY_FAST") != "" {
		// Test/CI mode: tiny cadences so the pipeline can be exercised quickly.
		fast := 20 * time.Millisecond
		cad = Cadences{CPU: fast, RAM: fast, Net: fast, Disk: fast, Uptime: fast}
		tick = 10 * time.Millisecond
	}
	run(os.Stdin, os.Stdout, providers.New(), cad, tick)
}

// run executes the plugin lifecycle against the given streams and provider. It
// returns when stdin closes (host shutdown).
func run(in *os.File, out *os.File, prov pal.Telemetry, cad Cadences, tick time.Duration) {
	w := newMsgWriter(out)

	sc := bufio.NewScanner(in)
	sc.Buffer(make([]byte, 0, 64*1024), 1<<20)

	// Wait for the host's init before doing anything.
	if !sc.Scan() {
		return
	}

	// Declare our typed states (the IPC gate admits only these).
	if err := w.write(ipcproto.Message{
		Type:     ipcproto.MsgRegister,
		Register: &ipcproto.RegisterPayload{States: systemStates()},
	}); err != nil {
		return
	}

	pub := NewPublisher(prov, w, cad, cpuWarnPercent, ramWarnPercent)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Publish loop.
	go func() {
		t := time.NewTicker(tick)
		defer t.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case now := <-t.C:
				_ = pub.PublishDue(now)
			}
		}
	}()

	// Heartbeat loop (liveness even when no metric is due).
	go func() {
		t := time.NewTicker(time.Second)
		defer t.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-t.C:
				_ = w.write(ipcproto.Message{Type: ipcproto.MsgHeartbeat})
			}
		}
	}()

	// Drain stdin; loop ends when the host closes it.
	for sc.Scan() {
	}
}
