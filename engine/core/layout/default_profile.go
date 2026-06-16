package layout

// DefaultProfile is the built-in "Living Deck" served to a freshly paired device
// when no profile has been authored yet (the first-testable-slice default). It
// renders live system telemetry (from the bundled telemetry plugin's state ids) and
// offers the bundled power actions. The widget types, appearance/config keys, and
// interaction shape match the client renderer's built-in widgets exactly:
//   - gauge.circular / gauge.linear: appearance.stateBinding + appearance.style.label
//     + config.{min,max,unit}; value tracks the bound state.
//   - label: appearance.stateBinding + appearance.style.label + config.unit.
//   - button: appearance.style.label; interaction.tap = {target:"action", ref:<id>};
//     config.confirm=true marks a destructive action (client requires a 2-tap).
func DefaultProfile() *Profile {
	// tempGauge: a circular gauge for a 0..100 temperature (°C). The bound scalar
	// drives the arc + centre value; config.history is a literal series feeding the
	// client gauge's inline sparkline + MIN/AVG/MAX row. valueRules tints the arc
	// red past the hot threshold (client-side, zero round-trip).
	tempGauge := func(id, title, state, unit string, history []any, p Placement) Widget {
		return Widget{
			ID:        id,
			Type:      "gauge.circular",
			Placement: p,
			Appearance: map[string]any{
				"stateBinding": state,
				"style":        map[string]any{"title": title},
				"valueRules": []any{
					map[string]any{"op": ">=", "value": 85.0, "accent": "#ff3b3b"},
				},
			},
			Config: map[string]any{"min": 0.0, "max": 100.0, "unit": unit, "history": history},
		}
	}
	// ramGauge: like tempGauge but with no hot threshold (percent/usage gauge).
	ramGauge := func(id, title, state, unit string, history []any, p Placement) Widget {
		return Widget{
			ID:        id,
			Type:      "gauge.circular",
			Placement: p,
			Appearance: map[string]any{
				"stateBinding": state,
				"style":        map[string]any{"title": title},
			},
			Config: map[string]any{"min": 0.0, "max": 100.0, "unit": unit, "history": history},
		}
	}

	// section.header: appearance.style.{title,rule}. A small-caps region label.
	header := func(id, title string, p Placement) Widget {
		return Widget{
			ID:         id,
			Type:       "section.header",
			Placement:  p,
			Appearance: map[string]any{"style": map[string]any{"title": title, "rule": true}},
		}
	}
	// launcher: appearance.style.{label,icon,color}; tap → launch.url (param carries
	// the target the launchers plugin opens, PROJ-175).
	launcher := func(id, label, icon, color, target string, p Placement) Widget {
		return Widget{
			ID:        id,
			Type:      "launcher",
			Placement: p,
			Appearance: map[string]any{
				"style": map[string]any{"label": label, "icon": icon, "color": color},
			},
			Interaction: map[string]any{"tap": map[string]any{
				"target": "action", "ref": "launch.url", "param": target}},
		}
	}
	// iconButton: a button with a leading icon (appearance.style.{label,icon}).
	iconButton := func(id, label, icon, actionID string, destructive bool, p Placement) Widget {
		return Widget{
			ID:        id,
			Type:      "button",
			Placement: p,
			Appearance: map[string]any{
				"style": map[string]any{"label": label, "icon": icon},
			},
			Interaction: map[string]any{"tap": map[string]any{"target": "action", "ref": actionID}},
			Config:      map[string]any{"confirm": destructive},
		}
	}

	page := Page{
		ID: "home",
		Grid: map[string]any{
			"columns": 24, "rows": 16, "gutter": 8, "marginX": 16, "marginY": 16,
		},
		Widgets: []Widget{
			// QUICK LAUNCH — a header + a row of launcher tiles (launchers plugin,
			// PROJ-175). Each tap opens its target URL/app.
			header("w-quick-header", "QUICK LAUNCH",
				Placement{Col: 0, Row: 0, ColSpan: 18, RowSpan: 1}),
			launcher("w-l-disney", "Disney+", "play", "#1f6feb", "https://disneyplus.com",
				Placement{Col: 0, Row: 1, ColSpan: 3, RowSpan: 3}),
			launcher("w-l-prime", "Prime Video", "play", "#00a8e1", "https://primevideo.com",
				Placement{Col: 3, Row: 1, ColSpan: 3, RowSpan: 3}),
			launcher("w-l-netflix", "Netflix", "play", "#e50914", "https://netflix.com",
				Placement{Col: 6, Row: 1, ColSpan: 3, RowSpan: 3}),
			launcher("w-l-chrome", "Chrome", "browser", "#4285f4", "https://google.com",
				Placement{Col: 9, Row: 1, ColSpan: 3, RowSpan: 3}),
			launcher("w-l-chatgpt", "ChatGPT", "app", "#10a37f", "https://chatgpt.com",
				Placement{Col: 12, Row: 1, ColSpan: 3, RowSpan: 3}),

			// VOLUME — vertical slider card on the right (volume plugin, PROJ-174),
			// reflects system.volume.
			header("w-volume-header", "VOLUME",
				Placement{Col: 19, Row: 0, ColSpan: 5, RowSpan: 1}),
			{
				ID:        "w-volume",
				Type:      "slider",
				Placement: Placement{Col: 20, Row: 1, ColSpan: 3, RowSpan: 9},
				Appearance: map[string]any{
					"stateBinding": "system.volume",
					"style":        map[string]any{"orientation": "vertical"},
				},
				Interaction: map[string]any{"dragValue": map[string]any{"target": "action", "ref": "volume.set"}},
				Config:      map[string]any{"min": 0.0, "max": 100.0},
			},

			// Now-playing media card (media plugin) — reads the media.* state map.
			{
				ID:        "w-player",
				Type:      "media.player",
				Placement: Placement{Col: 0, Row: 4, ColSpan: 18, RowSpan: 4},
				Appearance: map[string]any{
					"stateBinding": "media.nowplaying",
					"style":        map[string]any{"track": "Blinding Lights", "artist": "The Weeknd"},
				},
				Interaction: map[string]any{
					"previous":  map[string]any{"target": "action", "ref": "media.previous"},
					"playPause": map[string]any{"target": "action", "ref": "media.play"},
					"next":      map[string]any{"target": "action", "ref": "media.next"},
					"shuffle":   map[string]any{"target": "action", "ref": "media.shuffle"},
					"repeat":    map[string]any{"target": "action", "ref": "media.repeat"},
				},
			},

			// Action button row.
			iconButton("b-lock", "LOCK", "power", "system.lock", true,
				Placement{Col: 0, Row: 8, ColSpan: 4, RowSpan: 2}),
			iconButton("b-terminal", "TERMINAL", "terminal", "launch.terminal", false,
				Placement{Col: 4, Row: 8, ColSpan: 4, RowSpan: 2}),
			iconButton("b-files", "FILE EXPLORER", "folder", "launch.files", false,
				Placement{Col: 8, Row: 8, ColSpan: 5, RowSpan: 2}),
			iconButton("b-control", "CONTROL PANEL", "settings", "launch.control", false,
				Placement{Col: 13, Row: 8, ColSpan: 5, RowSpan: 2}),
			iconButton("b-sleep", "SLEEP", "power", "system.sleep", true,
				Placement{Col: 19, Row: 10, ColSpan: 5, RowSpan: 2}),

			// SYSTEM MONITOR — three circular gauges (telemetry plugin, PROJ-172):
			// CPU temp, GPU temp, RAM. Each carries a literal history series so the
			// client gauge's inline sparkline + MIN/AVG/MAX row light up; the bound
			// scalar drives the live arc + centre value. The hot threshold tints the
			// arc red client-side (zero round-trip).
			header("w-monitor-header", "SYSTEM MONITOR",
				Placement{Col: 0, Row: 10, ColSpan: 18, RowSpan: 1}),
			tempGauge("w-cpu", "CPU TEMPERATURE", "system.cpu.temp", "C",
				[]any{38.0, 40.0, 39.0, 41.0, 43.0, 42.0, 44.0, 42.0, 41.0, 42.0},
				Placement{Col: 0, Row: 11, ColSpan: 5, RowSpan: 5}),
			tempGauge("w-gpu", "GPU TEMPERATURE", "system.gpu.temp", "C",
				[]any{51.0, 53.0, 52.0, 54.0, 56.0, 55.0, 57.0, 55.0, 54.0, 55.0},
				Placement{Col: 5, Row: 11, ColSpan: 5, RowSpan: 5}),
			ramGauge("w-ram", "RAM USAGE", "system.ram.percent", "%",
				[]any{40.0, 44.0, 42.0, 46.0, 48.0, 45.0, 47.0, 44.0, 46.0, 45.0},
				Placement{Col: 10, Row: 11, ColSpan: 5, RowSpan: 5}),

			// SYSTEM STATUS — a host-authored status list on the right.
			{
				ID:        "w-status",
				Type:      "status.list",
				Placement: Placement{Col: 15, Row: 11, ColSpan: 9, RowSpan: 5},
				Appearance: map[string]any{"style": map[string]any{"title": "SYSTEM STATUS"}},
				Config: map[string]any{"items": []any{
					map[string]any{"label": "Power Plan", "value": "Balanced", "icon": "bolt"},
					map[string]any{"label": "Network", "value": "Connected", "icon": "network", "theme": "success"},
					map[string]any{"label": "Storage", "value": "420 / 512 GB", "icon": "storage"},
					map[string]any{"label": "Uptime", "value": "--", "icon": "clock"},
				}},
			},
		},
	}

	return &Profile{Version: 1, Pages: []Page{page}}
}

// PublishedTelemetryIDs are the state ids the bundled first-party plugins emit
// (keep in sync with their manifests). The session subscribes to ALL of them, not
// just what the engine's own default layout shows, so a client rendering its own
// pages still receives every live metric it can bind.
var PublishedTelemetryIDs = []string{
	"system.cpu.percent",
	"system.ram.percent",
	"system.disk.percent",
	"system.net.throughput",
	"system.uptime",
	"system.gpu.load",
	"system.gpu.temp",
	"system.gpu.vram.used",
	"system.gpu.vram.total",
	"system.ram.used",
	"system.ram.free",
	"system.ram.total",
	"system.net.rx",
	"system.net.tx",
	"system.disk.c.percent",
	"system.disk.d.percent",
	"system.disk.e.percent",
	"system.disk.f.percent",
	"system.info",
	"system.processes",
	"system.volume",
	"system.muted",
	"notification.count",
}

// StateBindings returns the distinct state ids a device's session subscribes to:
// the full published-telemetry set (so any client layout receives live data)
// unioned with the profile's own widget bindings, in first-seen order. The session
// manager builds the fan-out subscription filter from this.
func (p *Profile) StateBindings() []string {
	seen := map[string]bool{}
	var out []string
	add := func(id string) {
		if id != "" && !seen[id] {
			seen[id] = true
			out = append(out, id)
		}
	}
	for _, id := range PublishedTelemetryIDs {
		add(id)
	}
	for _, page := range p.Pages {
		for _, w := range page.Widgets {
			binding, _ := w.Appearance["stateBinding"].(string)
			add(binding)
		}
	}
	return out
}

// ActivePage returns the first page (the page a device shows on connect), or nil.
func (p *Profile) ActivePage() *Page {
	if len(p.Pages) == 0 {
		return nil
	}
	return &p.Pages[0]
}
