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
	"github.com/shishir/cyberdeck/engine/internal/service"
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
	audit    *persistence.AuditRepo
	control  *transport.ControlChannel

	// quit triggers a graceful shutdown (invoked by the loopback control channel's
	// service.quit op); nil until run() installs it.
	quit func()
	// paused reflects whether the loopback control channel has paused session
	// serving (drops live sessions; new sessions still refused while paused).
	paused bool

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

	opts := serveOptions{
		configPath: *configPath,
		dataDir:    *dataDir,
		port:       *port,
		pluginsDir: *pluginsDir,
		powerLive:  *powerLive,
	}

	// Service mode (P1-AC-01): run under / register with the OS service manager so
	// the engine survives the UI closing. `--service [run]` is the supervised
	// process; `--service install|uninstall` manages registration.
	if *service && !*console {
		return runService(ctx, fs.Arg(0), opts, stdout)
	}

	logger := log.New(stdout, "", log.LstdFlags)
	return serve(ctx, "console", opts, logger, stdout)
}

// serveOptions are the parsed run options threaded into serve() and the service
// manager's run callback.
type serveOptions struct {
	configPath string
	dataDir    string
	port       int
	pluginsDir string
	powerLive  bool
}

// runService dispatches the --service sub-command: install/uninstall register or
// remove the OS service; run (the default) executes the engine under the manager,
// mapping a manager Stop into a context cancel so shutdown stays graceful.
func runService(ctx context.Context, actionArg string, opts serveOptions, stdout io.Writer) error {
	action, err := service.ParseAction(actionArg)
	if err != nil {
		return err
	}
	exe, err := os.Executable()
	if err != nil {
		return fmt.Errorf("resolve executable: %w", err)
	}
	def := service.Definition{
		Exec: exe,
		// The supervised process must re-enter service run mode (not re-install).
		Args: []string{"--service", string(service.ActionRun),
			"--data", opts.dataDir, "--plugins", opts.pluginsDir,
			"--config", opts.configPath, "--port", fmt.Sprintf("%d", opts.port)},
	}
	mgr, err := service.New(def, func(stop <-chan struct{}) error {
		svcCtx, cancel := context.WithCancel(ctx)
		defer cancel()
		go func() {
			select {
			case <-stop:
				cancel()
			case <-svcCtx.Done():
			}
		}()
		logger := log.New(stdout, "", log.LstdFlags)
		return serve(svcCtx, "service", opts, logger, stdout)
	})
	if err != nil {
		return err
	}
	switch action {
	case service.ActionInstall:
		if err := mgr.Install(); err != nil {
			return err
		}
		_, _ = fmt.Fprintf(stdout, "cyberdeck: service %q installed\n", service.Name)
		return nil
	case service.ActionUninstall:
		if err := mgr.Uninstall(); err != nil {
			return err
		}
		_, _ = fmt.Fprintf(stdout, "cyberdeck: service %q uninstalled\n", service.Name)
		return nil
	default:
		return mgr.Run()
	}
}

// serve boots the wired engine subsystems to READY, prints the pairing QR, and
// serves until ctx is cancelled (OS signal, loopback control quit, or service
// manager stop), then shuts down gracefully. mode is "console" or "service".
func serve(ctx context.Context, mode string, opts serveOptions, logger *log.Logger, stdout io.Writer) error {
	configPath, dataDir, port, pluginsDir, powerLive := opts.configPath, opts.dataDir, opts.port, opts.pluginsDir, opts.powerLive

	// Announce the selected mode before contending for the single-instance lock so
	// the chosen path is observable even when another instance already holds it.
	logger.Printf("cyberdeck %s starting in %s mode", version, mode)

	lock, err := lifecycle.AcquireInstance(instanceName(dataDir), func() {
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

	cfg, cfgErr := config.Load(configPath)
	if cfgErr != nil {
		logger.Printf("config: %v (continuing with defaults)", cfgErr)
	}
	logger.Printf("config loaded (telemetry cpu interval %dms)", cfg.Telemetry.CPUIntervalMS)

	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		return fmt.Errorf("create data dir: %w", err)
	}
	db, err := persistence.Open(filepath.Join(dataDir, "cyberdeck.db"))
	if err != nil {
		return fmt.Errorf("open database: %w", err)
	}

	// runCtx is cancelled either by an OS signal (parent ctx) or by the loopback
	// control channel's service.quit op (eng.quit) — both drive graceful shutdown.
	runCtx, cancelRun := context.WithCancel(ctx)
	defer cancelRun()

	eng := &engine{
		logger: logger, port: port, pluginsDir: pluginsDir, powerDryRun: !powerLive,
		quit: cancelRun,
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

	<-runCtx.Done()
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
			// First-slice default: grant the bundled categories so the deck is usable
			// (destructive actions still require the device's 2-tap confirm).
			security.WithDefaultPermissions(`{"allowPowerActions":true,"allowedCategories":["power","volume","launch"],"deniedActions":[],"allowEditTrigger":true}`),
		)
		if err != nil {
			return fmt.Errorf("pairing server: %w", err)
		}

		e.audit = persistence.NewAuditRepo(db)
		auditor := auditAdapter{repo: e.audit, logger: e.logger}
		invoker := pluginInvoker{host: e.host, lookup: builtinLookup}
		e.server = session.NewServer(e.fanout, layout.DefaultProfile(), e.store, builtinLookup, invoker, auditor, e.logger)
		e.listener = session.NewListener(fmt.Sprintf(":%d", e.port), pairingSrv, e.server, e.logger)
		e.pump = session.NewStatePump(e.store, e.fanout, 500*time.Millisecond, e.logger)

		// Loopback control channel (PROJ-144): a privileged, 127.0.0.1-only listener
		// the local Desktop UI / console dials to drive status/pause/resume/quit, mint
		// pairing tokens, and read the audit tail. It is deliberately NOT wired into
		// the LAN ChannelMux/session path — that boundary stays unwired.
		handler := transport.NewControlHandler(
			lifeController{eng: e},
			e.tokens, // *security.TokenIssuer satisfies TokenMinter.Issue(privileged)
			auditReader{repo: e.audit},
		)
		e.control = transport.NewControlChannel(transport.DefaultControlAddr, handler, e.logger)
		return nil
	}
}

// hostService launches + tears down the bundled first-party plugins.
type hostService struct{ eng *engine }

func (h *hostService) Start(context.Context) error {
	h.eng.launchPlugin("telemetry", nil)
	dryRun := h.eng.powerDryRun
	if dryRun {
		h.eng.logger.Printf("actions are DRY-RUN (use --power-live to execute power/volume/launch for real)")
	}
	h.eng.launchPlugin("power", envIf(dryRun, "CYBERDECK_POWER_DRYRUN=1"))
	h.eng.launchPlugin("volume", envIf(dryRun, "CYBERDECK_VOLUME_DRYRUN=1"))
	h.eng.launchPlugin("launchers", envIf(dryRun, "CYBERDECK_LAUNCH_DRYRUN=1"))
	// media controls transport via OS media keys (dry-run skips the real key presses).
	h.eng.launchPlugin("media", envIf(dryRun, "CYBERDECK_MEDIA_DRYRUN=1"))
	// system: performance modes + maintenance utilities + fan local-state.
	h.eng.launchPlugin("system", envIf(dryRun, "CYBERDECK_SYSTEM_DRYRUN=1"))
	// notifications is read-only (publishes notification.count; no actions).
	h.eng.launchPlugin("notifications", nil)
	return nil
}

// envIf returns [kv] when on, else nil (a plugin's dry-run env switch).
func envIf(on bool, kv string) []string {
	if on {
		return []string{kv}
	}
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
	// The loopback control channel starts in the same boot stage as the LAN
	// listener ("start transport (LAN listener + loopback control)") so the local
	// UI/console can drive the engine from boot; it binds 127.0.0.1 only.
	if err := t.eng.control.Start(ctx); err != nil {
		return err
	}
	if err := t.eng.listener.Start(ctx); err != nil {
		return err
	}
	t.eng.logger.Printf("loopback control channel on %s", t.eng.control.Addr())
	return nil
}

func (t *transportService) Stop(ctx context.Context) error {
	t.eng.server.CloseAll()
	err := t.eng.listener.Stop(ctx)
	if cerr := t.eng.control.Stop(ctx); cerr != nil && err == nil {
		err = cerr
	}
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
		case strings.HasPrefix(line, "restrict "):
			e.restrictDevice(w, strings.TrimSpace(strings.TrimPrefix(line, "restrict ")))
		case line == "help":
			_, _ = fmt.Fprintln(w, "commands: <Enter> = new pairing code · list · revoke <uuid> · restrict <uuid> · help")
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

// restrictedPermsJSON is the grant the console `restrict` command applies: power
// actions denied (no power category, allowPowerActions=false) while volume + launch
// stay usable. The session honours this on the device's next (re)connect — the
// pairing handshake keeps a known device's stored grant (see security.Handshake).
const restrictedPermsJSON = `{"allowPowerActions":false,"allowedCategories":["volume","launch"],"deniedActions":[],"allowEditTrigger":false}`

// restrictDevice tightens a paired device's permissions to the restricted grant
// (power denied) and drops any live session so the new grant takes effect on
// reconnect. This is the operator control behind the permissioned-2nd-device journey
// (J6 / P1-AC-07): a restricted device's power action is denied engine-side + audited.
func (e *engine) restrictDevice(w io.Writer, uuid string) {
	if uuid == "" {
		_, _ = fmt.Fprintln(w, "usage: restrict <uuid>")
		return
	}
	d, err := e.devices.Get(context.Background(), uuid)
	if err != nil {
		_, _ = fmt.Fprintf(w, "restrict %s: %v\n", uuid, err)
		return
	}
	d.PermissionsJSON = restrictedPermsJSON
	if err := e.devices.Update(context.Background(), d); err != nil {
		_, _ = fmt.Fprintf(w, "restrict %s: %v\n", uuid, err)
		return
	}
	closed := e.server.CloseDevice(uuid) // force a reconnect that re-reads the grant
	e.logger.Printf("restricted device %s (power denied; live session closed=%v)", uuid, closed)
	_, _ = fmt.Fprintf(w, "restricted %s (power denied; live session closed=%v)\n", uuid, closed)
}

// --- small adapters local to the entrypoint wiring ---

// memKV is an in-memory PublicStore for the (per-run) engine identity.
type memKV struct{ m map[string]string }

func (s *memKV) GetString(k string) (string, bool, error) { v, ok := s.m[k]; return v, ok, nil }
func (s *memKV) SetString(k, v string) error              { s.m[k] = v; return nil }

// lifeController adapts the engine to transport.LifecycleController so the loopback
// control channel can drive run-state (PROJ-144). Pause drops live sessions (and
// flags the engine paused); Resume clears the flag (the LAN listener keeps
// accepting); Quit cancels the run context to start a graceful shutdown.
type lifeController struct{ eng *engine }

func (c lifeController) Status(context.Context) (string, error) {
	if c.eng.paused {
		return "paused", nil
	}
	return "running", nil
}

func (c lifeController) Pause(context.Context) error {
	c.eng.paused = true
	c.eng.server.CloseAll()
	c.eng.logger.Printf("control: paused (live sessions dropped)")
	return nil
}

func (c lifeController) Resume(context.Context) error {
	c.eng.paused = false
	c.eng.logger.Printf("control: resumed")
	return nil
}

func (c lifeController) Quit(context.Context) error {
	c.eng.logger.Printf("control: quit requested")
	if c.eng.quit != nil {
		c.eng.quit()
	}
	return nil
}

// auditReader adapts persistence.AuditRepo to transport.AuditReader: it reads the
// audit tail and maps records into the transport-level AuditRow (which avoids a
// persistence import inside the transport package).
type auditReader struct{ repo *persistence.AuditRepo }

func (r auditReader) Recent(ctx context.Context, limit int) ([]transport.AuditRow, error) {
	recs, err := r.repo.Recent(ctx, limit)
	if err != nil {
		return nil, err
	}
	rows := make([]transport.AuditRow, 0, len(recs))
	for _, a := range recs {
		rows = append(rows, transport.AuditRow{
			ID: a.ID, TS: a.TS, Actor: a.Actor, EventType: a.EventType,
			ResourceType: a.ResourceType, ResourceID: a.ResourceID, PayloadJSON: a.PayloadJSON,
		})
	}
	return rows, nil
}

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

// builtinLookup is the static action catalogue for the bundled first-party plugins
// (the full manifest→registry merge is a strengthening follow-up; this is enough to
// authorize + route the default deck's controls). Source routes to the owning plugin.
var builtinLookup = staticLookup{m: func() map[string]registry.ActionDescriptor {
	d := func(id, label, category, source string, destructive bool) registry.ActionDescriptor {
		return registry.ActionDescriptor{ID: id, Label: label, Category: category, Source: source, Destructive: destructive}
	}
	return map[string]registry.ActionDescriptor{
		// power (plugins/power)
		"system.shutdown":  d("system.shutdown", "Shut Down", "power", "power", true),
		"system.restart":   d("system.restart", "Restart", "power", "power", true),
		"system.sleep":     d("system.sleep", "Sleep", "power", "power", false),
		"system.hibernate": d("system.hibernate", "Hibernate", "power", "power", true),
		"system.lock":      d("system.lock", "Lock", "power", "power", false),
		"system.logoff":    d("system.logoff", "Log Off", "power", "power", true),
		// volume (plugins/volume)
		"volume.set":  d("volume.set", "Set Volume", "volume", "volume", false),
		"volume.mute": d("volume.mute", "Toggle Mute", "volume", "volume", false),
		// launchers (plugins/launchers)
		"launch.app": d("launch.app", "Launch App", "launch", "launchers", false),
		"launch.url": d("launch.url", "Open URL", "launch", "launchers", false),
		// media (plugins/media)
		"media.transport.playPause": d("media.transport.playPause", "Play/Pause", "media", "media", false),
		"media.transport.next":      d("media.transport.next", "Next Track", "media", "media", false),
		"media.transport.previous":  d("media.transport.previous", "Previous Track", "media", "media", false),
		// system utilities (plugins/system)
		"performance.setMode.silent":      d("performance.setMode.silent", "Silent Mode", "performance", "system", false),
		"performance.setMode.balanced":    d("performance.setMode.balanced", "Balanced Mode", "performance", "system", false),
		"performance.setMode.performance": d("performance.setMode.performance", "Performance Mode", "performance", "system", false),
		"performance.setMode.turbo":       d("performance.setMode.turbo", "Turbo Mode", "performance", "system", false),
		"system.clearCache":               d("system.clearCache", "Clear Cache", "system", "system", true),
		"system.emptyRecycleBin":          d("system.emptyRecycleBin", "Empty Recycle Bin", "system", "system", true),
		"fan.setSpeed.cpu":                d("fan.setSpeed.cpu", "CPU Fan Speed", "fan", "system", false),
		"fan.setSpeed.case1":              d("fan.setSpeed.case1", "Case Fan Speed", "fan", "system", false),
		"fan.toggleAuto":                  d("fan.toggleAuto", "Auto Fan Control", "fan", "system", false),
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
