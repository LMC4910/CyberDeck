// Package lifecycle owns the engine boot sequence and graceful shutdown (TRD 2B
// §7.1/§7.2). PROJ-104 establishes the staged skeleton with the documented
// ordering; PROJ-105 replaces the stub stages with real subsystem wiring
// (SQLite, core, plugin host, transport) via injected interfaces.
package lifecycle

import (
	"context"
	"fmt"
	"log"
)

// BootStage is one named step of the boot sequence. Run may be nil (a stub that
// only logs its stage), which is how PROJ-104 reaches READY before the real
// subsystems exist.
type BootStage struct {
	Name string
	Run  func(context.Context) error
}

// Boot runs the stages in order, logging each, and reaches READY on success. A
// stage error aborts the boot and is returned.
func Boot(ctx context.Context, logger *log.Logger, stages []BootStage) error {
	for _, s := range stages {
		logger.Printf("boot: %s", s.Name)
		if s.Run == nil {
			continue
		}
		if err := s.Run(ctx); err != nil {
			return fmt.Errorf("lifecycle: boot stage %q: %w", s.Name, err)
		}
	}
	logger.Printf("boot: READY")
	return nil
}

// DefaultStages returns the documented boot ordering (2B §7.1) as stubs. PROJ-105
// supplies real Run funcs (open/migrate SQLite, init core, start plugin host,
// start transport, mDNS advertise) via injected subsystem constructors.
func DefaultStages() []BootStage {
	return []BootStage{
		{Name: "load config"},
		{Name: "open + migrate SQLite"},
		{Name: "init core (state store, registries, event bus, sessions)"},
		{Name: "start plugin host + launch first-party plugins"},
		{Name: "start transport (LAN listener + loopback control)"},
		{Name: "mDNS advertise"},
	}
}
