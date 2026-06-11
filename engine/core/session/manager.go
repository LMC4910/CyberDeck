package session

import (
	"context"
	"encoding/json"
	"log"
	"sync"
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

// Server serves paired devices: it pushes each the active layout + a filtered live
// state stream, and dispatches their interactions through the permission gate and
// audit. It implements Handler, so the listener hands it each new session. (Distinct
// from Manager, which is the in-memory session/profile registry, PROJ-163.)
type Server struct {
	fanout  *transport.Fanout
	profile *layout.Profile
	states  StateReader
	lookup  ActionLookup
	invoker ActionInvoker
	audit   Auditor
	logger  *log.Logger

	mu   sync.Mutex
	live map[string]*transport.EncryptedSession // device uuid → session
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
		live: map[string]*transport.EncryptedSession{},
	}
}

// Serve sets up a freshly paired session — pushes the layout snapshot + initial
// state, registers the device for fan-out, and consumes its interactions — then
// returns immediately. A background goroutine cleans up when the session ends, so
// the listener's accept loop is never held open by a live session.
func (m *Server) Serve(sess *transport.EncryptedSession, hr *HandshakeResult) {
	uuid := hr.DeviceUUID
	perms, err := security.ParsePermissions(hr.PermissionsJSON)
	if err != nil {
		m.logger.Printf("session: %s has unparseable permissions, denying all: %v", uuid, err)
	}
	authCtx := security.AuthContext{Authenticated: true, Revoked: false, Perms: perms}

	mux := transport.NewChannelMux(sess, 0, 0)

	// Initial snapshot: the active page, then the current value of each bound state.
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
	// Flush the burst before registering for fan-out so the initial send is serial.
	if err := mux.Flush(); err != nil {
		m.logger.Printf("session: %s initial flush: %v", uuid, err)
	}

	m.fanout.Add(&transport.Subscriber{
		DeviceUUID: uuid,
		Subs:       state.NewSubscriptionSet(bound...),
		Mux:        mux,
		ProfileID:  profileID,
		EditMode:   false,
	})
	m.track(uuid, sess)
	m.audit.Audit("session.opened", map[string]any{"device": uuid})

	go m.consumeControl(sess, mux, uuid, authCtx)
	go func() {
		<-sess.Done()
		m.fanout.Remove(uuid)
		mux.Close()
		m.untrack(uuid)
		m.audit.Audit("session.closed", map[string]any{"device": uuid})
	}()
}

// CloseAll tears down every live session (graceful shutdown).
func (m *Server) CloseAll() {
	m.mu.Lock()
	sessions := make([]*transport.EncryptedSession, 0, len(m.live))
	for _, s := range m.live {
		sessions = append(sessions, s)
	}
	m.mu.Unlock()
	for _, s := range sessions {
		_ = s.Close()
	}
}

func (m *Server) track(uuid string, sess *transport.EncryptedSession) {
	m.mu.Lock()
	m.live[uuid] = sess
	m.mu.Unlock()
}

func (m *Server) untrack(uuid string) {
	m.mu.Lock()
	delete(m.live, uuid)
	m.mu.Unlock()
}

// consumeControl dispatches the device's control-channel interactions until the
// session ends.
func (m *Server) consumeControl(sess *transport.EncryptedSession, mux *transport.ChannelMux, uuid string, authCtx security.AuthContext) {
	for {
		select {
		case <-sess.Done():
			return
		case env, ok := <-mux.ControlInbound():
			if !ok {
				return
			}
			if env.Type == "interaction" {
				m.handleInteraction(env, uuid, authCtx)
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
