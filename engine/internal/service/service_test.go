package service

import (
	"strings"
	"testing"
)

func TestParseAction(t *testing.T) {
	cases := []struct {
		in      string
		want    Action
		wantErr bool
	}{
		{"", ActionRun, false},
		{"run", ActionRun, false},
		{"  run  ", ActionRun, false},
		{"install", ActionInstall, false},
		{"uninstall", ActionUninstall, false},
		{"bogus", "", true},
		{"start", "", true},
	}
	for _, c := range cases {
		got, err := ParseAction(c.in)
		if c.wantErr {
			if err == nil {
				t.Errorf("ParseAction(%q): want error, got nil", c.in)
			}
			continue
		}
		if err != nil {
			t.Errorf("ParseAction(%q): unexpected error %v", c.in, err)
		}
		if got != c.want {
			t.Errorf("ParseAction(%q)=%q, want %q", c.in, got, c.want)
		}
	}
}

func TestDefinitionWithDefaults(t *testing.T) {
	d := Definition{}.withDefaults()
	if d.Name != Name {
		t.Errorf("Name=%q, want %q", d.Name, Name)
	}
	if d.DisplayName == "" || d.Description == "" {
		t.Errorf("DisplayName/Description should be filled: %+v", d)
	}

	// Explicit identity fields are preserved.
	custom := Definition{Name: "Other", DisplayName: "Disp", Description: "Desc"}.withDefaults()
	if custom.Name != "Other" || custom.DisplayName != "Disp" || custom.Description != "Desc" {
		t.Errorf("withDefaults overrode explicit fields: %+v", custom)
	}
}

func TestRenderLaunchdPlist(t *testing.T) {
	d := Definition{
		Exec: "/Applications/CyberDeck/cyberdeck",
		Args: []string{"--service", "run", "--data", "/Users/me/Library/Application Support/CyberDeck"},
	}
	out := renderLaunchdPlist(d)

	mustContain(t, out, `<plist version="1.0">`)
	mustContain(t, out, "<string>io.cyberdeck.cyberdeck</string>")
	mustContain(t, out, "<string>/Applications/CyberDeck/cyberdeck</string>")
	mustContain(t, out, "<string>--service</string>")
	// RunAtLoad + KeepAlive are what keep the engine alive after the UI closes.
	mustContain(t, out, "<key>RunAtLoad</key>")
	mustContain(t, out, "<key>KeepAlive</key>")
}

func TestRenderLaunchdPlistEscapesXML(t *testing.T) {
	d := Definition{Exec: "/opt/a&b/<engine>", Args: nil}
	out := renderLaunchdPlist(d)
	mustContain(t, out, "/opt/a&amp;b/&lt;engine&gt;")
	if strings.Contains(out, "/opt/a&b/<engine>") {
		t.Errorf("raw XML metacharacters leaked into plist:\n%s", out)
	}
}

func TestRenderSystemdUnit(t *testing.T) {
	d := Definition{
		Exec: "/usr/local/bin/cyberdeck",
		Args: []string{"--service", "run"},
	}
	out := renderSystemdUnit(d)

	mustContain(t, out, "[Unit]")
	mustContain(t, out, "[Service]")
	mustContain(t, out, "[Install]")
	mustContain(t, out, "ExecStart=/usr/local/bin/cyberdeck --service run")
	// Restart + WantedBy keep the engine up and start it at boot.
	mustContain(t, out, "Restart=on-failure")
	mustContain(t, out, "WantedBy=multi-user.target")
}

func TestSystemdExecStartQuotesSpaces(t *testing.T) {
	d := Definition{
		Exec: "/opt/My Apps/cyberdeck",
		Args: []string{"--data", "/var/lib/Cyber Deck"},
	}
	got := systemdExecStart(d)
	want := `"/opt/My Apps/cyberdeck" --data "/var/lib/Cyber Deck"`
	if got != want {
		t.Errorf("systemdExecStart=%q, want %q", got, want)
	}
}

func TestSystemdUnitName(t *testing.T) {
	if got := systemdUnitName(""); got != "cyberdeck.service" {
		t.Errorf("systemdUnitName(\"\")=%q, want cyberdeck.service", got)
	}
	if got := systemdUnitName("CyberDeck"); got != "cyberdeck.service" {
		t.Errorf("systemdUnitName(CyberDeck)=%q, want cyberdeck.service", got)
	}
}

func TestLaunchdLabel(t *testing.T) {
	if got := launchdLabel(""); got != "io.cyberdeck.cyberdeck" {
		t.Errorf("launchdLabel(\"\")=%q, want io.cyberdeck.cyberdeck", got)
	}
	if got := launchdLabel("CyberDeck"); got != "io.cyberdeck.cyberdeck" {
		t.Errorf("launchdLabel(CyberDeck)=%q, want io.cyberdeck.cyberdeck", got)
	}
}

func mustContain(t *testing.T, haystack, needle string) {
	t.Helper()
	if !strings.Contains(haystack, needle) {
		t.Errorf("output missing %q:\n%s", needle, haystack)
	}
}
