package main

import (
	"encoding/json"
	"testing"
)

// fakeVol records apply calls and returns scripted Get() values.
type fakeVol struct {
	setVol  float64
	setN    int
	muteVal bool
	muteN   int

	getVol   float64
	getMuted bool
	getOK    bool
}

func (f *fakeVol) SetVolume(v float64) error { f.setVol = v; f.setN++; return nil }
func (f *fakeVol) SetMute(m bool) error      { f.muteVal = m; f.muteN++; return nil }
func (f *fakeVol) Get() (float64, bool, bool) { return f.getVol, f.getMuted, f.getOK }

func testProvider() (*provider, *fakeVol) {
	f := &fakeVol{}
	return newProvider(f), f
}

func TestVolumeSetUpdatesState(t *testing.T) {
	p, f := testProvider()
	if err := p.execute(actVolumeSet, json.RawMessage(`{"value":30}`)); err != nil {
		t.Fatal(err)
	}
	if v, _ := p.snapshot(); v != 30 {
		t.Errorf("volume = %v, want 30", v)
	}
	if f.setN != 1 || f.setVol != 30 {
		t.Errorf("controller SetVolume = (%d calls, %v), want (1, 30)", f.setN, f.setVol)
	}
}

func TestVolumeClamped(t *testing.T) {
	p, f := testProvider()
	_ = p.execute(actVolumeSet, json.RawMessage(`{"value":150}`))
	if v, _ := p.snapshot(); v != 100 {
		t.Errorf("over-range volume = %v, want clamped to 100", v)
	}
	if f.setVol != 100 {
		t.Errorf("controller got %v, want clamped 100", f.setVol)
	}
	_ = p.execute(actVolumeSet, json.RawMessage(`{"value":-5}`))
	if v, _ := p.snapshot(); v != 0 {
		t.Errorf("under-range volume = %v, want clamped to 0", v)
	}
}

func TestVolumeMuteToggles(t *testing.T) {
	p, f := testProvider()
	_, m0 := p.snapshot()
	_ = p.execute(actVolumeMute, nil)
	if _, m1 := p.snapshot(); m1 == m0 {
		t.Error("mute did not toggle")
	}
	_ = p.execute(actVolumeMute, nil)
	if _, m2 := p.snapshot(); m2 != m0 {
		t.Error("second mute did not toggle back")
	}
	if f.muteN != 2 {
		t.Errorf("controller SetMute calls = %d, want 2", f.muteN)
	}
}

func TestVolumeUnknownAction(t *testing.T) {
	p, _ := testProvider()
	if err := p.execute("volume.bogus", nil); err == nil {
		t.Error("unknown action should error")
	}
}

func TestSyncFromOSAdoptsRealVolume(t *testing.T) {
	p, f := testProvider()
	f.getVol, f.getMuted, f.getOK = 42, true, true
	p.syncFromOS()
	if v, m := p.snapshot(); v != 42 || !m {
		t.Errorf("after sync = (%v, %v), want (42, true)", v, m)
	}
	// Unsupported read-back leaves the authoritative state untouched.
	f.getVol, f.getMuted, f.getOK = 5, false, false
	p.syncFromOS()
	if v, m := p.snapshot(); v != 42 || !m {
		t.Errorf("unsupported Get changed state to (%v, %v), want (42, true)", v, m)
	}
}
