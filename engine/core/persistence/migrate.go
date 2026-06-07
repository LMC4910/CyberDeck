package persistence

import (
	"context"
	"database/sql"
	"embed"
	"errors"
	"fmt"
	"io/fs"
	"sort"
	"strconv"
	"strings"
)

//go:embed migrations
var migrationsFS embed.FS

// schemaVersionKey is the meta(key) under which the applied schema version is
// tracked (TB-PER-2).
const schemaVersionKey = "schema_version"

// migration is one forward-only schema step.
type migration struct {
	version int
	name    string
	sql     string
}

// Migrate applies all pending embedded migrations in ascending version order.
// Forward-only and idempotent: already-applied versions are skipped, so a
// re-open re-applies nothing. Each migration runs in its own transaction and
// bumps meta.schema_version on success.
func (db *DB) Migrate(ctx context.Context) error {
	ms, err := loadMigrations(migrationsFS, "migrations")
	if err != nil {
		return err
	}
	return db.applyMigrations(ctx, ms)
}

// SchemaVersion returns the currently-applied schema version (0 if none).
func (db *DB) SchemaVersion(ctx context.Context) (int, error) {
	if err := db.ensureMeta(ctx); err != nil {
		return 0, err
	}
	return db.schemaVersion(ctx)
}

// loadMigrations reads NNNN_*.sql files from dir within fsys, ignoring non-.sql
// entries (e.g. the README). Returns them sorted ascending, erroring on
// duplicate versions.
func loadMigrations(fsys fs.FS, dir string) ([]migration, error) {
	entries, err := fs.ReadDir(fsys, dir)
	if err != nil {
		return nil, fmt.Errorf("persistence: read migrations dir: %w", err)
	}
	var ms []migration
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".sql") {
			continue
		}
		ver, err := parseVersion(e.Name())
		if err != nil {
			return nil, err
		}
		body, err := fs.ReadFile(fsys, dir+"/"+e.Name())
		if err != nil {
			return nil, fmt.Errorf("persistence: read migration %s: %w", e.Name(), err)
		}
		ms = append(ms, migration{version: ver, name: e.Name(), sql: string(body)})
	}
	sort.Slice(ms, func(i, j int) bool { return ms[i].version < ms[j].version })
	for i := 1; i < len(ms); i++ {
		if ms[i].version == ms[i-1].version {
			return nil, fmt.Errorf("persistence: duplicate migration version %04d (%s, %s)",
				ms[i].version, ms[i-1].name, ms[i].name)
		}
	}
	return ms, nil
}

// parseVersion extracts the leading numeric version from "NNNN_description.sql".
func parseVersion(name string) (int, error) {
	prefix := strings.TrimSuffix(name, ".sql")
	if i := strings.IndexByte(prefix, '_'); i >= 0 {
		prefix = prefix[:i]
	}
	v, err := strconv.Atoi(prefix)
	if err != nil {
		return 0, fmt.Errorf("persistence: migration %q has no leading numeric version: %w", name, err)
	}
	return v, nil
}

// applyMigrations brings the schema up to the highest version in ms, skipping any
// already applied.
func (db *DB) applyMigrations(ctx context.Context, ms []migration) error {
	if err := db.ensureMeta(ctx); err != nil {
		return err
	}
	current, err := db.schemaVersion(ctx)
	if err != nil {
		return err
	}
	for _, m := range ms {
		if m.version <= current {
			continue // already applied (idempotent / resume)
		}
		if err := db.applyOne(ctx, m); err != nil {
			return err
		}
		current = m.version
	}
	return nil
}

// ensureMeta bootstraps the meta table that tracks the schema version. It is the
// runner's own bookkeeping, created before any migration so version tracking has
// somewhere to live; 0001_init.sql also declares it (IF NOT EXISTS) idempotently.
func (db *DB) ensureMeta(ctx context.Context) error {
	if _, err := db.writer.ExecContext(ctx,
		`CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);`); err != nil {
		return fmt.Errorf("persistence: ensure meta table: %w", err)
	}
	return nil
}

// schemaVersion reads meta.schema_version, returning 0 when unset.
func (db *DB) schemaVersion(ctx context.Context) (int, error) {
	var val string
	err := db.writer.QueryRowContext(ctx,
		`SELECT value FROM meta WHERE key = ?`, schemaVersionKey).Scan(&val)
	if errors.Is(err, sql.ErrNoRows) {
		return 0, nil
	}
	if err != nil {
		return 0, fmt.Errorf("persistence: read schema version: %w", err)
	}
	v, err := strconv.Atoi(val)
	if err != nil {
		return 0, fmt.Errorf("persistence: corrupt schema version %q: %w", val, err)
	}
	return v, nil
}

// applyOne runs a single migration and records its version atomically.
func (db *DB) applyOne(ctx context.Context, m migration) error {
	tx, err := db.writer.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("persistence: begin migration %s: %w", m.name, err)
	}
	defer func() { _ = tx.Rollback() }() // no-op after Commit

	if hasExecutableSQL(m.sql) {
		if _, err := tx.ExecContext(ctx, m.sql); err != nil {
			return fmt.Errorf("persistence: exec migration %s: %w", m.name, err)
		}
	}
	if _, err := tx.ExecContext(ctx,
		`INSERT INTO meta(key, value) VALUES(?, ?)
		 ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
		schemaVersionKey, strconv.Itoa(m.version)); err != nil {
		return fmt.Errorf("persistence: record migration %s: %w", m.name, err)
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("persistence: commit migration %s: %w", m.name, err)
	}
	return nil
}

// hasExecutableSQL reports whether s contains anything beyond blank lines and
// "--" line comments, so a comment-only migration doesn't trip the driver.
func hasExecutableSQL(s string) bool {
	for _, line := range strings.Split(s, "\n") {
		t := strings.TrimSpace(line)
		if t == "" || strings.HasPrefix(t, "--") {
			continue
		}
		return true
	}
	return false
}
