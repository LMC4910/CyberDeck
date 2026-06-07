package persistence

import (
	"context"
	"reflect"
	"strings"
	"testing"
)

func TestAuditAppendAndQuery(t *testing.T) {
	ctx := context.Background()
	repo := NewAuditRepo(openSchema(t))

	entries := []AuditEntry{
		{TS: 100, Actor: "dev-1", EventType: "action.executed", ResourceType: "action", ResourceID: "media.volume.set", PayloadJSON: `{}`},
		{TS: 200, Actor: "dev-1", EventType: "action.rejected", ResourceType: "action", ResourceID: "system.shutdown", PayloadJSON: `{}`},
		{TS: 300, Actor: "dev-2", EventType: "action.executed", ResourceType: "action", ResourceID: "media.play", PayloadJSON: `{}`},
	}
	for _, e := range entries {
		id, err := repo.Append(ctx, e)
		if err != nil {
			t.Fatalf("Append: %v", err)
		}
		if id == 0 {
			t.Error("Append returned id 0 (expected AUTOINCREMENT id)")
		}
	}

	byActor, err := repo.ByActor(ctx, "dev-1")
	if err != nil {
		t.Fatalf("ByActor: %v", err)
	}
	if len(byActor) != 2 {
		t.Errorf("ByActor(dev-1) = %d rows, want 2", len(byActor))
	}

	byType, err := repo.ByEventType(ctx, "action.executed")
	if err != nil {
		t.Fatalf("ByEventType: %v", err)
	}
	if len(byType) != 2 {
		t.Errorf("ByEventType(action.executed) = %d rows, want 2", len(byType))
	}

	inRange, err := repo.ByTimeRange(ctx, 150, 250)
	if err != nil {
		t.Fatalf("ByTimeRange: %v", err)
	}
	if len(inRange) != 1 || inRange[0].ResourceID != "system.shutdown" {
		t.Errorf("ByTimeRange(150,250) = %+v, want the rejected shutdown only", inRange)
	}
}

// TestAuditNoMutationAPI verifies, by reflection, that AuditRepo exposes no
// update/delete/mutation path — the audit log is append-only (ADR-0014).
func TestAuditNoMutationAPI(t *testing.T) {
	typ := reflect.TypeOf(&AuditRepo{})
	banned := []string{"update", "delete", "remove", "set", "modify", "edit", "truncate"}
	for i := 0; i < typ.NumMethod(); i++ {
		name := strings.ToLower(typ.Method(i).Name)
		for _, b := range banned {
			if strings.Contains(name, b) {
				t.Errorf("AuditRepo exposes mutation method %q; audit_log must be append-only", typ.Method(i).Name)
			}
		}
	}
}
