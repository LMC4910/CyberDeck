package persistence

import (
	"context"
	"testing"
	"testing/fstest"
)

// tableExists reports whether a table is present in the schema.
func tableExists(t *testing.T, db *DB, name string) bool {
	t.Helper()
	var got string
	err := db.Reader().QueryRowContext(context.Background(),
		`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, name).Scan(&got)
	if err != nil {
		return false
	}
	return got == name
}

func openMigrated(t *testing.T) *DB {
	t.Helper()
	db, err := Open(tempDBPath(t))
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return db
}

func TestMigrateFresh(t *testing.T) {
	ctx := context.Background()
	db := openMigrated(t)

	ms := []migration{
		{version: 1, name: "0001_t1.sql", sql: "CREATE TABLE t1 (id INTEGER PRIMARY KEY);"},
	}
	if err := db.applyMigrations(ctx, ms); err != nil {
		t.Fatalf("applyMigrations: %v", err)
	}
	if !tableExists(t, db, "t1") {
		t.Error("table t1 not created by migration")
	}
	if v, _ := db.SchemaVersion(ctx); v != 1 {
		t.Errorf("schema version = %d, want 1", v)
	}
}

func TestMigrateIdempotent(t *testing.T) {
	ctx := context.Background()
	db := openMigrated(t)

	ms := []migration{
		{version: 1, name: "0001_t1.sql", sql: "CREATE TABLE t1 (id INTEGER PRIMARY KEY);"},
	}
	if err := db.applyMigrations(ctx, ms); err != nil {
		t.Fatalf("apply #1: %v", err)
	}
	// Second apply of the same set must not re-run the CREATE (which would error
	// "table t1 already exists") — it must be skipped.
	if err := db.applyMigrations(ctx, ms); err != nil {
		t.Fatalf("apply #2 (idempotent) errored: %v", err)
	}
	if v, _ := db.SchemaVersion(ctx); v != 1 {
		t.Errorf("schema version = %d, want 1", v)
	}
}

func TestMigratePartialThenResume(t *testing.T) {
	ctx := context.Background()
	db := openMigrated(t)

	// Apply only v1.
	if err := db.applyMigrations(ctx, []migration{
		{version: 1, name: "0001_t1.sql", sql: "CREATE TABLE t1 (id INTEGER PRIMARY KEY);"},
	}); err != nil {
		t.Fatalf("apply v1: %v", err)
	}
	// Insert a row so we can prove v1's table is untouched on resume.
	if _, err := db.Writer().ExecContext(ctx, "INSERT INTO t1(id) VALUES(42);"); err != nil {
		t.Fatalf("seed t1: %v", err)
	}

	// Now resume with [v1, v2]: v1 is skipped, only v2 runs.
	if err := db.applyMigrations(ctx, []migration{
		{version: 1, name: "0001_t1.sql", sql: "CREATE TABLE t1 (id INTEGER PRIMARY KEY);"},
		{version: 2, name: "0002_t2.sql", sql: "CREATE TABLE t2 (id INTEGER PRIMARY KEY);"},
	}); err != nil {
		t.Fatalf("resume: %v", err)
	}

	if !tableExists(t, db, "t2") {
		t.Error("v2 table t2 not created on resume")
	}
	if v, _ := db.SchemaVersion(ctx); v != 2 {
		t.Errorf("schema version after resume = %d, want 2", v)
	}
	var n int
	if err := db.Reader().QueryRowContext(ctx, "SELECT count(*) FROM t1").Scan(&n); err != nil {
		t.Fatalf("count t1: %v", err)
	}
	if n != 1 {
		t.Errorf("t1 row count = %d, want 1 (v1 must not be re-run on resume)", n)
	}
}

func TestMigrateEmbeddedNoSQLFiles(t *testing.T) {
	ctx := context.Background()
	db := openMigrated(t)

	// The embedded migrations/ dir holds only README.md in PROJ-110, so Migrate
	// applies nothing but still bootstraps meta at version 0.
	if err := db.Migrate(ctx); err != nil {
		t.Fatalf("Migrate: %v", err)
	}
	if v, _ := db.SchemaVersion(ctx); v != 0 {
		t.Errorf("schema version = %d, want 0", v)
	}
}

func TestParseVersion(t *testing.T) {
	cases := map[string]struct {
		want int
		ok   bool
	}{
		"0001_init.sql":        {1, true},
		"0042_add_indexes.sql": {42, true},
		"10_x.sql":             {10, true},
		"not_numeric.sql":      {0, false},
		"0003.sql":             {3, true},
	}
	for name, want := range cases {
		got, err := parseVersion(name)
		if want.ok && err != nil {
			t.Errorf("parseVersion(%q) unexpected error: %v", name, err)
		}
		if !want.ok && err == nil {
			t.Errorf("parseVersion(%q) = %d, want error", name, got)
		}
		if want.ok && got != want.want {
			t.Errorf("parseVersion(%q) = %d, want %d", name, got, want.want)
		}
	}
}

func TestLoadMigrationsDuplicateVersion(t *testing.T) {
	// "0001_a.sql" and "1_b.sql" both parse to version 1 — must be rejected.
	fsys := fstest.MapFS{
		"0001_a.sql": {Data: []byte("CREATE TABLE a (x INTEGER);")},
		"1_b.sql":    {Data: []byte("CREATE TABLE b (x INTEGER);")},
	}
	if _, err := loadMigrations(fsys, "."); err == nil {
		t.Fatal("loadMigrations with duplicate version = nil error, want error")
	}
}
