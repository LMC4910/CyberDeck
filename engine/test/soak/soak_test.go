package soak

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"
)

// reportPath returns where a run writes its artifact. CYBERDECK_SOAK_REPORT
// overrides it; otherwise it lands next to the test binary's working dir.
func reportPath(t *testing.T, name string) string {
	t.Helper()
	if p := os.Getenv("CYBERDECK_SOAK_REPORT"); p != "" {
		return p
	}
	return filepath.Join(t.TempDir(), name)
}

// TestSoakShort is the compressed soak that gates every build. It runs the real
// engine data path with 8 simulated sessions hard (high telemetry/pump cadence)
// for ~45s, then asserts:
//
//   - heap growth extrapolated to < 5 MB/h (P1-AC-14 leak check)
//   - the data path sustained throughput the whole run (no stalled window)
//
// It is intentionally hot (not "idle"), so it does NOT assert the 2% idle-CPU
// budget — that is validated separately by TestIdleCPUBudget at production
// cadence. The whole test completes well under two minutes.
func TestSoakShort(t *testing.T) {
	if testing.Short() {
		t.Skip("soak: skipped under -short")
	}
	h, err := New(ShortConfig())
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	rep, err := h.Run(context.Background(), "short")
	if rep != nil {
		if werr := WriteReport(reportPath(t, "soak-short.json"), rep); werr != nil {
			t.Logf("soak: write report: %v", werr)
		}
		t.Logf("soak/short: deltas=%d heapGrowth=%.3f MB/h avgTput=%.0f/s minTput=%.0f/s avgCPU=%.1f%% samples=%d",
			rep.TotalDeltasFanned, rep.MemGrowthBytesPerHour/(1<<20),
			rep.AvgThroughputPS, rep.MinThroughputPS, rep.AvgCPUPercent, len(rep.Samples))
	}
	if err != nil {
		t.Fatalf("soak budget breach: %v", err)
	}

	// Defensive cross-checks beyond the harness's own gates.
	if rep.TotalDeltasFanned == 0 {
		t.Fatal("soak: no deltas fanned — data path inert")
	}
	if len(rep.Samples) < 3 {
		t.Fatalf("soak: too few samples (%d) to trust the trend", len(rep.Samples))
	}
}

// TestIdleCPUBudget runs the harness at production (idle) cadence for a short
// window and asserts the engine's steady-state process CPU stays under 2%. This
// is the literal idle-CPU budget from PROJ-301, exercised quickly. Memory and
// throughput gates are relaxed here (the window is too short for a meaningful
// hourly regression); the dedicated leak check lives in TestSoakShort.
func TestIdleCPUBudget(t *testing.T) {
	if testing.Short() {
		t.Skip("soak: skipped under -short")
	}
	cfg := Config{
		Sessions:              8,
		Duration:              18 * time.Second,
		TelemetryInterval:     1 * time.Second,        // idle cadence
		PumpInterval:          500 * time.Millisecond, // production pump interval
		SampleInterval:        1 * time.Second,
		MemGrowthLimitPerHour: 64 << 20, // relaxed: window too short to regress
		IdleCPULimitPercent:   2,        // the budget under test
		SettlePeriod:          3 * time.Second,
	}
	h, err := New(cfg)
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	rep, err := h.Run(context.Background(), "idle-cpu")
	if rep != nil {
		t.Logf("soak/idle-cpu: avgCPU=%.2f%% deltas=%d samples=%d",
			rep.AvgCPUPercent, rep.TotalDeltasFanned, len(rep.Samples))
	}
	if err != nil {
		t.Fatalf("idle CPU budget breach: %v", err)
	}
}

// TestSoakFull is the literal 8-hour idle soak. It is env-gated and never runs
// in CI; set CYBERDECK_SOAK=full to execute it (and pass -timeout 9h). It writes
// its report to CYBERDECK_SOAK_REPORT (or a temp file).
func TestSoakFull(t *testing.T) {
	if os.Getenv("CYBERDECK_SOAK") != "full" {
		t.Skip("soak: full 8h soak is env-gated (set CYBERDECK_SOAK=full, -timeout 9h)")
	}
	h, err := New(FullConfig())
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	rep, err := h.Run(context.Background(), "full")
	if rep != nil {
		if werr := WriteReport(reportPath(t, "soak-full.json"), rep); werr != nil {
			t.Logf("soak: write report: %v", werr)
		}
		t.Logf("soak/full: deltas=%d heapGrowth=%.3f MB/h avgCPU=%.2f%% avgTput=%.0f/s samples=%d",
			rep.TotalDeltasFanned, rep.MemGrowthBytesPerHour/(1<<20),
			rep.AvgCPUPercent, rep.AvgThroughputPS, len(rep.Samples))
	}
	if err != nil {
		t.Fatalf("soak budget breach: %v", err)
	}
}

// TestNewRejectsTooFewSessions guards the >=8-session requirement.
func TestNewRejectsTooFewSessions(t *testing.T) {
	cfg := ShortConfig()
	cfg.Sessions = 4
	if _, err := New(cfg); err == nil {
		t.Fatal("expected New to reject <8 sessions")
	}
}
