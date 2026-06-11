package main

import (
	"context"
	"encoding/json"
	"testing"
)

func noopProvider() *provider {
	return newProvider(func(context.Context, string, ...string) error { return nil })
}

func TestVolumeSetUpdatesState(t *testing.T) {
	p := noopProvider()
	if err := p.execute(context.Background(), actVolumeSet,
		json.RawMessage(`{"value":30}`)); err != nil {
		t.Fatal(err)
	}
	if v, _ := p.snapshot(); v != 30 {
		t.Errorf("volume = %v, want 30", v)
	}
}

func TestVolumeClamped(t *testing.T) {
	p := noopProvider()
	_ = p.execute(context.Background(), actVolumeSet, json.RawMessage(`{"value":150}`))
	if v, _ := p.snapshot(); v != 100 {
		t.Errorf("over-range volume = %v, want clamped to 100", v)
	}
	_ = p.execute(context.Background(), actVolumeSet, json.RawMessage(`{"value":-5}`))
	if v, _ := p.snapshot(); v != 0 {
		t.Errorf("under-range volume = %v, want clamped to 0", v)
	}
}

func TestVolumeMuteToggles(t *testing.T) {
	p := noopProvider()
	_, m0 := p.snapshot()
	_ = p.execute(context.Background(), actVolumeMute, nil)
	if _, m1 := p.snapshot(); m1 == m0 {
		t.Error("mute did not toggle")
	}
	_ = p.execute(context.Background(), actVolumeMute, nil)
	if _, m2 := p.snapshot(); m2 != m0 {
		t.Error("second mute did not toggle back")
	}
}

func TestVolumeUnknownAction(t *testing.T) {
	if err := noopProvider().execute(context.Background(), "volume.bogus", nil); err == nil {
		t.Error("unknown action should error")
	}
}
