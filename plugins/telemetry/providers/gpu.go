package providers

import (
	"sync"
	"time"

	"github.com/shishir/cyberdeck/engine/pal"
)

// gpuSnapshot is one coherent reading of a GPU. Each field carries its own ok flag
// because a source may expose some metrics but not others (e.g. a vendor that
// reports load/temp but never VRAM). A zero value means "nothing available".
type gpuSnapshot struct {
	load, temp, vramUsed, vramTotal         float64
	loadOK, tempOK, vramUsedOK, vramTotalOK bool
}

// gpuSource is one ordered GPU backend (NVIDIA, a vendor fallback, …). Sample
// returns a snapshot and ok=false when the source cannot serve a reading right now.
// It is the capability T carried by the pal.Chain that selects the highest-available
// source.
type gpuSource interface {
	// sample reads the current GPU metrics. ok=false means the source is
	// momentarily unable to serve (the chain treats the reading as unavailable).
	sample() (gpuSnapshot, bool)
}

// gpuSourceProvider adapts a gpuSource into a pal.Provider so it can take part in a
// pal.Chain (highest-available-source → vendor → unavailable). Probe must be cheap
// and side-effect-free per the PAL contract, so detectors are constructed up front
// and Probe just reports the cached detection result.
type gpuSourceProvider struct {
	name      string
	available bool
	src       gpuSource
}

func (p gpuSourceProvider) Name() string          { return p.name }
func (p gpuSourceProvider) Probe() bool           { return p.available }
func (p gpuSourceProvider) Capability() gpuSource { return p.src }

// gpuProviders is the ordered set of GPU sources, highest priority first. Detection
// (the relatively expensive part) happens once here; nil entries are skipped so an
// empty chain — and thus a cleanly unavailable GPU capability — is the natural
// result on machines without a supported GPU.
func gpuProviders() []pal.Provider[gpuSource] {
	var ps []pal.Provider[gpuSource]
	if src, ok := detectNvidia(); ok {
		ps = append(ps, gpuSourceProvider{name: "nvidia-smi", available: true, src: src})
	}
	// Future vendors (AMD/Intel) slot in here as additional providers.
	return ps
}

// gpuCapability is the pal.GPU surfaced to the publisher. It is backed by a
// pal.Chain of GPU sources and a short-TTL snapshot cache so a publish tick that
// reads Load/Temp/VRAM does not re-sample the underlying source four times.
type gpuCapability struct {
	chain *pal.Chain[gpuSource]
	ttl   time.Duration

	mu       sync.Mutex
	cached   gpuSnapshot
	cachedOK bool
	last     time.Time
	primed   bool
}

// NewGPU builds the GPU telemetry capability by binding the highest-available GPU
// source through the PAL provider chain. On a machine with no supported GPU the
// chain binds nothing and every read returns ok=false ("--"), with no crash.
func NewGPU() pal.GPU {
	return newGPU(pal.NewChain(gpuProviders()...), 500*time.Millisecond)
}

func newGPU(chain *pal.Chain[gpuSource], ttl time.Duration) *gpuCapability {
	chain.Bind()
	return &gpuCapability{chain: chain, ttl: ttl}
}

// Compile-time assertion that the capability satisfies the PAL surface.
var _ pal.GPU = (*gpuCapability)(nil)

// snapshot returns the current (possibly cached) reading. When the bound source
// faults, it re-probes the chain once (degrading to unavailable if nothing else can
// serve) so a removed/disabled GPU does not wedge the capability.
func (g *gpuCapability) snapshot() (gpuSnapshot, bool) {
	g.mu.Lock()
	defer g.mu.Unlock()

	now := time.Now()
	if g.primed && now.Sub(g.last) < g.ttl {
		return g.cached, g.cachedOK
	}
	g.last = now
	g.primed = true

	src, ok := g.chain.Capability()
	if ok {
		if snap, sok := src.sample(); sok {
			g.cached, g.cachedOK = snap, true
			return g.cached, true
		}
		// Bound source faulted; re-probe the chain for a healthier one.
		g.chain.Rebind()
		if src, ok = g.chain.Capability(); ok {
			if snap, sok := src.sample(); sok {
				g.cached, g.cachedOK = snap, true
				return g.cached, true
			}
		}
	}
	g.cached, g.cachedOK = gpuSnapshot{}, false
	return g.cached, false
}

func (g *gpuCapability) Load() (float64, bool) {
	s, ok := g.snapshot()
	return s.load, ok && s.loadOK
}

func (g *gpuCapability) Temp() (float64, bool) {
	s, ok := g.snapshot()
	return s.temp, ok && s.tempOK
}

func (g *gpuCapability) VRAMUsed() (float64, bool) {
	s, ok := g.snapshot()
	return s.vramUsed, ok && s.vramUsedOK
}

func (g *gpuCapability) VRAMTotal() (float64, bool) {
	s, ok := g.snapshot()
	return s.vramTotal, ok && s.vramTotalOK
}
