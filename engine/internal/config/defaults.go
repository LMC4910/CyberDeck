package config

// Default returns the documented default configuration (Doc 0 §16). Used on a
// missing/malformed config and as the baseline for clamping.
func Default() *Config {
	return &Config{
		Version: 1,
		Telemetry: TelemetryConfig{
			CPUIntervalMS:     1000,
			GPUIntervalMS:     2000,
			StorageIntervalMS: 5000,
		},
		Media:      MediaConfig{PollIntervalMS: 1000},
		SmartHome:  SmartHomeConfig{HABaseURL: ""},
		Thresholds: ThresholdsConfig{CPUTempWarn: 85, GPUTempWarn: 85, RAMWarnPercent: 90},
		Display:    DisplayConfig{Theme: "cyberpunk"},
	}
}
