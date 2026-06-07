// Package vars implements user variables (var.*) as first-class states (TRD 2B
// §2.4 / FR-10.4): typed, durable in SQLite (via persistence.VariableRepo), and
// bindable by widgets like any other state. A flow writing var.mic_muted updates
// the live state store — which fans out and triggers watchers — and persists.
package vars

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/shishir/cyberdeck/engine/core/persistence"
	"github.com/shishir/cyberdeck/engine/core/state"
)

// VarManager bridges durable variable storage and the live state store.
type VarManager struct {
	repo  *persistence.VariableRepo
	store *state.Store
	now   func() int64
}

// Option configures a VarManager.
type Option func(*VarManager)

// WithClock injects a timestamp source (unix millis) for tests.
func WithClock(now func() int64) Option {
	return func(m *VarManager) {
		if now != nil {
			m.now = now
		}
	}
}

// NewManager creates a variable manager over a repo and the live store.
func NewManager(repo *persistence.VariableRepo, store *state.Store, opts ...Option) *VarManager {
	m := &VarManager{repo: repo, store: store, now: func() int64 { return time.Now().UnixMilli() }}
	for _, o := range opts {
		o(m)
	}
	return m
}

// SetVar sets a variable: it updates the live state store first (fan-out + event,
// the architecture's primary path) then persists durably. The value must be a
// number, string, or bool.
func (m *VarManager) SetVar(ctx context.Context, name string, value any) error {
	vt, err := valueType(value)
	if err != nil {
		return err
	}
	if err := m.store.Set(name, value); err != nil {
		return fmt.Errorf("vars: live set %q: %w", name, err)
	}
	vj, err := json.Marshal(value)
	if err != nil {
		return fmt.Errorf("vars: encode %q: %w", name, err)
	}
	if err := m.repo.Set(ctx, persistence.Variable{
		Name: name, ValueType: vt, ValueJSON: string(vj), UpdatedAt: m.now(),
	}); err != nil {
		return fmt.Errorf("vars: persist %q: %w", name, err)
	}
	return nil
}

// GetVar returns the variable's live state (authoritative), or false if unset.
func (m *VarManager) GetVar(name string) (state.State, bool) {
	return m.store.Get(name)
}

// Load reads all persisted var.* from SQLite into the live state store. Called at
// startup so variables survive restart.
func (m *VarManager) Load(ctx context.Context) error {
	vars, err := m.repo.List(ctx)
	if err != nil {
		return fmt.Errorf("vars: load: %w", err)
	}
	for _, v := range vars {
		val, err := decode(v.ValueType, v.ValueJSON)
		if err != nil {
			return fmt.Errorf("vars: decode %q: %w", v.Name, err)
		}
		if err := m.store.Set(v.Name, val); err != nil {
			return fmt.Errorf("vars: restore %q: %w", v.Name, err)
		}
	}
	return nil
}

func valueType(v any) (string, error) {
	switch v.(type) {
	case float64, float32, int, int32, int64:
		return state.TypeNumber, nil
	case string:
		return state.TypeString, nil
	case bool:
		return state.TypeBool, nil
	default:
		return "", fmt.Errorf("vars: unsupported value type %T", v)
	}
}

func decode(valueType, valueJSON string) (any, error) {
	switch valueType {
	case state.TypeNumber:
		var f float64
		if err := json.Unmarshal([]byte(valueJSON), &f); err != nil {
			return nil, err
		}
		return f, nil
	case state.TypeBool:
		var b bool
		if err := json.Unmarshal([]byte(valueJSON), &b); err != nil {
			return nil, err
		}
		return b, nil
	case state.TypeString:
		var s string
		if err := json.Unmarshal([]byte(valueJSON), &s); err != nil {
			return nil, err
		}
		return s, nil
	default:
		return nil, fmt.Errorf("unknown value_type %q", valueType)
	}
}
