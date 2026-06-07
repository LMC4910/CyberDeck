package transport

import (
	"context"
	"errors"
	"fmt"
	"time"
)

// ConnectionManager resolves a device to ordered candidate endpoints and opens a
// session to it (ADR-0010). Everything above it (sessions, channels, engine,
// document model) is endpoint-kind-agnostic.
type ConnectionManager interface {
	Resolve(ctx context.Context, deviceUUID string) ([]TransportEndpoint, error)
	Open(ctx context.Context, deviceUUID string) (Session, error)
}

// Manager is the V1 ConnectionManager. It delegates discovery to an injected
// EndpointResolver and the post-dial handshake to an injected Handshaker, so it
// contains no discovery logic and no crypto itself.
type Manager struct {
	resolver    EndpointResolver
	handshaker  Handshaker
	dialTimeout time.Duration
}

// Option configures a Manager.
type Option func(*Manager)

// WithDialTimeout bounds each candidate's dial+handshake attempt.
func WithDialTimeout(d time.Duration) Option {
	return func(m *Manager) {
		if d > 0 {
			m.dialTimeout = d
		}
	}
}

// NewManager builds a connection manager.
func NewManager(resolver EndpointResolver, handshaker Handshaker, opts ...Option) *Manager {
	m := &Manager{
		resolver:    resolver,
		handshaker:  handshaker,
		dialTimeout: 10 * time.Second,
	}
	for _, o := range opts {
		o(m)
	}
	return m
}

// Resolve returns the device's candidate endpoints in priority order.
func (m *Manager) Resolve(ctx context.Context, deviceUUID string) ([]TransportEndpoint, error) {
	eps, err := m.resolver.Resolve(ctx, deviceUUID)
	if err != nil {
		return nil, err
	}
	return orderCandidates(eps), nil
}

// Open resolves candidates, then dials and handshakes each in priority order
// until one succeeds (2A §4: RESOLVING → DIALING → HANDSHAKE → CONNECTED). The
// first established session wins.
func (m *Manager) Open(ctx context.Context, deviceUUID string) (Session, error) {
	candidates, err := m.Resolve(ctx, deviceUUID)
	if err != nil {
		return nil, fmt.Errorf("transport: resolve %s: %w", deviceUUID, err)
	}
	if len(candidates) == 0 {
		return nil, fmt.Errorf("transport: no endpoints for device %s", deviceUUID)
	}

	var attemptErrs []error
	for _, ep := range candidates {
		sess, err := m.dialAndHandshake(ctx, deviceUUID, ep)
		if err != nil {
			attemptErrs = append(attemptErrs, err)
			continue
		}
		return sess, nil
	}
	return nil, fmt.Errorf("transport: all %d endpoints failed for device %s: %w",
		len(candidates), deviceUUID, errors.Join(attemptErrs...))
}

func (m *Manager) dialAndHandshake(ctx context.Context, deviceUUID string, ep TransportEndpoint) (Session, error) {
	dialCtx := ctx
	if m.dialTimeout > 0 {
		var cancel context.CancelFunc
		dialCtx, cancel = context.WithTimeout(ctx, m.dialTimeout)
		defer cancel()
	}

	conn, err := ep.Dial(dialCtx)
	if err != nil {
		return nil, err
	}
	sess, err := m.handshaker.Handshake(dialCtx, deviceUUID, conn, ep.Describe())
	if err != nil {
		_ = conn.Close()
		return nil, fmt.Errorf("transport: handshake via %s: %w", ep.Describe().Source, err)
	}
	return sess, nil
}
