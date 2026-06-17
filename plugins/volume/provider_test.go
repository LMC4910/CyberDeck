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

	appCh  string
	appVal float64
	appN   int
	closeN int
}

func (f *fakeVol) SetVolume(v float64) error  { f.setVol = v; f.setN++; return nil }
func (f *fakeVol) SetMute(m bool) error       { f.muteVal = m; f.muteN++; return nil }
func (f *fakeVol) Get() (float64, bool, bool) { return f.getVol, f.getMuted, f.getOK }
func (f *fakeVol) SetAppVolume(ch string, v float64) error {
	f.appCh = ch
	f.appVal = v
	f.appN++
	return nil
}
func (f *fakeVol) Close() error { f.closeN++; return nil }

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

func TestAppVolumeSetsChannelStateAndController(t *testing.T) {
	p, f := testProvider()
	if err := p.execute(actAppVolumeSet,
		json.RawMessage(`{"value":35,"target":"spotify"}`)); err != nil {
		t.Fatal(err)
	}
	if got := p.appSnapshot()["spotify"]; got != 35 {
		t.Errorf("spotify channel state = %v, want 35", got)
	}
	if f.appN != 1 || f.appCh != "spotify" || f.appVal != 35 {
		t.Errorf("controller SetAppVolume = (%d, %q, %v), want (1, spotify, 35)",
			f.appN, f.appCh, f.appVal)
	}
	// Over-range clamps; empty channel is ignored.
	_ = p.execute(actAppVolumeSet, json.RawMessage(`{"value":150,"target":"discord"}`))
	if got := p.appSnapshot()["discord"]; got != 100 {
		t.Errorf("discord clamp = %v, want 100", got)
	}
	_ = p.execute(actAppVolumeSet, json.RawMessage(`{"value":10,"target":""}`))
	if f.appN != 2 {
		t.Errorf("empty channel should not reach controller (appN=%d, want 2)", f.appN)
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
