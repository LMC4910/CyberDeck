package transport

import (
	"context"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// fakeProbe answers Probe from an in-memory address→uuid table, so the scan opens no
// real sockets. It records every probed address and can simulate per-probe latency.
type fakeProbe struct {
	mu      sync.Mutex
	byAddr  map[string]string // address -> uuid for engines that exist
	probed  []string
	inFlt   int32
	maxInFl int32
	delay   time.Duration
}

func (p *fakeProbe) Probe(ctx context.Context, address string) (string, error) {
	cur := atomic.AddInt32(&p.inFlt, 1)
	for {
		old := atomic.LoadInt32(&p.maxInFl)
		if cur <= old || atomic.CompareAndSwapInt32(&p.maxInFl, old, cur) {
			break
		}
	}
	defer atomic.AddInt32(&p.inFlt, -1)

	p.mu.Lock()
	p.probed = append(p.probed, address)
	uuid, ok := p.byAddr[address]
	p.mu.Unlock()

	if p.delay > 0 {
		if err := sleepCtx(ctx, p.delay); err != nil {
			return "", err
		}
	}
	if !ok {
		return "", context.DeadlineExceeded // unreachable host
	}
	return uuid, nil
}

func (p *fakeProbe) probedCount() int {
	p.mu.Lock()
	defer p.mu.Unlock()
	return len(p.probed)
}

// fakeClock is a manual clock + sleep that advances virtual time on each sleep, so
// rate-limiting is tested deterministically with no wall-clock delay.
type fakeClock struct {
	mu        sync.Mutex
	t         time.Time
	totalWait time.Duration
}

func newFakeClock() *fakeClock { return &fakeClock{t: time.Unix(0, 0)} }

func (c *fakeClock) now() time.Time {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.t
}

func (c *fakeClock) sleep(_ context.Context, d time.Duration) error {
	c.mu.Lock()
	c.t = c.t.Add(d)
	c.totalWait += d
	c.mu.Unlock()
	return nil
}

func (c *fakeClock) waited() time.Duration {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.totalWait
}

const scanUUID = "11111111-2222-3333-4444-555555555555"

// --- tests ---

// TestScanRelocatesEngineByUUID is the headline behaviour: the engine moved to a new
// IP within the subnet; the scan finds it by UUID and returns a SourceActiveScan
// endpoint pointing at the NEW address.
func TestScanRelocatesEngineByUUID(t *testing.T) {
	probe := &fakeProbe{byAddr: map[string]string{
		"192.168.1.77:47600": scanUUID, // engine relocated here (was .50)
	}}
	clock := newFakeClock()
	s := NewActiveScanner(probe, ScanConfig{CIDR: "192.168.1.0/24"},
		withScanClock(clock.now, clock.sleep))

	eps, err := s.Scan(context.Background(), scanUUID)
	if err != nil {
		t.Fatalf("Scan: %v", err)
	}
	if len(eps) != 1 {
		t.Fatalf("found %d endpoints, want 1", len(eps))
	}
	info := eps[0].Describe()
	if info.Source != SourceActiveScan {
		t.Errorf("source = %s, want active-scan", info.Source)
	}
	if info.Kind != KindLAN {
		t.Errorf("kind = %q, want lan", info.Kind)
	}
	if info.Address != "192.168.1.77:47600" {
		t.Errorf("address = %q, want 192.168.1.77:47600", info.Address)
	}
}

// TestScanIgnoresOtherEngines: hosts that answer with a DIFFERENT uuid are not matched.
func TestScanIgnoresOtherEngines(t *testing.T) {
	probe := &fakeProbe{byAddr: map[string]string{
		"192.168.1.10:47600": "some-other-engine",
		"192.168.1.20:47600": scanUUID,
		"192.168.1.30:47600": "yet-another",
	}}
	clock := newFakeClock()
	s := NewActiveScanner(probe, ScanConfig{CIDR: "192.168.1.0/24"},
		withScanClock(clock.now, clock.sleep))

	eps, err := s.Scan(context.Background(), scanUUID)
	if err != nil {
		t.Fatalf("Scan: %v", err)
	}
	if len(eps) != 1 || eps[0].Describe().Address != "192.168.1.20:47600" {
		t.Fatalf("got %+v, want only 192.168.1.20:47600", eps)
	}
}

// TestScanNoMatchReturnsEmpty: a subnet with no matching engine yields no endpoints
// (and no error) — the resolver simply contributes nothing.
func TestScanNoMatchReturnsEmpty(t *testing.T) {
	probe := &fakeProbe{byAddr: map[string]string{}}
	clock := newFakeClock()
	s := NewActiveScanner(probe, ScanConfig{CIDR: "10.0.0.0/29"},
		withScanClock(clock.now, clock.sleep))

	eps, err := s.Scan(context.Background(), scanUUID)
	if err != nil {
		t.Fatalf("Scan: %v", err)
	}
	if len(eps) != 0 {
		t.Errorf("found %d endpoints, want 0", len(eps))
	}
}

// TestScanRateLimitRespected: with a MinInterval and N hosts, the limiter must have
// inserted at least (N-1) intervals of wait — i.e. probes are spaced, never bursted.
func TestScanRateLimitRespected(t *testing.T) {
	const minInterval = 10 * time.Millisecond
	// /28 = 16 addresses → 14 usable hosts after trimming network+broadcast.
	probe := &fakeProbe{byAddr: map[string]string{}}
	clock := newFakeClock()
	s := NewActiveScanner(probe,
		ScanConfig{CIDR: "192.168.5.0/28", MinInterval: minInterval},
		withScanClock(clock.now, clock.sleep))

	if _, err := s.Scan(context.Background(), scanUUID); err != nil {
		t.Fatalf("Scan: %v", err)
	}
	hosts := probe.probedCount()
	if hosts != 14 {
		t.Fatalf("probed %d hosts, want 14 (usable hosts in /28)", hosts)
	}
	// The first acquire is free; each of the remaining (hosts-1) waits one interval.
	wantWait := time.Duration(hosts-1) * minInterval
	if clock.waited() != wantWait {
		t.Errorf("total rate-limit wait = %v, want %v", clock.waited(), wantWait)
	}
}

// TestScanConcurrencyBounded: in-flight probes never exceed the configured concurrency.
func TestScanConcurrencyBounded(t *testing.T) {
	probe := &fakeProbe{byAddr: map[string]string{}, delay: 2 * time.Millisecond}
	// No rate-limit spacing here so concurrency is actually exercised.
	s := NewActiveScanner(probe, ScanConfig{
		CIDR:        "192.168.9.0/27", // 30 usable hosts
		Concurrency: 4,
		MinInterval: -1, // disable spacing
	})

	if _, err := s.Scan(context.Background(), scanUUID); err != nil {
		t.Fatalf("Scan: %v", err)
	}
	if got := atomic.LoadInt32(&probe.maxInFl); got > 4 {
		t.Errorf("max in-flight probes = %d, want <= 4 (concurrency bound)", got)
	}
}

// TestScanRequiresTargetUUID: an empty target uuid is rejected (no untargeted sweeps).
func TestScanRequiresTargetUUID(t *testing.T) {
	s := NewActiveScanner(&fakeProbe{}, ScanConfig{CIDR: "10.0.0.0/30"})
	if _, err := s.Scan(context.Background(), ""); err == nil {
		t.Error("Scan with empty uuid = nil error, want error")
	}
}

// TestScanRejectsOversizeRange: a CIDR wider than the host bound is refused, so the
// scan can never become an unbounded sweep.
func TestScanRejectsOversizeRange(t *testing.T) {
	s := NewActiveScanner(&fakeProbe{}, ScanConfig{CIDR: "10.0.0.0/16"})
	if _, err := s.Scan(context.Background(), scanUUID); err == nil {
		t.Error("Scan over /16 = nil error, want oversize-range error")
	}
}

func TestEnumerateHostsTrimsNetworkAndBroadcast(t *testing.T) {
	hosts, err := enumerateHosts("192.168.1.0/30")
	if err != nil {
		t.Fatalf("enumerateHosts: %v", err)
	}
	// /30 = .0 .1 .2 .3 → usable .1 .2
	want := []string{"192.168.1.1", "192.168.1.2"}
	if len(hosts) != len(want) {
		t.Fatalf("got %v, want %v", hosts, want)
	}
	for i := range want {
		if hosts[i] != want[i] {
			t.Errorf("host[%d] = %s, want %s", i, hosts[i], want[i])
		}
	}
}

// TestScanResolverIsTransparentEndpointResolver: a ScanResolver plugged into the real
// ConnectionManager produces a session over the relocated engine, with NO manager
// awareness that the candidate came from a scan (TA-EP-1). Scan candidates sort last.
func TestScanResolverIsTransparentEndpointResolver(t *testing.T) {
	probe := &fakeProbe{byAddr: map[string]string{
		"172.16.0.5:47600": scanUUID,
	}}
	clock := newFakeClock()
	// Inject a fake-dialing endpoint factory so the manager exercises the scan
	// candidate without opening a real socket — the scan is transparent: the manager
	// sees a generic TransportEndpoint regardless of how the hit was found.
	scanner := NewActiveScanner(probe, ScanConfig{CIDR: "172.16.0.0/29"},
		withScanClock(clock.now, clock.sleep),
		withEndpointFactory(func(address string, source CandidateSource) TransportEndpoint {
			return &fakeEndpoint{
				info: EndpointInfo{Kind: KindLAN, Address: address, Source: source},
				conn: &fakeConn{},
			}
		}))
	resolver := NewScanResolver(scanner)

	hs := &fakeHandshaker{}
	m := NewManager(resolver, hs)
	sess, err := m.Open(context.Background(), scanUUID)
	if err != nil {
		t.Fatalf("Open via scan resolver: %v", err)
	}
	if sess.DeviceUUID() != scanUUID {
		t.Errorf("session uuid = %q, want %q", sess.DeviceUUID(), scanUUID)
	}
	if hs.calls != 1 {
		t.Errorf("handshake calls = %d, want 1", hs.calls)
	}
}

// compile-time: the fake probe satisfies the real seam.
var _ IdentityProbe = (*fakeProbe)(nil)
