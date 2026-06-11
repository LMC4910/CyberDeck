package session_test

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/shishir/cyberdeck/engine/core/persistence"
	"github.com/shishir/cyberdeck/engine/core/security"
	"github.com/shishir/cyberdeck/engine/core/session"
)

func newTrust(t *testing.T) (*session.TrustAdapter, *persistence.DeviceRepo) {
	t.Helper()
	db, err := persistence.Open(filepath.Join(t.TempDir(), "t.db"))
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	if err := db.Migrate(context.Background()); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	repo := persistence.NewDeviceRepo(db)
	return session.NewTrustAdapter(repo), repo
}

func TestTrustAdapterStatusAndSave(t *testing.T) {
	ctx := context.Background()
	adapter, repo := newTrust(t)

	// Unknown device → not exists, not revoked, no error.
	exists, revoked, err := adapter.Status(ctx, "dev-1")
	if err != nil || exists || revoked {
		t.Fatalf("Status(unknown) = (%v,%v,%v)", exists, revoked, err)
	}

	// Save inserts.
	rec := security.TrustRecord{UUID: "dev-1", PublicKey: []byte{1, 2, 3}, PermissionsJSON: `{"a":1}`, PairedAt: 111}
	if err := adapter.Save(ctx, rec); err != nil {
		t.Fatalf("Save insert: %v", err)
	}
	exists, revoked, _ = adapter.Status(ctx, "dev-1")
	if !exists || revoked {
		t.Errorf("after insert Status = exists %v revoked %v", exists, revoked)
	}

	// Save again upserts (re-pair) without error and refreshes perms.
	rec.PermissionsJSON = `{"a":2}`
	if err := adapter.Save(ctx, rec); err != nil {
		t.Fatalf("Save upsert: %v", err)
	}
	d, _ := repo.Get(ctx, "dev-1")
	if d.PermissionsJSON != `{"a":2}` {
		t.Errorf("perms not refreshed on re-pair: %q", d.PermissionsJSON)
	}

	// A revoked device reports revoked.
	if err := repo.Revoke(ctx, "dev-1"); err != nil {
		t.Fatalf("revoke: %v", err)
	}
	_, revoked, _ = adapter.Status(ctx, "dev-1")
	if !revoked {
		t.Error("revoked device should report revoked=true")
	}
}
