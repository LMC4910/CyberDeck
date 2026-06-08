package lifecycle

import (
	"errors"
	"fmt"
	"sync/atomic"
	"testing"
	"time"
)

func TestSingleInstanceRefusesSecondAndSignalsFocus(t *testing.T) {
	name := fmt.Sprintf("test-%d", time.Now().UnixNano())

	var focused atomic.Int32
	first, err := AcquireInstance(name, func() { focused.Add(1) })
	if err != nil {
		t.Fatalf("first AcquireInstance: %v", err)
	}
	defer func() { _ = first.Release() }()

	// A second acquisition must be refused...
	second, err := AcquireInstance(name, nil)
	if !errors.Is(err, ErrAlreadyRunning) {
		t.Fatalf("second AcquireInstance = (%v, %v), want ErrAlreadyRunning", second, err)
	}
	if second != nil {
		t.Error("refused acquisition should return a nil lock")
	}

	// ...and the first instance must receive the focus signal.
	deadline := time.Now().Add(2 * time.Second)
	for focused.Load() == 0 {
		if time.Now().After(deadline) {
			t.Fatal("first instance never received a focus signal")
		}
		time.Sleep(10 * time.Millisecond)
	}
}

func TestSingleInstanceReacquireAfterRelease(t *testing.T) {
	name := fmt.Sprintf("test-reacq-%d", time.Now().UnixNano())

	first, err := AcquireInstance(name, nil)
	if err != nil {
		t.Fatalf("first AcquireInstance: %v", err)
	}
	if err := first.Release(); err != nil {
		t.Fatalf("Release: %v", err)
	}

	// After release the slot is free again (the listener address is reusable).
	second, err := AcquireInstance(name, nil)
	if err != nil {
		t.Fatalf("re-acquire after release: %v", err)
	}
	_ = second.Release()
}
