// Command cyberdeck is the CyberDeck host-engine entrypoint. It selects run mode
// (--service / --console), enforces a single running instance, loads config, runs
// the staged boot sequence to READY wiring the real subsystems (SQLite, core,
// plugin host), and shuts down gracefully on SIGINT/SIGTERM (TRD 2B §7.1/§7.2).
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"log"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"

	"github.com/shishir/cyberdeck/engine/core/persistence"
	"github.com/shishir/cyberdeck/engine/core/state"
	"github.com/shishir/cyberdeck/engine/internal/config"
	"github.com/shishir/cyberdeck/engine/internal/lifecycle"
	"github.com/shishir/cyberdeck/engine/pluginhost"
)

// version is the engine build version, overridable via -ldflags "-X main.version=…".
var version = "0.0.0-dev"

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	if err := run(ctx, os.Args[1:], os.Stdout); err != nil {
		fmt.Fprintln(os.Stderr, "cyberdeck:", err)
		os.Exit(1)
	}
}

// engine holds the wired core subsystems so the boot stages can construct them and
// later stages / shutdown can reference them. Only the subsystems with live
// consumers today are wired (state store + plugin host); registries, event bus and
// session manager are already-tested subsystems that get wired in here once the
// transport/session-open tickets (PROJ-180/124) give them runtime consumers.
type engine struct {
	store *state.Store
	host  *pluginhost.Host
}

// run parses flags, claims the single-instance lock, boots the real subsystems,
// waits for ctx cancellation (a signal), then shuts down. ctx is injected so tests
// can drive the lifecycle deterministically.
func run(ctx context.Context, args []string, stdout io.Writer) error {
	fs := flag.NewFlagSet("cyberdeck", flag.ContinueOnError)
	fs.SetOutput(stdout)
	var (
		service     = fs.Bool("service", false, "run under the OS service manager")
		console     = fs.Bool("console", false, "run in the foreground (dev/default)")
		showVersion = fs.Bool("version", false, "print version and exit")
		configPath  = fs.String("config", "config.json", "path to config.json")
		dataDir     = fs.String("data", defaultDataDir(), "directory for the engine database + state")
	)
	if err := fs.Parse(args); err != nil {
		return err
	}

	if *showVersion {
		_, err := fmt.Fprintf(stdout, "CyberDeck engine %s\n", version)
		return err
	}

	mode := "console"
	if *service && !*console {
		mode = "service"
	}

	logger := log.New(stdout, "", log.LstdFlags)

	// Single-instance guard: a second launch signals the first to focus and exits.
	lock, err := lifecycle.AcquireInstance(instanceName(*dataDir), func() {
		logger.Printf("focus requested by another launch")
	})
	if errors.Is(err, lifecycle.ErrAlreadyRunning) {
		logger.Printf("another instance is already running; signaled it to focus — exiting")
		return nil
	}
	if err != nil {
		return fmt.Errorf("single-instance guard: %w", err)
	}
	defer func() { _ = lock.Release() }()

	cfg, cfgErr := config.Load(*configPath)
	if cfgErr != nil {
		logger.Printf("config: %v (continuing with defaults)", cfgErr)
	}
	logger.Printf("cyberdeck %s starting in %s mode (telemetry cpu interval %dms)",
		version, mode, cfg.Telemetry.CPUIntervalMS)

	if err := os.MkdirAll(*dataDir, 0o755); err != nil {
		return fmt.Errorf("create data dir: %w", err)
	}
	db, err := persistence.Open(filepath.Join(*dataDir, "cyberdeck.db"))
	if err != nil {
		return fmt.Errorf("open database: %w", err)
	}

	eng := &engine{}
	subs := lifecycle.Subsystems{
		DB:       db,
		DBCloser: db,
		InitCore: func(context.Context) error {
			eng.store = state.New()
			eng.host = pluginhost.NewHost(
				pluginhost.WithStateSetter(eng.store),
				pluginhost.WithLogger(logger),
			)
			return nil
		},
		PluginHost: &hostService{eng: eng},
	}

	// Boot runs to READY on its own context: the signal context (ctx) drives the
	// post-boot shutdown wait, not boot itself, so an early signal shuts the engine
	// down cleanly after boot rather than aborting a half-finished boot.
	if err := lifecycle.Boot(context.Background(), logger, lifecycle.BuildStages(subs)); err != nil {
		_ = db.Close()
		return err
	}
	logger.Printf("engine running; waiting for shutdown signal")

	<-ctx.Done()
	logger.Printf("shutdown signal received")

	// Shutdown gets a fresh context so teardown isn't already-cancelled.
	return lifecycle.Shutdown(context.Background(), logger, lifecycle.BuildShutdownSteps(subs))
}

// hostService adapts the plugin host to the lifecycle Service seam. The host is
// constructed during core init; launching the bundled first-party plugins is wired
// by the runtime/installer (PROJ-190+) once plugin binary paths are known, so Start
// is currently a readiness no-op and Stop tears down any launched plugins.
type hostService struct{ eng *engine }

func (h *hostService) Start(context.Context) error { return nil }

func (h *hostService) Stop(ctx context.Context) error {
	if h.eng.host == nil {
		return nil
	}
	return h.eng.host.Shutdown(ctx)
}

// defaultDataDir is the per-user location for the engine database.
func defaultDataDir() string {
	if d, err := os.UserConfigDir(); err == nil {
		return filepath.Join(d, "CyberDeck")
	}
	return "."
}

// instanceName scopes the single-instance lock to a data directory so distinct
// installs (and tests using temp dirs) don't contend.
func instanceName(dataDir string) string {
	abs, err := filepath.Abs(dataDir)
	if err != nil {
		abs = dataDir
	}
	return "cyberdeck:" + abs
}
