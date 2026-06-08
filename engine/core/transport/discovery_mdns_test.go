package transport

import (
	"context"
	"io"
	"testing"
	"time"
)

func sampleAdvertisement() Advertisement {
	return Advertisement{
		Name:        "Shishir's Engine",
		UUID:        "11111111-2222-3333-4444-555555555555",
		Version:     "1.0.0",
		Fingerprint: "abc123def456",
		Port:        47600,
	}
}

func TestEncodeParseTXTRoundTrip(t *testing.T) {
	adv := sampleAdvertisement()
	got, err := parseTXT(encodeTXT(adv), "192.168.1.50", adv.Port)
	if err != nil {
		t.Fatalf("parseTXT: %v", err)
	}
	want := DiscoveredEngine{
		Name: adv.Name, UUID: adv.UUID, Version: adv.Version,
		Fingerprint: adv.Fingerprint, Host: "192.168.1.50", Port: adv.Port,
	}
	if got != want {
		t.Errorf("round-trip = %+v, want %+v", got, want)
	}
}

func TestParseTXTRequiresUUIDAndFingerprint(t *testing.T) {
	cases := map[string][]string{
		"missing uuid": {"name=x", "ver=1", "fp=ff"},
		"missing fp":   {"name=x", "uuid=u", "ver=1"},
		"empty":        {},
	}
	for name, txt := range cases {
		if _, err := parseTXT(txt, "h", 1); err == nil {
			t.Errorf("%s: expected error, got nil", name)
		}
	}
}

func TestParseTXTIgnoresUnknownAndMalformedKeys(t *testing.T) {
	txt := []string{"uuid=u", "fp=ff", "future=whatever", "noequalsign", "name=N"}
	got, err := parseTXT(txt, "h", 5)
	if err != nil {
		t.Fatalf("parseTXT: %v", err)
	}
	if got.UUID != "u" || got.Fingerprint != "ff" || got.Name != "N" {
		t.Errorf("unexpected parse: %+v", got)
	}
}

func TestDiscoveredEngineEndpoint(t *testing.T) {
	d := DiscoveredEngine{UUID: "u", Fingerprint: "ff", Host: "10.0.0.2", Port: 47600}
	info := d.Endpoint().Describe()
	if info.Kind != KindLAN {
		t.Errorf("kind = %q, want %q", info.Kind, KindLAN)
	}
	if info.Source != SourceMDNS {
		t.Errorf("source = %q, want %q", info.Source, SourceMDNS)
	}
	if info.Address != "10.0.0.2:47600" {
		t.Errorf("address = %q, want 10.0.0.2:47600", info.Address)
	}
}

// --- in-memory advertise→browse round-trip through the Advertiser/Browser seams,
// exercising the real TXT codec without multicast. ---

type memBus struct {
	txt  []string
	host string
	port int
}

type nopCloser struct{}

func (nopCloser) Close() error { return nil }

type memAdvertiser struct{ bus *memBus }

func (a memAdvertiser) Advertise(_ context.Context, adv Advertisement) (io.Closer, error) {
	a.bus.txt = encodeTXT(adv)
	a.bus.host = "127.0.0.1"
	a.bus.port = adv.Port
	return nopCloser{}, nil
}

type memBrowser struct{ bus *memBus }

func (b memBrowser) Browse(context.Context, time.Duration) ([]DiscoveredEngine, error) {
	if b.bus.txt == nil {
		return nil, nil
	}
	d, err := parseTXT(b.bus.txt, b.bus.host, b.bus.port)
	if err != nil {
		return nil, err
	}
	return []DiscoveredEngine{d}, nil
}

// compile-time: the fakes satisfy the real seams.
var (
	_ Advertiser = memAdvertiser{}
	_ Browser    = memBrowser{}
)

func TestInMemoryAdvertiseBrowseRoundTrip(t *testing.T) {
	bus := &memBus{}
	adv := sampleAdvertisement()

	closer, err := memAdvertiser{bus}.Advertise(context.Background(), adv)
	if err != nil {
		t.Fatalf("advertise: %v", err)
	}
	defer func() { _ = closer.Close() }()

	got, err := memBrowser{bus}.Browse(context.Background(), time.Second)
	if err != nil {
		t.Fatalf("browse: %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("discovered %d engines, want 1", len(got))
	}
	if got[0].UUID != adv.UUID || got[0].Fingerprint != adv.Fingerprint || got[0].Name != adv.Name {
		t.Errorf("discovered = %+v", got[0])
	}
}

// TestZeroconfAdvertiseBrowseRealNetwork is the best-effort real-multicast
// round-trip. Many CI/dev networks block multicast, so a no-result run skips rather
// than fails; where multicast works it verifies the real advertise→browse path and
// TXT correctness.
func TestZeroconfAdvertiseBrowseRealNetwork(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping real-multicast discovery test in -short mode")
	}
	adv := sampleAdvertisement()
	adv.UUID = "real-roundtrip-" + time.Now().Format("150405.000")

	closer, err := NewAdvertiser().Advertise(context.Background(), adv)
	if err != nil {
		t.Skipf("cannot advertise on this host (no multicast?): %v", err)
	}
	defer func() { _ = closer.Close() }()

	found, err := NewBrowser().Browse(context.Background(), 3*time.Second)
	if err != nil {
		t.Skipf("browse failed (no multicast?): %v", err)
	}
	for _, e := range found {
		if e.UUID == adv.UUID {
			if e.Fingerprint != adv.Fingerprint {
				t.Errorf("discovered fp = %q, want %q", e.Fingerprint, adv.Fingerprint)
			}
			return // round-trip verified
		}
	}
	t.Skip("own advertisement not observed within timeout (multicast likely blocked)")
}
