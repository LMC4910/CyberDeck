package pal

// Telemetry is the system-telemetry capability (2G). Every method follows the
// (value, ok) convention: ok=false means that metric is currently unavailable on
// this platform/provider (the bound state reads "--"). The first-party telemetry
// plugin (PROJ-171, gopsutil provider) implements this; the GPU provider chain is
// PROJ-172.
type Telemetry interface {
	CPUPercent() (float64, bool)      // total CPU utilisation %
	MemUsedPercent() (float64, bool)  // RAM used %
	NetThroughput() (float64, bool)   // bytes/sec aggregate
	DiskUsedPercent() (float64, bool) // primary volume used %
	UptimeSeconds() (float64, bool)   // host uptime
}
