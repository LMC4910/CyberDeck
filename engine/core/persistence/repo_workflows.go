package persistence

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
)

// Workflow is a flow document (2D owns body_json shape).
type Workflow struct {
	ID        string
	Label     string
	Version   int
	BodyJSON  string
	UpdatedAt int64
}

// WorkflowRepo is the typed accessor for the workflows table.
type WorkflowRepo struct{ db *DB }

// NewWorkflowRepo binds a WorkflowRepo to the store.
func NewWorkflowRepo(db *DB) *WorkflowRepo { return &WorkflowRepo{db: db} }

// Insert writes a new workflow.
func (r *WorkflowRepo) Insert(ctx context.Context, w Workflow) error {
	if err := validateJSONField("workflow body_json", w.BodyJSON); err != nil {
		return err
	}
	_, err := r.db.Writer().ExecContext(ctx,
		`INSERT INTO workflows(id,label,version,body_json,updated_at) VALUES(?,?,?,?,?)`,
		w.ID, w.Label, w.Version, w.BodyJSON, w.UpdatedAt)
	if err != nil {
		return fmt.Errorf("persistence: insert workflow %s: %w", w.ID, err)
	}
	return nil
}

// Get returns the workflow by ID, or ErrNotFound.
func (r *WorkflowRepo) Get(ctx context.Context, id string) (Workflow, error) {
	var w Workflow
	err := r.db.Reader().QueryRowContext(ctx,
		`SELECT id,label,version,body_json,updated_at FROM workflows WHERE id=?`, id).
		Scan(&w.ID, &w.Label, &w.Version, &w.BodyJSON, &w.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return Workflow{}, ErrNotFound
	}
	if err != nil {
		return Workflow{}, fmt.Errorf("persistence: get workflow %s: %w", id, err)
	}
	return w, nil
}

// List returns all workflows ordered by ID.
func (r *WorkflowRepo) List(ctx context.Context) ([]Workflow, error) {
	rows, err := r.db.Reader().QueryContext(ctx,
		`SELECT id,label,version,body_json,updated_at FROM workflows ORDER BY id`)
	if err != nil {
		return nil, fmt.Errorf("persistence: list workflows: %w", err)
	}
	defer func() { _ = rows.Close() }()
	var out []Workflow
	for rows.Next() {
		var w Workflow
		if err := rows.Scan(&w.ID, &w.Label, &w.Version, &w.BodyJSON, &w.UpdatedAt); err != nil {
			return nil, fmt.Errorf("persistence: scan workflow: %w", err)
		}
		out = append(out, w)
	}
	return out, rows.Err()
}

// Update replaces an existing workflow, or returns ErrNotFound.
func (r *WorkflowRepo) Update(ctx context.Context, w Workflow) error {
	if err := validateJSONField("workflow body_json", w.BodyJSON); err != nil {
		return err
	}
	res, err := r.db.Writer().ExecContext(ctx,
		`UPDATE workflows SET label=?, version=?, body_json=?, updated_at=? WHERE id=?`,
		w.Label, w.Version, w.BodyJSON, w.UpdatedAt, w.ID)
	if err != nil {
		return fmt.Errorf("persistence: update workflow %s: %w", w.ID, err)
	}
	return requireAffected(res, w.ID)
}

// Delete removes a workflow, or returns ErrNotFound.
func (r *WorkflowRepo) Delete(ctx context.Context, id string) error {
	res, err := r.db.Writer().ExecContext(ctx, `DELETE FROM workflows WHERE id=?`, id)
	if err != nil {
		return fmt.Errorf("persistence: delete workflow %s: %w", id, err)
	}
	return requireAffected(res, id)
}
