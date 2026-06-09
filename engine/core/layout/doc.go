// Package layout owns the engine-authoritative layout document and its operation
// log (2C §2/§4 / ADR-0003/0012). The Designer sends ops over the Layout channel;
// the engine applies them to the authoritative document, increments a monotonic
// version, persists, and (PROJ-212) rebroadcasts. The document body shape mirrors
// the client renderer (PROJ-181) so ops are identical on both sides.
package layout

import (
	"encoding/json"
	"fmt"
)

// Placement is a widget's grid placement (2C §3). Spans default to 1.
type Placement struct {
	Col     int `json:"col"`
	Row     int `json:"row"`
	ColSpan int `json:"colSpan"`
	RowSpan int `json:"rowSpan"`
}

// Widget is one placed widget. Appearance/interaction/config are kept as generic
// maps — the engine applies ops to them but does not interpret their contents.
type Widget struct {
	ID          string         `json:"id"`
	Type        string         `json:"type"`
	Placement   Placement      `json:"placement"`
	Appearance  map[string]any `json:"appearance,omitempty"`
	Interaction map[string]any `json:"interaction,omitempty"`
	Config      map[string]any `json:"config,omitempty"`
}

// Page is a grid + its widgets.
type Page struct {
	ID      string         `json:"id"`
	Grid    map[string]any `json:"grid,omitempty"`
	Widgets []Widget       `json:"widgets"`
}

// Profile is the authoritative layout document: a set of pages with a monotonic
// version (2C §2/§4.2).
type Profile struct {
	Version int    `json:"version"`
	Pages   []Page `json:"pages"`
}

// ParseProfile decodes a profile document body.
func ParseProfile(body []byte) (*Profile, error) {
	var p Profile
	if err := json.Unmarshal(body, &p); err != nil {
		return nil, fmt.Errorf("layout: parse profile: %w", err)
	}
	return &p, nil
}

// JSON encodes the profile document body.
func (p *Profile) JSON() ([]byte, error) {
	b, err := json.Marshal(p)
	if err != nil {
		return nil, fmt.Errorf("layout: encode profile: %w", err)
	}
	return b, nil
}

// page returns a pointer to the page with id, or nil.
func (p *Profile) page(id string) *Page {
	for i := range p.Pages {
		if p.Pages[i].ID == id {
			return &p.Pages[i]
		}
	}
	return nil
}

// widgetIndex returns the index of the widget with id on the page, or -1.
func (pg *Page) widgetIndex(id string) int {
	for i := range pg.Widgets {
		if pg.Widgets[i].ID == id {
			return i
		}
	}
	return -1
}

// clone deep-copies a widget (so captured pre-state for inverses is independent of
// later mutation).
func (w Widget) clone() Widget {
	w.Appearance = cloneMap(w.Appearance)
	w.Interaction = cloneMap(w.Interaction)
	w.Config = cloneMap(w.Config)
	return w
}

func cloneMap(m map[string]any) map[string]any {
	if m == nil {
		return nil
	}
	out := make(map[string]any, len(m))
	for k, v := range m {
		out[k] = v
	}
	return out
}
