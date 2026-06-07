package registry

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
)

// Kind tags a persisted registry item.
const (
	kindAction   = "action"
	kindWidget   = "widget"
	kindFlowNode = "flownode"
)

// RegistryStore persists merged registry items (PROJ-112's persistence.RegistryRepo
// adapts to this at wiring time). It is expressed in primitive terms so this
// package does not depend on persistence.
type RegistryStore interface {
	Upsert(ctx context.Context, id, kind, source, schemaJSON string, version int) error
}

// Contributions is one source's (a plugin's) batch of registry contributions.
type Contributions struct {
	Source    string
	Actions   []ActionDescriptor
	Widgets   []WidgetDescriptor
	FlowNodes []FlowNodeDescriptor
}

// Registry holds the three merged registries. Safe for concurrent use.
type Registry struct {
	mu        sync.RWMutex
	actions   map[string]ActionDescriptor
	widgets   map[string]WidgetDescriptor
	flowNodes map[string]FlowNodeDescriptor
	store     RegistryStore
}

// Option configures a Registry.
type Option func(*Registry)

// WithStore wires a persistence store; merged items are upserted to registry_items.
func WithStore(s RegistryStore) Option {
	return func(r *Registry) { r.store = s }
}

// New creates an empty registry.
func New(opts ...Option) *Registry {
	r := &Registry{
		actions:   make(map[string]ActionDescriptor),
		widgets:   make(map[string]WidgetDescriptor),
		flowNodes: make(map[string]FlowNodeDescriptor),
	}
	for _, o := range opts {
		o(r)
	}
	return r
}

// Merge validates a contribution batch against the schema-of-schemas, rejects any
// ID collision (against already-registered items or within the batch) with a
// diagnostic, persists the merged items, then commits them. It is atomic: on any
// validation or collision error nothing is committed.
func (r *Registry) Merge(ctx context.Context, c Contributions) error {
	// 1) Validate every descriptor up front.
	for _, a := range c.Actions {
		if err := a.validate(); err != nil {
			return fmt.Errorf("registry: invalid contribution from %q: %w", c.Source, err)
		}
	}
	for _, w := range c.Widgets {
		if err := w.validate(); err != nil {
			return fmt.Errorf("registry: invalid contribution from %q: %w", c.Source, err)
		}
	}
	for _, f := range c.FlowNodes {
		if err := f.validate(); err != nil {
			return fmt.Errorf("registry: invalid contribution from %q: %w", c.Source, err)
		}
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	// 2) Collision detection (existing + within-batch), per registry namespace.
	if err := noCollision(c.Actions, r.actions, func(a ActionDescriptor) string { return a.ID }, "action id"); err != nil {
		return err
	}
	if err := noCollision(c.Widgets, r.widgets, func(w WidgetDescriptor) string { return w.Type }, "widget type"); err != nil {
		return err
	}
	if err := noCollision(c.FlowNodes, r.flowNodes, func(f FlowNodeDescriptor) string { return f.Kind }, "flow-node kind"); err != nil {
		return err
	}

	// 3) Persist (idempotent upserts) before committing to memory.
	if r.store != nil {
		for _, a := range c.Actions {
			if err := r.persist(ctx, a.ID, kindAction, c.Source, a); err != nil {
				return err
			}
		}
		for _, w := range c.Widgets {
			if err := r.persist(ctx, w.Type, kindWidget, c.Source, w); err != nil {
				return err
			}
		}
		for _, f := range c.FlowNodes {
			if err := r.persist(ctx, f.Kind, kindFlowNode, c.Source, f); err != nil {
				return err
			}
		}
	}

	// 4) Commit to memory.
	for _, a := range c.Actions {
		r.actions[a.ID] = a
	}
	for _, w := range c.Widgets {
		r.widgets[w.Type] = w
	}
	for _, f := range c.FlowNodes {
		r.flowNodes[f.Kind] = f
	}
	return nil
}

// noCollision rejects items whose key already exists or repeats within the batch.
func noCollision[T any, V any](items []T, existing map[string]V, key func(T) string, label string) error {
	seen := make(map[string]bool, len(items))
	for _, it := range items {
		k := key(it)
		if _, ok := existing[k]; ok {
			return fmt.Errorf("registry: duplicate %s %q (already registered)", label, k)
		}
		if seen[k] {
			return fmt.Errorf("registry: duplicate %s %q (within contribution batch)", label, k)
		}
		seen[k] = true
	}
	return nil
}

func (r *Registry) persist(ctx context.Context, id, kind, source string, v any) error {
	b, err := json.Marshal(v)
	if err != nil {
		return fmt.Errorf("registry: marshal %s %q: %w", kind, id, err)
	}
	if err := r.store.Upsert(ctx, id, kind, source, string(b), 1); err != nil {
		return fmt.Errorf("registry: persist %s %q: %w", kind, id, err)
	}
	return nil
}
