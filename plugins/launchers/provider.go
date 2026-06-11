// Command launchers is the first-party CyberDeck launchers/system-tools plugin
// (PROJ-175): it opens an application/file (launch.app{path}) or a URL
// (launch.url{url}) via the per-OS opener (start / open / xdg-open). Commands are
// mockable so tests never spawn anything.
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os/exec"
	"runtime"
)

// Launcher action IDs.
const (
	actLaunchApp = "launch.app"
	actLaunchURL = "launch.url"
)

// runner executes an OS command. Injectable so tests record commands instead of
// spawning processes.
type runner func(ctx context.Context, name string, args ...string) error

func execRunner(ctx context.Context, name string, args ...string) error {
	return exec.CommandContext(ctx, name, args...).Run()
}

type provider struct{ run runner }

func newProvider(r runner) *provider {
	if r == nil {
		r = execRunner
	}
	return &provider{run: r}
}

// execute opens the action's target (path/url) via the platform opener.
func (p *provider) execute(ctx context.Context, actionID string, params json.RawMessage) error {
	target := targetFor(actionID, params)
	if target == "" {
		return fmt.Errorf("launchers: %q requires a target", actionID)
	}
	name, args, ok := openCommand(target)
	if !ok {
		return fmt.Errorf("launchers: unsupported platform %q", runtime.GOOS)
	}
	if err := p.run(ctx, name, args...); err != nil {
		return fmt.Errorf("launchers: %q: %w", actionID, err)
	}
	return nil
}

// targetFor extracts the path/url/target param for the action.
func targetFor(actionID string, params json.RawMessage) string {
	var p struct {
		Path   string `json:"path"`
		URL    string `json:"url"`
		Target string `json:"target"`
	}
	_ = json.Unmarshal(params, &p)
	switch actionID {
	case actLaunchApp:
		if p.Path != "" {
			return p.Path
		}
	case actLaunchURL:
		if p.URL != "" {
			return p.URL
		}
	}
	return p.Target
}

// openCommand returns the platform opener for a target (app/file/URL).
func openCommand(target string) (name string, args []string, ok bool) {
	switch runtime.GOOS {
	case "windows":
		return "cmd", []string{"/c", "start", "", target}, true
	case "darwin":
		return "open", []string{target}, true
	case "linux":
		return "xdg-open", []string{target}, true
	default:
		return "", nil, false
	}
}
