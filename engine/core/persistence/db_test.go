package persistence

import (
	"context"
	"os"
	"path/filepath"
	"testing"
)

func tempDBPath(t *testing.T) string {
	t.Helper()
	return filepath.Join(t.TempDir(), "cyberdeck.db")
}

func TestOpenCreatesFile(t *testing.T) {
	path := tempDBPath(t)
	if _, err := os.Stat(path); err == nil {
		t.Fatalf("precondition: db file already exists at %s", path)
	}

	db, err := Open(path)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	if _, err := os.Stat(path); err != nil {
		t.Errorf("expected db file created at %s: %v", path, err)
	}
	if db.Path() != path {
		t.Errorf("Path() = %q, want %q", db.Path(), path)
	}
}

func TestOpenEmptyPath(t *testing.T) {
	if _, err := Open(""); err == nil {
		t.Fatal("Open(\"\") = nil error, want error")
	}
}

func TestWALEnabled(t *testing.T) {
	db, err := Open(tempDBPath(t))
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	mode, err := db.JournalMode(context.Background())
	if err != nil {
		t.Fatalf("JournalMode: %v", err)
	}
	if mode != "wal" {
		t.Errorf("journal_mode = %q, want %q", mode, "wal")
	}
}

func TestFreshOpenAndMigrate(t *testing.T) {
	ctx := context.Background()
	db, err := Open(tempDBPath(t))
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	if err := db.Migrate(ctx); err != nil {
		t.Fatalf("Migrate: %v", err)
	}
	// A fresh DB applies the embedded migrations; 0001_init brings it to v1.
	v, err := db.SchemaVersion(ctx)
	if err != nil {
		t.Fatalf("SchemaVersion: %v", err)
	}
	if v != 1 {
		t.Errorf("fresh schema version = %d, want 1", v)
	}
}

func TestReopenIdempotent(t *testing.T) {
	ctx := context.Background()
	path := tempDBPath(t)

	db1, err := Open(path)
	if err != nil {
		t.Fatalf("Open #1: %v", err)
	}
	if err := db1.applyMigrations(ctx, []migration{
		{version: 1, name: "0001_t1.sql", sql: "CREATE TABLE t1 (id INTEGER PRIMARY KEY);"},
	}); err != nil {
		t.Fatalf("apply #1: %v", err)
	}
	if err := db1.Close(); err != nil {
		t.Fatalf("close #1: %v", err)
	}

	db2, err := Open(path)
	if err != nil {
		t.Fatalf("Open #2: %v", err)
	}
	t.Cleanup(func() { _ = db2.Close() })

	// Re-applying the same migration set must be a no-op, not a re-create error.
	if err := db2.applyMigrations(ctx, []migration{
		{version: 1, name: "0001_t1.sql", sql: "CREATE TABLE t1 (id INTEGER PRIMARY KEY);"},
	}); err != nil {
		t.Fatalf("apply #2 (idempotent re-open) errored: %v", err)
	}
	v, err := db2.SchemaVersion(ctx)
	if err != nil {
		t.Fatalf("SchemaVersion: %v", err)
	}
	if v != 1 {
		t.Errorf("schema version after re-open = %d, want 1", v)
	}
}
