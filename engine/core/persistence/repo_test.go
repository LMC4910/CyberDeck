package persistence

import (
	"bytes"
	"context"
	"errors"
	"testing"
)

// openSchema opens a fresh DB and applies all migrations so the durable tables
// exist.
func openSchema(t *testing.T) *DB {
	t.Helper()
	db := openMigrated(t)
	if err := db.Migrate(context.Background()); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return db
}

func TestDeviceCRUDAndRevoke(t *testing.T) {
	ctx := context.Background()
	repo := NewDeviceRepo(openSchema(t))

	dev := Device{
		UUID:             "dev-1",
		Label:            "Pixel",
		PublicKey:        []byte{0x01, 0x02, 0x00, 0xff, 0xab},
		DeviceClass:      "phone",
		PermissionsJSON:  `{"allowPowerActions":false}`,
		LocatorHintsJSON: `{"lastIp":"192.168.1.5"}`,
		Revoked:          false,
		PairedAt:         1000,
		LastSeen:         1000,
	}
	if err := repo.Insert(ctx, dev); err != nil {
		t.Fatalf("Insert: %v", err)
	}

	got, err := repo.Get(ctx, "dev-1")
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if got.Label != dev.Label || got.DeviceClass != dev.DeviceClass ||
		got.PermissionsJSON != dev.PermissionsJSON || got.LocatorHintsJSON != dev.LocatorHintsJSON ||
		got.Revoked != false || got.PairedAt != 1000 {
		t.Errorf("Get returned unexpected device: %+v", got)
	}
	if !bytes.Equal(got.PublicKey, dev.PublicKey) {
		t.Errorf("public key BLOB mismatch: got %x want %x", got.PublicKey, dev.PublicKey)
	}

	list, err := repo.List(ctx)
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("List len = %d, want 1", len(list))
	}

	// Update mutable fields.
	got.Label = "Pixel 9"
	got.PermissionsJSON = `{"allowPowerActions":true}`
	got.LastSeen = 2000
	if err := repo.Update(ctx, got); err != nil {
		t.Fatalf("Update: %v", err)
	}
	reread, _ := repo.Get(ctx, "dev-1")
	if reread.Label != "Pixel 9" || reread.PermissionsJSON != `{"allowPowerActions":true}` || reread.LastSeen != 2000 {
		t.Errorf("Update not reflected: %+v", reread)
	}

	// Revoke.
	if err := repo.Revoke(ctx, "dev-1"); err != nil {
		t.Fatalf("Revoke: %v", err)
	}
	revoked, _ := repo.Get(ctx, "dev-1")
	if !revoked.Revoked {
		t.Error("device not marked revoked")
	}

	// last_seen update.
	if err := repo.UpdateLastSeen(ctx, "dev-1", 3000); err != nil {
		t.Fatalf("UpdateLastSeen: %v", err)
	}
	if ls, _ := repo.Get(ctx, "dev-1"); ls.LastSeen != 3000 {
		t.Errorf("last_seen = %d, want 3000", ls.LastSeen)
	}
}

func TestDeviceNotFound(t *testing.T) {
	ctx := context.Background()
	repo := NewDeviceRepo(openSchema(t))

	if _, err := repo.Get(ctx, "missing"); !errors.Is(err, ErrNotFound) {
		t.Errorf("Get(missing) = %v, want ErrNotFound", err)
	}
	if err := repo.Revoke(ctx, "missing"); !errors.Is(err, ErrNotFound) {
		t.Errorf("Revoke(missing) = %v, want ErrNotFound", err)
	}
	if err := repo.Update(ctx, Device{UUID: "missing"}); !errors.Is(err, ErrNotFound) {
		t.Errorf("Update(missing) = %v, want ErrNotFound", err)
	}
}

func TestDeviceBLOBIntegrityFullByteRange(t *testing.T) {
	ctx := context.Background()
	repo := NewDeviceRepo(openSchema(t))

	key := make([]byte, 256)
	for i := range key {
		key[i] = byte(i) // includes 0x00 and 0xff
	}
	if err := repo.Insert(ctx, Device{UUID: "d", PublicKey: key, PairedAt: 1, LastSeen: 1}); err != nil {
		t.Fatalf("Insert: %v", err)
	}
	got, _ := repo.Get(ctx, "d")
	if !bytes.Equal(got.PublicKey, key) {
		t.Error("full-byte-range BLOB did not round-trip intact")
	}
}

func TestMetaGetSetDelete(t *testing.T) {
	repo := NewMetaRepo(openSchema(t))

	if _, ok, err := repo.GetString("k"); err != nil || ok {
		t.Errorf("Get(missing) = ok %v err %v, want ok=false", ok, err)
	}
	if err := repo.SetString("k", "v1"); err != nil {
		t.Fatalf("Set: %v", err)
	}
	if v, ok, _ := repo.GetString("k"); !ok || v != "v1" {
		t.Errorf("Get = %q ok %v, want v1/true", v, ok)
	}
	// overwrite
	if err := repo.SetString("k", "v2"); err != nil {
		t.Fatalf("Set overwrite: %v", err)
	}
	if v, _, _ := repo.GetString("k"); v != "v2" {
		t.Errorf("overwrite Get = %q, want v2", v)
	}
	// delete
	if err := repo.Delete("k"); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if _, ok, _ := repo.GetString("k"); ok {
		t.Error("key present after delete")
	}
}

func TestAccountCRUD(t *testing.T) {
	ctx := context.Background()
	repo := NewAccountRepo(openSchema(t))

	a := Account{ID: "acc1", Email: "x@example.com", Tier: "free", CreatedAt: 100}
	if err := repo.Insert(ctx, a); err != nil {
		t.Fatalf("Insert: %v", err)
	}
	got, err := repo.Get(ctx, "acc1")
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if got != a {
		t.Errorf("Get = %+v, want %+v", got, a)
	}
	if err := repo.Delete(ctx, "acc1"); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if _, err := repo.Get(ctx, "acc1"); !errors.Is(err, ErrNotFound) {
		t.Errorf("Get after delete = %v, want ErrNotFound", err)
	}
}
