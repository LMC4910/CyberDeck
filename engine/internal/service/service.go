// Package service wraps the host engine in the platform service manager so it
// survives the UI being closed (P1-AC-01): Windows SCM, macOS launchd, and Linux
// systemd. `cyberdeck --service` runs under the manager; `cyberdeck --service
// install|uninstall` registers/removes the unit. The OS-specific install/run lives
// in service_{windows,darwin,linux}.go; the manager-agnostic bits — the service
// identity and the launchd/systemd unit renderers — live here so they compile and
// are testable on every OS (cross-compile-clean: no build tags, stdlib only).
package service

import (
	"fmt"
	"strings"
)

// Name is the service/daemon identifier registered with the OS manager. Kept
// short + dotless so it is a valid SCM service name, launchd label, and systemd
// unit base alike.
const Name = "CyberDeck"

// Definition describes how the engine should be registered with the platform
// service manager. Exec is the absolute path to the engine binary; Args are the
// arguments the manager launches it with (it must include the run-as-service flag,
// e.g. "--service", so the supervised process enters service mode rather than
// re-installing itself).
type Definition struct {
	Name        string   // service id (defaults to Name when empty)
	DisplayName string   // human label shown by the manager
	Description string   // one-line description
	Exec        string   // absolute path to the engine executable
	Args        []string // arguments the manager passes (must select service run mode)
}

// withDefaults returns a copy of d with empty identity fields filled in.
func (d Definition) withDefaults() Definition {
	if d.Name == "" {
		d.Name = Name
	}
	if d.DisplayName == "" {
		d.DisplayName = "CyberDeck Engine"
	}
	if d.Description == "" {
		d.Description = "CyberDeck host engine — keeps the deck reachable after the UI closes."
	}
	return d
}

// Manager registers/removes the engine with the platform service manager and, when
// launched by that manager, runs the engine under its supervision. The concrete
// implementation is selected per-OS (service_{windows,darwin,linux}.go) via New.
type Manager interface {
	// Install registers the service with the OS manager (idempotent where the
	// platform allows).
	Install() error
	// Uninstall removes the service registration.
	Uninstall() error
	// Run executes the engine under the service manager. On Windows it dispatches
	// to the SCM; on launchd/systemd the manager runs the process directly so Run
	// just invokes the supplied run func and returns its error.
	Run() error
}

// RunFunc is the engine's blocking run function as the service manager invokes it.
// stop is closed when the manager requests a graceful shutdown (Windows SCM
// Stop/Shutdown); on launchd/systemd the OS sends SIGTERM instead, which the
// engine already handles, so stop simply never fires. The func must return when
// either its own work completes or stop is closed.
type RunFunc func(stop <-chan struct{}) error

// Action is a service sub-command parsed from the CLI ("install"/"uninstall"/
// "run"). RunMode means "be the supervised service process" (the default when
// --service is given with no sub-command).
type Action string

const (
	ActionRun       Action = "run"
	ActionInstall   Action = "install"
	ActionUninstall Action = "uninstall"
)

// ParseAction maps the positional arg following --service to an Action. An empty
// arg means run-as-service; "install"/"uninstall" manage registration. Anything
// else is an error so a typo fails loudly instead of silently running.
func ParseAction(arg string) (Action, error) {
	switch strings.TrimSpace(arg) {
	case "", string(ActionRun):
		return ActionRun, nil
	case string(ActionInstall):
		return ActionInstall, nil
	case string(ActionUninstall):
		return ActionUninstall, nil
	default:
		return "", fmt.Errorf("service: unknown action %q (want install|uninstall)", arg)
	}
}
