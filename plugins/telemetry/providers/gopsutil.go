// Package providers contains telemetry capability providers for the first-party
// telemetry plugin. Gopsutil is the cross-platform default (PROJ-171); the GPU
// chain (PROJ-172) plugs in alongside it via the PAL provider chain.
package providers

import (
	"runtime"
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
	mu       sync.Mutex
	lastNet  uint64    // last total bytes (sent+recv) for throughput delta
	lastTime time.Time // when lastNet was sampled
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

// NetThroughput reports aggregate bytes/sec across all interfaces, computed as a
// delta between successive calls. The first call establishes a baseline and
// reports 0 (available, but no rate yet).
func (g *Gopsutil) NetThroughput() (float64, bool) {
	counters, err := net.IOCounters(false)
	if err != nil || len(counters) == 0 {
		return 0, false
	}
	total := counters[0].BytesSent + counters[0].BytesRecv
	now := time.Now()

	g.mu.Lock()
	defer g.mu.Unlock()
	if g.lastTime.IsZero() {
		g.lastNet, g.lastTime = total, now
		return 0, true
	}
	dt := now.Sub(g.lastTime).Seconds()
	g.lastNet, g.lastTime = total, now
	if dt <= 0 || total < g.lastNet {
		return 0, true
	}
	return float64(total-g.lastNet) / dt, true
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

// primaryMount is the path whose volume represents "primary storage" per OS.
func primaryMount() string {
	if runtime.GOOS == "windows" {
		return "C:\\"
	}
	return "/"
}
