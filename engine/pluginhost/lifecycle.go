package pluginhost

import (
	"context"
	"sync"
	"time"
)

// Crash isolation (2F §4/§6 / NFR-07, P1-AC-13): a Supervisor keeps a plugin
// running — restarting it with backoff when it crashes or hangs — and after
// repeated failure marks it FAULTED. A faulted plugin keeps its registry
// contributions (so layouts that bind its states don't break) while its states
// read "unavailable" (--). The engine never crashes because a plugin did.

// Status is the supervised plugin's lifecycle state.
type Status int

const (
	StatusReady Status = iota
	StatusRestarting
	StatusFaulted
)

func (s Status) String() string {
	switch s {
	case StatusReady:
		return "READY"
	case StatusRestarting:
		return "RESTARTING"
	case StatusFaulted:
		return "FAULTED"
	default:
		return "UNKNOWN"
	}
}

// Supervisor launches and keeps one plugin alive per LaunchSpec.
type Supervisor struct {
	host           *Host
	spec           LaunchSpec
	maxRestarts    int
	backoff        func(attempt int) time.Duration
	setUnavailable func(stateID string)

	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup

	mu             sync.Mutex
	status         Status
	restarts       int
	current        *Plugin
	declaredStates []string

	faultedCh chan struct{}
	faultOnce sync.Once
}

// SupervisorOption configures a Supervisor.
type SupervisorOption func(*Supervisor)

// WithMaxRestarts sets how many restarts are attempted before faulting.
func WithMaxRestarts(n int) SupervisorOption {
	return func(s *Supervisor) {
		if n >= 0 {
			s.maxRestarts = n
		}
	}
}

// WithBackoff sets the restart backoff function (attempt is 1-based).
func WithBackoff(fn func(attempt int) time.Duration) SupervisorOption {
	return func(s *Supervisor) {
		if fn != nil {
			s.backoff = fn
		}
	}
}

// WithSetUnavailable sets the callback used to mark a faulted plugin's states
// unavailable (wired to the state store at PROJ-105).
func WithSetUnavailable(fn func(stateID string)) SupervisorOption {
	return func(s *Supervisor) { s.setUnavailable = fn }
}

// NewSupervisor creates a supervisor for a plugin spec.
func NewSupervisor(host *Host, spec LaunchSpec, opts ...SupervisorOption) *Supervisor {
	ctx, cancel := context.WithCancel(context.Background())
	s := &Supervisor{
		host:        host,
		spec:        spec,
		maxRestarts: 3,
		backoff:     defaultBackoff,
		ctx:         ctx,
		cancel:      cancel,
		faultedCh:   make(chan struct{}),
	}
	for _, o := range opts {
		o(s)
	}
	return s
}

func defaultBackoff(attempt int) time.Duration {
	d := 100 * time.Millisecond * time.Duration(1<<min(attempt, 6))
	if d > 5*time.Second {
		d = 5 * time.Second
	}
	return d
}

// Start launches the plugin and begins supervision.
func (s *Supervisor) Start() error {
	p, err := s.host.Launch(s.spec)
	if err != nil {
		return err
	}
	s.setCurrent(p)
	s.setStatus(StatusReady)
	s.wg.Add(1)
	go s.run(p)
	return nil
}

type watchReason int

const (
	watchStop watchReason = iota
	watchFailed
)

func (s *Supervisor) run(p *Plugin) {
	defer s.wg.Done()
	for {
		reason := s.watch(p)
		_ = p.Close()
		if reason == watchStop {
			return
		}
		// Failure: capture the failed plugin's declared states for fault handling.
		s.storeStates(p.DeclaredStates())

		s.mu.Lock()
		if s.restarts >= s.maxRestarts {
			s.mu.Unlock()
			s.fault()
			return
		}
		s.restarts++
		attempt := s.restarts
		s.status = StatusRestarting
		s.mu.Unlock()

		if !s.sleep(s.backoff(attempt)) {
			return // stopped during backoff
		}
		np, err := s.host.Launch(s.spec)
		if err != nil {
			s.host.logger.Printf("supervisor: relaunch %q failed: %v", s.spec.Name, err)
			s.fault()
			return
		}
		s.setCurrent(np)
		s.setStatus(StatusReady)
		p = np
	}
}

// watch blocks until the plugin fails (exit/hang) or the supervisor is stopped.
func (s *Supervisor) watch(p *Plugin) watchReason {
	select {
	case <-s.ctx.Done():
		return watchStop
	case <-p.Unhealthy():
		return watchFailed
	case <-p.Exited():
		return watchFailed
	}
}

func (s *Supervisor) fault() {
	s.mu.Lock()
	s.status = StatusFaulted
	states := append([]string(nil), s.declaredStates...)
	s.mu.Unlock()

	// Keep contributions registered (no unregister); mark bound states unavailable.
	if s.setUnavailable != nil {
		for _, id := range states {
			s.setUnavailable(id)
		}
	}
	s.faultOnce.Do(func() { close(s.faultedCh) })
	s.host.logger.Printf("supervisor: plugin %q FAULTED after %d restarts; %d states marked unavailable",
		s.spec.Name, s.maxRestarts, len(states))
}

func (s *Supervisor) sleep(d time.Duration) bool {
	if d <= 0 {
		select {
		case <-s.ctx.Done():
			return false
		default:
			return true
		}
	}
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-t.C:
		return true
	case <-s.ctx.Done():
		return false
	}
}

// Stop ends supervision and closes the current plugin.
func (s *Supervisor) Stop() {
	s.cancel()
	s.mu.Lock()
	p := s.current
	s.mu.Unlock()
	if p != nil {
		_ = p.Close()
	}
	s.wg.Wait()
}

// Status returns the current lifecycle status.
func (s *Supervisor) Status() Status {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.status
}

// Restarts returns the number of restarts performed.
func (s *Supervisor) Restarts() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.restarts
}

// Faulted is closed once the plugin has faulted.
func (s *Supervisor) Faulted() <-chan struct{} { return s.faultedCh }

func (s *Supervisor) setCurrent(p *Plugin) {
	s.mu.Lock()
	s.current = p
	s.mu.Unlock()
}

func (s *Supervisor) setStatus(st Status) {
	s.mu.Lock()
	s.status = st
	s.mu.Unlock()
}

func (s *Supervisor) storeStates(states []string) {
	if len(states) == 0 {
		return
	}
	s.mu.Lock()
	s.declaredStates = append([]string(nil), states...)
	s.mu.Unlock()
}
