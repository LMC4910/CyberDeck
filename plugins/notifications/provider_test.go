package main

import (
	"sync"
	"testing"
)

func TestSetCountAbsolute(t *testing.T) {
	p := newProvider()
	if got := p.snapshot(); got != 0 {
		t.Fatalf("initial count = %d, want 0", got)
	}
	p.setCount(5)
	if got := p.snapshot(); got != 5 {
		t.Errorf("count = %d, want 5", got)
	}
	p.setCount(2) // a later absolute report replaces, it does not accumulate
	if got := p.snapshot(); got != 2 {
		t.Errorf("count = %d, want 2", got)
	}
}

func TestSetCountClampsNegative(t *testing.T) {
	p := newProvider()
	p.setCount(-3)
	if got := p.snapshot(); got != 0 {
		t.Errorf("negative count = %d, want clamped to 0", got)
	}
}

func TestAddAndClear(t *testing.T) {
	p := newProvider()
	p.add(1) // notification arrives
	p.add(1)
	p.add(1)
	if got := p.snapshot(); got != 3 {
		t.Fatalf("after 3 adds count = %d, want 3", got)
	}
	p.add(-1) // one dismissed
	if got := p.snapshot(); got != 2 {
		t.Errorf("after dismiss count = %d, want 2", got)
	}
	p.clear() // clear all
	if got := p.snapshot(); got != 0 {
		t.Errorf("after clear count = %d, want 0", got)
	}
}

func TestAddClampsAtZero(t *testing.T) {
	p := newProvider()
	p.add(1)
	p.add(-5) // more removed than present: never goes negative
	if got := p.snapshot(); got != 0 {
		t.Errorf("count = %d, want clamped to 0", got)
	}
}

// TestConcurrentMutationRace exercises the mutex under -race: the listener goroutine
// mutates while the publish loop snapshots.
func TestConcurrentMutationRace(t *testing.T) {
	p := newProvider()
	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		defer wg.Done()
		for i := 0; i < 1000; i++ {
			p.add(1)
			p.setCount(i)
			p.clear()
		}
	}()
	go func() {
		defer wg.Done()
		for i := 0; i < 1000; i++ {
			_ = p.snapshot()
		}
	}()
	wg.Wait()
}
