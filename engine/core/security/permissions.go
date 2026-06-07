package security

import (
	"encoding/json"
	"fmt"
)

// Permission model (2E §5). The engine enforces permissions on EVERY interaction
// event, engine-side, never trusting the client or the layout content (a layout
// containing a forbidden action simply produces rejected taps). Authorize is a
// pure function; the caller audits the decision (PROJ-127).

// Permissions is a device's permission set, stored per device as permissions_json
// (2E §2.3 / §5.1).
type Permissions struct {
	AllowPowerActions bool     `json:"allowPowerActions"`
	AllowedCategories []string `json:"allowedCategories"`
	DeniedActions     []string `json:"deniedActions"` // explicit denies override category allow
	AllowEditTrigger  bool     `json:"allowEditTrigger"`
}

// ParsePermissions decodes a permissions_json string. An empty string yields the
// zero (fail-closed) permission set: no categories allowed.
func ParsePermissions(s string) (Permissions, error) {
	var p Permissions
	if s == "" {
		return p, nil
	}
	if err := json.Unmarshal([]byte(s), &p); err != nil {
		return Permissions{}, fmt.Errorf("permissions: parse: %w", err)
	}
	return p, nil
}

// ActionDescriptor is the minimal action metadata Authorize needs. It comes from
// the action registry (PROJ-161); modelled as an interface so the permission
// check is testable before the registry exists.
type ActionDescriptor interface {
	ActionID() string
	Category() string
	IsDestructive() bool
}

// AuthContext is the per-interaction authorization input: the session's
// authentication state and the device's permission snapshot.
type AuthContext struct {
	Authenticated bool
	Revoked       bool
	Perms         Permissions
}

// Reason explains why authorization was denied (empty when allowed). It is stable
// text suitable for the audit log (PROJ-127).
type Reason string

const (
	ReasonOK              Reason = ""
	ReasonUnauthenticated Reason = "device not authenticated or revoked"
	ReasonCategory        Reason = "action category not permitted"
	ReasonDenied          Reason = "action explicitly denied"
	ReasonDestructive     Reason = "destructive action not permitted (allowPowerActions=false)"
)

// Decision is the result of Authorize.
type Decision struct {
	Allowed bool
	Reason  Reason
}

// Authorize runs the 5-step permission check (2E §5.2) in order, returning the
// first failing reason or an allow. It is pure — no side effects, no audit (the
// caller audits).
//
//  1. authenticated & not revoked
//  2. action category ∈ allowedCategories
//  3. action ∉ deniedActions
//  4. destructive action requires allowPowerActions
//  5. plugin-provided action perms — enforced at the IPC boundary (PROJ-133); here a pass
func Authorize(s AuthContext, action ActionDescriptor) Decision {
	if !s.Authenticated || s.Revoked {
		return deny(ReasonUnauthenticated)
	}
	if !contains(s.Perms.AllowedCategories, action.Category()) {
		return deny(ReasonCategory)
	}
	if contains(s.Perms.DeniedActions, action.ActionID()) {
		return deny(ReasonDenied)
	}
	if action.IsDestructive() && !s.Perms.AllowPowerActions {
		return deny(ReasonDestructive)
	}
	// Step 5 (plugin capability perms) is enforced by the plugin host at the IPC
	// boundary (PROJ-133); the permission model passes it through here.
	return Decision{Allowed: true, Reason: ReasonOK}
}

func deny(r Reason) Decision { return Decision{Allowed: false, Reason: r} }

func contains(list []string, v string) bool {
	for _, s := range list {
		if s == v {
			return true
		}
	}
	return false
}
