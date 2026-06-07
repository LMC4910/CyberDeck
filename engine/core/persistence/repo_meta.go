package persistence

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
)

// MetaRepo is the typed accessor for the meta key/value table. Its GetString /
// SetString shape also satisfies the identity PublicStore contract (PROJ-120), so
// engine identity's public material can persist here.
type MetaRepo struct {
	db *DB
}

// NewMetaRepo binds a MetaRepo to the store.
func NewMetaRepo(db *DB) *MetaRepo { return &MetaRepo{db: db} }

// GetString returns the value for key and whether it was present.
func (r *MetaRepo) GetString(key string) (string, bool, error) {
	var v string
	err := r.db.Reader().QueryRowContext(context.Background(),
		`SELECT value FROM meta WHERE key=?`, key).Scan(&v)
	if errors.Is(err, sql.ErrNoRows) {
		return "", false, nil
	}
	if err != nil {
		return "", false, fmt.Errorf("persistence: meta get %q: %w", key, err)
	}
	return v, true, nil
}

// SetString stores (or replaces) the value for key.
func (r *MetaRepo) SetString(key, value string) error {
	_, err := r.db.Writer().ExecContext(context.Background(),
		`INSERT INTO meta(key,value) VALUES(?,?)
		 ON CONFLICT(key) DO UPDATE SET value=excluded.value`, key, value)
	if err != nil {
		return fmt.Errorf("persistence: meta set %q: %w", key, err)
	}
	return nil
}

// Delete removes a key. Deleting a missing key is not an error.
func (r *MetaRepo) Delete(key string) error {
	_, err := r.db.Writer().ExecContext(context.Background(),
		`DELETE FROM meta WHERE key=?`, key)
	if err != nil {
		return fmt.Errorf("persistence: meta delete %q: %w", key, err)
	}
	return nil
}
