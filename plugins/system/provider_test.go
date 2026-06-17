package main

import (
	"encoding/json"
	"testing"
)

// fakeControl records OS calls and returns a scripted active plan.
type fakeControl struct {
	plan   string
	setN   int
	emptyN int
	clearN int
}

func (f *fakeControl) SetPowerPlan(m string) error { f.plan = m; f.setN++; return nil }
func (f *fakeControl) ActivePlan() (string, bool) {
	if f.plan == "" {
		return "", false
	}
	return f.plan, true
}
func (f *fakeControl) EmptyRecycleBin() error { f.emptyN++; return nil }
func (f *fakeControl) ClearCache() error      { f.clearN++; return nil }

func TestPerformanceSetModeAndActive(t *testing.T) {
	f := &fakeControl{}
	p := newProvider(f)
	if err := p.execute(actPerfPerformance, nil); err != nil {
		t.Fatal(err)
	}
	if f.plan != modePerformance || f.setN != 1 {
		t.Errorf("SetPowerPlan = (%q, %d), want (performance, 1)", f.plan, f.setN)
	}
	if p.activeMode() != modePerformance {
		t.Errorf("activeMode = %q, want performance", p.activeMode())
	}
}

func TestUtilitiesDispatch(t *testing.T) {
	f := &fakeControl{}
	p := newProvider(f)
	if err := p.execute(actClearCache, nil); err != nil {
		t.Fatal(err)
	}
	if err := p.execute(actEmptyRecycleBin, nil); err != nil {
		t.Fatal(err)
	}
	if f.clearN != 1 || f.emptyN != 1 {
		t.Errorf("clear=%d empty=%d, want 1/1", f.clearN, f.emptyN)
	}
}

func TestFanLocalStatePersistsAndClamps(t *testing.T) {
	p := newProvider(&fakeControl{})
	_ = p.execute(actFanSetCPU, json.RawMessage(`{"value":80}`))
	_ = p.execute(actFanSetCase1, json.RawMessage(`{"value":150}`)) // clamps to 100
	cpu, case1, auto := p.fanSnapshot()
	if cpu != 80 {
		t.Errorf("fanCPU = %v, want 80", cpu)
	}
	if case1 != 100 {
		t.Errorf("fanCase1 = %v, want clamped 100", case1)
	}
	_ = p.execute(actFanToggleAuto, nil)
	if _, _, a1 := p.fanSnapshot(); a1 == auto {
		t.Error("toggleAuto did not flip the auto flag")
	}
}

func TestUnknownActionErrors(t *testing.T) {
	if err := newProvider(&fakeControl{}).execute("system.bogus", nil); err == nil {
		t.Error("unknown action should error")
	}
}
