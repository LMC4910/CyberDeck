package lifecycle

import "context"

// Subsystem seams the boot/shutdown sequences drive. Real engine subsystems
// satisfy these directly (e.g. *persistence.DB is a Migrator + Closer); tests
// inject fakes. Keeping the wiring behind interfaces is what lets PROJ-105 turn
// the PROJ-104 stubs into the real lifecycle without lifecycle depending on every
// concrete package.

// Migrator opens-then-migrates the persistent store (PROJ-110).
type Migrator interface {
	Migrate(ctx context.Context) error
}

// Closer tears a subsystem down (e.g. close SQLite).
type Closer interface {
	Close() error
}

// Service is a runtime subsystem with a start/stop lifecycle (plugin host,
// transport listener, mDNS advertiser).
type Service interface {
	Start(ctx context.Context) error
	Stop(ctx context.Context) error
}

// Subsystems is the injected wiring for the real boot/shutdown sequences. Any
// field may be nil: a nil subsystem keeps its documented stage in the ordering but
// is logged and skipped. This lets stages whose backing ticket isn't built yet
// (the LAN listener / mDNS advertiser, PROJ-147) hold their place as no-ops while
// the available subsystems (SQLite, core, plugin host) are wired for real.
type Subsystems struct {
	DB         Migrator                    // open + migrate SQLite (PROJ-110)
	DBCloser   Closer                      // close SQLite on shutdown
	InitCore   func(context.Context) error // build state store / registries / event bus / sessions
	FlushCore  func(context.Context) error // flush durable writes on shutdown
	PluginHost Service                     // plugin host + first-party plugins (PROJ-130/131)
	Transport  Service                     // transport listener (PROJ-150 + 147)
	MDNS       Service                     // mDNS advertise (PROJ-147)
}

// BuildStages returns the documented boot ordering (2B §7.1) with real Run funcs
// wired from the injected subsystems. The "load config" stage is a placeholder for
// ordering — config is loaded by the entrypoint before boot.
func BuildStages(s Subsystems) []BootStage {
	return []BootStage{
		{Name: "load config"},
		{Name: "open + migrate SQLite", Run: migrateOf(s.DB)},
		{Name: "init core (state store, registries, event bus, sessions)", Run: s.InitCore},
		{Name: "start plugin host + launch first-party plugins", Run: startOf(s.PluginHost)},
		{Name: "start transport (LAN listener + loopback control)", Run: startOf(s.Transport)},
		{Name: "mDNS advertise", Run: startOf(s.MDNS)},
	}
}

// BuildShutdownSteps returns the documented graceful-shutdown ordering (2B §7.2):
// stop accepting sessions (transport + mDNS) → flush durable writes → stop plugins
// → close SQLite.
func BuildShutdownSteps(s Subsystems) []ShutdownStep {
	return []ShutdownStep{
		{Name: "stop accepting sessions", Run: stopAll(s.Transport, s.MDNS)},
		{Name: "flush durable writes", Run: s.FlushCore},
		{Name: "stop plugins (SIGTERM then kill)", Run: stopOf(s.PluginHost)},
		{Name: "close SQLite", Run: closeOf(s.DBCloser)},
	}
}

func migrateOf(m Migrator) func(context.Context) error {
	if m == nil {
		return nil
	}
	return m.Migrate
}

func startOf(s Service) func(context.Context) error {
	if s == nil {
		return nil
	}
	return s.Start
}

func stopOf(s Service) func(context.Context) error {
	if s == nil {
		return nil
	}
	return s.Stop
}

// stopAll stops several services in the given order, best-effort: the first error
// is returned but every non-nil service is still stopped.
func stopAll(svcs ...Service) func(context.Context) error {
	return func(ctx context.Context) error {
		var first error
		for _, s := range svcs {
			if s == nil {
				continue
			}
			if err := s.Stop(ctx); err != nil && first == nil {
				first = err
			}
		}
		return first
	}
}

func closeOf(c Closer) func(context.Context) error {
	if c == nil {
		return nil
	}
	return func(context.Context) error { return c.Close() }
}
