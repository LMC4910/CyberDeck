package persistence

import (
	"testing"

	"github.com/shishir/cyberdeck/engine/internal/secrets"
)

// TestNoSecretInPersistedEntities is the PROJ-115 leak guard: every type the
// persistence layer writes to SQLite must be free of secrets.Secret fields, so a
// secret can never be persisted (2E §7, TB-PER-3). Secrets live only in the OS
// secret store (PROJ-121).
func TestNoSecretInPersistedEntities(t *testing.T) {
	entities := []any{
		Document{},
		RegistryItem{},
		Variable{},
		Workflow{},
		Device{},
		Account{},
		AuditEntry{},
	}
	for _, e := range entities {
		if secrets.ContainsSecret(e) {
			t.Errorf("%T holds a secrets.Secret field — secrets must never be persisted to SQLite (2E §7)", e)
		}
	}

	// Positive control: a struct that DOES carry a secret is detected, proving the
	// guard would catch a regression.
	type leakyRow struct {
		Name string
		Key  secrets.Secret
	}
	if !secrets.ContainsSecret(leakyRow{}) {
		t.Error("guard failed to detect a Secret-bearing struct")
	}
}
