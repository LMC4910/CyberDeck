package transport

import (
	"context"
	"fmt"
	"net"
	"sort"
	"sync"
	"time"
)

// Bounded active scan (2A §2 / FR-2.2, PROJ-148). When mDNS is blocked and the
// last-known IP has gone stale (DHCP moved the engine), the device can still find a
// KNOWN engine by sweeping the local subnet and probing each host's identity for the
// expected UUID. This is the lowest-priority discovery source: every hit is tagged
// SourceActiveScan, so orderCandidates sorts it AFTER last-known-IP and mDNS, and the
// ConnectionManager treats a scan-found endpoint identically to any other — the scan
// is entirely transparent above the resolver seam (TA-EP-1).
//
// The scan is deliberately polite: it is bounded to a single /24-class host range,
// caps the number of concurrent probes, and spaces probe launches by a minimum
// interval so it never floods the LAN. A probe that does not answer with the engine's
// identity within its timeout is simply dropped.

const (
	// DefaultScanConcurrency bounds how many host probes are in flight at once.
	DefaultScanConcurrency = 16
	// DefaultScanProbeTimeout bounds a single host's connect+identity probe.
	DefaultScanProbeTimeout = 400 * time.Millisecond
	// DefaultScanMinInterval is the minimum spacing between probe launches, so the
	// scan stays rate-limited regardless of concurrency.
	DefaultScanMinInterval = 5 * time.Millisecond
	// maxScanHosts caps the host range a single scan will sweep, so a misconfigured
	// or hostile CIDR can never turn into an unbounded sweep.
	maxScanHosts = 256
)

// IdentityProbe reports the engine UUID reachable at host:port, or an error if the
// host is unreachable / is not a CyberDeck engine within the timeout. It is the one
// seam the scan needs to talk to the network, so tests inject an in-memory probe and
// no real sockets are opened. The real implementation does a bounded connect plus a
// lightweight pre-handshake identity read (the engine answers with its UUID before any
// secret material changes hands).
type IdentityProbe interface {
	Probe(ctx context.Context, address string) (uuid string, err error)
}

// ScanConfig bounds an active scan.
type ScanConfig struct {
	// CIDR is the subnet to sweep (e.g. "192.168.1.0/24"). Required.
	CIDR string
	// Port is the engine port probed on each host (defaults to DefaultServicePort).
	Port int
	// Concurrency bounds in-flight probes (defaults to DefaultScanConcurrency).
	Concurrency int
	// ProbeTimeout bounds each probe (defaults to DefaultScanProbeTimeout).
	ProbeTimeout time.Duration
	// MinInterval is the minimum spacing between probe launches (defaults to
	// DefaultScanMinInterval); the rate limiter that keeps the sweep polite.
	MinInterval time.Duration
}

func (c ScanConfig) withDefaults() ScanConfig {
	if c.Port == 0 {
		c.Port = DefaultServicePort
	}
	if c.Concurrency <= 0 {
		c.Concurrency = DefaultScanConcurrency
	}
	if c.ProbeTimeout <= 0 {
		c.ProbeTimeout = DefaultScanProbeTimeout
	}
	if c.MinInterval < 0 {
		c.MinInterval = DefaultScanMinInterval
	}
	return c
}

// limiter spaces successive Acquire() calls by at least minInterval. It is the rate
// limiter that keeps the scan from flooding the LAN; injecting the clock keeps tests
// deterministic and fast.
type limiter struct {
	minInterval time.Duration
	now         func() time.Time
	sleep       func(context.Context, time.Duration) error

	mu   sync.Mutex
	next time.Time
}

func newLimiter(minInterval time.Duration, now func() time.Time, sleep func(context.Context, time.Duration) error) *limiter {
	if now == nil {
		now = time.Now
	}
	if sleep == nil {
		sleep = sleepCtx
	}
	return &limiter{minInterval: minInterval, now: now, sleep: sleep}
}

// acquire blocks until at least minInterval has elapsed since the previous acquire,
// then reserves the next slot. Returns ctx.Err() if the context ends while waiting.
func (l *limiter) acquire(ctx context.Context) error {
	if l.minInterval <= 0 {
		return ctx.Err()
	}
	l.mu.Lock()
	now := l.now()
	wait := time.Duration(0)
	if now.Before(l.next) {
		wait = l.next.Sub(now)
	}
	l.next = now.Add(wait).Add(l.minInterval)
	l.mu.Unlock()

	if wait <= 0 {
		return ctx.Err()
	}
	return l.sleep(ctx, wait)
}

// sleepCtx sleeps for d unless ctx ends first.
func sleepCtx(ctx context.Context, d time.Duration) error {
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-t.C:
		return nil
	}
}

// endpointFactory builds the TransportEndpoint for a scan hit. It defaults to
// NewLanEndpoint (a real dialing endpoint); injecting it lets tests assert the scan
// is transparent to the ConnectionManager without opening a real socket.
type endpointFactory func(address string, source CandidateSource) TransportEndpoint

func defaultEndpointFactory(address string, source CandidateSource) TransportEndpoint {
	return NewLanEndpoint(address, source)
}

// ActiveScanner locates a known engine by UUID across a bounded subnet (PROJ-148).
type ActiveScanner struct {
	probe  IdentityProbe
	cfg    ScanConfig
	lim    *limiter
	makeEP endpointFactory
}

// ScannerOption configures an ActiveScanner (used mainly by tests to inject a clock).
type ScannerOption func(*ActiveScanner)

// withScanClock injects the limiter's clock + sleep (test seam).
func withScanClock(now func() time.Time, sleep func(context.Context, time.Duration) error) ScannerOption {
	return func(s *ActiveScanner) {
		s.lim = newLimiter(s.cfg.MinInterval, now, sleep)
	}
}

// withEndpointFactory injects how scan hits become endpoints (test seam).
func withEndpointFactory(f endpointFactory) ScannerOption {
	return func(s *ActiveScanner) {
		if f != nil {
			s.makeEP = f
		}
	}
}

// NewActiveScanner builds a scanner over the given identity probe and config.
func NewActiveScanner(probe IdentityProbe, cfg ScanConfig, opts ...ScannerOption) *ActiveScanner {
	cfg = cfg.withDefaults()
	s := &ActiveScanner{
		probe:  probe,
		cfg:    cfg,
		lim:    newLimiter(cfg.MinInterval, nil, nil),
		makeEP: defaultEndpointFactory,
	}
	for _, o := range opts {
		o(s)
	}
	return s
}

// Scan sweeps the configured subnet for the engine whose identity matches wantUUID
// and returns SourceActiveScan endpoints for every matching host (usually one). It is
// rate-limited and concurrency-bounded; hosts that do not answer or whose UUID differs
// are dropped. Returns an empty (non-nil-error) slice when nothing matched.
func (s *ActiveScanner) Scan(ctx context.Context, wantUUID string) ([]TransportEndpoint, error) {
	if wantUUID == "" {
		return nil, fmt.Errorf("transport: active scan requires a target uuid")
	}
	hosts, err := enumerateHosts(s.cfg.CIDR)
	if err != nil {
		return nil, err
	}

	type hit struct{ address string }
	var (
		mu   sync.Mutex
		hits []hit
		wg   sync.WaitGroup
	)
	sem := make(chan struct{}, s.cfg.Concurrency)

scan:
	for _, host := range hosts {
		if ctx.Err() != nil {
			break
		}
		// Rate-limit BEFORE launching each probe: this is the one gate every probe
		// passes through, so concurrency never outruns MinInterval.
		if err := s.lim.acquire(ctx); err != nil {
			break
		}
		select {
		case sem <- struct{}{}:
		case <-ctx.Done():
			break scan
		}
		address := net.JoinHostPort(host, fmt.Sprintf("%d", s.cfg.Port))
		wg.Add(1)
		go func() {
			defer wg.Done()
			defer func() { <-sem }()

			pctx, cancel := context.WithTimeout(ctx, s.cfg.ProbeTimeout)
			defer cancel()
			gotUUID, err := s.probe.Probe(pctx, address)
			if err != nil || gotUUID != wantUUID {
				return
			}
			mu.Lock()
			hits = append(hits, hit{address: address})
			mu.Unlock()
		}()
	}
	wg.Wait()

	// Stable output: sort by address so a multi-NIC engine yields deterministic order.
	sort.Slice(hits, func(i, j int) bool { return hits[i].address < hits[j].address })
	eps := make([]TransportEndpoint, 0, len(hits))
	for _, h := range hits {
		eps = append(eps, s.makeEP(h.address, SourceActiveScan))
	}
	return eps, nil
}

// enumerateHosts expands a CIDR into its usable host addresses, bounded by
// maxScanHosts. The network and broadcast addresses of an IPv4 block are skipped.
func enumerateHosts(cidr string) ([]string, error) {
	if cidr == "" {
		return nil, fmt.Errorf("transport: active scan requires a CIDR")
	}
	ip, ipnet, err := net.ParseCIDR(cidr)
	if err != nil {
		return nil, fmt.Errorf("transport: active scan parse CIDR %q: %w", cidr, err)
	}
	var hosts []string
	for cur := cloneIP(ip.Mask(ipnet.Mask)); ipnet.Contains(cur); incIP(cur) {
		hosts = append(hosts, cur.String())
		if len(hosts) > maxScanHosts+2 { // +2 for the trimmed network/broadcast
			return nil, fmt.Errorf("transport: active scan range %q exceeds %d-host bound", cidr, maxScanHosts)
		}
	}
	// Trim IPv4 network + broadcast addresses for a /31-or-larger block.
	if ip.To4() != nil && len(hosts) >= 2 {
		hosts = hosts[1 : len(hosts)-1]
	}
	if len(hosts) > maxScanHosts {
		return nil, fmt.Errorf("transport: active scan range %q exceeds %d-host bound", cidr, maxScanHosts)
	}
	return hosts, nil
}

func cloneIP(ip net.IP) net.IP {
	out := make(net.IP, len(ip))
	copy(out, ip)
	return out
}

// incIP increments an IP address in place (big-endian).
func incIP(ip net.IP) {
	for i := len(ip) - 1; i >= 0; i-- {
		ip[i]++
		if ip[i] != 0 {
			break
		}
	}
}

// ScanResolver adapts an ActiveScanner to the EndpointResolver seam so the scan can be
// composed into the ConnectionManager's candidate pipeline transparently. It resolves
// a deviceUUID by scanning the configured subnet; the returned candidates carry the
// SourceActiveScan tag and therefore sort last. Compose it behind the locator/mDNS
// resolvers via a multiResolver so the scan only widens the candidate set.
type ScanResolver struct {
	scanner *ActiveScanner
}

// NewScanResolver wraps a scanner as an EndpointResolver.
func NewScanResolver(scanner *ActiveScanner) *ScanResolver {
	return &ScanResolver{scanner: scanner}
}

// Resolve scans the subnet for the device and returns its active-scan candidates.
func (r *ScanResolver) Resolve(ctx context.Context, deviceUUID string) ([]TransportEndpoint, error) {
	return r.scanner.Scan(ctx, deviceUUID)
}

// compile-time: ScanResolver is a drop-in EndpointResolver.
var _ EndpointResolver = (*ScanResolver)(nil)
