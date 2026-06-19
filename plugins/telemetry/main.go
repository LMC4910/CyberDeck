// Command telemetry is the first-party CyberDeck telemetry plugin (PROJ-171). It
// runs out-of-process and speaks the host↔plugin IPC protocol (ipcproto) over
// stdio: it receives init, registers its typed system.* states, then publishes
// cadenced telemetry (CPU/RAM/net at 1s, disk at 10s, uptime at 60s) plus
// high-usage threshold events, until the host closes stdin.
package main

import (
	"bufio"
	"context"
	"fmt"
	"math"
	"os"
	"time"

	"github.com/shishir/cyberdeck/engine/pal"
	"github.com/shishir/cyberdeck/engine/pluginhost/ipcproto"

	"github.com/shishir/cyberdeck/plugins/telemetry/providers"
)

// High-usage thresholds. CPU/RAM are percent; GPU is degrees Celsius — a GPU
// temp strictly above gpuWarnTempC emits a system.gpu.high event (PROJ-172).
const (
	cpuWarnPercent = 85.0
	ramWarnPercent = 90.0
	gpuWarnTempC   = 88.0
)

func main() {
	cad := DefaultCadences()
	tick := time.Second
	if os.Getenv("CYBERDECK_TELEMETRY_FAST") != "" {
		// Test/CI mode: tiny cadences so the pipeline can be exercised quickly.
		fast := 20 * time.Millisecond
		cad = Cadences{CPU: fast, RAM: fast, Net: fast, Disk: fast, Uptime: fast, Process: fast}
		tick = 10 * time.Millisecond
	}
	run(os.Stdin, os.Stdout, providers.New(), providers.NewGPU(), cad, tick)
}

// run executes the plugin lifecycle against the given streams and providers. The
// gpu provider is the PAL-chain-selected GPU capability (unavailable on machines
// without a supported GPU — its gauges simply stay "--"). It returns when stdin
// closes (host shutdown).
func run(in *os.File, out *os.File, prov pal.Telemetry, gpu pal.GPU, cad Cadences, tick time.Duration) {
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

	// Publish the (mostly static) host details once so the "Detailed System Info"
	// card shows real data on connect (separate from the cadenced float metrics).
	if si, ok := prov.(systemInfoProvider); ok {
		if info := si.SystemInfo(); len(info) > 0 {
			_ = w.write(ipcproto.Message{
				Type:  ipcproto.MsgStateUpdate,
				State: &ipcproto.StatePayload{ID: stateSystemInfo, Value: info},
			})
		}
	}

	pub := NewPublisher(prov, gpu, w, cad, cpuWarnPercent, ramWarnPercent, gpuWarnTempC)

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

	// Top-processes loop (heavier; its own cadence). Published as a list state.
	if pp, ok := prov.(processProvider); ok && cad.Process > 0 {
		go func() {
			t := time.NewTicker(cad.Process)
			defer t.Stop()
			for {
				select {
				case <-ctx.Done():
					return
				case <-t.C:
					if procs, ok := pp.TopProcesses(); ok {
						_ = w.write(ipcproto.Message{
							Type:  ipcproto.MsgStateUpdate,
							State: &ipcproto.StatePayload{ID: stateProcesses, Value: procs},
						})
					}
				}
			}
		}()
	}

	// System status map (power plan / network / storage / uptime) for the dashboard
	// status card. Composed string fields → its own goroutine (not the float loop).
	if sp, ok := prov.(statusProvider); ok && cad.Status > 0 {
		go func() {
			emit := func() {
				m := map[string]any{}
				if v, ok := sp.PowerPlan(); ok {
					m["powerPlan"] = v
				}
				if v, ok := sp.NetworkStatus(); ok {
					m["network"] = v
				}
				if v, ok := sp.StorageFree(); ok {
					m["storage"] = v
				}
				if s, ok := prov.UptimeSeconds(); ok {
					m["uptime"] = formatUptime(s)
				}
				if len(m) > 0 {
					_ = w.write(ipcproto.Message{
						Type:  ipcproto.MsgStateUpdate,
						State: &ipcproto.StatePayload{ID: stateStatus, Value: m},
					})
				}
			}
			emit() // once at startup so the card fills in immediately
			t := time.NewTicker(cad.Status)
			defer t.Stop()
			for {
				select {
				case <-ctx.Done():
					return
				case <-t.C:
					emit()
				}
			}
		}()
	}

	// CPU temperature loop (sensor source shells out; its own slow cadence).
	if ctp, ok := prov.(cpuTempProvider); ok && cad.CPUTemp > 0 {
		go func() {
			t := time.NewTicker(cad.CPUTemp)
			defer t.Stop()
			for {
				select {
				case <-ctx.Done():
					return
				case <-t.C:
					if temp, ok := ctp.CPUTemp(); ok {
						_ = w.write(ipcproto.Message{
							Type:  ipcproto.MsgStateUpdate,
							State: &ipcproto.StatePayload{ID: stateCPUTemp, Value: temp},
						})
					}
				}
			}
		}()
	}

	// Network loop: latency (ping) + a composed summary map for the Networks card.
	if np, ok := prov.(pingProvider); ok && cad.Ping > 0 {
		ext, _ := prov.(extendedTelemetry)
		sp, _ := prov.(statusProvider)
		go func() {
			emit := func() {
				ping, pok := np.Ping()
				if pok {
					_ = w.write(ipcproto.Message{
						Type:  ipcproto.MsgStateUpdate,
						State: &ipcproto.StatePayload{ID: stateNetPing, Value: ping},
					})
				}
				m := map[string]any{}
				if ext != nil {
					if rx, ok := ext.NetRxBytesPerSec(); ok {
						m["download"] = fmt.Sprintf("%.1f Mbps", rx*8/1e6)
					}
					if tx, ok := ext.NetTxBytesPerSec(); ok {
						m["upload"] = fmt.Sprintf("%.1f Mbps", tx*8/1e6)
					}
				}
				if pok {
					m["ping"] = fmt.Sprintf("%.0f ms", ping)
				}
				if sp != nil {
					if s, ok := sp.NetworkStatus(); ok {
						m["status"] = s
					}
				}
				if len(m) > 0 {
					_ = w.write(ipcproto.Message{
						Type:  ipcproto.MsgStateUpdate,
						State: &ipcproto.StatePayload{ID: stateNetSummary, Value: m},
					})
				}
			}
			emit()
			t := time.NewTicker(cad.Ping)
			defer t.Stop()
			for {
				select {
				case <-ctx.Done():
					return
				case <-t.C:
					emit()
				}
			}
		}()
	}

	// System health loop: a derived 0–100 score composed from live CPU/RAM load,
	// CPU/GPU temperature and GPU load. Its own goroutine (composite read) and only
	// when a real basis exists (else skipped → "--").
	if cad.Health > 0 {
		ctp, _ := prov.(cpuTempProvider)
		go func() {
			emit := func() {
				if score, ok := computeHealth(prov, gpu, ctp); ok {
					_ = w.write(ipcproto.Message{
						Type:  ipcproto.MsgStateUpdate,
						State: &ipcproto.StatePayload{ID: stateHealth, Value: score},
					})
				}
			}
			emit()
			t := time.NewTicker(cad.Health)
			defer t.Stop()
			for {
				select {
				case <-ctx.Done():
					return
				case <-t.C:
					emit()
				}
			}
		}()
	}

	// Storage-used loop: the primary volume's used space in TB (System Overview tile).
	if sup, ok := prov.(storageUsedProvider); ok && cad.Storage > 0 {
		go func() {
			emit := func() {
				if tb, ok := sup.StorageUsedTB(); ok {
					_ = w.write(ipcproto.Message{
						Type:  ipcproto.MsgStateUpdate,
						State: &ipcproto.StatePayload{ID: stateStorageUsedTB, Value: tb},
					})
				}
			}
			emit()
			t := time.NewTicker(cad.Storage)
			defer t.Stop()
			for {
				select {
				case <-ctx.Done():
					return
				case <-t.C:
					emit()
				}
			}
		}()
	}

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

// computeHealth derives a 0–100 system-health score from whatever live metrics are
// readable: it starts at 100 and deducts for high CPU/RAM load, high CPU/GPU
// temperature and high GPU load. Each band only penalises above a comfortable
// threshold, so an idle, cool machine scores ~100. Returns ok=false when NO metric
// is available (no real basis → the ring shows "--" rather than a fabricated number).
func computeHealth(prov pal.Telemetry, gpu pal.GPU, ctp cpuTempProvider) (float64, bool) {
	score := 100.0
	used := false
	if cpu, ok := prov.CPUPercent(); ok {
		used = true
		if cpu > 75 {
			score -= (cpu - 75) * 0.5
		}
	}
	if ram, ok := prov.MemUsedPercent(); ok {
		used = true
		if ram > 80 {
			score -= (ram - 80) * 0.7
		}
	}
	if gpu != nil {
		if gl, ok := gpu.Load(); ok {
			used = true
			if gl > 85 {
				score -= (gl - 85) * 0.3
			}
		}
		if gt, ok := gpu.Temp(); ok {
			used = true
			if gt > 78 {
				score -= (gt - 78) * 0.6
			}
		}
	}
	if ctp != nil {
		if ct, ok := ctp.CPUTemp(); ok {
			used = true
			if ct > 75 {
				score -= (ct - 75) * 0.6
			}
		}
	}
	if !used {
		return 0, false
	}
	if score < 0 {
		score = 0
	}
	if score > 100 {
		score = 100
	}
	return math.Round(score), true
}

// formatUptime renders uptime seconds as "Dd Hh Mm" (dropping leading zero units)
// for the dashboard status card.
func formatUptime(seconds float64) string {
	total := int(seconds)
	d := total / 86400
	h := (total % 86400) / 3600
	m := (total % 3600) / 60
	switch {
	case d > 0:
		return fmt.Sprintf("%dd %dh %dm", d, h, m)
	case h > 0:
		return fmt.Sprintf("%dh %dm", h, m)
	default:
		return fmt.Sprintf("%dm", m)
	}
}
