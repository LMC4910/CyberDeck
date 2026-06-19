// Package providers contains telemetry capability providers for the first-party
// telemetry plugin. Gopsutil is the cross-platform default (PROJ-171); the GPU
// chain (PROJ-172) plugs in alongside it via the PAL provider chain.
package providers

import (
	"fmt"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/shirou/gopsutil/v4/cpu"
	"github.com/shirou/gopsutil/v4/disk"
	"github.com/shirou/gopsutil/v4/host"
	"github.com/shirou/gopsutil/v4/mem"
	"github.com/shirou/gopsutil/v4/net"

	"github.com/shishir/cyberdeck/engine/pal"
)

// Gopsutil implements pal.Telemetry using gopsutil. Each method follows the
// (value, ok) convention: ok=false means the metric is unavailable on this host
// right now (the bound state shows "--"), never a fabricated zero.
type Gopsutil struct {
	mu sync.Mutex
	// Net rate sampler: cumulative rx/tx counters + the cached per-second rates
	// computed from them. Recomputed at most once per ~250ms so the rx, tx, and
	// throughput reads within one publish tick all share a single sample.
	lastRx, lastTx uint64
	lastNetTime    time.Time
	rxRate, txRate float64
	netSampled     bool
}

// New returns a gopsutil-backed telemetry provider.
func New() *Gopsutil { return &Gopsutil{} }

// Compile-time assertion that the provider satisfies the PAL capability.
var _ pal.Telemetry = (*Gopsutil)(nil)

// CPUPercent reports total CPU utilisation since the previous call (non-blocking).
func (g *Gopsutil) CPUPercent() (float64, bool) {
	pct, err := cpu.Percent(0, false)
	if err != nil || len(pct) == 0 {
		return 0, false
	}
	return pct[0], true
}

// MemUsedPercent reports RAM used percentage.
func (g *Gopsutil) MemUsedPercent() (float64, bool) {
	v, err := mem.VirtualMemory()
	if err != nil || v == nil {
		return 0, false
	}
	return v.UsedPercent, true
}

// sampleNet refreshes the cached rx/tx rates from the cumulative interface
// counters, computing the delta over the elapsed interval. The first call sets a
// baseline (rates 0). Reads within ~250ms reuse the cached sample so the rx, tx
// and throughput metrics published in one tick agree. Returns false if counters
// are unavailable. (Fixes the prior bug that updated `last` before the delta.)
func (g *Gopsutil) sampleNet() bool {
	counters, err := net.IOCounters(false)
	if err != nil || len(counters) == 0 {
		return false
	}
	rx, tx := counters[0].BytesRecv, counters[0].BytesSent
	now := time.Now()

	g.mu.Lock()
	defer g.mu.Unlock()
	if g.lastNetTime.IsZero() {
		g.lastRx, g.lastTx, g.lastNetTime = rx, tx, now
		g.rxRate, g.txRate, g.netSampled = 0, 0, true
		return true
	}
	dt := now.Sub(g.lastNetTime).Seconds()
	if dt < 0.25 && g.netSampled {
		return true // reuse the cached rates within the coalescing window
	}
	if dt <= 0 {
		return true
	}
	if rx >= g.lastRx {
		g.rxRate = float64(rx-g.lastRx) / dt
	}
	if tx >= g.lastTx {
		g.txRate = float64(tx-g.lastTx) / dt
	}
	g.lastRx, g.lastTx, g.lastNetTime = rx, tx, now
	g.netSampled = true
	return true
}

// NetThroughput reports aggregate bytes/sec (rx+tx) across all interfaces.
func (g *Gopsutil) NetThroughput() (float64, bool) {
	if !g.sampleNet() {
		return 0, false
	}
	g.mu.Lock()
	defer g.mu.Unlock()
	return g.rxRate + g.txRate, true
}

// NetRxBytesPerSec / NetTxBytesPerSec report download / upload rates (bytes/sec).
func (g *Gopsutil) NetRxBytesPerSec() (float64, bool) {
	if !g.sampleNet() {
		return 0, false
	}
	g.mu.Lock()
	defer g.mu.Unlock()
	return g.rxRate, true
}

func (g *Gopsutil) NetTxBytesPerSec() (float64, bool) {
	if !g.sampleNet() {
		return 0, false
	}
	g.mu.Lock()
	defer g.mu.Unlock()
	return g.txRate, true
}

// DiskUsedPercent reports used percentage of the primary volume.
func (g *Gopsutil) DiskUsedPercent() (float64, bool) {
	u, err := disk.Usage(primaryMount())
	if err != nil || u == nil {
		return 0, false
	}
	return u.UsedPercent, true
}

// UptimeSeconds reports host uptime in seconds.
func (g *Gopsutil) UptimeSeconds() (float64, bool) {
	up, err := host.Uptime()
	if err != nil {
		return 0, false
	}
	return float64(up), true
}

// MemUsedBytes / MemFreeBytes / MemTotalBytes report RAM in bytes. "Free" uses
// Available (memory reclaimable for new allocations), which matches what a user
// reads as free far better than the OS's raw free-page count.
func (g *Gopsutil) MemUsedBytes() (float64, bool) {
	v, err := mem.VirtualMemory()
	if err != nil || v == nil {
		return 0, false
	}
	return float64(v.Used), true
}

func (g *Gopsutil) MemFreeBytes() (float64, bool) {
	v, err := mem.VirtualMemory()
	if err != nil || v == nil {
		return 0, false
	}
	return float64(v.Available), true
}

func (g *Gopsutil) MemTotalBytes() (float64, bool) {
	v, err := mem.VirtualMemory()
	if err != nil || v == nil {
		return 0, false
	}
	return float64(v.Total), true
}

// DiskPercentFor reports the used percentage of the volume at mount, or ok=false
// when that volume doesn't exist on this host (so an absent drive shows "--").
func (g *Gopsutil) DiskPercentFor(mount string) (float64, bool) {
	u, err := disk.Usage(mount)
	if err != nil || u == nil {
		return 0, false
	}
	return u.UsedPercent, true
}

// Ping reports the round-trip latency (ms) to 1.1.1.1 via the system ping tool
// (no raw socket / admin needed). ok=false on timeout / unreachable.
func (g *Gopsutil) Ping() (float64, bool) {
	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		cmd = exec.Command("ping", "-n", "1", "-w", "1000", "1.1.1.1")
	} else {
		cmd = exec.Command("ping", "-c", "1", "-W", "1", "1.1.1.1")
	}
	out, _ := cmd.Output() // non-zero exit on loss; parse whatever came back
	return parsePingMs(string(out))
}

// parsePingMs extracts the latency from ping output ("time=12ms" / "time<1ms" /
// "time=12.3 ms").
func parsePingMs(s string) (float64, bool) {
	for _, key := range []string{"time=", "time<"} {
		i := strings.Index(s, key)
		if i < 0 {
			continue
		}
		rest := s[i+len(key):]
		j := 0
		for j < len(rest) && (rest[j] == '.' || (rest[j] >= '0' && rest[j] <= '9')) {
			j++
		}
		if j == 0 {
			continue
		}
		if v, err := strconv.ParseFloat(rest[:j], 64); err == nil {
			return v, true
		}
	}
	return 0, false
}

// NetworkStatus reports "Connected" when any non-loopback interface is up with an
// address, else "Disconnected". ok=false only when interfaces can't be read.
func (g *Gopsutil) NetworkStatus() (string, bool) {
	ifaces, err := net.Interfaces()
	if err != nil {
		return "", false
	}
	for _, ifc := range ifaces {
		up, loopback := false, false
		for _, f := range ifc.Flags {
			switch f {
			case "up":
				up = true
			case "loopback":
				loopback = true
			}
		}
		if up && !loopback && len(ifc.Addrs) > 0 {
			return "Connected", true
		}
	}
	return "Disconnected", true
}

// StorageFree reports the primary volume's free space as a display string
// ("X GB Free" / "X.X TB Free").
func (g *Gopsutil) StorageFree() (string, bool) {
	u, err := disk.Usage(primaryMount())
	if err != nil || u == nil || u.Total == 0 {
		return "", false
	}
	free := float64(u.Free)
	if free >= (1 << 40) {
		return fmt.Sprintf("%.1f TB Free", free/(1<<40)), true
	}
	return fmt.Sprintf("%.0f GB Free", free/(1<<30)), true
}

// StorageUsedTB reports the primary volume's used space in TB (binary, matching the
// SystemInfo total). ok=false when the volume can't be read, so the tile shows "--".
func (g *Gopsutil) StorageUsedTB() (float64, bool) {
	u, err := disk.Usage(primaryMount())
	if err != nil || u == nil || u.Total == 0 {
		return 0, false
	}
	return float64(u.Used) / (1 << 40), true
}

// SystemInfo returns a best-effort snapshot of static host details for the
// "Detailed System Info" card: OS, CPU model, total RAM, and primary-disk size.
// Missing pieces are omitted so the card row keeps its authored literal.
func (g *Gopsutil) SystemInfo() map[string]any {
	out := map[string]any{}
	if h, err := host.Info(); err == nil && h != nil && h.Platform != "" {
		out["os"] = h.Platform
	}
	if ci, err := cpu.Info(); err == nil && len(ci) > 0 && ci[0].ModelName != "" {
		out["cpu"] = ci[0].ModelName
	}
	if v, err := mem.VirtualMemory(); err == nil && v != nil && v.Total > 0 {
		out["ram"] = fmt.Sprintf("%.0f GB", float64(v.Total)/(1<<30))
	}
	if u, err := disk.Usage(primaryMount()); err == nil && u != nil && u.Total > 0 {
		total := float64(u.Total)
		if total >= (1 << 40) {
			out["storage"] = fmt.Sprintf("%.1f TB", total/(1<<40))
		} else {
			out["storage"] = fmt.Sprintf("%.0f GB", total/(1<<30))
		}
	}
	return out
}

// primaryMount is the path whose volume represents "primary storage" per OS.
func primaryMount() string {
	if runtime.GOOS == "windows" {
		return "C:\\"
	}
	return "/"
}
