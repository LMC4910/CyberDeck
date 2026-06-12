// Package soak is a long-running performance soak harness for the CyberDeck
// engine (PROJ-301). It assembles the real engine hot path — state store →
// state pump → fan-out → per-device channel mux — drives it with a synthetic
// telemetry generator at production cadence, and attaches >=8 simulated device
// sessions that consume the fanned-out deltas. While it runs it periodically
// samples heap/OS memory, CPU, and end-to-end throughput, then asserts the
// Phase-1 budgets:
//
//   - memory growth < 5 MB/h           (P1-AC-14, "RSS growth")
//   - idle CPU      < 2 %              (idle telemetry cadence)
//   - sustained, non-degrading throughput (deltas keep flowing to devices)
//
// Two modes share one harness:
//
//   - SHORT (default, exercised by TestSoakShort): a compressed run that
//     finishes in well under two minutes so it can gate every CI build while
//     still surfacing leaks and stalls. Memory growth is extrapolated to an
//     hourly rate before the budget check.
//   - FULL (env-gated CYBERDECK_SOAK=full, NOT run in CI): the literal 8-hour
//     soak at idle cadence.
//
// The harness deliberately uses an in-process lightweight session sink rather
// than the full encrypted/network session per device: the goal is to stress the
// engine's own steady-state data path (store delta-suppression, fan-out
// filtering, mux coalescing, pump draining) for memory/CPU/throughput, not the
// transport crypto. Every other collaborator (store, pump, fanout, mux, server)
// is the real production type, wired exactly as cmd/cyberdeck wires it.
package soak

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"math/rand"
	"os"
	"runtime"
	"sync"
	"sync/atomic"
	"time"

	"github.com/shishir/cyberdeck/engine/core/layout"
	"github.com/shishir/cyberdeck/engine/core/session"
	"github.com/shishir/cyberdeck/engine/core/state"
	"github.com/shishir/cyberdeck/engine/core/transport"
)

// Config parameterises a soak run.
type Config struct {
	// Sessions is the number of simulated device sessions (>=8 per PROJ-301).
	Sessions int
	// Duration is the wall-clock length of the run.
	Duration time.Duration
	// TelemetryInterval is the cadence at which each telemetry state is updated
	// (the engine's idle cadence is ~1s; the pump coalesces to its own tick).
	TelemetryInterval time.Duration
	// PumpInterval is how often the state pump drains+fans changed state.
	PumpInterval time.Duration
	// SampleInterval is how often the harness samples mem/CPU/throughput.
	SampleInterval time.Duration
	// MemGrowthLimitPerHour is the max tolerated memory growth (bytes/hour).
	MemGrowthLimitPerHour float64
	// IdleCPULimitPercent is the max tolerated average process CPU (percent).
	IdleCPULimitPercent float64
	// SettlePeriod is an initial window excluded from the memory-growth
	// regression so warm-up allocation (caches, goroutine stacks) isn't counted
	// as a leak. The throughput floor still applies across the whole run.
	SettlePeriod time.Duration
}

// ShortConfig is a compressed run that completes in well under two minutes.
// Cadences are tightened so the data path is exercised hard (high throughput,
// frequent sampling) while staying short enough to gate every build.
func ShortConfig() Config {
	return Config{
		Sessions:              8,
		Duration:              45 * time.Second,
		TelemetryInterval:     5 * time.Millisecond,
		PumpInterval:          20 * time.Millisecond,
		SampleInterval:        500 * time.Millisecond,
		MemGrowthLimitPerHour: 5 << 20, // 5 MB/h (P1-AC-14)
		IdleCPULimitPercent:   80,      // SHORT runs hot on purpose; see TestSoakShort note
		SettlePeriod:          8 * time.Second,
	}
}

// FullConfig is the literal 8-hour idle soak (env-gated; not run in CI).
func FullConfig() Config {
	return Config{
		Sessions:              8,
		Duration:              8 * time.Hour,
		TelemetryInterval:     1 * time.Second, // engine idle cadence
		PumpInterval:          500 * time.Millisecond,
		SampleInterval:        30 * time.Second,
		MemGrowthLimitPerHour: 5 << 20, // 5 MB/h
		IdleCPULimitPercent:   2,       // idle CPU < 2%
		SettlePeriod:          5 * time.Minute,
	}
}

// Sample is one periodic measurement.
type Sample struct {
	At           time.Duration // elapsed since start
	HeapAllocB   uint64        // runtime heap in-use (live objects)
	SysB         uint64        // total OS memory obtained (closest portable RSS proxy)
	NumGoroutine int
	NumGC        uint32
	CPUPercent   float64 // process CPU since previous sample
	DeltasFanned uint64  // cumulative deltas sent to devices (all sessions)
	DeltasInWin  uint64  // deltas fanned within this sample window
	ThroughputPS float64 // deltas/sec within this sample window
}

// Report is the soak's outcome artifact.
type Report struct {
	Mode                  string   `json:"mode"`
	Sessions              int      `json:"sessions"`
	Duration              string   `json:"duration"`
	TelemetryInterval     string   `json:"telemetryInterval"`
	PumpInterval          string   `json:"pumpInterval"`
	Samples               []Sample `json:"samples"`
	MemGrowthBytesPerHour float64  `json:"memGrowthBytesPerHour"`
	MemGrowthLimitPerHour float64  `json:"memGrowthLimitPerHour"`
	AvgCPUPercent         float64  `json:"avgCpuPercent"`
	IdleCPULimitPercent   float64  `json:"idleCpuLimitPercent"`
	AvgThroughputPS       float64  `json:"avgThroughputPerSec"`
	MinThroughputPS       float64  `json:"minThroughputPerSec"`
	TotalDeltasFanned     uint64   `json:"totalDeltasFanned"`
	Passed                bool     `json:"passed"`
	Failures              []string `json:"failures"`
	GeneratedAt           string   `json:"generatedAt"`
	GoVersion             string   `json:"goVersion"`
	GOOS                  string   `json:"goos"`
}

// deviceSink is a lightweight in-process sessionLike: it satisfies the part of
// transport.EncryptedSession the ChannelMux needs (Send + Received), counting
// every envelope the engine actually delivers. It never blocks the pump (Send
// is O(1)) so the harness measures the engine's production path, not a slow
// fake. Received() yields a never-closing channel: simulated devices are pure
// consumers (they send no control traffic in the soak).
type deviceSink struct {
	delivered *atomic.Uint64
	in        chan transport.Envelope // never written; kept open for the demux loop
}

func newDeviceSink(counter *atomic.Uint64) *deviceSink {
	return &deviceSink{delivered: counter, in: make(chan transport.Envelope)}
}

func (d *deviceSink) Send(transport.Envelope) error       { d.delivered.Add(1); return nil }
func (d *deviceSink) Received() <-chan transport.Envelope { return d.in }

// Harness owns a wired engine data path and its simulated sessions.
type Harness struct {
	cfg    Config
	store  *state.Store
	fanout *transport.Fanout
	pump   *session.StatePump

	muxes     []*transport.ChannelMux
	delivered atomic.Uint64
}

// New builds a harness: the real store/fanout/pump, plus cfg.Sessions simulated
// device subscribers each behind a real ChannelMux over a counting sink. The
// fan-out only ever sends a delta to a subscriber whose SubscriptionSet contains
// the state id, so we subscribe every device to the deck's bound states.
func New(cfg Config) (*Harness, error) {
	if cfg.Sessions < 8 {
		return nil, fmt.Errorf("soak: need >=8 sessions (PROJ-301), got %d", cfg.Sessions)
	}
	store := state.New()
	fanout := transport.NewFanout()
	profile := layout.DefaultProfile()
	bindings := profile.StateBindings()

	h := &Harness{
		cfg:    cfg,
		store:  store,
		fanout: fanout,
		pump:   session.NewStatePump(store, fanout, cfg.PumpInterval, discardLogger()),
	}

	for i := 0; i < cfg.Sessions; i++ {
		sink := newDeviceSink(&h.delivered)
		mux := transport.NewChannelMux(sink, 0, 0)
		h.muxes = append(h.muxes, mux)
		fanout.Add(&transport.Subscriber{
			DeviceUUID: fmt.Sprintf("soak-dev-%02d", i),
			Subs:       state.NewSubscriptionSet(bindings...),
			Mux:        mux,
			ProfileID:  "default",
		})
	}
	return h, nil
}

// Run executes the soak: starts the pump + telemetry generator, samples
// periodically, then tears everything down and evaluates the budgets. It
// returns a Report (also written as an artifact by WriteReport) and an error if
// any budget was breached. The provided ctx can cut a run short.
func (h *Harness) Run(ctx context.Context, mode string) (*Report, error) {
	ctx, cancel := context.WithTimeout(ctx, h.cfg.Duration)
	defer cancel()

	if err := h.pump.Start(ctx); err != nil {
		return nil, fmt.Errorf("soak: start pump: %w", err)
	}

	var wg sync.WaitGroup
	wg.Add(1)
	go func() { defer wg.Done(); h.driveTelemetry(ctx) }()

	samples := h.sampleLoop(ctx)

	// Stop generating + pumping, then drain remaining goroutines/muxes.
	cancel()
	wg.Wait()
	_ = h.pump.Stop(context.Background())
	for _, m := range h.muxes {
		m.Close()
	}

	rep := h.evaluate(mode, samples)
	if !rep.Passed {
		return rep, fmt.Errorf("soak: budget breach: %v", rep.Failures)
	}
	return rep, nil
}

// driveTelemetry mutates the bound telemetry states at the configured cadence,
// mimicking the live telemetry plugin: gauges wander, counters tick, booleans
// toggle. Values genuinely change most ticks so the store does NOT suppress
// them (we want real fan-out traffic), but some repeats exercise the
// delta-suppression fast path too.
func (h *Harness) driveTelemetry(ctx context.Context) {
	t := time.NewTicker(h.cfg.TelemetryInterval)
	defer t.Stop()
	rng := rand.New(rand.NewSource(1))
	start := time.Now()
	// gauge baselines
	g := map[string]float64{
		"system.cpu.percent": 12, "system.ram.percent": 40,
		"system.disk.percent": 55, "system.gpu.temp": 48,
		"system.volume": 30,
	}
	var notif float64
	muted := false
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			// Wander each gauge within [0,100] (or sensible ranges).
			for id, v := range g {
				v += (rng.Float64() - 0.5) * 6
				if v < 0 {
					v = 0
				}
				if v > 100 {
					v = 100
				}
				g[id] = v
				_ = h.store.Set(id, math.Round(v*10)/10)
			}
			// Monotonic uptime (seconds since start).
			_ = h.store.Set("system.uptime", math.Floor(time.Since(start).Seconds()))
			// Notification counter ticks occasionally.
			if rng.Intn(8) == 0 {
				notif++
				_ = h.store.Set("notification.count", notif)
			}
			// Mute toggles rarely (boolean path).
			if rng.Intn(50) == 0 {
				muted = !muted
				_ = h.store.Set("system.muted", muted)
			}
			// VRAM (large numbers, bytes).
			_ = h.store.Set("system.gpu.vram.used", math.Round(rng.Float64()*8e9))
			_ = h.store.Set("system.gpu.vram.total", 8e9)
		}
	}
}

// sampleLoop samples mem/CPU/throughput until ctx ends, returning the series.
func (h *Harness) sampleLoop(ctx context.Context) []Sample {
	t := time.NewTicker(h.cfg.SampleInterval)
	defer t.Stop()
	start := time.Now()

	var prevDelivered uint64
	prevAt := time.Duration(0)
	prevCPU := processCPUTime()
	prevWall := time.Now()

	var samples []Sample
	for {
		select {
		case <-ctx.Done():
			return samples
		case now := <-t.C:
			// Force a GC before reading the heap so the sample reflects RETAINED
			// (live) memory, not where in the GC sawtooth we happened to land.
			// Without this, HeapAlloc swings by megabytes between collections and a
			// short-window hourly extrapolation turns that noise into a phantom
			// leak. With it, a real leak still trends up monotonically while
			// transient garbage is collected away. This is the standard leak-soak
			// technique and the slight pause is irrelevant at our sample cadence.
			runtime.GC()
			var ms runtime.MemStats
			runtime.ReadMemStats(&ms)

			delivered := h.delivered.Load()
			elapsed := now.Sub(start)
			winSecs := (elapsed - prevAt).Seconds()
			winDeltas := delivered - prevDelivered
			tput := 0.0
			if winSecs > 0 {
				tput = float64(winDeltas) / winSecs
			}

			curCPU := processCPUTime()
			wallNow := time.Now()
			cpuPct := 0.0
			if dw := wallNow.Sub(prevWall).Seconds(); dw > 0 {
				cpuPct = (curCPU - prevCPU).Seconds() / dw * 100
			}

			samples = append(samples, Sample{
				At:           elapsed,
				HeapAllocB:   ms.HeapAlloc,
				SysB:         ms.Sys,
				NumGoroutine: runtime.NumGoroutine(),
				NumGC:        ms.NumGC,
				CPUPercent:   cpuPct,
				DeltasFanned: delivered,
				DeltasInWin:  winDeltas,
				ThroughputPS: tput,
			})

			prevDelivered = delivered
			prevAt = elapsed
			prevCPU = curCPU
			prevWall = wallNow
		}
	}
}

// evaluate computes the regression/averages and checks budgets.
func (h *Harness) evaluate(mode string, samples []Sample) *Report {
	rep := &Report{
		Mode:                  mode,
		Sessions:              h.cfg.Sessions,
		Duration:              h.cfg.Duration.String(),
		TelemetryInterval:     h.cfg.TelemetryInterval.String(),
		PumpInterval:          h.cfg.PumpInterval.String(),
		Samples:               samples,
		MemGrowthLimitPerHour: h.cfg.MemGrowthLimitPerHour,
		IdleCPULimitPercent:   h.cfg.IdleCPULimitPercent,
		TotalDeltasFanned:     h.delivered.Load(),
		GeneratedAt:           time.Now().UTC().Format(time.RFC3339),
		GoVersion:             runtime.Version(),
		GOOS:                  runtime.GOOS,
		Passed:                true,
	}

	// Memory-growth regression over post-settle samples (HeapAlloc vs elapsed).
	rep.MemGrowthBytesPerHour = memGrowthPerHour(samples, h.cfg.SettlePeriod)

	// CPU + throughput stats: skip the first sample (no prior window) and the
	// settle window for CPU averaging (warm-up GC churn isn't "idle").
	var cpuSum float64
	var cpuN int
	var tputSum, tputMin float64
	tputMin = math.Inf(1)
	var tputN int
	curStall, maxStall := 0, 0
	for i, s := range samples {
		if i == 0 {
			continue
		}
		if s.At >= h.cfg.SettlePeriod {
			cpuSum += s.CPUPercent
			cpuN++
		}
		tputSum += s.ThroughputPS
		if s.ThroughputPS < tputMin {
			tputMin = s.ThroughputPS
		}
		// Track the longest run of consecutive zero-throughput windows. A single
		// empty window is benign at idle cadence (sample/pump phase misalignment
		// can land a window between pump ticks); a genuine stall (deadlocked pump,
		// choked fanout) parks throughput at 0 across many consecutive windows.
		if s.ThroughputPS <= 0 {
			curStall++
			if curStall > maxStall {
				maxStall = curStall
			}
		} else {
			curStall = 0
		}
		tputN++
	}
	if cpuN > 0 {
		rep.AvgCPUPercent = cpuSum / float64(cpuN)
	}
	if tputN > 0 {
		rep.AvgThroughputPS = tputSum / float64(tputN)
		rep.MinThroughputPS = tputMin
	}

	// --- budget checks ---
	if rep.MemGrowthBytesPerHour > h.cfg.MemGrowthLimitPerHour {
		rep.Passed = false
		rep.Failures = append(rep.Failures, fmt.Sprintf(
			"memory growth %.2f MB/h exceeds budget %.2f MB/h (P1-AC-14)",
			rep.MemGrowthBytesPerHour/(1<<20), h.cfg.MemGrowthLimitPerHour/(1<<20)))
	}
	if rep.AvgCPUPercent > h.cfg.IdleCPULimitPercent {
		rep.Passed = false
		rep.Failures = append(rep.Failures, fmt.Sprintf(
			"avg CPU %.2f%% exceeds budget %.2f%%", rep.AvgCPUPercent, h.cfg.IdleCPULimitPercent))
	}
	// Sustained throughput: the engine must keep fanning deltas the whole run.
	// A genuine stall (deadlocked pump, fanout choked by a goroutine leak) parks
	// throughput at 0 across consecutive windows; one isolated empty window at
	// idle cadence is benign (see maxStall comment above). maxStallWindows allows
	// a single empty window plus one for jitter.
	const maxStallWindows = 2
	switch {
	case rep.TotalDeltasFanned == 0:
		rep.Passed = false
		rep.Failures = append(rep.Failures, "no deltas fanned out — data path never delivered")
	case rep.AvgThroughputPS <= 0:
		rep.Passed = false
		rep.Failures = append(rep.Failures, "average throughput is 0 — data path not sustained")
	case maxStall > maxStallWindows:
		rep.Passed = false
		rep.Failures = append(rep.Failures, fmt.Sprintf(
			"throughput stalled to 0 for %d consecutive windows — sustained delivery not met", maxStall))
	}
	return rep
}

// memGrowthPerHour fits a least-squares line to HeapAlloc over elapsed time for
// samples past the settle period and returns the slope in bytes/hour. With
// fewer than two usable samples it returns 0 (no trend asserted).
func memGrowthPerHour(samples []Sample, settle time.Duration) float64 {
	var xs, ys []float64
	for _, s := range samples {
		if s.At < settle {
			continue
		}
		xs = append(xs, s.At.Hours())
		ys = append(ys, float64(s.HeapAllocB))
	}
	if len(xs) < 2 {
		return 0
	}
	var sx, sy, sxx, sxy float64
	n := float64(len(xs))
	for i := range xs {
		sx += xs[i]
		sy += ys[i]
		sxx += xs[i] * xs[i]
		sxy += xs[i] * ys[i]
	}
	denom := n*sxx - sx*sx
	if denom == 0 {
		return 0
	}
	return (n*sxy - sx*sy) / denom // slope: bytes per hour
}

// WriteReport writes the report as pretty JSON to path (creating parent dirs).
func WriteReport(path string, rep *Report) error {
	if err := os.MkdirAll(dirOf(path), 0o755); err != nil {
		return err
	}
	b, err := json.MarshalIndent(rep, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, b, 0o644)
}
