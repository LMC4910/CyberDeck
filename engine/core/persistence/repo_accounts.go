package persistence

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
)

// Account is the reserved cloud-overlay record (Phase 7, ADR-0016). Structurally
// present in V1 but unused; it references device UUIDs and never owns identity.
type Account struct {
	ID        string
	Email     string
	Tier      string
	CreatedAt int64
}

// AccountRepo is the minimal typed accessor for the reserved accounts table.
type AccountRepo struct {
	db *DB
}

// NewAccountRepo binds an AccountRepo to the store.
func NewAccountRepo(db *DB) *AccountRepo { return &AccountRepo{db: db} }

// Insert writes a new account.
func (r *AccountRepo) Insert(ctx context.Context, a Account) error {
	_, err := r.db.Writer().ExecContext(ctx,
		`INSERT INTO accounts(id,email,tier,created_at) VALUES(?,?,?,?)`,
		a.ID, a.Email, a.Tier, a.CreatedAt)
	if err != nil {
		return fmt.Errorf("persistence: insert account %s: %w", a.ID, err)
	}
	return nil
}

// Get returns the account by ID, or ErrNotFound.
func (r *AccountRepo) Get(ctx context.Context, id string) (Account, error) {
	var a Account
	err := r.db.Reader().QueryRowContext(ctx,
		`SELECT id,email,tier,created_at FROM accounts WHERE id=?`, id).
		Scan(&a.ID, &a.Email, &a.Tier, &a.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return Account{}, ErrNotFound
	}
	if err != nil {
		return Account{}, fmt.Errorf("persistence: get account %s: %w", id, err)
	}
	return a, nil
}

// Delete removes the account by ID, or ErrNotFound.
func (r *AccountRepo) Delete(ctx context.Context, id string) error {
	res, err := r.db.Writer().ExecContext(ctx, `DELETE FROM accounts WHERE id=?`, id)
	if err != nil {
		return fmt.Errorf("persistence: delete account %s: %w", id, err)
	}
	return requireAffected(res, id)
}
