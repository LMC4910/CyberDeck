// Command cyberdeck is the CyberDeck host-engine entrypoint. It selects run mode
// (--service / --console), enforces a single running instance, loads config, runs
// the staged boot sequence to READY wiring the real subsystems (SQLite, core,
// plugin host, transport listener), prints a pairing QR, and shuts down gracefully
// on SIGINT/SIGTERM (TRD 2B §7.1/§7.2).
package main

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"log"
	"os"
	"os/signal"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"
	"time"

	"github.com/mdp/qrterminal/v3"

	"github.com/shishir/cyberdeck/engine/core/layout"
	"github.com/shishir/cyberdeck/engine/core/persistence"
	"github.com/shishir/cyberdeck/engine/core/registry"
	"github.com/shishir/cyberdeck/engine/core/security"
	"github.com/shishir/cyberdeck/engine/core/security/secretstore"
	"github.com/shishir/cyberdeck/engine/core/session"
	"github.com/shishir/cyberdeck/engine/core/state"
	"github.com/shishir/cyberdeck/engine/core/transport"
	"github.com/shishir/cyberdeck/engine/internal/config"
	"github.com/shishir/cyberdeck/engine/internal/lifecycle"
	"github.com/shishir/cyberdeck/engine/pluginhost"
)

// version is the engine build version, overridable via -ldflags "-X main.version=…".
var version = "0.0.0-dev"

// defaultPort is the LAN listener port (devices dial it).
const defaultPort = 8765

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	if err := run(ctx, os.Args[1:], os.Stdout); err != nil {
		fmt.Fprintln(os.Stderr, "cyberdeck:", err)
		os.Exit(1)
	}
}

// engine holds the wired core subsystems so the boot stages can construct them and
// later stages / shutdown / the pairing printout can reference them.
type engine struct {
	logger   *log.Logger
	store    *state.Store
	host     *pluginhost.Host
	fanout   *transport.Fanout
	identity *security.Identity
	tokens   *security.TokenIssuer
	server   *session.Server
	listener *session.Listener
	pump     *session.StatePump
	devices  *persistence.DeviceRepo

	port        int
	pluginsDir  string
	powerDryRun bool
}

func run(ctx context.Context, args []string, stdout io.Writer) error {
	fs := flag.NewFlagSet("cyberdeck", flag.ContinueOnError)
	fs.SetOutput(stdout)
	var (
		service     = fs.Bool("service", false, "run under the OS service manager")
		console     = fs.Bool("console", false, "run in the foreground (dev/default)")
		showVersion = fs.Bool("version", false, "print version and exit")
		configPath  = fs.String("config", "config.json", "path to config.json")
		dataDir     = fs.String("data", defaultDataDir(), "directory for the engine database + state")
		port        = fs.Int("port", defaultPort, "LAN listener port devices connect to")
		pluginsDir  = fs.String("plugins", defaultPluginsDir(), "directory holding the bundled plugin binaries")
		powerLive   = fs.Bool("power-live", false, "actually execute power actions (default: dry-run for safety)")
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

	eng := &engine{
		logger: logger, port: *port, pluginsDir: *pluginsDir, powerDryRun: !*powerLive,
	}
	subs := lifecycle.Subsystems{
		DB:         db,
		DBCloser:   db,
		InitCore:   eng.initCore(db),
		PluginHost: &hostService{eng: eng},
		Transport:  &transportService{eng: eng},
	}

	if err := lifecycle.Boot(context.Background(), logger, lifecycle.BuildStages(subs)); err != nil {
		_ = db.Close()
		return err
	}

	eng.printPairing(stdout) // QR + payload for the first device
	go eng.consoleLoop(stdout)
	logger.Printf("engine running on port %d; waiting for shutdown signal", eng.port)

	<-ctx.Done()
	logger.Printf("shutdown signal received")
	return lifecycle.Shutdown(context.Background(), logger, lifecycle.BuildShutdownSteps(subs))
}

// initCore builds the core subsystems: state store, plugin host, fan-out, engine
// identity, the pairing server (token issuer + trust store), the session server,
// the LAN listener, and the state pump.
func (e *engine) initCore(db *persistence.DB) func(context.Context) error {
	return func(context.Context) error {
		e.store = state.New()
		e.fanout = transport.NewFanout()
		e.host = pluginhost.NewHost(
			pluginhost.WithStateSetter(e.store),
			pluginhost.WithLogger(e.logger),
		)
		e.tokens = security.NewTokenIssuer(security.WithTokenTTL(15 * time.Minute))
		e.devices = persistence.NewDeviceRepo(db)

		// Engine identity (ephemeral per run in this slice → fingerprint stable for
		// the run; persistent secure identity is a strengthening follow-up).
		id, err := security.LoadOrCreate(secretstore.NewMemoryStore(), &memKV{m: map[string]string{}}, "engine")
		if err != nil {
			return fmt.Errorf("engine identity: %w", err)
		}
		e.identity = id

		pairingSrv, err := security.NewPairingServer(
			id, e.tokens, session.NewTrustAdapter(e.devices),
			// First-slice default: grant the power category so the deck is usable
			// (destructive actions still require the device's 2-tap confirm).
			security.WithDefaultPermissions(`{"allowPowerActions":true,"allowedCategories":["power"],"deniedActions":[],"allowEditTrigger":true}`),
		)
		if err != nil {
			return fmt.Errorf("pairing server: %w", err)
		}

		auditor := auditAdapter{repo: persistence.NewAuditRepo(db), logger: e.logger}
		invoker := pluginInvoker{host: e.host, lookup: powerLookup}
		e.server = session.NewServer(e.fanout, layout.DefaultProfile(), e.store, powerLookup, invoker, auditor, e.logger)
		e.listener = session.NewListener(fmt.Sprintf(":%d", e.port), pairingSrv, e.server, e.logger)
		e.pump = session.NewStatePump(e.store, e.fanout, 500*time.Millisecond, e.logger)
		return nil
	}
}

// hostService launches + tears down the bundled first-party plugins.
type hostService struct{ eng *engine }

func (h *hostService) Start(context.Context) error {
	h.eng.launchPlugin("telemetry", nil)
	var powerEnv []string
	if h.eng.powerDryRun {
		powerEnv = []string{"CYBERDECK_POWER_DRYRUN=1"}
		h.eng.logger.Printf("power actions are in DRY-RUN (use --power-live to execute for real)")
	}
	h.eng.launchPlugin("power", powerEnv)
	return nil
}

func (h *hostService) Stop(ctx context.Context) error {
	if h.eng.host == nil {
		return nil
	}
	return h.eng.host.Shutdown(ctx)
}

// launchPlugin starts a bundled plugin if its binary exists; a missing binary is
// logged and skipped so the engine still runs (telemetry missing → no live state;
// power missing → power buttons fail) rather than failing to boot.
func (e *engine) launchPlugin(name string, env []string) {
	path := filepath.Join(e.pluginsDir, name, name+exeSuffix())
	if _, err := os.Stat(path); err != nil {
		e.logger.Printf("plugin %q not found at %s (skipping): %v", name, path, err)
		return
	}
	if _, err := e.host.Launch(pluginhost.LaunchSpec{Name: name, Path: path, Env: env}); err != nil {
		e.logger.Printf("launch plugin %q: %v", name, err)
		return
	}
	e.logger.Printf("launched plugin %q", name)
}

// transportService starts the state pump + LAN listener and, on shutdown, closes
// live sessions then stops accepting.
type transportService struct{ eng *engine }

func (t *transportService) Start(ctx context.Context) error {
	if err := t.eng.pump.Start(ctx); err != nil {
		return err
	}
	return t.eng.listener.Start(ctx)
}

func (t *transportService) Stop(ctx context.Context) error {
	t.eng.server.CloseAll()
	err := t.eng.listener.Stop(ctx)
	if perr := t.eng.pump.Stop(ctx); perr != nil && err == nil {
		err = perr
	}
	return err
}

// printPairing issues a fresh single-use token and prints the pairing QR + payload.
func (e *engine) printPairing(w io.Writer) {
	tok, err := e.tokens.Issue(true) // privileged: local console
	if err != nil {
		e.logger.Printf("issue pairing token: %v", err)
		return
	}
	payload, err := security.BuildPairingPayload(e.port, tok, e.identity.Fingerprint())
	if err != nil {
		e.logger.Printf("build pairing payload: %v", err)
		return
	}
	js, err := payload.JSON()
	if err != nil {
		e.logger.Printf("encode pairing payload: %v", err)
		return
	}
	_, _ = fmt.Fprintln(w, "\n=== CyberDeck pairing — scan on Android, or paste on desktop ===")
	qrterminal.GenerateHalfBlock(js, qrterminal.L, w)
	_, _ = fmt.Fprintf(w, "\npayload: %s\n", js)
	_, _ = fmt.Fprintf(w, "addresses=%v  port=%d  fingerprint=%s\n", payload.Addresses, payload.Port, payload.FP)
	_, _ = fmt.Fprintln(w, "(console: <Enter> = new code · list · revoke <uuid> · help)")
}

// consoleLoop is the privileged local console: Enter prints a fresh pairing code,
// `list` shows paired + live devices, `revoke <uuid>` revokes a device and drops its
// live session. (The local console is inherently the privileged channel, 2E §3.1.)
func (e *engine) consoleLoop(w io.Writer) {
	sc := bufio.NewScanner(os.Stdin)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		switch {
		case line == "":
			e.printPairing(w)
		case line == "list":
			e.listDevices(w)
		case strings.HasPrefix(line, "revoke "):
			e.revokeDevice(w, strings.TrimSpace(strings.TrimPrefix(line, "revoke ")))
		case line == "help":
			_, _ = fmt.Fprintln(w, "commands: <Enter> = new pairing code · list · revoke <uuid> · help")
		default:
			_, _ = fmt.Fprintf(w, "unknown command %q (try: help)\n", line)
		}
	}
	if err := sc.Err(); err != nil {
		e.logger.Printf("console: stdin error: %v", err)
	}
}

// listDevices prints the paired devices and which are currently connected.
func (e *engine) listDevices(w io.Writer) {
	devs, err := e.devices.List(context.Background())
	if err != nil {
		_, _ = fmt.Fprintf(w, "list: %v\n", err)
		return
	}
	live := map[string]bool{}
	for _, u := range e.server.LiveDevices() {
		live[u] = true
	}
	if len(devs) == 0 {
		_, _ = fmt.Fprintln(w, "no paired devices")
		return
	}
	_, _ = fmt.Fprintln(w, "paired devices:")
	for _, d := range devs {
		status := "offline"
		if live[d.UUID] {
			status = "LIVE"
		}
		if d.Revoked {
			status = "revoked"
		}
		_, _ = fmt.Fprintf(w, "  %s  [%s]  paired=%s\n", d.UUID, status,
			time.UnixMilli(d.PairedAt).Format(time.RFC3339))
	}
}

// revokeDevice revokes a device and tears down its live session immediately.
func (e *engine) revokeDevice(w io.Writer, uuid string) {
	if uuid == "" {
		_, _ = fmt.Fprintln(w, "usage: revoke <uuid>")
		return
	}
	if err := e.devices.Revoke(context.Background(), uuid); err != nil {
		_, _ = fmt.Fprintf(w, "revoke %s: %v\n", uuid, err)
		return
	}
	closed := e.server.CloseDevice(uuid)
	e.logger.Printf("revoked device %s (live session closed=%v)", uuid, closed)
	_, _ = fmt.Fprintf(w, "revoked %s (live session closed=%v)\n", uuid, closed)
}

// --- small adapters local to the entrypoint wiring ---

// memKV is an in-memory PublicStore for the (per-run) engine identity.
type memKV struct{ m map[string]string }

func (s *memKV) GetString(k string) (string, bool, error) { v, ok := s.m[k]; return v, ok, nil }
func (s *memKV) SetString(k, v string) error              { s.m[k] = v; return nil }

// auditAdapter records audit events durably (PROJ-114/127) and to the log.
type auditAdapter struct {
	repo   *persistence.AuditRepo
	logger *log.Logger
}

func (a auditAdapter) Audit(event string, fields map[string]any) {
	actor, _ := fields["device"].(string)
	resID, _ := fields["actionId"].(string)
	payload, _ := json.Marshal(fields)
	if a.repo != nil {
		_, _ = a.repo.Append(context.Background(), persistence.AuditEntry{
			TS: time.Now().UnixMilli(), Actor: actor, EventType: event,
			ResourceType: "action", ResourceID: resID, PayloadJSON: string(payload),
		})
	}
	a.logger.Printf("audit %s %v", event, fields)
}

// powerLookup is the static action catalogue for the bundled power plugin (the full
// manifest→registry merge is a strengthening follow-up; this is enough to authorize
// + route the default deck's buttons).
var powerLookup = staticLookup{m: func() map[string]registry.ActionDescriptor {
	mk := func(id, label string, destructive bool) registry.ActionDescriptor {
		return registry.ActionDescriptor{ID: id, Label: label, Category: "power", Destructive: destructive, Source: "power"}
	}
	return map[string]registry.ActionDescriptor{
		"system.shutdown":  mk("system.shutdown", "Shut Down", true),
		"system.restart":   mk("system.restart", "Restart", true),
		"system.sleep":     mk("system.sleep", "Sleep", false),
		"system.hibernate": mk("system.hibernate", "Hibernate", true),
		"system.lock":      mk("system.lock", "Lock", false),
		"system.logoff":    mk("system.logoff", "Log Off", true),
	}
}()}

type staticLookup struct{ m map[string]registry.ActionDescriptor }

func (s staticLookup) Action(id string) (registry.ActionDescriptor, bool) {
	d, ok := s.m[id]
	return d, ok
}

// pluginInvoker routes an authorized action to the plugin that owns it (by the
// descriptor's Source) and unwraps the plugin's result.
type pluginInvoker struct {
	host   *pluginhost.Host
	lookup staticLookup
}

func (pi pluginInvoker) Invoke(ctx context.Context, actionID string, params json.RawMessage) error {
	desc, ok := pi.lookup.Action(actionID)
	if !ok {
		return fmt.Errorf("unknown action %q", actionID)
	}
	plug, ok := pi.host.Plugin(desc.Source)
	if !ok {
		return fmt.Errorf("plugin %q not running", desc.Source)
	}
	res, err := plug.Invoke(ctx, actionID, params)
	if err != nil {
		return err
	}
	if !res.OK {
		return errors.New(res.Error)
	}
	return nil
}

func exeSuffix() string {
	if runtime.GOOS == "windows" {
		return ".exe"
	}
	return ""
}

// defaultDataDir is the per-user location for the engine database.
func defaultDataDir() string {
	if d, err := os.UserConfigDir(); err == nil {
		return filepath.Join(d, "CyberDeck")
	}
	return "."
}

// defaultPluginsDir resolves the bundled-plugins directory next to the executable,
// falling back to ./plugins for `go run` / dev.
func defaultPluginsDir() string {
	if exe, err := os.Executable(); err == nil {
		cand := filepath.Join(filepath.Dir(exe), "plugins")
		if _, err := os.Stat(cand); err == nil {
			return cand
		}
	}
	return "plugins"
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
