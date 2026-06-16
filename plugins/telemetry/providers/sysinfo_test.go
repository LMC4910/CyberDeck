package providers

import "testing"

// TestSystemInfoReportsHostDetails proves the gopsutil-backed SystemInfo() returns
// real, non-empty host details (used to drive the "Detailed System Info" card).
// Tolerant of fields a sandbox can't read, but RAM total is reliably available.
func TestSystemInfoReportsHostDetails(t *testing.T) {
	info := New().SystemInfo()
	if len(info) == 0 {
		t.Fatal("SystemInfo returned no details")
	}
	for k, v := range info {
		if s, ok := v.(string); !ok || s == "" {
			t.Errorf("%s = %v (%T), want a non-empty string", k, v, v)
		}
	}
	if _, ok := info["ram"]; !ok {
		t.Error("expected a 'ram' entry in SystemInfo")
	}
}
