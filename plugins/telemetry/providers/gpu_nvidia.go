package providers

import (
	"context"
	"os/exec"
	"strconv"
	"strings"
	"time"
)

// nvidiaQuery is the nvidia-smi field list, in the same order parsed below. Values
// come back as a single CSV line with no header and no units (raw numbers): GPU
// utilisation %, temperature C, VRAM used MiB, VRAM total MiB.
const nvidiaQuery = "utilization.gpu,temperature.gpu,memory.used,memory.total"

// nvidiaSampleTimeout caps a single nvidia-smi invocation so a hung driver cannot
// stall the publish loop; on timeout the source simply reports unavailable.
const nvidiaSampleTimeout = 2 * time.Second

// nvidiaRunner runs the nvidia-smi query and returns its raw stdout. It is a field
// so tests can inject a fake without spawning a process.
type nvidiaRunner func() ([]byte, error)

// nvidiaSource reads GPU metrics from the NVIDIA Management Library via the
// nvidia-smi CLI. No cgo / vendor SDK dependency: present whenever an NVIDIA driver
// is installed, absent (→ unavailable) otherwise.
type nvidiaSource struct {
	run nvidiaRunner
}

// detectNvidia probes for a usable nvidia-smi. It is invoked once at chain-build
// time (not on the hot path), so a one-off exec is acceptable here. ok=false means
// no NVIDIA GPU/driver — the chain skips this provider and degrades.
func detectNvidia() (gpuSource, bool) {
	path, err := exec.LookPath("nvidia-smi")
	if err != nil {
		return nil, false
	}
	src := &nvidiaSource{run: func() ([]byte, error) {
		ctx, cancel := context.WithTimeout(context.Background(), nvidiaSampleTimeout)
		defer cancel()
		return exec.CommandContext(ctx, path,
			"--query-gpu="+nvidiaQuery,
			"--format=csv,noheader,nounits",
		).Output()
	}}
	// A successful sample at detection time confirms the driver actually answers
	// (a stale nvidia-smi on PATH with no working GPU must not falsely bind).
	if _, ok := src.sample(); !ok {
		return nil, false
	}
	return src, true
}

func (s *nvidiaSource) sample() (gpuSnapshot, bool) {
	out, err := s.run()
	if err != nil {
		return gpuSnapshot{}, false
	}
	return parseNvidiaCSV(string(out))
}

// parseNvidiaCSV parses the first GPU row of nvidia-smi CSV output. Per-field "ok"
// flags isolate "[N/A]"/unparseable values (some metrics are unsupported on certain
// boards) so one missing field never invalidates the others. VRAM is reported in
// MiB by nvidia-smi and converted to bytes to match the byte-typed states.
func parseNvidiaCSV(out string) (gpuSnapshot, bool) {
	line := firstNonEmptyLine(out)
	if line == "" {
		return gpuSnapshot{}, false
	}
	fields := strings.Split(line, ",")
	if len(fields) < 4 {
		return gpuSnapshot{}, false
	}

	const mib = 1024 * 1024
	var snap gpuSnapshot
	snap.load, snap.loadOK = parseField(fields[0], 1)
	snap.temp, snap.tempOK = parseField(fields[1], 1)
	snap.vramUsed, snap.vramUsedOK = parseField(fields[2], mib)
	snap.vramTotal, snap.vramTotalOK = parseField(fields[3], mib)

	ok := snap.loadOK || snap.tempOK || snap.vramUsedOK || snap.vramTotalOK
	return snap, ok
}

// parseField trims and parses one CSV field, scaling by mul. "[N/A]" and any
// non-numeric value yield ok=false.
func parseField(s string, mul float64) (float64, bool) {
	v, err := strconv.ParseFloat(strings.TrimSpace(s), 64)
	if err != nil {
		return 0, false
	}
	return v * mul, true
}

func firstNonEmptyLine(s string) string {
	for _, ln := range strings.Split(s, "\n") {
		if t := strings.TrimSpace(ln); t != "" {
			return t
		}
	}
	return ""
}
