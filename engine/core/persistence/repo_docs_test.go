package persistence

import (
	"context"
	"errors"
	"testing"
)

func TestDocumentCRUD(t *testing.T) {
	ctx := context.Background()
	repo := NewDocumentRepo(openSchema(t))

	d := Document{ID: "doc1", Kind: "page", DeviceClass: "phone", Version: 1, BodyJSON: `{"w":[]}`, UpdatedAt: 100}
	if err := repo.Insert(ctx, d); err != nil {
		t.Fatalf("Insert: %v", err)
	}
	got, err := repo.Get(ctx, "doc1")
	if err != nil || got != d {
		t.Fatalf("Get = %+v, %v; want %+v", got, err, d)
	}
	d.Version = 2
	d.BodyJSON = `{"w":[1]}`
	if err := repo.Update(ctx, d); err != nil {
		t.Fatalf("Update: %v", err)
	}
	if got, _ := repo.Get(ctx, "doc1"); got.Version != 2 {
		t.Errorf("version after update = %d, want 2", got.Version)
	}
	if list, _ := repo.ListByDeviceClass(ctx, "phone"); len(list) != 1 {
		t.Errorf("ListByDeviceClass len = %d, want 1", len(list))
	}
	if err := repo.Delete(ctx, "doc1"); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if _, err := repo.Get(ctx, "doc1"); !errors.Is(err, ErrNotFound) {
		t.Errorf("Get after delete = %v, want ErrNotFound", err)
	}
}

func TestDocumentInvalidBodyRejected(t *testing.T) {
	ctx := context.Background()
	repo := NewDocumentRepo(openSchema(t))
	err := repo.Insert(ctx, Document{ID: "bad", Kind: "page", BodyJSON: "{not json", UpdatedAt: 1})
	if err == nil {
		t.Fatal("Insert with invalid body_json succeeded, want error")
	}
	if _, gerr := repo.Get(ctx, "bad"); !errors.Is(gerr, ErrNotFound) {
		t.Error("invalid document was persisted")
	}
}

func TestDocumentInsertManyRollback(t *testing.T) {
	ctx := context.Background()
	repo := NewDocumentRepo(openSchema(t))

	// Second doc has an invalid body → the whole batch must roll back.
	err := repo.InsertMany(ctx, []Document{
		{ID: "ok1", Kind: "page", BodyJSON: `{}`, UpdatedAt: 1},
		{ID: "bad2", Kind: "page", BodyJSON: "{nope", UpdatedAt: 1},
	})
	if err == nil {
		t.Fatal("InsertMany with an invalid doc succeeded, want error")
	}
	// No partial write: even the valid first doc must be absent.
	if _, e := repo.Get(ctx, "ok1"); !errors.Is(e, ErrNotFound) {
		t.Error("partial write: ok1 persisted despite batch rollback")
	}
}

func TestRegistryCRUD(t *testing.T) {
	ctx := context.Background()
	repo := NewRegistryRepo(openSchema(t))

	it := RegistryItem{ID: "media.volume.set", Kind: "action", Source: "plugin:core.media", SchemaJSON: `{"params":[]}`, Version: 1}
	if err := repo.Upsert(ctx, it); err != nil {
		t.Fatalf("Upsert: %v", err)
	}
	// Upsert again with a new version (exercises ON CONFLICT).
	it.Version = 2
	if err := repo.Upsert(ctx, it); err != nil {
		t.Fatalf("Upsert #2: %v", err)
	}
	got, err := repo.Get(ctx, "media.volume.set")
	if err != nil || got.Version != 2 {
		t.Fatalf("Get = %+v, %v; want version 2", got, err)
	}
	if items, _ := repo.ListByKind(ctx, "action"); len(items) != 1 {
		t.Errorf("ListByKind len = %d, want 1", len(items))
	}
	if err := repo.Upsert(ctx, RegistryItem{ID: "x", Kind: "action", SchemaJSON: "bad"}); err == nil {
		t.Error("Upsert with invalid schema_json succeeded, want error")
	}
}

func TestVariableSetGetUpsert(t *testing.T) {
	ctx := context.Background()
	repo := NewVariableRepo(openSchema(t))

	if err := repo.Set(ctx, Variable{Name: "var.mic_muted", ValueType: "bool", ValueJSON: "false", UpdatedAt: 1}); err != nil {
		t.Fatalf("Set: %v", err)
	}
	// Upsert (same name) flips the value.
	if err := repo.Set(ctx, Variable{Name: "var.mic_muted", ValueType: "bool", ValueJSON: "true", UpdatedAt: 2}); err != nil {
		t.Fatalf("Set upsert: %v", err)
	}
	got, err := repo.Get(ctx, "var.mic_muted")
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if got.ValueJSON != "true" || got.UpdatedAt != 2 {
		t.Errorf("Get = %+v, want value true / updated 2", got)
	}
	if list, _ := repo.List(ctx); len(list) != 1 {
		t.Errorf("List len = %d, want 1", len(list))
	}
	if err := repo.Set(ctx, Variable{Name: "var.bad", ValueType: "string", ValueJSON: "{oops"}); err == nil {
		t.Error("Set with invalid value_json succeeded, want error")
	}
	if err := repo.Delete(ctx, "var.mic_muted"); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if _, err := repo.Get(ctx, "var.mic_muted"); !errors.Is(err, ErrNotFound) {
		t.Errorf("Get after delete = %v, want ErrNotFound", err)
	}
}

func TestWorkflowCRUD(t *testing.T) {
	ctx := context.Background()
	repo := NewWorkflowRepo(openSchema(t))

	w := Workflow{ID: "wf1", Label: "Mute", Version: 1, BodyJSON: `{"nodes":[]}`, UpdatedAt: 1}
	if err := repo.Insert(ctx, w); err != nil {
		t.Fatalf("Insert: %v", err)
	}
	got, err := repo.Get(ctx, "wf1")
	if err != nil || got != w {
		t.Fatalf("Get = %+v, %v; want %+v", got, err, w)
	}
	w.Label = "Mute Mic"
	w.Version = 2
	if err := repo.Update(ctx, w); err != nil {
		t.Fatalf("Update: %v", err)
	}
	if got, _ := repo.Get(ctx, "wf1"); got.Label != "Mute Mic" || got.Version != 2 {
		t.Errorf("after update = %+v", got)
	}
	if list, _ := repo.List(ctx); len(list) != 1 {
		t.Errorf("List len = %d, want 1", len(list))
	}
	if err := repo.Delete(ctx, "wf1"); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if _, err := repo.Get(ctx, "wf1"); !errors.Is(err, ErrNotFound) {
		t.Errorf("Get after delete = %v, want ErrNotFound", err)
	}
}
