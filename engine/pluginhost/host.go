package pluginhost

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os/exec"
	"sync"
	"sync/atomic"
	"time"
)

// StateSetter is the engine state store seam (PROJ-160): plugin stateUpdates flow
// into it. *state.Store satisfies this (Set(id, value)).
type StateSetter interface {
	Set(id string, value any) error
}

// Host launches and supervises out-of-process plugins and brokers their IPC
// (2F §4/§5). A crashing plugin never takes down the engine (NFR-07; restart/fault
// policy is PROJ-131).
type Host struct {
	setter     StateSetter
	logger     *log.Logger
	onRegister func(plugin string, rp RegisterPayload)
	denier     AuditDenier
	hbTimeout  time.Duration

	mu      sync.Mutex
	plugins map[string]*Plugin
}

// Option configures a Host.
type Option func(*Host)

// WithStateSetter wires plugin stateUpdates into the state store.
func WithStateSetter(s StateSetter) Option { return func(h *Host) { h.setter = s } }

// WithLogger sets the engine logger that captures plugin log messages.
func WithLogger(l *log.Logger) Option {
	return func(h *Host) {
		if l != nil {
			h.logger = l
		}
	}
}

// WithOnRegister sets the callback invoked when a plugin registers contributions.
func WithOnRegister(fn func(string, RegisterPayload)) Option {
	return func(h *Host) { h.onRegister = fn }
}

// WithAuditDenier sets the sink for plugin permission denials (PROJ-133/127).
func WithAuditDenier(d AuditDenier) Option { return func(h *Host) { h.denier = d } }

// WithHeartbeatTimeout sets the liveness timeout (a plugin silent longer than this
// is considered hung).
func WithHeartbeatTimeout(d time.Duration) Option {
	return func(h *Host) {
		if d > 0 {
			h.hbTimeout = d
		}
	}
}

// NewHost creates a plugin host.
func NewHost(opts ...Option) *Host {
	h := &Host{
		logger:    log.Default(),
		hbTimeout: 5 * time.Second,
		plugins:   make(map[string]*Plugin),
	}
	for _, o := range opts {
		o(h)
	}
	return h
}

// LaunchSpec describes how to start a plugin process.
type LaunchSpec struct {
	Name         string
	Path         string
	Args         []string
	Env          []string // appended to the host environment
	Dir          string
	Config       json.RawMessage
	GrantedPerms []string
	Permissions  ManifestPermissions // network/filesystem levels for the IPC gate (PROJ-133)
	Stderr       io.Writer           // per-plugin log sink (nil = discard)
}

// Launch starts a plugin process, sends init, and begins the IPC + supervision
// loops.
func (h *Host) Launch(spec LaunchSpec) (*Plugin, error) {
	cmd := exec.Command(spec.Path, spec.Args...)
	cmd.Dir = spec.Dir
	if len(spec.Env) > 0 {
		cmd.Env = append(cmd.Environ(), spec.Env...)
	}
	if spec.Stderr != nil {
		cmd.Stderr = spec.Stderr
	}

	stdin, err := cmd.StdinPipe()
	if err != nil {
		return nil, fmt.Errorf("pluginhost: stdin pipe: %w", err)
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, fmt.Errorf("pluginhost: stdout pipe: %w", err)
	}
	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("pluginhost: start %q: %w", spec.Name, err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	p := &Plugin{
		name:       spec.Name,
		host:       h,
		cmd:        cmd,
		perms:      spec.Permissions,
		stdin:      stdin,
		ctx:        ctx,
		cancel:     cancel,
		exited:     make(chan struct{}),
		unhealthy:  make(chan struct{}),
		registered: make(chan RegisterPayload, 1),
		results:    make(map[string]chan ActionResultPayload),
	}
	p.markBeat()

	h.mu.Lock()
	h.plugins[spec.Name] = p
	h.mu.Unlock()

	// init handshake (host → plugin).
	if err := p.send(Message{Type: MsgInit, Init: &InitPayload{Config: spec.Config, GrantedPerms: spec.GrantedPerms}}); err != nil {
		_ = p.Close()
		return nil, fmt.Errorf("pluginhost: send init to %q: %w", spec.Name, err)
	}

	go func() { p.exitErr = cmd.Wait(); close(p.exited) }()
	p.wg.Add(2)
	go p.readLoop(stdout)
	go p.monitor()
	return p, nil
}

// Shutdown closes every launched plugin (each plugin's Close does SIGTERM-then-kill
// with a grace period) and clears the registry. It is the lifecycle "stop plugins"
// step (PROJ-105). Safe to call with no plugins launched.
func (h *Host) Shutdown(context.Context) error {
	h.mu.Lock()
	plugins := make([]*Plugin, 0, len(h.plugins))
	for _, p := range h.plugins {
		plugins = append(plugins, p)
	}
	h.plugins = make(map[string]*Plugin)
	h.mu.Unlock()

	var first error
	for _, p := range plugins {
		if err := p.Close(); err != nil && first == nil {
			first = err
		}
	}
	return first
}

// Plugin returns a launched plugin by name.
func (h *Host) Plugin(name string) (*Plugin, bool) {
	h.mu.Lock()
	defer h.mu.Unlock()
	p, ok := h.plugins[name]
	return p, ok
}

// Plugin is one supervised plugin process.
type Plugin struct {
	name  string
	host  *Host
	cmd   *exec.Cmd
	perms ManifestPermissions

	stdin   io.WriteCloser
	writeMu sync.Mutex

	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup

	lastBeat      atomic.Int64 // unix-nanos of last received message
	unhealthy     chan struct{}
	unhealthyOnce sync.Once

	exited  chan struct{}
	exitErr error

	registered chan RegisterPayload

	stateMu        sync.Mutex
	declaredStates []string

	resultsMu sync.Mutex
	results   map[string]chan ActionResultPayload
}

// DeclaredStates returns the state IDs the plugin declared in its register message
// (used by the supervisor to mark them unavailable on fault, PROJ-131).
func (p *Plugin) DeclaredStates() []string {
	p.stateMu.Lock()
	defer p.stateMu.Unlock()
	return append([]string(nil), p.declaredStates...)
}

func (p *Plugin) setDeclaredStates(states []string) {
	p.stateMu.Lock()
	p.declaredStates = append([]string(nil), states...)
	p.stateMu.Unlock()
}

// Name returns the plugin name.
func (p *Plugin) Name() string { return p.name }

// Registered returns a channel that yields the first register payload.
func (p *Plugin) Registered() <-chan RegisterPayload { return p.registered }

// Exited is closed when the process has exited.
func (p *Plugin) Exited() <-chan struct{} { return p.exited }

// ExitErr returns the process exit error (valid after Exited is closed).
func (p *Plugin) ExitErr() error { return p.exitErr }

func (p *Plugin) markBeat() { p.lastBeat.Store(time.Now().UnixNano()) }

// send writes one message to the plugin's stdin.
func (p *Plugin) send(m Message) error {
	b, err := encodeMessage(m)
	if err != nil {
		return err
	}
	p.writeMu.Lock()
	defer p.writeMu.Unlock()
	_, err = p.stdin.Write(b)
	return err
}

// readLoop reads and dispatches plugin→host messages until stdout closes.
func (p *Plugin) readLoop(stdout io.Reader) {
	defer p.wg.Done()
	sc := bufio.NewScanner(stdout)
	sc.Buffer(make([]byte, 0, 64*1024), 4<<20)
	for sc.Scan() {
		p.markBeat() // any traffic is liveness
		var m Message
		if err := json.Unmarshal(sc.Bytes(), &m); err != nil {
			p.host.logger.Printf("pluginhost: %s: bad message: %v", p.name, err)
			continue
		}
		p.dispatch(m)
	}
}

func (p *Plugin) dispatch(m Message) {
	switch m.Type {
	case MsgRegister:
		if m.Register != nil {
			p.setDeclaredStates(m.Register.States)
			if p.host.onRegister != nil {
				p.host.onRegister(p.name, *m.Register)
			}
			select {
			case p.registered <- *m.Register:
			default:
			}
		}
	case MsgStateUpdate:
		if m.State != nil {
			// IPC permission gate (PROJ-133): a plugin may only publish states it
			// declared in its register/manifest.
			if !p.allowsState(m.State.ID) {
				p.host.auditDenied(p.name, "state", m.State.ID)
				return
			}
			if p.host.setter != nil {
				if err := p.host.setter.Set(m.State.ID, m.State.Value); err != nil {
					p.host.logger.Printf("pluginhost: %s: stateUpdate %q rejected: %v", p.name, m.State.ID, err)
				}
			}
		}
	case MsgLog:
		if m.Log != nil {
			p.host.logger.Printf("[plugin %s] %s: %s", p.name, m.Log.Level, m.Log.Msg)
		}
	case MsgActionResult:
		if m.ActionResult != nil {
			p.deliverResult(*m.ActionResult)
		}
	case MsgHeartbeat:
		// liveness already recorded by markBeat
	}
}

func (p *Plugin) deliverResult(r ActionResultPayload) {
	p.resultsMu.Lock()
	ch, ok := p.results[r.CallID]
	if ok {
		delete(p.results, r.CallID)
	}
	p.resultsMu.Unlock()
	if ok {
		ch <- r
	}
}

// Close shuts the plugin down: closes stdin (signalling exit), waits for the
// process with a kill fallback, and stops the IPC/supervision goroutines.
func (p *Plugin) Close() error {
	p.cancel()
	_ = p.stdin.Close()
	select {
	case <-p.exited:
	case <-time.After(2 * time.Second):
		_ = p.cmd.Process.Kill()
		<-p.exited
	}
	p.wg.Wait()
	return nil
}
