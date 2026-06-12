package service

import (
	"fmt"
	"strings"
)

// This file holds the manager-agnostic unit renderers — the launchd plist and the
// systemd unit — plus their small naming/escaping helpers. They are pure string
// builders with no OS-specific imports, so they live untagged here (rather than in
// darwin.go/linux.go) to compile and be unit-tested on every host, matching the
// package doc. The OS-specific managers (darwin.go/linux.go) call them.

// renderLaunchdPlist renders a macOS launchd property-list for the definition.
// KeepAlive + RunAtLoad make launchd restart the engine if it exits and start it
// at boot/login — that is what keeps the deck reachable after the UI closes.
func renderLaunchdPlist(d Definition) string {
	d = d.withDefaults()
	var b strings.Builder
	b.WriteString(`<?xml version="1.0" encoding="UTF-8"?>` + "\n")
	b.WriteString(`<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">` + "\n")
	b.WriteString(`<plist version="1.0">` + "\n")
	b.WriteString("<dict>\n")
	b.WriteString("  <key>Label</key>\n")
	fmt.Fprintf(&b, "  <string>%s</string>\n", launchdLabel(d.Name))
	b.WriteString("  <key>ProgramArguments</key>\n")
	b.WriteString("  <array>\n")
	for _, a := range append([]string{d.Exec}, d.Args...) {
		fmt.Fprintf(&b, "    <string>%s</string>\n", plistEscape(a))
	}
	b.WriteString("  </array>\n")
	b.WriteString("  <key>RunAtLoad</key>\n  <true/>\n")
	b.WriteString("  <key>KeepAlive</key>\n  <true/>\n")
	b.WriteString("</dict>\n")
	b.WriteString("</plist>\n")
	return b.String()
}

// launchdLabel namespaces the service under a reverse-DNS-ish label as launchd
// expects.
func launchdLabel(name string) string {
	if name == "" {
		name = Name
	}
	return "io.cyberdeck." + strings.ToLower(name)
}

// plistEscape escapes the XML metacharacters that can appear in a path/arg.
func plistEscape(s string) string {
	r := strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;")
	return r.Replace(s)
}

// renderSystemdUnit renders a Linux systemd service unit for the definition.
// Restart=on-failure keeps the engine up; WantedBy multi-user.target starts it at
// boot so the deck stays reachable independent of any UI.
func renderSystemdUnit(d Definition) string {
	d = d.withDefaults()
	var b strings.Builder
	b.WriteString("[Unit]\n")
	fmt.Fprintf(&b, "Description=%s\n", d.Description)
	b.WriteString("After=network.target\n\n")
	b.WriteString("[Service]\n")
	b.WriteString("Type=simple\n")
	fmt.Fprintf(&b, "ExecStart=%s\n", systemdExecStart(d))
	b.WriteString("Restart=on-failure\n")
	b.WriteString("RestartSec=2\n\n")
	b.WriteString("[Install]\n")
	b.WriteString("WantedBy=multi-user.target\n")
	return b.String()
}

// systemdExecStart joins the executable + args into an ExecStart line, quoting any
// argument that contains whitespace (systemd splits on spaces).
func systemdExecStart(d Definition) string {
	parts := append([]string{d.Exec}, d.Args...)
	for i, p := range parts {
		if strings.ContainsAny(p, " \t") {
			parts[i] = `"` + p + `"`
		}
	}
	return strings.Join(parts, " ")
}

// systemdUnitName is the unit filename for the service.
func systemdUnitName(name string) string {
	if name == "" {
		name = Name
	}
	return strings.ToLower(name) + ".service"
}
