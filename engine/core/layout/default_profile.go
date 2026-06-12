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
	gauge := func(id, typ, state, label, unit string, p Placement) Widget {
		return Widget{
			ID:        id,
			Type:      typ,
			Placement: p,
			Appearance: map[string]any{
				"stateBinding": state,
				"style":        map[string]any{"label": label},
				// red when hot (client-side value rules, zero round-trip).
				"valueRules": []any{
					map[string]any{"op": ">=", "value": 85.0, "accent": "#ff3b3b"},
				},
			},
			Config: map[string]any{"min": 0.0, "max": 100.0, "unit": unit},
		}
	}
	button := func(id, label, actionID string, destructive bool, p Placement) Widget {
		return Widget{
			ID:         id,
			Type:       "button",
			Placement:  p,
			Appearance: map[string]any{"style": map[string]any{"label": label}},
			Interaction: map[string]any{
				"tap": map[string]any{"target": "action", "ref": actionID},
			},
			Config: map[string]any{"confirm": destructive},
		}
	}

	page := Page{
		ID: "home",
		Grid: map[string]any{
			"columns": 24, "rows": 18, "gutter": 8, "marginX": 16, "marginY": 16,
		},
		Widgets: []Widget{
			gauge("w-cpu", "gauge.circular", "system.cpu.percent", "CPU", "%",
				Placement{Col: 1, Row: 1, ColSpan: 6, RowSpan: 6}),
			gauge("w-ram", "gauge.circular", "system.ram.percent", "RAM", "%",
				Placement{Col: 8, Row: 1, ColSpan: 6, RowSpan: 6}),
			gauge("w-disk", "gauge.linear", "system.disk.percent", "DISK", "%",
				Placement{Col: 15, Row: 1, ColSpan: 8, RowSpan: 3}),
			{
				ID:        "w-uptime",
				Type:      "label",
				Placement: Placement{Col: 15, Row: 5, ColSpan: 8, RowSpan: 2},
				Appearance: map[string]any{
					"stateBinding": "system.uptime",
					"style":        map[string]any{"label": "UPTIME"},
				},
				Config: map[string]any{"unit": "s"},
			},
			// Notification-count badge (notifications plugin, PROJ-176). Degrades to
			// "--" when the OS exposes no count. Sits in the free band below the gauges.
			{
				ID:        "w-notif",
				Type:      "label",
				Placement: Placement{Col: 1, Row: 7, ColSpan: 6, RowSpan: 2},
				Appearance: map[string]any{
					"stateBinding": "notification.count",
					"style":        map[string]any{"label": "NOTIFS"},
				},
			},
			// GPU gauges (telemetry plugin, PROJ-172). load is a percent gauge; temp is
			// the source of the system.gpu.high threshold event. Both degrade to "--"
			// when no supported GPU is present.
			gauge("w-gpu-load", "gauge.circular", "system.gpu.load", "GPU", "%",
				Placement{Col: 8, Row: 7, ColSpan: 6, RowSpan: 2}),
			{
				ID:        "w-gpu-temp",
				Type:      "label",
				Placement: Placement{Col: 15, Row: 7, ColSpan: 8, RowSpan: 2},
				Appearance: map[string]any{
					"stateBinding": "system.gpu.temp",
					"style":        map[string]any{"label": "GPU TEMP"},
					"valueRules": []any{
						map[string]any{"op": ">=", "value": 85.0, "accent": "#ff3b3b"},
					},
				},
				Config: map[string]any{"unit": "C"},
			},
			button("b-lock", "LOCK", "system.lock", false,
				Placement{Col: 1, Row: 9, ColSpan: 5, RowSpan: 3}),
			button("b-sleep", "SLEEP", "system.sleep", false,
				Placement{Col: 7, Row: 9, ColSpan: 5, RowSpan: 3}),
			button("b-restart", "RESTART", "system.restart", true,
				Placement{Col: 13, Row: 9, ColSpan: 5, RowSpan: 3}),
			button("b-shutdown", "SHUTDOWN", "system.shutdown", true,
				Placement{Col: 19, Row: 9, ColSpan: 5, RowSpan: 3}),
			// Volume slider + mute (volume plugin, PROJ-174) — reflects system.volume.
			{
				ID:          "w-volume",
				Type:        "slider",
				Placement:   Placement{Col: 1, Row: 13, ColSpan: 12, RowSpan: 2},
				Appearance:  map[string]any{"stateBinding": "system.volume"},
				Interaction: map[string]any{"dragValue": map[string]any{"target": "action", "ref": "volume.set"}},
				Config:      map[string]any{"min": 0.0, "max": 100.0},
			},
			{
				ID:   "w-mute",
				Type: "toggle",
				Placement: Placement{Col: 14, Row: 13, ColSpan: 4, RowSpan: 2},
				Appearance: map[string]any{
					"stateBinding": "system.muted",
					"style":        map[string]any{"label": "MUTE"},
				},
				Interaction: map[string]any{"tap": map[string]any{"target": "action", "ref": "volume.mute"}},
			},
			// Launch a URL (launchers plugin, PROJ-175). `param` carries the target.
			{
				ID:         "w-open",
				Type:       "button",
				Placement:  Placement{Col: 19, Row: 13, ColSpan: 5, RowSpan: 2},
				Appearance: map[string]any{"style": map[string]any{"label": "OPEN GITHUB"}},
				Interaction: map[string]any{"tap": map[string]any{
					"target": "action", "ref": "launch.url", "param": "https://github.com"}},
				Config: map[string]any{"confirm": false},
			},
			// GPU VRAM (telemetry plugin, PROJ-172) — used/total in bytes. Degrades to
			// "--" with no supported GPU. Sits in the free band below the volume row.
			{
				ID:        "w-gpu-vram-used",
				Type:      "label",
				Placement: Placement{Col: 1, Row: 16, ColSpan: 11, RowSpan: 2},
				Appearance: map[string]any{
					"stateBinding": "system.gpu.vram.used",
					"style":        map[string]any{"label": "VRAM USED"},
				},
				Config: map[string]any{"unit": "B"},
			},
			{
				ID:        "w-gpu-vram-total",
				Type:      "label",
				Placement: Placement{Col: 13, Row: 16, ColSpan: 11, RowSpan: 2},
				Appearance: map[string]any{
					"stateBinding": "system.gpu.vram.total",
					"style":        map[string]any{"label": "VRAM TOTAL"},
				},
				Config: map[string]any{"unit": "B"},
			},
		},
	}

	return &Profile{Version: 1, Pages: []Page{page}}
}

// StateBindings returns the distinct state ids the profile's widgets bind, in
// first-seen order. The session manager uses this to build a device's subscription
// filter (fan-out only sends a session the states its layout actually shows).
func (p *Profile) StateBindings() []string {
	seen := map[string]bool{}
	var out []string
	for _, page := range p.Pages {
		for _, w := range page.Widgets {
			binding, _ := w.Appearance["stateBinding"].(string)
			if binding != "" && !seen[binding] {
				seen[binding] = true
				out = append(out, binding)
			}
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
