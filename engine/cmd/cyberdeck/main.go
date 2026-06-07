// Command cyberdeck is the CyberDeck host-engine entrypoint. It selects run mode
// (--service / --console), loads config, runs the staged boot sequence to READY,
// and shuts down gracefully on SIGINT/SIGTERM (TRD 2B §7.1/§7.2). The real
// subsystem wiring inside the boot stages arrives in PROJ-105.
package main

import (
	"context"
	"flag"
	"fmt"
	"io"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/shishir/cyberdeck/engine/internal/config"
	"github.com/shishir/cyberdeck/engine/internal/lifecycle"
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

// run parses flags, boots, waits for ctx cancellation (a signal), then shuts down.
// ctx is injected so tests can drive the lifecycle deterministically.
func run(ctx context.Context, args []string, stdout io.Writer) error {
	fs := flag.NewFlagSet("cyberdeck", flag.ContinueOnError)
	fs.SetOutput(stdout)
	var (
		service     = fs.Bool("service", false, "run under the OS service manager")
		console     = fs.Bool("console", false, "run in the foreground (dev/default)")
		showVersion = fs.Bool("version", false, "print version and exit")
		configPath  = fs.String("config", "config.json", "path to config.json")
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
	cfg, cfgErr := config.Load(*configPath)
	if cfgErr != nil {
		logger.Printf("config: %v (continuing with defaults)", cfgErr)
	}
	logger.Printf("cyberdeck %s starting in %s mode (telemetry cpu interval %dms)",
		version, mode, cfg.Telemetry.CPUIntervalMS)

	if err := lifecycle.Boot(ctx, logger, lifecycle.DefaultStages()); err != nil {
		return err
	}
	logger.Printf("engine running; waiting for shutdown signal")

	<-ctx.Done()
	logger.Printf("shutdown signal received")

	// Shutdown gets a fresh context so teardown isn't already-cancelled.
	return lifecycle.Shutdown(context.Background(), logger, lifecycle.DefaultShutdownSteps())
}
