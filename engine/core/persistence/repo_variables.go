package persistence

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
)

// Variable is a durable user variable (var.*) — typed and bindable as state
// (2B §2.4). value_json holds the typed value; value_type tags it.
type Variable struct {
	Name      string
	ValueType string // number | string | bool
	ValueJSON string
	UpdatedAt int64
}

// VariableRepo is the typed accessor for the variables table.
type VariableRepo struct{ db *DB }

// NewVariableRepo binds a VariableRepo to the store.
func NewVariableRepo(db *DB) *VariableRepo { return &VariableRepo{db: db} }

// Set inserts or updates a variable (typed var.* set).
func (r *VariableRepo) Set(ctx context.Context, v Variable) error {
	if err := validateJSONField("variable value_json", v.ValueJSON); err != nil {
		return err
	}
	_, err := r.db.Writer().ExecContext(ctx,
		`INSERT INTO variables(name,value_type,value_json,updated_at) VALUES(?,?,?,?)
		 ON CONFLICT(name) DO UPDATE SET value_type=excluded.value_type,
		   value_json=excluded.value_json, updated_at=excluded.updated_at`,
		v.Name, v.ValueType, v.ValueJSON, v.UpdatedAt)
	if err != nil {
		return fmt.Errorf("persistence: set variable %s: %w", v.Name, err)
	}
	return nil
}

// Get returns the variable by name, or ErrNotFound.
func (r *VariableRepo) Get(ctx context.Context, name string) (Variable, error) {
	var v Variable
	err := r.db.Reader().QueryRowContext(ctx,
		`SELECT name,value_type,value_json,updated_at FROM variables WHERE name=?`, name).
		Scan(&v.Name, &v.ValueType, &v.ValueJSON, &v.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return Variable{}, ErrNotFound
	}
	if err != nil {
		return Variable{}, fmt.Errorf("persistence: get variable %s: %w", name, err)
	}
	return v, nil
}

// List returns all variables ordered by name.
func (r *VariableRepo) List(ctx context.Context) ([]Variable, error) {
	rows, err := r.db.Reader().QueryContext(ctx,
		`SELECT name,value_type,value_json,updated_at FROM variables ORDER BY name`)
	if err != nil {
		return nil, fmt.Errorf("persistence: list variables: %w", err)
	}
	defer func() { _ = rows.Close() }()
	var out []Variable
	for rows.Next() {
		var v Variable
		if err := rows.Scan(&v.Name, &v.ValueType, &v.ValueJSON, &v.UpdatedAt); err != nil {
			return nil, fmt.Errorf("persistence: scan variable: %w", err)
		}
		out = append(out, v)
	}
	return out, rows.Err()
}

// Delete removes a variable, or returns ErrNotFound.
func (r *VariableRepo) Delete(ctx context.Context, name string) error {
	res, err := r.db.Writer().ExecContext(ctx, `DELETE FROM variables WHERE name=?`, name)
	if err != nil {
		return fmt.Errorf("persistence: delete variable %s: %w", name, err)
	}
	return requireAffected(res, name)
}
