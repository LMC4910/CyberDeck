package layout

import (
	"context"
	"encoding/json"
	"errors"
	"sort"
	"testing"

	"github.com/shishir/cyberdeck/engine/core/persistence"
)

func baseProfile() *Profile {
	return &Profile{
		Version: 1,
		Pages: []Page{
			{
				ID:   "page1",
				Grid: map[string]any{"columns": float64(24), "rows": float64(18)},
				Widgets: []Widget{
					{
						ID: "w1", Type: "label",
						Placement:  Placement{Col: 0, Row: 0, ColSpan: 1, RowSpan: 1},
						Appearance: map[string]any{"style": map[string]any{"label": "A"}, "stateBinding": "s.x"},
					},
					{
						ID: "w2", Type: "gauge.circular",
						Placement:  Placement{Col: 2, Row: 0, ColSpan: 2, RowSpan: 2},
						Appearance: map[string]any{"style": map[string]any{"label": "B"}},
					},
				},
			},
		},
	}
}

// norm renders a profile for content comparison: version zeroed, pages + widgets
// sorted by id (order-independent).
func norm(p *Profile) string {
	cp := Profile{Pages: append([]Page(nil), p.Pages...)}
	sort.Slice(cp.Pages, func(i, j int) bool { return cp.Pages[i].ID < cp.Pages[j].ID })
	for i := range cp.Pages {
		ws := append([]Widget(nil), cp.Pages[i].Widgets...)
		sort.Slice(ws, func(a, b int) bool { return ws[a].ID < ws[b].ID })
		cp.Pages[i].Widgets = ws
	}
	b, _ := json.Marshal(cp)
	return string(b)
}

func ptr(s string) *string { return &s }

func TestApplyIncrementsVersionAndMutates(t *testing.T) {
	p := baseProfile()
	if _, err := p.Apply(Op{Kind: OpMoveWidget, PageID: "page1", WidgetID: "w1", To: &Placement{Col: 5, Row: 6}}); err != nil {
		t.Fatalf("move: %v", err)
	}
	if p.Version != 2 {
		t.Errorf("version = %d, want 2", p.Version)
	}
	w, _ := p.widget("page1", "w1")
	if w.Placement.Col != 5 || w.Placement.Row != 6 {
		t.Errorf("placement = %+v, want col5 row6", w.Placement)
	}
	if w.Placement.ColSpan != 1 {
		t.Errorf("move must not change span, got %+v", w.Placement)
	}
}

func TestVersionMonotonicAcrossOps(t *testing.T) {
	p := baseProfile()
	ops := []Op{
		{Kind: OpMoveWidget, PageID: "page1", WidgetID: "w1", To: &Placement{Col: 1, Row: 1}},
		{Kind: OpResizeWidget, PageID: "page1", WidgetID: "w1", To: &Placement{ColSpan: 3, RowSpan: 3}},
		{Kind: OpSetStyle, PageID: "page1", WidgetID: "w1", Style: map[string]any{"label": "Z"}},
	}
	want := 2
	for _, op := range ops {
		if _, err := p.Apply(op); err != nil {
			t.Fatalf("apply %s: %v", op.Kind, err)
		}
		if p.Version != want {
			t.Errorf("after %s version = %d, want %d", op.Kind, p.Version, want)
		}
		want++
	}
}

func TestInverseRoundTrip(t *testing.T) {
	cases := map[string]Op{
		"move":           {Kind: OpMoveWidget, PageID: "page1", WidgetID: "w1", To: &Placement{Col: 7, Row: 8}},
		"resize":         {Kind: OpResizeWidget, PageID: "page1", WidgetID: "w1", To: &Placement{ColSpan: 4, RowSpan: 5}},
		"setStyle":       {Kind: OpSetStyle, PageID: "page1", WidgetID: "w1", Style: map[string]any{"label": "NEW"}},
		"setBinding":     {Kind: OpSetBinding, PageID: "page1", WidgetID: "w1", Binding: ptr("s.y")},
		"clearBinding":   {Kind: OpSetBinding, PageID: "page1", WidgetID: "w1", Binding: nil},
		"setInteraction": {Kind: OpSetInteraction, PageID: "page1", WidgetID: "w2", Interaction: map[string]any{"tap": "media.play"}},
		"setConfig":      {Kind: OpSetConfig, PageID: "page1", WidgetID: "w2", Config: map[string]any{"min": float64(0)}},
		"changeGrid":     {Kind: OpChangeGrid, PageID: "page1", Grid: map[string]any{"columns": float64(12)}},
		"addWidget":      {Kind: OpAddWidget, PageID: "page1", Widget: &Widget{ID: "w3", Type: "label", Placement: Placement{Col: 4, Row: 4, ColSpan: 1, RowSpan: 1}}},
		"removeWidget":   {Kind: OpRemoveWidget, PageID: "page1", WidgetID: "w2"},
		"addPage":        {Kind: OpAddPage, Page: &Page{ID: "page2", Widgets: []Widget{}}},
		"removePage":     {Kind: OpRemovePage, PageID: "page1"},
	}
	for name, op := range cases {
		t.Run(name, func(t *testing.T) {
			p := baseProfile()
			before := norm(p)
			inv, err := p.Apply(op)
			if err != nil {
				t.Fatalf("apply: %v", err)
			}
			if norm(p) == before {
				t.Fatalf("op %s did not change the document", name)
			}
			if _, err := p.Apply(inv); err != nil {
				t.Fatalf("apply inverse: %v", err)
			}
			if got := norm(p); got != before {
				t.Errorf("round-trip mismatch\n before=%s\n after =%s", before, got)
			}
		})
	}
}

func TestApplyErrorsOnUnknownTargets(t *testing.T) {
	p := baseProfile()
	if _, err := p.Apply(Op{Kind: OpMoveWidget, PageID: "nope", WidgetID: "w1", To: &Placement{}}); !errors.Is(err, ErrPageNotFound) {
		t.Errorf("want ErrPageNotFound, got %v", err)
	}
	if _, err := p.Apply(Op{Kind: OpMoveWidget, PageID: "page1", WidgetID: "nope", To: &Placement{}}); !errors.Is(err, ErrWidgetNotFound) {
		t.Errorf("want ErrWidgetNotFound, got %v", err)
	}
	if p.Version != 1 {
		t.Errorf("failed ops must not bump version, got %d", p.Version)
	}
}

func TestProfileJSONRoundTrip(t *testing.T) {
	p := baseProfile()
	b, err := p.JSON()
	if err != nil {
		t.Fatalf("JSON: %v", err)
	}
	back, err := ParseProfile(b)
	if err != nil {
		t.Fatalf("ParseProfile: %v", err)
	}
	if norm(back) != norm(p) || back.Version != p.Version {
		t.Error("profile did not survive a JSON round-trip")
	}
}

// --- OpLog (persistence + single-writer lock) ---

type memStore struct{ docs map[string]persistence.Document }

func newMemStore() *memStore { return &memStore{docs: map[string]persistence.Document{}} }

func (m *memStore) Load(_ context.Context, id string) (persistence.Document, error) {
	d, ok := m.docs[id]
	if !ok {
		return persistence.Document{}, persistence.ErrNotFound
	}
	return d, nil
}

func (m *memStore) Update(_ context.Context, d persistence.Document) error {
	m.docs[d.ID] = d
	return nil
}

func TestOpLogApplyPersists(t *testing.T) {
	store := newMemStore()
	body, _ := baseProfile().JSON()
	store.docs["doc1"] = persistence.Document{ID: "doc1", Kind: "profile", Version: 1, BodyJSON: string(body)}

	log := NewOpLog(store, WithClock(func() int64 { return 42 }))
	inv, ver, err := log.Apply(context.Background(), "doc1",
		Op{Kind: OpMoveWidget, PageID: "page1", WidgetID: "w1", To: &Placement{Col: 9, Row: 9}})
	if err != nil {
		t.Fatalf("Apply: %v", err)
	}
	if ver != 2 {
		t.Errorf("newVersion = %d, want 2", ver)
	}
	if inv.Kind != OpMoveWidget {
		t.Errorf("inverse kind = %s, want MoveWidget", inv.Kind)
	}
	stored := store.docs["doc1"]
	if stored.Version != 2 || stored.UpdatedAt != 42 {
		t.Errorf("stored meta = v%d ts%d, want v2 ts42", stored.Version, stored.UpdatedAt)
	}
	got, _ := ParseProfile([]byte(stored.BodyJSON))
	w, _ := got.widget("page1", "w1")
	if w.Placement.Col != 9 || w.Placement.Row != 9 {
		t.Errorf("persisted placement = %+v, want col9 row9", w.Placement)
	}
}

func TestSingleWriterLock(t *testing.T) {
	log := NewOpLog(newMemStore())
	release, ok := log.AcquireEdit("doc1")
	if !ok {
		t.Fatal("first AcquireEdit should succeed")
	}
	if _, ok2 := log.AcquireEdit("doc1"); ok2 {
		t.Error("second AcquireEdit on a held doc must be rejected")
	}
	// A different document is independently lockable.
	if _, ok3 := log.AcquireEdit("doc2"); !ok3 {
		t.Error("a different document should be lockable")
	}
	release()
	if _, ok4 := log.AcquireEdit("doc1"); !ok4 {
		t.Error("after release the doc should be re-acquirable")
	}
}
