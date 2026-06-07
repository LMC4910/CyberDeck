// Package config loads and validates the engine's non-secret config.json (Doc 0
// §16). It is resilient by design: a missing or malformed file yields documented
// defaults with a logged warning — never a crash. Secrets are NEVER here (no token
// fields by construction); credentials live in the OS secret store (2E §7).
package config

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"log"
	"os"
)

// Config is the typed engine configuration.
type Config struct {
	Version    int              `json:"version"`
	Telemetry  TelemetryConfig  `json:"telemetry"`
	Media      MediaConfig      `json:"media"`
	SmartHome  SmartHomeConfig  `json:"smarthome"`
	Thresholds ThresholdsConfig `json:"thresholds"`
	Display    DisplayConfig    `json:"display"`
}

// TelemetryConfig holds polling cadences (milliseconds).
type TelemetryConfig struct {
	CPUIntervalMS     int `json:"cpu_interval_ms"`
	GPUIntervalMS     int `json:"gpu_interval_ms"`
	StorageIntervalMS int `json:"storage_interval_ms"`
}

// MediaConfig holds media polling settings.
type MediaConfig struct {
	PollIntervalMS int `json:"poll_interval_ms"`
}

// SmartHomeConfig holds the Home Assistant base URL. The HA *token* is NOT here —
// it lives in the OS secret store (2E §7).
type SmartHomeConfig struct {
	HABaseURL string `json:"ha_base_url"`
}

// ThresholdsConfig holds warning thresholds.
type ThresholdsConfig struct {
	CPUTempWarn    float64 `json:"cpu_temp_warn"`
	GPUTempWarn    float64 `json:"gpu_temp_warn"`
	RAMWarnPercent float64 `json:"ram_warn_percent"`
}

// DisplayConfig holds display preferences.
type DisplayConfig struct {
	Theme string `json:"theme"`
}

// Load reads and validates config.json at path. It always returns a usable
// Config: a missing file yields defaults (err nil, normal first run); a malformed
// file yields defaults plus a non-nil error (already logged) so the caller can
// surface it; out-of-range values are clamped to valid bounds. It never panics.
func Load(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if errors.Is(err, fs.ErrNotExist) {
		log.Printf("WARNING config: %q not found; using defaults", path)
		return Default(), nil
	}
	if err != nil {
		log.Printf("WARNING config: cannot read %q (%v); using defaults", path, err)
		return Default(), fmt.Errorf("config: read %q: %w", path, err)
	}

	var cfg Config
	if err := json.Unmarshal(data, &cfg); err != nil {
		log.Printf("WARNING config: %q is malformed (%v); using defaults", path, err)
		return Default(), fmt.Errorf("config: parse %q: %w", path, err)
	}

	clamp(&cfg)
	return &cfg, nil
}
