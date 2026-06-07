package registry

import (
	"context"
	"encoding/json"
	"path/filepath"
	"reflect"
	"strings"
	"testing"

	"github.com/shishir/cyberdeck/engine/core/persistence"
)

func f64(v float64) *float64 { return &v }

func sampleContribs() Contributions {
	return Contributions{
		Source: "plugin:core.media",
		Actions: []ActionDescriptor{
			{ID: "media.volume.set", Label: "Set Volume", Category: "media",
				Params: []Param{{Name: "level", Type: ParamInt, Min: f64(0), Max: f64(100), Required: true}}},
			{ID: "system.reboot", Label: "Reboot", Category: "system", Destructive: true},
		},
		Widgets: []WidgetDescriptor{
			{Type: "gauge.circular", Label: "Circular Gauge", AcceptsStateKinds: []string{"scalar"},
				ConfigSchema: []ConfigField{{Name: "min", Type: "float", Default: 0.0}}, Gestures: []string{"tap"}},
			{Type: "label", Label: "Label", AcceptsStateKinds: []string{"text", "scalar"}},
		},
		FlowNodes: []FlowNodeDescriptor{
			{Kind: "if", Label: "If", ExecHandle: "core.if"},
		},
	}
}

func TestMergeAndQuery(t *testing.T) {
	ctx := context.Background()
	r := New()
	if err := r.Merge(ctx, sampleContribs()); err != nil {
		t.Fatalf("Merge: %v", err)
	}

	if a, ok := r.Action("media.volume.set"); !ok || a.Label != "Set Volume" {
		t.Errorf("Action lookup failed: %+v ok=%v", a, ok)
	}
	if media := r.ActionsByCategory("media"); len(media) != 1 || media[0].ID != "media.volume.set" {
		t.Errorf("ActionsByCategory(media) = %+v", media)
	}
	scalar := r.WidgetsAcceptingKind("scalar")
	if len(scalar) != 2 { // both gauge.circular and label accept scalar
		t.Errorf("WidgetsAcceptingKind(scalar) = %d, want 2", len(scalar))
	}
	textOnly := r.WidgetsAcceptingKind("text")
	if len(textOnly) != 1 || textOnly[0].Type != "label" {
		t.Errorf("WidgetsAcceptingKind(text) = %+v", textOnly)
	}
	if _, ok := r.FlowNode("if"); !ok {
		t.Error("FlowNode(if) not found")
	}
	if all := r.AllActions(); len(all) != 2 || all[0].ID != "media.volume.set" {
		t.Errorf("AllActions sort/contents wrong: %+v", all)
	}
}

func TestCollisionRejected(t *testing.T) {
	ctx := context.Background()
	r := New()
	if err := r.Merge(ctx, sampleContribs()); err != nil {
		t.Fatalf("Merge: %v", err)
	}

	// Different source claims an existing action id → rejected with diagnostic.
	err := r.Merge(ctx, Contributions{Source: "plugin:evil",
		Actions: []ActionDescriptor{{ID: "media.volume.set", Label: "Hijack", Category: "media"}}})
	if err == nil || !strings.Contains(err.Error(), "media.volume.set") {
		t.Errorf("expected collision diagnostic naming the id, got %v", err)
	}

	// Within-batch duplicate widget type → rejected.
	err = r.Merge(ctx, Contributions{Source: "p", Widgets: []WidgetDescriptor{
		{Type: "dup", Label: "A"}, {Type: "dup", Label: "B"},
	}})
	if err == nil || !strings.Contains(err.Error(), "dup") {
		t.Errorf("expected within-batch collision, got %v", err)
	}

	// Flow-node kind collision.
	if err := r.Merge(ctx, Contributions{Source: "p", FlowNodes: []FlowNodeDescriptor{{Kind: "if", Label: "If2", ExecHandle: "x"}}}); err == nil {
		t.Error("expected flow-node kind collision")
	}
}

func TestBadSchemaRejected(t *testing.T) {
	ctx := context.Background()
	bad := []Contributions{
		{Source: "p", Actions: []ActionDescriptor{{ID: "", Label: "x", Category: "c"}}},                              // no id
		{Source: "p", Actions: []ActionDescriptor{{ID: "a", Label: "", Category: "c"}}},                              // no label
		{Source: "p", Actions: []ActionDescriptor{{ID: "a", Label: "x", Category: ""}}},                              // no category
		{Source: "p", Actions: []ActionDescriptor{{ID: "a", Label: "x", Category: "c", Params: []Param{{Name: "n", Type: "bogus"}}}}}, // bad param type
		{Source: "p", Actions: []ActionDescriptor{{ID: "a", Label: "x", Category: "c", Params: []Param{{Name: "n", Type: ParamChoice}}}}}, // choice w/o choices
		{Source: "p", Actions: []ActionDescriptor{{ID: "a", Label: "x", Category: "c", Params: []Param{{Name: "n", Type: ParamInt, Min: f64(10), Max: f64(1)}}}}}, // min>max
		{Source: "p", Widgets: []WidgetDescriptor{{Type: "", Label: "x"}}},                                           // no widget type
		{Source: "p", FlowNodes: []FlowNodeDescriptor{{Kind: "k", Label: "x", ExecHandle: ""}}},                      // no execHandle
	}
	for i, c := range bad {
		r := New()
		if err := r.Merge(ctx, c); err == nil {
			t.Errorf("case %d: expected validation error, got nil", i)
		}
		// Atomic: nothing registered after a failed merge.
		if len(r.AllActions())+len(r.AllWidgets())+len(r.AllFlowNodes()) != 0 {
			t.Errorf("case %d: registry mutated despite validation failure", i)
		}
	}
}

func TestAtomicMergeNoPartial(t *testing.T) {
	ctx := context.Background()
	r := New()
	// One valid, one invalid action in the same batch → whole batch rejected.
	err := r.Merge(ctx, Contributions{Source: "p", Actions: []ActionDescriptor{
		{ID: "ok", Label: "OK", Category: "c"},
		{ID: "bad", Label: "", Category: "c"},
	}})
	if err == nil {
		t.Fatal("expected error")
	}
	if _, ok := r.Action("ok"); ok {
		t.Error("partial merge: valid action committed despite batch failure")
	}
}

// repoStore adapts persistence.RegistryRepo to the registry's RegistryStore.
type repoStore struct{ repo *persistence.RegistryRepo }

func (s repoStore) Upsert(ctx context.Context, id, kind, source, schemaJSON string, version int) error {
	return s.repo.Upsert(ctx, persistence.RegistryItem{
		ID: id, Kind: kind, Source: source, SchemaJSON: schemaJSON, Version: version,
	})
}

func TestPersistenceRoundTrip(t *testing.T) {
	ctx := context.Background()
	db, err := persistence.Open(filepath.Join(t.TempDir(), "registry.db"))
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	if err := db.Migrate(ctx); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	repo := persistence.NewRegistryRepo(db)

	r := New(WithStore(repoStore{repo: repo}))
	contribs := sampleContribs()
	if err := r.Merge(ctx, contribs); err != nil {
		t.Fatalf("Merge: %v", err)
	}

	// Load persisted action items back and reconstruct the descriptor.
	items, err := repo.ListByKind(ctx, "action")
	if err != nil {
		t.Fatalf("ListByKind: %v", err)
	}
	if len(items) != 2 {
		t.Fatalf("persisted %d action items, want 2", len(items))
	}
	byID := map[string]persistence.RegistryItem{}
	for _, it := range items {
		byID[it.ID] = it
	}
	raw, ok := byID["media.volume.set"]
	if !ok {
		t.Fatal("media.volume.set not persisted")
	}
	if raw.Source != "plugin:core.media" {
		t.Errorf("persisted source = %q", raw.Source)
	}
	var loaded ActionDescriptor
	if err := json.Unmarshal([]byte(raw.SchemaJSON), &loaded); err != nil {
		t.Fatalf("unmarshal persisted schema: %v", err)
	}
	if !reflect.DeepEqual(loaded, contribs.Actions[0]) {
		t.Errorf("round-trip mismatch:\n got %+v\nwant %+v", loaded, contribs.Actions[0])
	}
}
