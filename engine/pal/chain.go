package pal

import "sync"

// Chain binds the highest-priority *available* provider for a capability T and
// degrades gracefully to unavailable when none can serve (ADR-0007). Providers
// are tried in declaration order (highest priority first). Safe for concurrent
// use. The FPS chain (Phase 3) is the canonical multi-provider example; telemetry
// and GPU use this now.
type Chain[T any] struct {
	mu        sync.Mutex
	providers []Provider[T]
	bound     Provider[T]
	hasBound  bool
}

// NewChain creates a chain over ordered providers (highest priority first).
func NewChain[T any](providers ...Provider[T]) *Chain[T] {
	return &Chain[T]{providers: providers}
}

// Bind probes providers in order and binds the first available one. It returns
// whether a provider was bound (false = the capability is unavailable).
func (c *Chain[T]) Bind() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.bindLocked()
}

func (c *Chain[T]) bindLocked() bool {
	c.bound = nil
	c.hasBound = false
	for _, p := range c.providers {
		if p.Probe() {
			c.bound = p
			c.hasBound = true
			return true
		}
	}
	return false
}

// Rebind re-probes the chain (e.g. after a provider fault) and rebinds the
// highest available provider, or degrades to unavailable.
func (c *Chain[T]) Rebind() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.bindLocked()
}

// Capability returns the bound capability and ok=false when unavailable. The
// zero value of T (nil for an interface) is returned when unavailable.
func (c *Chain[T]) Capability() (T, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	var zero T
	if !c.hasBound {
		return zero, false
	}
	return c.bound.Capability(), true
}

// Available reports whether a provider is currently bound.
func (c *Chain[T]) Available() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.hasBound
}

// BoundName returns the name of the bound provider, or "" when unavailable.
func (c *Chain[T]) BoundName() string {
	c.mu.Lock()
	defer c.mu.Unlock()
	if !c.hasBound {
		return ""
	}
	return c.bound.Name()
}
