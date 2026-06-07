package config

import "log"

// Range bounds for clamping (documented rule: out-of-range values are clamped to
// valid bounds rather than rejecting the whole config — resilience over crash).
const (
	minIntervalMS = 100   // never poll faster than 10 Hz
	maxTempWarn   = 150.0 // °C
	maxPercent    = 100.0 // %
)

// clamp brings out-of-range values into valid bounds in place, logging each
// adjustment. A non-positive interval or absent version falls back to the default.
func clamp(c *Config) {
	d := Default()

	if c.Version <= 0 {
		log.Printf("WARNING config: version %d invalid; using %d", c.Version, d.Version)
		c.Version = d.Version
	}

	c.Telemetry.CPUIntervalMS = clampInterval("telemetry.cpu_interval_ms", c.Telemetry.CPUIntervalMS, d.Telemetry.CPUIntervalMS)
	c.Telemetry.GPUIntervalMS = clampInterval("telemetry.gpu_interval_ms", c.Telemetry.GPUIntervalMS, d.Telemetry.GPUIntervalMS)
	c.Telemetry.StorageIntervalMS = clampInterval("telemetry.storage_interval_ms", c.Telemetry.StorageIntervalMS, d.Telemetry.StorageIntervalMS)
	c.Media.PollIntervalMS = clampInterval("media.poll_interval_ms", c.Media.PollIntervalMS, d.Media.PollIntervalMS)

	c.Thresholds.CPUTempWarn = clampFloat("thresholds.cpu_temp_warn", c.Thresholds.CPUTempWarn, 0, maxTempWarn)
	c.Thresholds.GPUTempWarn = clampFloat("thresholds.gpu_temp_warn", c.Thresholds.GPUTempWarn, 0, maxTempWarn)
	c.Thresholds.RAMWarnPercent = clampFloat("thresholds.ram_warn_percent", c.Thresholds.RAMWarnPercent, 0, maxPercent)

	if c.Display.Theme == "" {
		c.Display.Theme = d.Display.Theme
	}
}

// clampInterval rejects a non-positive or sub-minimum interval, falling back to
// the default.
func clampInterval(name string, v, def int) int {
	if v < minIntervalMS {
		log.Printf("WARNING config: %s=%d below minimum %d; using default %d", name, v, minIntervalMS, def)
		return def
	}
	return v
}

func clampFloat(name string, v, lo, hi float64) float64 {
	switch {
	case v < lo:
		log.Printf("WARNING config: %s=%.1f below %.1f; clamping", name, v, lo)
		return lo
	case v > hi:
		log.Printf("WARNING config: %s=%.1f above %.1f; clamping", name, v, hi)
		return hi
	default:
		return v
	}
}
