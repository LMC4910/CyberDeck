package providers

import "testing"

// TestGopsutilSmoke exercises the real provider: every method must return without
// panicking and honour the (value, ok) contract. Uptime and memory are reliable on
// any host that runs the test suite, so we assert them; CPU/net/disk are only
// required not to panic (they may be momentarily unavailable in constrained CI).
func TestGopsutilSmoke(t *testing.T) {
	p := New()

	if v, ok := p.UptimeSeconds(); !ok || v <= 0 {
		t.Errorf("UptimeSeconds() = (%v, %v), want positive and ok", v, ok)
	}
	if v, ok := p.MemUsedPercent(); !ok || v <= 0 || v > 100 {
		t.Errorf("MemUsedPercent() = (%v, %v), want (0,100] and ok", v, ok)
	}

	// Must not panic; values only validated when reported available.
	if v, ok := p.CPUPercent(); ok && (v < 0 || v > 100) {
		t.Errorf("CPUPercent() = %v out of range", v)
	}
	if v, ok := p.DiskUsedPercent(); ok && (v < 0 || v > 100) {
		t.Errorf("DiskUsedPercent() = %v out of range", v)
	}
	if v, ok := p.NetThroughput(); ok && v < 0 {
		t.Errorf("NetThroughput() = %v, want >= 0", v)
	}
}
