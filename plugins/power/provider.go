// Command power is the first-party CyberDeck power-actions plugin (PROJ-173). It
// registers the six power actions (system.{shutdown,restart,sleep,hibernate,lock,
// logoff}) and, on invocation, runs the per-OS power command. Destructive actions
// (shutdown/restart/hibernate/logoff) carry the `destructive` flag so the client
// requires a 2-tap confirmation (PROJ-187) and the permission gate applies
// (PROJ-125). Actual power commands are mockable so tests never power off CI.
package main

import (
	"context"
	"fmt"
	"os/exec"
)

// Power action IDs.
const (
	actShutdown  = "system.shutdown"
	actRestart   = "system.restart"
	actSleep     = "system.sleep"
	actHibernate = "system.hibernate"
	actLock      = "system.lock"
	actLogoff    = "system.logoff"
)

// allActions is the registration order.
var allActions = []string{actShutdown, actRestart, actSleep, actHibernate, actLock, actLogoff}

// destructive marks the actions that need 2-tap confirmation + a permission gate.
var destructive = map[string]bool{
	actShutdown:  true,
	actRestart:   true,
	actHibernate: true,
	actLogoff:    true,
}

// hasDelay marks the actions that accept an optional `delay` (seconds) param.
var hasDelay = map[string]bool{actShutdown: true, actRestart: true}

// runner executes an OS command. Injectable so tests record commands instead of
// running them (never power off the test machine).
type runner func(ctx context.Context, name string, args ...string) error

func execRunner(ctx context.Context, name string, args ...string) error {
	return exec.CommandContext(ctx, name, args...).Run()
}

// provider runs power actions via per-OS command tables.
type provider struct{ run runner }

func newProvider(r runner) *provider {
	if r == nil {
		r = execRunner
	}
	return &provider{run: r}
}

// execute runs the OS command for an action, or returns an error if the action is
// unsupported on this platform (clean degradation).
func (p *provider) execute(ctx context.Context, action string) error {
	name, args, ok := commandFor(action)
	if !ok {
		return fmt.Errorf("power: action %q unsupported on this platform", action)
	}
	if err := p.run(ctx, name, args...); err != nil {
		return fmt.Errorf("power: %q: %w", action, err)
	}
	return nil
}
