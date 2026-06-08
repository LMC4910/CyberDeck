package transport

import (
	"context"
	"fmt"
	"io"
	"net"
	"strings"
	"sync"
	"time"

	"github.com/libp2p/zeroconf/v2"
)

// mDNS / DNS-SD discovery (2A §3 / FR-2.2). The engine advertises
// `_cyberdeck._tcp.local` with TXT {name, uuid, ver, fp}; clients browse to find
// engines. The TXT fingerprint (fp = engine pubkey fingerprint, PROJ-120) feeds the
// anti-MITM check at pairing. Discovery is the primary happy path but NOT a hard
// dependency — manual entry + active scan (PROJ-148) are the required fallbacks for
// multicast-blocked networks, so nothing here is on the critical connect path.

const (
	// ServiceType is the DNS-SD service type the engine advertises under.
	ServiceType = "_cyberdeck._tcp"
	// mdnsDomain is the multicast DNS domain.
	mdnsDomain = "local."
	// DefaultServicePort is the engine's default LAN listen port advertised in the
	// SRV record. The actual listener is wired with the connect path; advertising
	// the intended port here is sufficient for discovery.
	DefaultServicePort = 47600

	txtKeyName = "name"
	txtKeyUUID = "uuid"
	txtKeyVer  = "ver"
	txtKeyFP   = "fp"
)

// Advertisement is what the engine publishes about itself.
type Advertisement struct {
	Name        string // human-readable instance name
	UUID        string // engine UUID (PROJ-120)
	Version     string // engine version
	Fingerprint string // engine public-key fingerprint (anti-MITM)
	Port        int    // SRV port (defaults to DefaultServicePort if zero)
}

// DiscoveredEngine is an engine found while browsing.
type DiscoveredEngine struct {
	Name        string
	UUID        string
	Version     string
	Fingerprint string
	Host        string // resolved IP or hostname
	Port        int
}

// Endpoint maps a discovered engine onto a transport endpoint candidate tagged as
// mDNS-sourced (so it sorts after a last-known IP but before an active scan). This
// is the single bridge from discovery into the addressing layer — kind stays
// internal to this package (TA-EP-1).
func (d DiscoveredEngine) Endpoint() TransportEndpoint {
	return NewLanEndpoint(net.JoinHostPort(d.Host, fmt.Sprintf("%d", d.Port)), SourceMDNS)
}

// encodeTXT renders an advertisement as DNS-SD TXT key=value records.
func encodeTXT(adv Advertisement) []string {
	return []string{
		txtKeyName + "=" + adv.Name,
		txtKeyUUID + "=" + adv.UUID,
		txtKeyVer + "=" + adv.Version,
		txtKeyFP + "=" + adv.Fingerprint,
	}
}

// parseTXT decodes TXT records (plus the resolved host/port) into a discovered
// engine. Unknown keys are ignored; uuid and fp are required (a record without an
// identity/fingerprint is not a usable, anti-MITM-verifiable engine).
func parseTXT(txt []string, host string, port int) (DiscoveredEngine, error) {
	kv := make(map[string]string, len(txt))
	for _, entry := range txt {
		k, v, ok := strings.Cut(entry, "=")
		if !ok {
			continue
		}
		kv[k] = v
	}
	d := DiscoveredEngine{
		Name:        kv[txtKeyName],
		UUID:        kv[txtKeyUUID],
		Version:     kv[txtKeyVer],
		Fingerprint: kv[txtKeyFP],
		Host:        host,
		Port:        port,
	}
	if d.UUID == "" {
		return DiscoveredEngine{}, fmt.Errorf("transport: discovery TXT missing %q", txtKeyUUID)
	}
	if d.Fingerprint == "" {
		return DiscoveredEngine{}, fmt.Errorf("transport: discovery TXT missing %q", txtKeyFP)
	}
	return d, nil
}

// Advertiser publishes the engine on the LAN. The returned io.Closer stops the
// advertisement.
type Advertiser interface {
	Advertise(ctx context.Context, adv Advertisement) (io.Closer, error)
}

// Browser discovers engines on the LAN within the given duration.
type Browser interface {
	Browse(ctx context.Context, d time.Duration) ([]DiscoveredEngine, error)
}

// zeroconfAdvertiser is the real DNS-SD advertiser (github.com/libp2p/zeroconf).
type zeroconfAdvertiser struct{}

// NewAdvertiser returns the default mDNS advertiser.
func NewAdvertiser() Advertiser { return zeroconfAdvertiser{} }

func (zeroconfAdvertiser) Advertise(_ context.Context, adv Advertisement) (io.Closer, error) {
	port := adv.Port
	if port == 0 {
		port = DefaultServicePort
	}
	server, err := zeroconf.Register(adv.Name, ServiceType, mdnsDomain, port, encodeTXT(adv), nil)
	if err != nil {
		return nil, fmt.Errorf("transport: mdns register: %w", err)
	}
	return shutdownCloser{server}, nil
}

// shutdownCloser adapts *zeroconf.Server (Shutdown) to io.Closer.
type shutdownCloser struct{ s *zeroconf.Server }

func (c shutdownCloser) Close() error {
	c.s.Shutdown()
	return nil
}

// zeroconfBrowser is the real DNS-SD browser.
type zeroconfBrowser struct{}

// NewBrowser returns the default mDNS browser.
func NewBrowser() Browser { return zeroconfBrowser{} }

func (zeroconfBrowser) Browse(ctx context.Context, d time.Duration) ([]DiscoveredEngine, error) {
	ctx, cancel := context.WithTimeout(ctx, d)
	defer cancel()

	entries := make(chan *zeroconf.ServiceEntry, 8)
	var (
		mu      sync.Mutex
		found   []DiscoveredEngine
		collect sync.WaitGroup
	)
	collect.Add(1)
	go func() {
		defer collect.Done()
		for e := range entries {
			host := entryHost(e)
			if host == "" {
				continue
			}
			eng, err := parseTXT(e.Text, host, e.Port)
			if err != nil {
				continue // ignore non-CyberDeck / malformed responders
			}
			mu.Lock()
			found = append(found, eng)
			mu.Unlock()
		}
	}()

	if err := zeroconf.Browse(ctx, ServiceType, mdnsDomain, entries); err != nil {
		return nil, fmt.Errorf("transport: mdns browse: %w", err)
	}
	collect.Wait() // Browse closes entries when ctx expires
	return found, nil
}

// entryHost picks the best address for a discovered service: first IPv4, else IPv6,
// else the hostname.
func entryHost(e *zeroconf.ServiceEntry) string {
	if len(e.AddrIPv4) > 0 {
		return e.AddrIPv4[0].String()
	}
	if len(e.AddrIPv6) > 0 {
		return e.AddrIPv6[0].String()
	}
	return strings.TrimSuffix(e.HostName, ".")
}

// MDNSService adapts an Advertiser to the lifecycle Service seam (Start/Stop) so the
// boot "mDNS advertise" stage (PROJ-105) can advertise on start and withdraw on
// shutdown. It satisfies lifecycle.Service structurally (no import) to avoid coupling
// the transport package to the lifecycle package.
type MDNSService struct {
	adv Advertiser
	ad  Advertisement

	mu     sync.Mutex
	closer io.Closer
}

// NewMDNSService builds the boot-stage advertiser service.
func NewMDNSService(adv Advertiser, ad Advertisement) *MDNSService {
	return &MDNSService{adv: adv, ad: ad}
}

// Start begins advertising.
func (s *MDNSService) Start(ctx context.Context) error {
	c, err := s.adv.Advertise(ctx, s.ad)
	if err != nil {
		return err
	}
	s.mu.Lock()
	s.closer = c
	s.mu.Unlock()
	return nil
}

// Stop withdraws the advertisement.
func (s *MDNSService) Stop(context.Context) error {
	s.mu.Lock()
	c := s.closer
	s.closer = nil
	s.mu.Unlock()
	if c == nil {
		return nil
	}
	return c.Close()
}
