//go:build windows

package service

import (
	"fmt"

	"golang.org/x/sys/windows/svc"
	"golang.org/x/sys/windows/svc/mgr"
)

// New returns the Windows SCM-backed manager. run is the engine's blocking run
// function; its stop channel is closed when the SCM requests Stop/Shutdown so the
// engine can shut down gracefully.
func New(def Definition, run RunFunc) (Manager, error) {
	return &windowsManager{def: def.withDefaults(), run: run}, nil
}

type windowsManager struct {
	def Definition
	run RunFunc
}

// Install registers the engine as an auto-start SCM service. It fails if a service
// of the same name already exists so a re-install is an explicit uninstall first.
func (m *windowsManager) Install() error {
	mgrConn, err := mgr.Connect()
	if err != nil {
		return fmt.Errorf("service: connect SCM: %w", err)
	}
	defer func() { _ = mgrConn.Disconnect() }()

	if s, err := mgrConn.OpenService(m.def.Name); err == nil {
		_ = s.Close()
		return fmt.Errorf("service: %q already installed (uninstall first)", m.def.Name)
	}

	s, err := mgrConn.CreateService(m.def.Name, m.def.Exec, mgr.Config{
		DisplayName:  m.def.DisplayName,
		Description:  m.def.Description,
		StartType:    mgr.StartAutomatic,
		ErrorControl: mgr.ErrorNormal,
	}, m.def.Args...)
	if err != nil {
		return fmt.Errorf("service: create %q: %w", m.def.Name, err)
	}
	defer func() { _ = s.Close() }()
	return nil
}

// Uninstall removes the SCM service registration.
func (m *windowsManager) Uninstall() error {
	mgrConn, err := mgr.Connect()
	if err != nil {
		return fmt.Errorf("service: connect SCM: %w", err)
	}
	defer func() { _ = mgrConn.Disconnect() }()

	s, err := mgrConn.OpenService(m.def.Name)
	if err != nil {
		return fmt.Errorf("service: open %q: %w", m.def.Name, err)
	}
	defer func() { _ = s.Close() }()
	if err := s.Delete(); err != nil {
		return fmt.Errorf("service: delete %q: %w", m.def.Name, err)
	}
	return nil
}

// Run dispatches to the SCM when launched by it, running the engine under SCM
// supervision (svc.Run blocks until the SCM stops the service). When invoked
// interactively (not under the SCM — e.g. `cyberdeck --service` from a shell or in
// tests), there is no service controller to connect to, so it falls back to running
// the engine in the foreground with a stop channel the engine's own signal handling
// closes via ctx.
func (m *windowsManager) Run() error {
	isService, err := svc.IsWindowsService()
	if err != nil {
		return fmt.Errorf("service: detect SCM context: %w", err)
	}
	if !isService {
		return m.run(make(chan struct{}))
	}
	return svc.Run(m.def.Name, m)
}

// Execute is the svc.Handler entry point. It signals RUNNING, launches the engine
// (passing a stop channel closed on a Stop/Shutdown request), and returns once the
// engine has finished its graceful shutdown so the SCM marks the service STOPPED.
func (m *windowsManager) Execute(_ []string, r <-chan svc.ChangeRequest, s chan<- svc.Status) (bool, uint32) {
	const accepted = svc.AcceptStop | svc.AcceptShutdown
	s <- svc.Status{State: svc.StartPending}

	stop := make(chan struct{})
	done := make(chan error, 1)
	go func() { done <- m.run(stop) }()

	s <- svc.Status{State: svc.Running, Accepts: accepted}
	stopRequested := false
	for {
		select {
		case err := <-done:
			if err != nil {
				return true, 1
			}
			return false, 0
		case c := <-r:
			switch c.Cmd {
			case svc.Interrogate:
				s <- c.CurrentStatus
			case svc.Stop, svc.Shutdown:
				s <- svc.Status{State: svc.StopPending}
				if !stopRequested {
					stopRequested = true
					close(stop)
				}
			}
		}
	}
}
