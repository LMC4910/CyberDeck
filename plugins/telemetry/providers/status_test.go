package providers

import (
	"strings"
	"testing"
)

func TestNetworkStatusReportsConnectivity(t *testing.T) {
	s, ok := New().NetworkStatus()
	if !ok {
		t.Fatal("NetworkStatus reported unavailable")
	}
	if s != "Connected" && s != "Disconnected" {
		t.Errorf("NetworkStatus = %q, want Connected/Disconnected", s)
	}
}

func TestStorageFreeReportsText(t *testing.T) {
	s, ok := New().StorageFree()
	if !ok || s == "" {
		t.Fatalf("StorageFree returned (%q, %v), want non-empty + ok", s, ok)
	}
	if !strings.HasSuffix(s, "Free") {
		t.Errorf("StorageFree = %q, want a '... Free' string", s)
	}
}

func TestParsePingMs(t *testing.T) {
	cases := map[string]float64{
		"Reply from 1.1.1.1: bytes=32 time=12ms TTL=56":        12,
		"64 bytes from 1.1.1.1: icmp_seq=1 ttl=56 time=12.3 ms": 12.3,
		"Reply from 1.1.1.1: bytes=32 time<1ms TTL=56":          1,
	}
	for in, want := range cases {
		if got, ok := parsePingMs(in); !ok || got != want {
			t.Errorf("parsePingMs(%q) = (%v, %v), want (%v, true)", in, got, ok, want)
		}
	}
	if _, ok := parsePingMs("Request timed out."); ok {
		t.Error("a timeout line should not parse")
	}
}
