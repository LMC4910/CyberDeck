// Package persistence owns the engine's single embedded SQLite store (ADR-0014).
//
// All durable data — profiles/pages (documents), merged registry items, var.*,
// workflows, trusted devices, accounts, and the append-only audit log — lives in
// one file. Live state (the state store, §2) and series ring buffers are in-memory
// and are NEVER persisted here (TB-ST-3). Secrets are NEVER stored here (TB-PER-3,
// 2E §7); they go to the OS secret store (PROJ-121).
package persistence

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"path/filepath"

	_ "modernc.org/sqlite" // pure-Go SQLite driver (ADR-0001 impl, registers "sqlite")
)

const driverName = "sqlite"

// ErrNotFound is returned by repository Get/Update/Revoke calls when no row
// matches the requested key.
var ErrNotFound = errors.New("persistence: record not found")

// DB is the engine's single SQLite store. It holds two *sql.DB handles over the
// same file in WAL mode:
//
//   - writer: serialized (max 1 open connection) so writes never collide
//     (SQLITE_BUSY) — SQLite permits only one writer at a time.
//   - reader: a small pool, so var.* and audit reads don't block on the writer.
type DB struct {
	writer *sql.DB
	reader *sql.DB
	path   string
}

// dsn builds a modernc.org/sqlite DSN. WAL is persisted in the database header,
// but busy_timeout/foreign_keys/synchronous are per-connection, so they ride the
// DSN to apply to every connection a pool opens.
func dsn(path string) string {
	return fmt.Sprintf(
		"file:%s?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)&_pragma=foreign_keys(on)&_pragma=synchronous(NORMAL)",
		filepath.ToSlash(path),
	)
}

// Open opens (creating if absent) the SQLite store at path, enabling WAL and the
// writer/reader split. Call Migrate after Open to bring the schema up to date.
func Open(path string) (*DB, error) {
	if path == "" {
		return nil, errors.New("persistence: empty database path")
	}

	writer, err := sql.Open(driverName, dsn(path))
	if err != nil {
		return nil, fmt.Errorf("persistence: open writer: %w", err)
	}
	writer.SetMaxOpenConns(1) // single serialized writer

	reader, err := sql.Open(driverName, dsn(path))
	if err != nil {
		_ = writer.Close()
		return nil, fmt.Errorf("persistence: open reader: %w", err)
	}
	reader.SetMaxOpenConns(4) // modest read pool; reads are short

	db := &DB{writer: writer, reader: reader, path: path}

	// Eagerly establish the writer connection so the file is created and WAL is
	// engaged now, and so any open error surfaces here rather than on first use.
	if err := writer.PingContext(context.Background()); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("persistence: ping: %w", err)
	}
	return db, nil
}

// Writer returns the serialized writer handle. All INSERT/UPDATE/DELETE and DDL
// go through this handle.
func (db *DB) Writer() *sql.DB { return db.writer }

// Reader returns the read pool handle for SELECT-only queries.
func (db *DB) Reader() *sql.DB { return db.reader }

// Path returns the on-disk path of the store.
func (db *DB) Path() string { return db.path }

// JournalMode reports the active journal mode (expected "wal").
func (db *DB) JournalMode(ctx context.Context) (string, error) {
	var mode string
	if err := db.reader.QueryRowContext(ctx, "PRAGMA journal_mode").Scan(&mode); err != nil {
		return "", fmt.Errorf("persistence: read journal_mode: %w", err)
	}
	return mode, nil
}

// WithWriteTx runs fn inside a single write transaction, committing on success
// and rolling back on any error so a multi-row write is all-or-nothing.
func (db *DB) WithWriteTx(ctx context.Context, fn func(tx *sql.Tx) error) error {
	tx, err := db.writer.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("persistence: begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback() }() // no-op after a successful Commit
	if err := fn(tx); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("persistence: commit tx: %w", err)
	}
	return nil
}

// Close closes both handles, reader first.
func (db *DB) Close() error {
	var errs []error
	if db.reader != nil {
		if err := db.reader.Close(); err != nil {
			errs = append(errs, fmt.Errorf("persistence: close reader: %w", err))
		}
	}
	if db.writer != nil {
		if err := db.writer.Close(); err != nil {
			errs = append(errs, fmt.Errorf("persistence: close writer: %w", err))
		}
	}
	return errors.Join(errs...)
}
