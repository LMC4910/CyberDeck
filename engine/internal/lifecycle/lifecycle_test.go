package lifecycle

import (
	"context"
	"errors"
	"io"
	"log"
	"testing"
)

func quietLogger() *log.Logger { return log.New(io.Discard, "", 0) }

func TestBootRunsStagesInOrder(t *testing.T) {
	var order []string
	stages := []BootStage{
		{Name: "a", Run: func(context.Context) error { order = append(order, "a"); return nil }},
		{Name: "b", Run: func(context.Context) error { order = append(order, "b"); return nil }},
		{Name: "c", Run: func(context.Context) error { order = append(order, "c"); return nil }},
	}
	if err := Boot(context.Background(), quietLogger(), stages); err != nil {
		t.Fatalf("Boot: %v", err)
	}
	if len(order) != 3 || order[0] != "a" || order[1] != "b" || order[2] != "c" {
		t.Errorf("stage order = %v, want [a b c]", order)
	}
}

func TestBootStageErrorAborts(t *testing.T) {
	var ran []string
	stages := []BootStage{
		{Name: "ok", Run: func(context.Context) error { ran = append(ran, "ok"); return nil }},
		{Name: "boom", Run: func(context.Context) error { return errors.New("fail") }},
		{Name: "never", Run: func(context.Context) error { ran = append(ran, "never"); return nil }},
	}
	err := Boot(context.Background(), quietLogger(), stages)
	if err == nil {
		t.Fatal("expected boot error")
	}
	for _, r := range ran {
		if r == "never" {
			t.Error("stage after a failing stage still ran")
		}
	}
}

func TestDefaultStagesAndShutdownOrdering(t *testing.T) {
	// DefaultStages are stubs (Run nil) and must boot to READY without error.
	if err := Boot(context.Background(), quietLogger(), DefaultStages()); err != nil {
		t.Fatalf("default Boot: %v", err)
	}

	var order []string
	steps := []ShutdownStep{
		{Name: "1", Run: func(context.Context) error { order = append(order, "1"); return nil }},
		{Name: "2", Run: func(context.Context) error { order = append(order, "2"); return errors.New("x") }},
		{Name: "3", Run: func(context.Context) error { order = append(order, "3"); return nil }},
	}
	// Shutdown is best-effort: a failing step does not abort the rest.
	err := Shutdown(context.Background(), quietLogger(), steps)
	if err == nil {
		t.Error("expected joined shutdown error")
	}
	if len(order) != 3 {
		t.Errorf("shutdown ran %v, want all 3 steps despite error", order)
	}
}
