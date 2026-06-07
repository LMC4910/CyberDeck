package persistence

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
)

// RegistryItem is a merged registry contribution (action / widget / flow-node).
// schema_json is owned by the registries (PROJ-161).
type RegistryItem struct {
	ID         string
	Kind       string // 'action' | 'widget' | 'flownode'
	Source     string
	SchemaJSON string
	Version    int
}

// RegistryRepo is the typed accessor for the registry_items table.
type RegistryRepo struct{ db *DB }

// NewRegistryRepo binds a RegistryRepo to the store.
func NewRegistryRepo(db *DB) *RegistryRepo { return &RegistryRepo{db: db} }

// Upsert inserts or replaces a registry item (registries re-merge on startup).
func (r *RegistryRepo) Upsert(ctx context.Context, it RegistryItem) error {
	if err := validateJSONField("registry schema_json", it.SchemaJSON); err != nil {
		return err
	}
	_, err := r.db.Writer().ExecContext(ctx,
		`INSERT INTO registry_items(id,kind,source,schema_json,version) VALUES(?,?,?,?,?)
		 ON CONFLICT(id) DO UPDATE SET kind=excluded.kind, source=excluded.source,
		   schema_json=excluded.schema_json, version=excluded.version`,
		it.ID, it.Kind, it.Source, it.SchemaJSON, it.Version)
	if err != nil {
		return fmt.Errorf("persistence: upsert registry item %s: %w", it.ID, err)
	}
	return nil
}

// Get returns the registry item by ID, or ErrNotFound.
func (r *RegistryRepo) Get(ctx context.Context, id string) (RegistryItem, error) {
	var it RegistryItem
	err := r.db.Reader().QueryRowContext(ctx,
		`SELECT id,kind,source,schema_json,version FROM registry_items WHERE id=?`, id).
		Scan(&it.ID, &it.Kind, &it.Source, &it.SchemaJSON, &it.Version)
	if errors.Is(err, sql.ErrNoRows) {
		return RegistryItem{}, ErrNotFound
	}
	if err != nil {
		return RegistryItem{}, fmt.Errorf("persistence: get registry item %s: %w", id, err)
	}
	return it, nil
}

// ListByKind returns registry items of a kind ordered by ID.
func (r *RegistryRepo) ListByKind(ctx context.Context, kind string) ([]RegistryItem, error) {
	rows, err := r.db.Reader().QueryContext(ctx,
		`SELECT id,kind,source,schema_json,version FROM registry_items WHERE kind=? ORDER BY id`, kind)
	if err != nil {
		return nil, fmt.Errorf("persistence: list registry items: %w", err)
	}
	defer func() { _ = rows.Close() }()
	var out []RegistryItem
	for rows.Next() {
		var it RegistryItem
		if err := rows.Scan(&it.ID, &it.Kind, &it.Source, &it.SchemaJSON, &it.Version); err != nil {
			return nil, fmt.Errorf("persistence: scan registry item: %w", err)
		}
		out = append(out, it)
	}
	return out, rows.Err()
}

// Delete removes a registry item, or returns ErrNotFound.
func (r *RegistryRepo) Delete(ctx context.Context, id string) error {
	res, err := r.db.Writer().ExecContext(ctx, `DELETE FROM registry_items WHERE id=?`, id)
	if err != nil {
		return fmt.Errorf("persistence: delete registry item %s: %w", id, err)
	}
	return requireAffected(res, id)
}
