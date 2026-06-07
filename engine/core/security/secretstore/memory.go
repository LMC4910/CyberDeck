package secretstore

import (
	"sync"

	"github.com/shishir/cyberdeck/engine/internal/secrets"
)

// MemoryStore is an in-memory, non-persistent SecretStore. It backs the contract
// tests and is useful for ephemeral/test contexts. It is NOT used by Open (which
// never silently keeps secrets only in memory for real deployments).
type MemoryStore struct {
	mu sync.RWMutex
	m  map[string]secrets.Secret
}

// NewMemoryStore creates an empty in-memory store.
func NewMemoryStore() *MemoryStore {
	return &MemoryStore{m: make(map[string]secrets.Secret)}
}

// Set stores or replaces the secret under key.
func (s *MemoryStore) Set(key string, value secrets.Secret) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.m[key] = value
	return nil
}

// Get returns the secret for key or ErrNotFound.
func (s *MemoryStore) Get(key string) (secrets.Secret, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	v, ok := s.m[key]
	if !ok {
		return secrets.Secret{}, ErrNotFound
	}
	return v, nil
}

// Delete removes the secret for key, or ErrNotFound if absent.
func (s *MemoryStore) Delete(key string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.m[key]; !ok {
		return ErrNotFound
	}
	delete(s.m, key)
	return nil
}
