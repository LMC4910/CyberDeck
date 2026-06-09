package layout

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/shishir/cyberdeck/engine/core/transport"
)

// Live op broadcast (2C §4.2 / ADR-0012 / AC P1-AC-09): "edit-on-desktop →
// live-on-device, no save/sync/reload". After the engine applies an op (PROJ-211)
// it fans the op out on the Layout channel (PROJ-150) only to sessions assigned the
// edited profile in edit/preview mode; the client applies it via the interpreter
// (PROJ-181) and targeted-repaints within 200ms. Apply stays transport-free — this
// broadcast service is the only place op-apply meets the transport.

// layoutOpType is the envelope type for a broadcast layout op.
const layoutOpType = "layout.op"

// Broadcaster ties the op-log to the transport fan-out.
type Broadcaster struct {
	log    *OpLog
	fanout *transport.Fanout
	now    func() int64
}

// BroadcasterOption configures a Broadcaster.
type BroadcasterOption func(*Broadcaster)

// WithBroadcastClock injects a timestamp source (unix millis) for tests.
func WithBroadcastClock(now func() int64) BroadcasterOption {
	return func(b *Broadcaster) {
		if now != nil {
			b.now = now
		}
	}
}

// NewBroadcaster builds a broadcaster over an op-log + fan-out.
func NewBroadcaster(log *OpLog, fanout *transport.Fanout, opts ...BroadcasterOption) *Broadcaster {
	b := &Broadcaster{
		log:    log,
		fanout: fanout,
		now:    func() int64 { return time.Now().UnixMilli() },
	}
	for _, o := range opts {
		o(b)
	}
	return b
}

// ApplyAndBroadcast applies an op to the document (versioning + persisting it via
// the op-log) and broadcasts it on the Layout channel to the edited profile's
// edit/preview sessions. It returns the inverse op (for undo, PROJ-215) and the new
// document version. The broadcast carries docVersion=newVersion so clients track
// last-applied + detect gaps.
func (b *Broadcaster) ApplyAndBroadcast(ctx context.Context, docID, profileID string, op Op) (inverse Op, newVersion int, err error) {
	inverse, newVersion, err = b.log.Apply(ctx, docID, op)
	if err != nil {
		return Op{}, 0, err
	}
	payload, err := opPayload(op, newVersion)
	if err != nil {
		return Op{}, 0, err
	}
	b.fanout.BroadcastLayout(profileID, transport.Envelope{
		V:       transport.ProtocolVersion,
		Type:    layoutOpType,
		TS:      b.now(),
		Payload: payload,
	})
	return inverse, newVersion, nil
}

// opPayload marshals an op to JSON and stamps the post-apply document version, so
// the client can order-apply and detect gaps independent of the per-session Layout
// channel sequence number.
func opPayload(op Op, version int) ([]byte, error) {
	b, err := json.Marshal(op)
	if err != nil {
		return nil, fmt.Errorf("layout: marshal op: %w", err)
	}
	var m map[string]any
	if err := json.Unmarshal(b, &m); err != nil {
		return nil, fmt.Errorf("layout: op to map: %w", err)
	}
	m["docVersion"] = version
	out, err := json.Marshal(m)
	if err != nil {
		return nil, fmt.Errorf("layout: marshal op payload: %w", err)
	}
	return out, nil
}
