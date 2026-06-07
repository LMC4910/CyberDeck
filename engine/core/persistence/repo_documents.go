package persistence

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
)

// validateJSONField fails closed on a malformed JSON body. Schema-level
// validation against shared/schemas arrives with the registries (PROJ-161); this
// is the structural gate that keeps invalid bodies out of the store.
func validateJSONField(field, data string) error {
	if data == "" {
		return fmt.Errorf("persistence: %s must not be empty", field)
	}
	if !json.Valid([]byte(data)) {
		return fmt.Errorf("persistence: %s is not valid JSON", field)
	}
	return nil
}

// Document is a profile/page layout document (2C owns body_json shape).
type Document struct {
	ID          string
	Kind        string // 'profile' | 'page'
	DeviceClass string
	Version     int
	BodyJSON    string
	UpdatedAt   int64
}

// DocumentRepo is the typed accessor for the documents table.
type DocumentRepo struct{ db *DB }

// NewDocumentRepo binds a DocumentRepo to the store.
func NewDocumentRepo(db *DB) *DocumentRepo { return &DocumentRepo{db: db} }

func insertDocument(ctx context.Context, x execer, d Document) error {
	if err := validateJSONField("document body_json", d.BodyJSON); err != nil {
		return err
	}
	_, err := x.ExecContext(ctx,
		`INSERT INTO documents(id,kind,device_class,version,body_json,updated_at) VALUES(?,?,?,?,?,?)`,
		d.ID, d.Kind, d.DeviceClass, d.Version, d.BodyJSON, d.UpdatedAt)
	if err != nil {
		return fmt.Errorf("persistence: insert document %s: %w", d.ID, err)
	}
	return nil
}

// Insert writes a new document.
func (r *DocumentRepo) Insert(ctx context.Context, d Document) error {
	return insertDocument(ctx, r.db.Writer(), d)
}

// InsertMany writes several documents in one transaction; any failure rolls back
// the whole batch (no partial writes).
func (r *DocumentRepo) InsertMany(ctx context.Context, docs []Document) error {
	return r.db.WithWriteTx(ctx, func(tx *sql.Tx) error {
		for _, d := range docs {
			if err := insertDocument(ctx, tx, d); err != nil {
				return err
			}
		}
		return nil
	})
}

// Get returns the document by ID, or ErrNotFound.
func (r *DocumentRepo) Get(ctx context.Context, id string) (Document, error) {
	var d Document
	err := r.db.Reader().QueryRowContext(ctx,
		`SELECT id,kind,device_class,version,body_json,updated_at FROM documents WHERE id=?`, id).
		Scan(&d.ID, &d.Kind, &d.DeviceClass, &d.Version, &d.BodyJSON, &d.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return Document{}, ErrNotFound
	}
	if err != nil {
		return Document{}, fmt.Errorf("persistence: get document %s: %w", id, err)
	}
	return d, nil
}

// ListByDeviceClass returns documents for a device class (uses the device_class index).
func (r *DocumentRepo) ListByDeviceClass(ctx context.Context, class string) ([]Document, error) {
	rows, err := r.db.Reader().QueryContext(ctx,
		`SELECT id,kind,device_class,version,body_json,updated_at FROM documents WHERE device_class=? ORDER BY id`, class)
	if err != nil {
		return nil, fmt.Errorf("persistence: list documents: %w", err)
	}
	defer func() { _ = rows.Close() }()
	var out []Document
	for rows.Next() {
		var d Document
		if err := rows.Scan(&d.ID, &d.Kind, &d.DeviceClass, &d.Version, &d.BodyJSON, &d.UpdatedAt); err != nil {
			return nil, fmt.Errorf("persistence: scan document: %w", err)
		}
		out = append(out, d)
	}
	return out, rows.Err()
}

// Update replaces an existing document, or returns ErrNotFound.
func (r *DocumentRepo) Update(ctx context.Context, d Document) error {
	if err := validateJSONField("document body_json", d.BodyJSON); err != nil {
		return err
	}
	res, err := r.db.Writer().ExecContext(ctx,
		`UPDATE documents SET kind=?, device_class=?, version=?, body_json=?, updated_at=? WHERE id=?`,
		d.Kind, d.DeviceClass, d.Version, d.BodyJSON, d.UpdatedAt, d.ID)
	if err != nil {
		return fmt.Errorf("persistence: update document %s: %w", d.ID, err)
	}
	return requireAffected(res, d.ID)
}

// Delete removes a document, or returns ErrNotFound.
func (r *DocumentRepo) Delete(ctx context.Context, id string) error {
	res, err := r.db.Writer().ExecContext(ctx, `DELETE FROM documents WHERE id=?`, id)
	if err != nil {
		return fmt.Errorf("persistence: delete document %s: %w", id, err)
	}
	return requireAffected(res, id)
}

// execer is satisfied by both *sql.DB and *sql.Tx, so the same insert helper works
// inside or outside a transaction.
type execer interface {
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
}
