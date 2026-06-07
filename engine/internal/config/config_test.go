package config

import (
	"os"
	"path/filepath"
	"reflect"
	"testing"

	"github.com/shishir/cyberdeck/engine/internal/secrets"
)

func writeTemp(t *testing.T, content string) string {
	t.Helper()
	p := filepath.Join(t.TempDir(), "config.json")
	if err := os.WriteFile(p, []byte(content), 0o600); err != nil {
		t.Fatalf("write temp config: %v", err)
	}
	return p
}

func TestLoadValid(t *testing.T) {
	p := writeTemp(t, `{
		"version": 2,
		"telemetry": {"cpu_interval_ms": 500, "gpu_interval_ms": 1500, "storage_interval_ms": 4000},
		"media": {"poll_interval_ms": 750},
		"smarthome": {"ha_base_url": "http://homeassistant.local:8123"},
		"thresholds": {"cpu_temp_warn": 80, "gpu_temp_warn": 75, "ram_warn_percent": 85},
		"display": {"theme": "neon"}
	}`)
	cfg, err := Load(p)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.Version != 2 || cfg.Telemetry.CPUIntervalMS != 500 || cfg.SmartHome.HABaseURL != "http://homeassistant.local:8123" ||
		cfg.Thresholds.CPUTempWarn != 80 || cfg.Display.Theme != "neon" {
		t.Errorf("loaded config unexpected: %+v", cfg)
	}
}

func TestLoadMissingUsesDefaults(t *testing.T) {
	cfg, err := Load(filepath.Join(t.TempDir(), "does-not-exist.json"))
	if err != nil {
		t.Fatalf("missing file should not error: %v", err)
	}
	if !reflect.DeepEqual(cfg, Default()) {
		t.Errorf("missing config = %+v, want defaults", cfg)
	}
}

func TestLoadMalformedUsesDefaults(t *testing.T) {
	p := writeTemp(t, `{ this is not valid json `)
	cfg, err := Load(p)
	if err == nil {
		t.Error("malformed config should return a (non-fatal) error")
	}
	if !reflect.DeepEqual(cfg, Default()) {
		t.Errorf("malformed config = %+v, want defaults (no crash)", cfg)
	}
}

func TestLoadClampsOutOfRange(t *testing.T) {
	p := writeTemp(t, `{
		"version": 0,
		"telemetry": {"cpu_interval_ms": 0, "gpu_interval_ms": 5, "storage_interval_ms": 5000},
		"media": {"poll_interval_ms": -10},
		"thresholds": {"cpu_temp_warn": 999, "gpu_temp_warn": -5, "ram_warn_percent": 250},
		"display": {"theme": ""}
	}`)
	cfg, err := Load(p)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	d := Default()
	if cfg.Version != d.Version {
		t.Errorf("version not defaulted: %d", cfg.Version)
	}
	if cfg.Telemetry.CPUIntervalMS != d.Telemetry.CPUIntervalMS || cfg.Media.PollIntervalMS != d.Media.PollIntervalMS {
		t.Errorf("sub-minimum intervals not defaulted: %+v", cfg.Telemetry)
	}
	if cfg.Thresholds.CPUTempWarn != maxTempWarn || cfg.Thresholds.GPUTempWarn != 0 || cfg.Thresholds.RAMWarnPercent != maxPercent {
		t.Errorf("thresholds not clamped: %+v", cfg.Thresholds)
	}
	if cfg.Display.Theme != d.Display.Theme {
		t.Errorf("empty theme not defaulted: %q", cfg.Display.Theme)
	}
}

func TestDefaultIsStableUnderClamp(t *testing.T) {
	cfg := Default()
	clamp(cfg) // clamping valid defaults must change nothing
	if !reflect.DeepEqual(cfg, Default()) {
		t.Error("Default() is not stable under clamp")
	}
}

func TestSampleConfigLoads(t *testing.T) {
	cfg, err := Load("config.sample.json")
	if err != nil {
		t.Fatalf("sample config failed to load: %v", err)
	}
	if cfg.Version != 1 {
		t.Errorf("sample version = %d, want 1", cfg.Version)
	}
}

// TestNoSecretFields ties to the PROJ-115 guard: config must carry no secrets.
func TestNoSecretFields(t *testing.T) {
	if secrets.ContainsSecret(Config{}) {
		t.Error("Config contains a secrets.Secret field — config must never hold secrets (2E §7)")
	}
}
