package flow

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/shishir/cyberdeck/engine/core/persistence"
)

// WorkflowStore is the slice of the persistence layer flow needs (the
// *persistence.WorkflowRepo satisfies it; tests inject an in-memory fake).
type WorkflowStore interface {
	Get(ctx context.Context, id string) (persistence.Workflow, error)
	Insert(ctx context.Context, w persistence.Workflow) error
	Update(ctx context.Context, w persistence.Workflow) error
}

// Store persists validated flow documents with a monotonic version.
type Store struct {
	repo WorkflowStore
	reg  NodeRegistry
	now  func() int64
}

// StoreOption configures a Store.
type StoreOption func(*Store)

// WithClock injects a timestamp source (unix millis) for tests.
func WithClock(now func() int64) StoreOption {
	return func(s *Store) {
		if now != nil {
			s.now = now
		}
	}
}

// NewStore builds a flow store over a workflow repo + the flow-node registry.
func NewStore(repo WorkflowStore, reg NodeRegistry, opts ...StoreOption) *Store {
	s := &Store{repo: repo, reg: reg, now: func() int64 { return time.Now().UnixMilli() }}
	for _, o := range opts {
		o(s)
	}
	return s
}

// Save validates the flow against the registry, then persists it: a new flow gets
// version 1; an existing one is version-bumped. A flow that fails validation is
// never written. Returns the persisted version.
func (s *Store) Save(ctx context.Context, f *Flow) (int, error) {
	if err := Validate(s.reg, f); err != nil {
		return 0, err
	}
	existing, err := s.repo.Get(ctx, f.ID)
	switch {
	case errors.Is(err, persistence.ErrNotFound):
		f.Version = 1
	case err != nil:
		return 0, fmt.Errorf("flow: load existing %q: %w", f.ID, err)
	default:
		f.Version = existing.Version + 1
	}

	body, err := f.JSON()
	if err != nil {
		return 0, err
	}
	row := persistence.Workflow{
		ID: f.ID, Label: f.Label, Version: f.Version,
		BodyJSON: string(body), UpdatedAt: s.now(),
	}
	if f.Version == 1 {
		if err := s.repo.Insert(ctx, row); err != nil {
			return 0, fmt.Errorf("flow: insert %q: %w", f.ID, err)
		}
	} else if err := s.repo.Update(ctx, row); err != nil {
		return 0, fmt.Errorf("flow: update %q: %w", f.ID, err)
	}
	return f.Version, nil
}

// Load reads a flow document by id; the persisted version is authoritative.
func (s *Store) Load(ctx context.Context, id string) (*Flow, error) {
	w, err := s.repo.Get(ctx, id)
	if err != nil {
		return nil, err
	}
	f, err := ParseFlow([]byte(w.BodyJSON))
	if err != nil {
		return nil, err
	}
	f.Version = w.Version
	return f, nil
}
