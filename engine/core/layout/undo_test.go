package layout

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/shishir/cyberdeck/engine/core/persistence"
	"github.com/shishir/cyberdeck/engine/core/transport"
)

// undoStore seeds an op-log + undo manager over the base profile.
func undoFixture(t *testing.T) (*UndoManager, *memStore) {
	t.Helper()
	store := newMemStore()
	body, _ := baseProfile().JSON()
	store.docs["doc1"] = persistence.Document{ID: "doc1", Kind: "profile", Version: 1, BodyJSON: string(body)}
	log := NewOpLog(store, WithClock(func() int64 { return 7 }))
	return BindOpLog(log, "doc1"), store
}

func currentProfile(t *testing.T, store *memStore) *Profile {
	t.Helper()
	p, err := ParseProfile([]byte(store.docs["doc1"].BodyJSON))
	if err != nil {
		t.Fatalf("parse stored: %v", err)
	}
	return p
}

func TestUndoRedoSingleEditRestoresContent(t *testing.T) {
	mgr, store := undoFixture(t)
	ctx := context.Background()
	before := norm(currentProfile(t, store))

	if _, err := mgr.Apply(ctx, Op{Kind: OpMoveWidget, PageID: "page1", WidgetID: "w1", To: &Placement{Col: 9, Row: 9}}); err != nil {
		t.Fatalf("apply: %v", err)
	}
	if norm(currentProfile(t, store)) == before {
		t.Fatal("edit did not change the document")
	}
	if !mgr.CanUndo() || mgr.CanRedo() {
		t.Fatalf("after edit: canUndo=%v canRedo=%v, want true/false", mgr.CanUndo(), mgr.CanRedo())
	}

	if err := mgr.Undo(ctx); err != nil {
		t.Fatalf("undo: %v", err)
	}
	if got := norm(currentProfile(t, store)); got != before {
		t.Errorf("undo did not restore content\n before=%s\n after =%s", before, got)
	}
	if mgr.CanUndo() || !mgr.CanRedo() {
		t.Fatalf("after undo: canUndo=%v canRedo=%v, want false/true", mgr.CanUndo(), mgr.CanRedo())
	}

	if err := mgr.Redo(ctx); err != nil {
		t.Fatalf("redo: %v", err)
	}
	w, _ := currentProfile(t, store).widget("page1", "w1")
	if w.Placement.Col != 9 || w.Placement.Row != 9 {
		t.Errorf("redo did not re-apply edit, placement = %+v", w.Placement)
	}
	if !mgr.CanUndo() || mgr.CanRedo() {
		t.Fatalf("after redo: canUndo=%v canRedo=%v, want true/false", mgr.CanUndo(), mgr.CanRedo())
	}
}

func TestMultiStepUndoRedoWalksHistory(t *testing.T) {
	mgr, store := undoFixture(t)
	ctx := context.Background()

	snaps := []string{norm(currentProfile(t, store))} // snaps[i] = content before edit i
	ops := []Op{
		{Kind: OpMoveWidget, PageID: "page1", WidgetID: "w1", To: &Placement{Col: 1, Row: 1}},
		{Kind: OpResizeWidget, PageID: "page1", WidgetID: "w1", To: &Placement{ColSpan: 3, RowSpan: 3}},
		{Kind: OpSetStyle, PageID: "page1", WidgetID: "w1", Style: map[string]any{"label": "Z"}},
		{Kind: OpAddWidget, PageID: "page1", Widget: &Widget{ID: "w9", Type: "label", Placement: Placement{Col: 6, Row: 6, ColSpan: 1, RowSpan: 1}}},
	}
	for _, op := range ops {
		if _, err := mgr.Apply(ctx, op); err != nil {
			t.Fatalf("apply %s: %v", op.Kind, err)
		}
		snaps = append(snaps, norm(currentProfile(t, store)))
	}

	// Undo all the way down — each undo restores the snapshot taken before that edit.
	for i := len(ops) - 1; i >= 0; i-- {
		if err := mgr.Undo(ctx); err != nil {
			t.Fatalf("undo step %d: %v", i, err)
		}
		if got := norm(currentProfile(t, store)); got != snaps[i] {
			t.Errorf("after undo %d\n want=%s\n got =%s", i, snaps[i], got)
		}
	}
	if mgr.CanUndo() {
		t.Error("undo stack should be empty after undoing every edit")
	}
	if err := mgr.Undo(ctx); !errors.Is(err, ErrNothingToUndo) {
		t.Errorf("undo on empty stack: want ErrNothingToUndo, got %v", err)
	}

	// Redo all the way back up — each redo reproduces the snapshot after that edit.
	for i := 0; i < len(ops); i++ {
		if err := mgr.Redo(ctx); err != nil {
			t.Fatalf("redo step %d: %v", i, err)
		}
		if got := norm(currentProfile(t, store)); got != snaps[i+1] {
			t.Errorf("after redo %d\n want=%s\n got =%s", i, snaps[i+1], got)
		}
	}
	if err := mgr.Redo(ctx); !errors.Is(err, ErrNothingToRedo) {
		t.Errorf("redo on empty stack: want ErrNothingToRedo, got %v", err)
	}
}

func TestNewEditClearsRedoBranch(t *testing.T) {
	mgr, store := undoFixture(t)
	ctx := context.Background()

	if _, err := mgr.Apply(ctx, Op{Kind: OpMoveWidget, PageID: "page1", WidgetID: "w1", To: &Placement{Col: 4, Row: 4}}); err != nil {
		t.Fatalf("apply: %v", err)
	}
	if err := mgr.Undo(ctx); err != nil {
		t.Fatalf("undo: %v", err)
	}
	if !mgr.CanRedo() {
		t.Fatal("expected a redo branch after undo")
	}

	// A fresh edit forks history — the redo branch is discarded.
	if _, err := mgr.Apply(ctx, Op{Kind: OpMoveWidget, PageID: "page1", WidgetID: "w2", To: &Placement{Col: 8, Row: 8}}); err != nil {
		t.Fatalf("forking apply: %v", err)
	}
	if mgr.CanRedo() {
		t.Error("a new edit must clear the redo branch")
	}
	w, _ := currentProfile(t, store).widget("page1", "w2")
	if w.Placement.Col != 8 {
		t.Errorf("forking edit not applied, placement = %+v", w.Placement)
	}
}

func TestUndoRedoBroadcastsEachStep(t *testing.T) {
	// Undo/redo must go through the SAME broadcast path as a normal edit, so each
	// step re-broadcasts to the device (edit-on-desktop → live-on-device).
	store := seedStore()
	fanout := transport.NewFanout()
	editor := newRecSession()
	editMux := transport.NewChannelMux(editor, 0, 0)
	defer editMux.Close()
	fanout.Add(&transport.Subscriber{DeviceUUID: "d1", Mux: editMux, ProfileID: "prof1", EditMode: true})

	bc := NewBroadcaster(NewOpLog(store), fanout, WithBroadcastClock(func() int64 { return 7 }))
	mgr := BindBroadcaster(bc, "doc1", "prof1")
	ctx := context.Background()

	if _, err := mgr.Apply(ctx, Op{Kind: OpMoveWidget, PageID: "page1", WidgetID: "w1", To: &Placement{Col: 3, Row: 4}}); err != nil {
		t.Fatalf("apply: %v", err)
	}
	if err := mgr.Undo(ctx); err != nil {
		t.Fatalf("undo: %v", err)
	}
	if err := mgr.Redo(ctx); err != nil {
		t.Fatalf("redo: %v", err)
	}
	if err := fanout.FlushAll(); err != nil {
		t.Fatalf("FlushAll: %v", err)
	}

	// Three broadcasts (apply, undo, redo), with monotonically increasing versions.
	envs := editor.sent()
	if len(envs) != 3 {
		t.Fatalf("editor received %d envelopes, want 3 (apply+undo+redo)", len(envs))
	}
	var lastVer float64
	for i, env := range envs {
		var m map[string]any
		if err := json.Unmarshal(env.Payload, &m); err != nil {
			t.Fatalf("payload %d: %v", i, err)
		}
		v, _ := m["docVersion"].(float64)
		if v <= lastVer {
			t.Errorf("envelope %d docVersion=%v not increasing (last=%v)", i, v, lastVer)
		}
		lastVer = v
	}
	if store.docs["doc1"].Version != 4 {
		t.Errorf("final version = %d, want 4 (1 base + apply + undo + redo)", store.docs["doc1"].Version)
	}
	// After redo the move is in effect again.
	w, _ := currentProfile(t, store).widget("page1", "w1")
	if w.Placement.Col != 3 || w.Placement.Row != 4 {
		t.Errorf("after redo placement = %+v, want col3 row4", w.Placement)
	}
}
