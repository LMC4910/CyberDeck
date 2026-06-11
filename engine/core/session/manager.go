package session

import (
	"context"
	"encoding/json"
	"log"
	"sync"
	"sync/atomic"
	"time"

	"github.com/shishir/cyberdeck/engine/core/layout"
	"github.com/shishir/cyberdeck/engine/core/registry"
	"github.com/shishir/cyberdeck/engine/core/security"
	"github.com/shishir/cyberdeck/engine/core/state"
	"github.com/shishir/cyberdeck/engine/core/transport"
)

// profileID is the single served profile in the first-testable slice (the built-in
// default deck). Multi-profile activation is PROJ-163/216 territory.
const profileID = "default"

// DefaultHeartbeatTimeout closes a session that has gone silent (no ping / traffic)
// for this long — frees a dead device's slot (PROJ-145). 0 disables the reaper.
const DefaultHeartbeatTimeout = 20 * time.Second

// --- collaborator seams (kept small + injected so the manager is unit-testable) ---

// ActionLookup resolves an action's descriptor for the permission check (the action
// registry, PROJ-161, satisfies it).
type ActionLookup interface {
	Action(id string) (registry.ActionDescriptor, bool)
}

// ActionInvoker dispatches an authorized action (the plugin-host-backed invoker
// wired in PROJ-105/B5 satisfies it).
type ActionInvoker interface {
	Invoke(ctx context.Context, actionID string, params json.RawMessage) error
}

// Auditor records an audit event (PROJ-127).
type Auditor interface {
	Audit(event string, fields map[string]any)
}

// StateReader provides the current state snapshot for a session's initial burst.
type StateReader interface {
	Snapshot() []state.State
}

// liveSession bundles a device's session + mux + last-seen timestamp (unix nanos).
type liveSession struct {
	sess     *transport.EncryptedSession
	mux      *transport.ChannelMux
	lastSeen atomic.Int64
}

// Server serves paired devices: it pushes each the active layout + a filtered live
// state stream, dispatches their interactions through the permission gate + audit,
// answers heartbeats + resyncs, and reaps silent sessions. It implements Handler, so
// the listener hands it each new session. (Distinct from Manager, the in-memory
// session/profile registry, PROJ-163.)
type Server struct {
	fanout    *transport.Fanout
	profile   *layout.Profile
	states    StateReader
	lookup    ActionLookup
	invoker   ActionInvoker
	audit     Auditor
	logger    *log.Logger
	heartbeat time.Duration
	now       func() time.Time

	mu   sync.Mutex
	live map[string]*liveSession // device uuid → live session
}

// NewServer builds a session server.
func NewServer(fanout *transport.Fanout, profile *layout.Profile, states StateReader,
	lookup ActionLookup, invoker ActionInvoker, audit Auditor, logger *log.Logger) *Server {
	if logger == nil {
		logger = log.New(log.Writer(), "", log.LstdFlags)
	}
	return &Server{
		fanout: fanout, profile: profile, states: states,
		lookup: lookup, invoker: invoker, audit: audit, logger: logger,
		heartbeat: DefaultHeartbeatTimeout,
		now:       time.Now,
		live:      map[string]*liveSession{},
	}
}

// SetHeartbeatTimeout overrides the idle-session reaper timeout (≤0 disables it).
func (m *Server) SetHeartbeatTimeout(d time.Duration) { m.heartbeat = d }

// Serve sets up a freshly paired session — pushes the layout snapshot + initial
// state, registers the device for fan-out, consumes its control channel (interactions
// / ping / resync), and reaps it if it goes silent — then returns immediately. A
// background goroutine cleans up when the session ends.
func (m *Server) Serve(sess *transport.EncryptedSession, hr *HandshakeResult) {
	uuid := hr.DeviceUUID
	perms, err := security.ParsePermissions(hr.PermissionsJSON)
	if err != nil {
		m.logger.Printf("session: %s has unparseable permissions, denying all: %v", uuid, err)
	}
	authCtx := security.AuthContext{Authenticated: true, Revoked: false, Perms: perms}

	mux := transport.NewChannelMux(sess, 0, 0)
	ls := &liveSession{sess: sess, mux: mux}
	ls.lastSeen.Store(m.now().UnixNano())

	m.serveSnapshot(mux) // initial layout + state burst (serial, before fan-out)

	m.fanout.Add(&transport.Subscriber{
		DeviceUUID: uuid,
		Subs:       state.NewSubscriptionSet(m.profile.StateBindings()...),
		Mux:        mux,
		ProfileID:  profileID,
		EditMode:   false,
	})
	m.track(uuid, ls)
	m.audit.Audit("session.opened", map[string]any{"device": uuid})

	go m.consumeControl(ls, uuid, authCtx)
	go m.reap(ls)
	go func() {
		<-sess.Done()
		m.fanout.Remove(uuid)
		mux.Close()
		m.untrack(uuid)
		m.audit.Audit("session.closed", map[string]any{"device": uuid})
	}()
}

// serveSnapshot sends the active page + the current value of each bound state, then
// flushes. Used for the initial burst and for resync (PROJ-149).
func (m *Server) serveSnapshot(mux *transport.ChannelMux) {
	bound := m.profile.StateBindings()
	if page := m.profile.ActivePage(); page != nil {
		if env, err := layoutSnapshotEnvelope(page, m.profile.Version); err == nil {
			mux.SendLayout(env)
		} else {
			m.logger.Printf("session: encode layout snapshot: %v", err)
		}
		boundSet := make(map[string]bool, len(bound))
		for _, id := range bound {
			boundSet[id] = true
		}
		for _, st := range m.states.Snapshot() {
			if boundSet[st.ID] {
				mux.SendState(st.ID, stateDeltaEnvelope(st))
			}
		}
	}
	if err := mux.Flush(); err != nil {
		m.logger.Printf("session: snapshot flush: %v", err)
	}
}

// CloseDevice tears down a device's live session immediately (used by revocation,
// PROJ-126). Reports whether a session was present.
func (m *Server) CloseDevice(uuid string) bool {
	m.mu.Lock()
	ls := m.live[uuid]
	delete(m.live, uuid) // untrack synchronously so a repeat call is a no-op
	m.mu.Unlock()
	if ls == nil {
		return false
	}
	_ = ls.sess.Close()
	return true
}

// LiveDevices returns the UUIDs of currently connected devices (for the console
// `list` command).
func (m *Server) LiveDevices() []string {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make([]string, 0, len(m.live))
	for uuid := range m.live {
		out = append(out, uuid)
	}
	return out
}

// CloseAll tears down every live session (graceful shutdown).
func (m *Server) CloseAll() {
	m.mu.Lock()
	sessions := make([]*transport.EncryptedSession, 0, len(m.live))
	for _, ls := range m.live {
		sessions = append(sessions, ls.sess)
	}
	m.mu.Unlock()
	for _, s := range sessions {
		_ = s.Close()
	}
}

func (m *Server) track(uuid string, ls *liveSession) {
	m.mu.Lock()
	m.live[uuid] = ls
	m.mu.Unlock()
}

func (m *Server) untrack(uuid string) {
	m.mu.Lock()
	delete(m.live, uuid)
	m.mu.Unlock()
}

// consumeControl dispatches the device's control-channel messages until the session
// ends: interactions (authorized + audited), ping (→ pong), and resync (→ re-serve).
func (m *Server) consumeControl(ls *liveSession, uuid string, authCtx security.AuthContext) {
	for {
		select {
		case <-ls.sess.Done():
			return
		case env, ok := <-ls.mux.ControlInbound():
			if !ok {
				return
			}
			ls.lastSeen.Store(m.now().UnixNano())
			switch env.Type {
			case "interaction":
				m.handleInteraction(env, uuid, authCtx)
			case "ping":
				_ = ls.sess.Send(transport.Envelope{
					V: transport.ProtocolVersion, Ch: transport.ChannelControl,
					Type: "pong", TS: m.now().UnixMilli(),
				})
			case "resync":
				m.serveSnapshot(ls.mux)
			}
		}
	}
}

// reap closes a session that has not been heard from within the heartbeat timeout.
func (m *Server) reap(ls *liveSession) {
	if m.heartbeat <= 0 {
		return
	}
	tick := max(m.heartbeat/4, 50*time.Millisecond)
	t := time.NewTicker(tick)
	defer t.Stop()
	for {
		select {
		case <-ls.sess.Done():
			return
		case <-t.C:
			if m.now().UnixNano()-ls.lastSeen.Load() > m.heartbeat.Nanoseconds() {
				m.logger.Printf("session: %s timed out (no heartbeat) — closing", ls.sess.DeviceUUID())
				_ = ls.sess.Close()
				return
			}
		}
	}
}

type interactionMsg struct {
	ActionID string          `json:"actionId"`
	Params   json.RawMessage `json:"params,omitempty"`
}

// handleInteraction authorizes and dispatches one interaction. Every outcome —
// unknown action, denial, failure, success — is audited (PROJ-127). A dispatch
// failure never propagates (a faulty action can't take down the session).
func (m *Server) handleInteraction(env transport.Envelope, uuid string, authCtx security.AuthContext) {
	var msg interactionMsg
	if err := json.Unmarshal(env.Payload, &msg); err != nil || msg.ActionID == "" {
		m.audit.Audit("interaction.rejected", map[string]any{"device": uuid, "reason": "malformed"})
		return
	}
	fields := map[string]any{"device": uuid, "actionId": msg.ActionID}

	desc, ok := m.lookup.Action(msg.ActionID)
	if !ok {
		fields["reason"] = "unknown action"
		m.audit.Audit("interaction.rejected", fields)
		return
	}
	if decision := security.Authorize(authCtx, actionDesc{desc}); !decision.Allowed {
		fields["reason"] = string(decision.Reason)
		m.audit.Audit("interaction.denied", fields)
		return
	}
	if err := m.invoker.Invoke(context.Background(), msg.ActionID, msg.Params); err != nil {
		fields["error"] = err.Error()
		m.audit.Audit("interaction.failed", fields)
		return
	}
	m.audit.Audit("interaction.executed", fields)
}

// actionDesc adapts a registry.ActionDescriptor to security.ActionDescriptor.
type actionDesc struct{ d registry.ActionDescriptor }

func (a actionDesc) ActionID() string    { return a.d.ID }
func (a actionDesc) Category() string    { return a.d.Category }
func (a actionDesc) IsDestructive() bool { return a.d.Destructive }

// layoutSnapshotEnvelope encodes the active page as the initial layout the client
// builds its interpreter from (LayoutPage.fromJson: id/grid/widgets/version).
func layoutSnapshotEnvelope(page *layout.Page, version int) (transport.Envelope, error) {
	body, err := json.Marshal(map[string]any{
		"id":      page.ID,
		"grid":    page.Grid,
		"widgets": page.Widgets,
		"version": version,
	})
	if err != nil {
		return transport.Envelope{}, err
	}
	return transport.Envelope{
		V: transport.ProtocolVersion, Ch: transport.ChannelLayout,
		Type: "layout.snapshot", TS: time.Now().UnixMilli(), Payload: body,
	}, nil
}

// stateDeltaEnvelope encodes a current state value as a state.delta (same shape the
// fan-out streams), so the client applies the initial burst and live updates the
// same way.
func stateDeltaEnvelope(st state.State) transport.Envelope {
	body, _ := json.Marshal(state.Delta{ID: st.ID, Value: st.Value, UpdatedAt: st.UpdatedAt})
	return transport.Envelope{
		V: transport.ProtocolVersion, Ch: transport.ChannelState,
		Type: "state.delta", TS: st.UpdatedAt, Payload: body,
	}
}
