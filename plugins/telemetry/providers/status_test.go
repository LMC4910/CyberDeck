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
