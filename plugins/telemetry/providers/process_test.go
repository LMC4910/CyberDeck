package providers

import "testing"

// TestTopProcessesReportsRunningProcesses proves the gopsutil process provider
// returns real running processes as {name, cpu} maps, capped at the top N.
func TestTopProcessesReportsRunningProcesses(t *testing.T) {
	procs, ok := New().TopProcesses()
	if !ok || len(procs) == 0 {
		t.Fatal("TopProcesses returned nothing")
	}
	if len(procs) > maxTopProcesses {
		t.Errorf("returned %d processes, want <= %d", len(procs), maxTopProcesses)
	}
	for _, p := range procs {
		if name, ok := p["name"].(string); !ok || name == "" {
			t.Errorf("process row missing a name: %v", p)
		}
		if _, ok := p["cpu"].(float64); !ok {
			t.Errorf("process row missing a cpu float: %v", p)
		}
	}
}
