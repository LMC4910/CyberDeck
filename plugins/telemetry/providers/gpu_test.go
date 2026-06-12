package providers

import (
	"testing"
	"time"

	"github.com/shishir/cyberdeck/engine/pal"
)

// fakeSource is a controllable gpuSource for chain/capability tests.
type fakeSource struct {
	snap gpuSnapshot
	ok   bool
}

func (f *fakeSource) sample() (gpuSnapshot, bool) { return f.snap, f.ok }

func availSnap() gpuSnapshot {
	return gpuSnapshot{
		load: 42, temp: 71, vramUsed: 3 << 30, vramTotal: 8 << 30,
		loadOK: true, tempOK: true, vramUsedOK: true, vramTotalOK: true,
	}
}

// TestGPUSelectsHighestAvailableSource proves the chain binds the first available
// provider and the capability serves its readings (highest-available-source rule).
func TestGPUSelectsHighestAvailableSource(t *testing.T) {
	primary := &fakeSource{snap: availSnap(), ok: true}
	vendor := &fakeSource{snap: gpuSnapshot{load: 1, loadOK: true}, ok: true}
	chain := pal.NewChain[gpuSource](
		gpuSourceProvider{name: "primary", available: true, src: primary},
		gpuSourceProvider{name: "vendor", available: true, src: vendor},
	)
	g := newGPU(chain, time.Hour)

	if got := chain.BoundName(); got != "primary" {
		t.Fatalf("bound %q, want primary (highest priority)", got)
	}
	if v, ok := g.Load(); !ok || v != 42 {
		t.Errorf("Load = (%v,%v), want (42,true)", v, ok)
	}
	if v, ok := g.Temp(); !ok || v != 71 {
		t.Errorf("Temp = (%v,%v), want (71,true)", v, ok)
	}
}

// TestGPUFallsBackToVendor proves an unavailable primary is skipped so a lower
// vendor source is selected (highest-available-source → vendor).
func TestGPUFallsBackToVendor(t *testing.T) {
	vendor := &fakeSource{snap: gpuSnapshot{load: 7, loadOK: true}, ok: true}
	chain := pal.NewChain[gpuSource](
		gpuSourceProvider{name: "primary", available: false},
		gpuSourceProvider{name: "vendor", available: true, src: vendor},
	)
	g := newGPU(chain, time.Hour)

	if got := chain.BoundName(); got != "vendor" {
		t.Fatalf("bound %q, want vendor (primary unavailable)", got)
	}
	if v, ok := g.Load(); !ok || v != 7 {
		t.Errorf("Load = (%v,%v), want (7,true)", v, ok)
	}
}

// TestGPUUnavailableDegradesCleanly proves a chain that binds nothing (no supported
// GPU) yields ok=false on every read and never panics — the "--" path.
func TestGPUUnavailableDegradesCleanly(t *testing.T) {
	g := newGPU(pal.NewChain[gpuSource](), time.Hour)

	for name, read := range map[string]func() (float64, bool){
		"Load":      g.Load,
		"Temp":      g.Temp,
		"VRAMUsed":  g.VRAMUsed,
		"VRAMTotal": g.VRAMTotal,
	} {
		if v, ok := read(); ok || v != 0 {
			t.Errorf("%s = (%v,%v), want (0,false) when no GPU", name, v, ok)
		}
	}
	// NewGPU on the real (likely GPU-less CI) host must also not panic and must
	// honour the (value, ok) contract.
	real := NewGPU()
	if v, ok := real.Temp(); ok && (v < 0 || v > 200) {
		t.Errorf("real GPU Temp = %v out of plausible range", v)
	}
}

// TestGPUSnapshotCachedWithinTTL proves Load/Temp/VRAM within one tick do not
// re-sample the source four times (a single coherent snapshot per TTL window).
func TestGPUSnapshotCachedWithinTTL(t *testing.T) {
	src := &countingSource{snap: availSnap(), ok: true}
	chain := pal.NewChain[gpuSource](gpuSourceProvider{name: "x", available: true, src: src})
	g := newGPU(chain, time.Hour)

	g.Load() // primes the snapshot cache (one sample)
	base := src.calls
	g.Temp()
	g.VRAMUsed()
	g.VRAMTotal()
	g.Load()
	if got := src.calls - base; got != 0 {
		t.Errorf("reads within TTL triggered %d extra samples, want 0 (cached)", got)
	}
}

// TestGPURebindsOnFault proves a bound source that starts faulting causes a re-probe
// that degrades to unavailable when nothing healthier can serve.
func TestGPURebindsOnFault(t *testing.T) {
	src := &fakeSource{snap: availSnap(), ok: true}
	chain := pal.NewChain[gpuSource](gpuSourceProvider{name: "x", available: true, src: src})
	g := newGPU(chain, 0) // ttl=0 → every read re-samples

	if _, ok := g.Load(); !ok {
		t.Fatal("Load ok=false while source healthy")
	}
	src.ok = false // GPU pulled / driver stops answering
	if _, ok := g.Load(); ok {
		t.Error("Load ok=true after source faulted with no fallback")
	}
}

// countingSource counts how many times it is sampled.
type countingSource struct {
	snap  gpuSnapshot
	ok    bool
	calls int
}

func (c *countingSource) sample() (gpuSnapshot, bool) {
	c.calls++
	return c.snap, c.ok
}
