package session

import (
	"sync"

	"github.com/shishir/cyberdeck/engine/core/security"
	"github.com/shishir/cyberdeck/engine/core/state"
)

// Session is one connected device's isolated session (2B §5.1): its UUID, a
// permissions snapshot, the active profile, the bound-state subscription set, and
// its mode. It is created post-handshake (by transport) and torn down on
// drop/revoke. All accessors are safe for concurrent use; no two sessions share
// mutable state.
type Session struct {
	uuid string // immutable

	mu            sync.RWMutex
	perms         security.Permissions
	activeProfile *Profile
	subscriptions *state.SubscriptionSet
	mode          Mode
}

func newSession(uuid string, perms security.Permissions) *Session {
	return &Session{
		uuid:          uuid,
		perms:         perms,
		subscriptions: state.NewSubscriptionSet(),
		mode:          ModeRuntime,
	}
}

// UUID returns the session's device UUID.
func (s *Session) UUID() string { return s.uuid }

// Permissions returns the session's permission snapshot.
func (s *Session) Permissions() security.Permissions {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.perms
}

// SetPermissions replaces the permission snapshot (e.g. after a permission edit).
func (s *Session) SetPermissions(p security.Permissions) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.perms = p
}

// Mode returns the session's interaction mode.
func (s *Session) Mode() Mode {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.mode
}

// SetMode flips the session's interaction mode (runtime↔edit).
func (s *Session) SetMode(m Mode) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.mode = m
}

// ActiveProfile returns the current profile (nil if none).
func (s *Session) ActiveProfile() *Profile {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.activeProfile
}

// SetActiveProfile sets the current profile.
func (s *Session) SetActiveProfile(p *Profile) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.activeProfile = p
}

// Subscriptions returns the session's bound-state subscription set (derived from
// its layout by the client/designer; the session just holds/exposes it).
func (s *Session) Subscriptions() *state.SubscriptionSet {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.subscriptions
}

// SetSubscriptions replaces the subscription set.
func (s *Session) SetSubscriptions(sub *state.SubscriptionSet) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.subscriptions = sub
}

// Manager owns the set of live sessions, keyed by device UUID.
type Manager struct {
	mu       sync.RWMutex
	sessions map[string]*Session
}

// NewManager creates an empty session manager.
func NewManager() *Manager {
	return &Manager{sessions: make(map[string]*Session)}
}

// Create makes a new isolated session for a device and registers it, replacing any
// existing session for that UUID.
func (m *Manager) Create(uuid string, perms security.Permissions) *Session {
	s := newSession(uuid, perms)
	m.mu.Lock()
	defer m.mu.Unlock()
	m.sessions[uuid] = s
	return s
}

// Get returns the live session for a device, if any.
func (m *Manager) Get(uuid string) (*Session, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	s, ok := m.sessions[uuid]
	return s, ok
}

// Teardown removes a device's session (used by revocation, PROJ-126). It reports
// whether a session was present.
func (m *Manager) Teardown(uuid string) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	_, ok := m.sessions[uuid]
	delete(m.sessions, uuid)
	return ok
}

// Count returns the number of live sessions.
func (m *Manager) Count() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return len(m.sessions)
}
