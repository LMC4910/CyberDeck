package transport

import (
	"encoding/json"
	"fmt"
	"sync"

	"github.com/shishir/cyberdeck/engine/core/state"
)

// Fan-out (2A §8 / FR-3.1 / NFR-10): the engine keeps one isolated session per
// device and fans state deltas — computed once by the state store — to each
// session's State channel, filtered to the states that session's layout binds.
// Layout ops fan out only to sessions assigned the edited profile in edit/preview
// mode. This is what delivers the ~80% idle-traffic reduction and lets two devices
// show different profiles without interference (P1-AC-11).

// Subscriber is one device's fan-out target. The session-manager wiring (PROJ-105)
// builds these from session.Session (UUID, Subscriptions, active profile, mode)
// plus the device's ChannelMux.
type Subscriber struct {
	DeviceUUID string
	Subs       *state.SubscriptionSet // states this device's layout binds
	Mux        *ChannelMux            // its per-channel send queues
	ProfileID  string                 // active profile
	EditMode   bool                   // in edit/preview mode (receives layout ops)
}

// Fanout owns the set of live subscribers. Safe for concurrent use.
type Fanout struct {
	mu   sync.RWMutex
	subs map[string]*Subscriber
}

// NewFanout creates an empty fan-out.
func NewFanout() *Fanout {
	return &Fanout{subs: make(map[string]*Subscriber)}
}

// Add registers (or replaces) a subscriber by device UUID.
func (f *Fanout) Add(sub *Subscriber) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.subs[sub.DeviceUUID] = sub
}

// Remove drops a subscriber.
func (f *Fanout) Remove(deviceUUID string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	delete(f.subs, deviceUUID)
}

// Count returns the number of live subscribers.
func (f *Fanout) Count() int {
	f.mu.RLock()
	defer f.mu.RUnlock()
	return len(f.subs)
}

// BroadcastState fans a batch of state deltas (typically from
// state.Store.DrainDirty) to subscribers, sending each delta only to sessions
// subscribed to that state id. Each delta is encoded once, then fanned out.
func (f *Fanout) BroadcastState(deltas []state.Delta) error {
	if len(deltas) == 0 {
		return nil
	}
	type encoded struct {
		id  string
		env Envelope
	}
	encs := make([]encoded, 0, len(deltas))
	for _, d := range deltas {
		payload, err := json.Marshal(d)
		if err != nil {
			return fmt.Errorf("fanout: encode delta %q: %w", d.ID, err)
		}
		encs = append(encs, encoded{id: d.ID, env: Envelope{
			V: ProtocolVersion, Type: "state.delta", TS: d.UpdatedAt, Payload: payload,
		}})
	}

	f.mu.RLock()
	defer f.mu.RUnlock()
	for _, sub := range f.subs {
		for _, e := range encs {
			if sub.Subs != nil && sub.Subs.Contains(e.id) {
				sub.Mux.SendState(e.id, e.env)
			}
		}
	}
	return nil
}

// BroadcastLayout fans a layout op only to sessions assigned the edited profile
// and in edit/preview mode (2A §8).
func (f *Fanout) BroadcastLayout(profileID string, env Envelope) {
	f.mu.RLock()
	defer f.mu.RUnlock()
	for _, sub := range f.subs {
		if sub.ProfileID == profileID && sub.EditMode {
			sub.Mux.SendLayout(env)
		}
	}
}

// FlushAll flushes every subscriber's queued envelopes to its session.
func (f *Fanout) FlushAll() error {
	f.mu.RLock()
	defer f.mu.RUnlock()
	for _, sub := range f.subs {
		if err := sub.Mux.Flush(); err != nil {
			return err
		}
	}
	return nil
}
