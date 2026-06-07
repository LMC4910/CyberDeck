package persistence

import (
	"bytes"
	"context"
	"testing"
)

// allTables is the durable set created by 0001_init (TRD 2B §6).
var allTables = []string{
	"documents", "registry_items", "variables", "workflows",
	"devices", "accounts", "audit_log", "meta",
}

func indexExists(t *testing.T, db *DB, name string) bool {
	t.Helper()
	var got string
	err := db.Reader().QueryRowContext(context.Background(),
		`SELECT name FROM sqlite_master WHERE type='index' AND name=?`, name).Scan(&got)
	return err == nil && got == name
}

func TestMigration0001CreatesSchema(t *testing.T) {
	ctx := context.Background()
	db := openMigrated(t)
	if err := db.Migrate(ctx); err != nil {
		t.Fatalf("Migrate: %v", err)
	}
	if v, _ := db.SchemaVersion(ctx); v != 1 {
		t.Fatalf("schema version = %d, want 1", v)
	}
	for _, tbl := range allTables {
		if !tableExists(t, db, tbl) {
			t.Errorf("table %q not created", tbl)
		}
	}
	for _, idx := range []string{"idx_audit_actor", "idx_audit_event_type", "idx_documents_device_class"} {
		if !indexExists(t, db, idx) {
			t.Errorf("index %q not created", idx)
		}
	}
}

func TestMigration0001Idempotent(t *testing.T) {
	ctx := context.Background()
	db := openMigrated(t)
	if err := db.Migrate(ctx); err != nil {
		t.Fatalf("Migrate #1: %v", err)
	}
	if err := db.Migrate(ctx); err != nil {
		t.Fatalf("Migrate #2 (idempotent): %v", err)
	}
	if v, _ := db.SchemaVersion(ctx); v != 1 {
		t.Errorf("schema version = %d, want 1", v)
	}
}

// TestMigration0001RoundTrips inserts and reads back one row per table, proving
// the columns are usable (incl. the devices public_key BLOB and audit_log
// AUTOINCREMENT id).
func TestMigration0001RoundTrips(t *testing.T) {
	ctx := context.Background()
	db := openMigrated(t)
	if err := db.Migrate(ctx); err != nil {
		t.Fatalf("Migrate: %v", err)
	}
	w := db.Writer()

	inserts := []struct {
		name string
		sql  string
		args []any
	}{
		{"documents", `INSERT INTO documents(id,kind,device_class,version,body_json,updated_at) VALUES(?,?,?,?,?,?)`,
			[]any{"doc1", "page", "phone", 1, "{}", 100}},
		{"registry_items", `INSERT INTO registry_items(id,kind,source,schema_json,version) VALUES(?,?,?,?,?)`,
			[]any{"media.volume.set", "action", "plugin:core.media", "{}", 1}},
		{"variables", `INSERT INTO variables(name,value_type,value_json,updated_at) VALUES(?,?,?,?)`,
			[]any{"var.mic_muted", "bool", "false", 100}},
		{"workflows", `INSERT INTO workflows(id,label,version,body_json,updated_at) VALUES(?,?,?,?,?)`,
			[]any{"wf1", "Mute", 1, "{}", 100}},
		{"accounts", `INSERT INTO accounts(id,email,tier,created_at) VALUES(?,?,?,?)`,
			[]any{"acc1", "x@example.com", "free", 100}},
		{"meta", `INSERT INTO meta(key,value) VALUES(?,?)`,
			[]any{"some_key", "some_value"}},
	}
	for _, in := range inserts {
		if _, err := w.ExecContext(ctx, in.sql, in.args...); err != nil {
			t.Errorf("insert %s: %v", in.name, err)
		}
		var n int
		if err := db.Reader().QueryRowContext(ctx, "SELECT count(*) FROM "+in.name).Scan(&n); err != nil {
			t.Errorf("count %s: %v", in.name, err)
		} else if n == 0 {
			t.Errorf("%s: row not found after insert", in.name)
		}
	}

	// devices: verify the public_key BLOB round-trips byte-for-byte.
	blob := []byte{0xDE, 0xAD, 0xBE, 0xEF, 0x00, 0x01}
	if _, err := w.ExecContext(ctx,
		`INSERT INTO devices(uuid,label,public_key,device_class,permissions_json,locator_hints_json,revoked,paired_at,last_seen)
		 VALUES(?,?,?,?,?,?,?,?,?)`,
		"dev-uuid", "phone", blob, "phone", "{}", "{}", 0, 100, 100); err != nil {
		t.Fatalf("insert devices: %v", err)
	}
	var gotBlob []byte
	if err := db.Reader().QueryRowContext(ctx, `SELECT public_key FROM devices WHERE uuid=?`, "dev-uuid").Scan(&gotBlob); err != nil {
		t.Fatalf("read public_key: %v", err)
	}
	if !bytes.Equal(gotBlob, blob) {
		t.Errorf("public_key BLOB mismatch: got %x want %x", gotBlob, blob)
	}

	// audit_log: AUTOINCREMENT assigns ids.
	for i := 0; i < 2; i++ {
		if _, err := w.ExecContext(ctx,
			`INSERT INTO audit_log(ts,actor,event_type,resource_type,resource_id,payload_json) VALUES(?,?,?,?,?,?)`,
			100+i, "dev-uuid", "action.executed", "action", "media.volume.set", "{}"); err != nil {
			t.Fatalf("insert audit_log: %v", err)
		}
	}
	var maxID int
	if err := db.Reader().QueryRowContext(ctx, `SELECT max(id) FROM audit_log`).Scan(&maxID); err != nil {
		t.Fatalf("read audit id: %v", err)
	}
	if maxID < 2 {
		t.Errorf("audit_log AUTOINCREMENT id = %d, want >= 2", maxID)
	}
}
