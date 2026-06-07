package lifecycle

import (
	"context"
	"errors"
	"fmt"
	"log"
)

// ShutdownStep is one named step of graceful shutdown. Run may be nil (stub).
type ShutdownStep struct {
	Name string
	Run  func(context.Context) error
}

// Shutdown runs the steps in order, logging each. Unlike boot, a step error does
// not abort the rest — best-effort teardown — but the joined error is returned.
func Shutdown(ctx context.Context, logger *log.Logger, steps []ShutdownStep) error {
	var errs []error
	for _, s := range steps {
		logger.Printf("shutdown: %s", s.Name)
		if s.Run == nil {
			continue
		}
		if err := s.Run(ctx); err != nil {
			errs = append(errs, fmt.Errorf("lifecycle: shutdown step %q: %w", s.Name, err))
		}
	}
	logger.Printf("shutdown: complete")
	return errors.Join(errs...)
}

// DefaultShutdownSteps returns the documented graceful-shutdown ordering (2B §7.2)
// as stubs (real teardown wired in PROJ-105).
func DefaultShutdownSteps() []ShutdownStep {
	return []ShutdownStep{
		{Name: "stop accepting sessions"},
		{Name: "flush durable writes"},
		{Name: "stop plugins (SIGTERM then kill)"},
		{Name: "close SQLite"},
	}
}
