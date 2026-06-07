package pal

import "testing"

// tempSensor is a test capability following the (value, ok) convention.
type tempSensor interface {
	Temp() (float64, bool)
}

type fakeSensor struct {
	v  float64
	ok bool
}

func (f fakeSensor) Temp() (float64, bool) { return f.v, f.ok }

// fakeProvider is a controllable provider of tempSensor.
type fakeProvider struct {
	name  string
	avail *bool // pointer so the test can flip availability
	cap   tempSensor
}

func (p fakeProvider) Name() string           { return p.name }
func (p fakeProvider) Probe() bool            { return *p.avail }
func (p fakeProvider) Capability() tempSensor { return p.cap }

func boolp(b bool) *bool { return &b }

func TestChainBindsHighestAvailable(t *testing.T) {
	a := fakeProvider{name: "A", avail: boolp(true), cap: fakeSensor{v: 1, ok: true}}
	b := fakeProvider{name: "B", avail: boolp(true), cap: fakeSensor{v: 2, ok: true}}
	c := NewChain[tempSensor](a, b)

	if !c.Bind() {
		t.Fatal("Bind returned false with available providers")
	}
	if c.BoundName() != "A" {
		t.Errorf("bound %q, want A (highest priority)", c.BoundName())
	}
	cap, ok := c.Capability()
	if !ok {
		t.Fatal("Capability ok=false despite bind")
	}
	if v, ok := cap.Temp(); !ok || v != 1 {
		t.Errorf("Temp = %v,%v want 1,true", v, ok)
	}
}

func TestChainSkipsUnavailable(t *testing.T) {
	a := fakeProvider{name: "A", avail: boolp(false), cap: fakeSensor{ok: false}}
	b := fakeProvider{name: "B", avail: boolp(true), cap: fakeSensor{v: 2, ok: true}}
	c := NewChain[tempSensor](a, b)

	if !c.Bind() || c.BoundName() != "B" {
		t.Errorf("bound %q, want B (A unavailable)", c.BoundName())
	}
}

func TestChainAllUnavailableDegrades(t *testing.T) { // P1-AC-05
	a := fakeProvider{name: "A", avail: boolp(false)}
	b := fakeProvider{name: "B", avail: boolp(false)}
	c := NewChain[tempSensor](a, b)

	if c.Bind() {
		t.Error("Bind returned true with no available providers")
	}
	if c.Available() {
		t.Error("Available true with no provider bound")
	}
	cap, ok := c.Capability()
	if ok {
		t.Error("Capability ok=true when unavailable")
	}
	if cap != nil {
		t.Error("unavailable capability should be the nil zero value")
	}
	// Empty chain also degrades cleanly (no panic).
	if NewChain[tempSensor]().Bind() {
		t.Error("empty chain bound a provider")
	}
}

func TestChainRebindOnFault(t *testing.T) {
	aAvail := boolp(true)
	a := fakeProvider{name: "A", avail: aAvail, cap: fakeSensor{v: 1, ok: true}}
	b := fakeProvider{name: "B", avail: boolp(true), cap: fakeSensor{v: 2, ok: true}}
	c := NewChain[tempSensor](a, b)

	c.Bind()
	if c.BoundName() != "A" {
		t.Fatalf("initial bind %q, want A", c.BoundName())
	}

	// A faults → re-probe rebinds to B.
	*aAvail = false
	if !c.Rebind() || c.BoundName() != "B" {
		t.Errorf("after A fault, bound %q, want B", c.BoundName())
	}

	// A recovers → re-probe rebinds back to the higher-priority A.
	*aAvail = true
	if !c.Rebind() || c.BoundName() != "A" {
		t.Errorf("after A recovery, bound %q, want A", c.BoundName())
	}
}
