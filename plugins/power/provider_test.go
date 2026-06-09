package main

import (
	"context"
	"testing"
)

type recRunner struct{ calls [][]string }

func (r *recRunner) run(_ context.Context, name string, args ...string) error {
	r.calls = append(r.calls, append([]string{name}, args...))
	return nil
}

func TestExecuteRunsThePlatformCommand(t *testing.T) {
	rec := &recRunner{}
	p := newProvider(rec.run)
	if err := p.execute(context.Background(), actLock); err != nil {
		t.Fatalf("execute(lock): %v", err)
	}
	if len(rec.calls) != 1 || rec.calls[0][0] == "" {
		t.Errorf("expected one command run, got %v", rec.calls)
	}
}

func TestExecuteUnsupportedActionErrors(t *testing.T) {
	rec := &recRunner{}
	p := newProvider(rec.run)
	if err := p.execute(context.Background(), "system.bogus"); err == nil {
		t.Error("expected an error for an unsupported action")
	}
	if len(rec.calls) != 0 {
		t.Error("an unsupported action must not run any command")
	}
}

func TestDestructiveFlags(t *testing.T) {
	for _, id := range []string{actShutdown, actRestart, actHibernate, actLogoff} {
		if !destructive[id] {
			t.Errorf("%s should be destructive", id)
		}
	}
	for _, id := range []string{actSleep, actLock} {
		if destructive[id] {
			t.Errorf("%s should not be destructive", id)
		}
	}
}

func TestActionDescriptors(t *testing.T) {
	descs := actionDescriptors()
	if len(descs) != len(allActions) {
		t.Fatalf("got %d descriptors, want %d", len(descs), len(allActions))
	}
	for _, d := range descs {
		if d.Category != "power" || d.Label == "" {
			t.Errorf("bad descriptor %+v", d)
		}
		if d.Destructive != destructive[d.ID] {
			t.Errorf("%s destructive flag = %v, want %v", d.ID, d.Destructive, destructive[d.ID])
		}
		if hasDelay[d.ID] && len(d.Params) == 0 {
			t.Errorf("%s should carry a delay param", d.ID)
		}
	}
}
