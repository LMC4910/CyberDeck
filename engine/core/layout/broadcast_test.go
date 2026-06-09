package layout

import (
	"context"
	"encoding/json"
	"sync"
	"testing"

	"github.com/shishir/cyberdeck/engine/core/persistence"
	"github.com/shishir/cyberdeck/engine/core/transport"
)

// recSession is a recording fake session for the channel mux.
type recSession struct {
	mu  sync.Mutex
	got []transport.Envelope
	in  chan transport.Envelope
}

func newRecSession() *recSession {
	return &recSession{in: make(chan transport.Envelope)}
}

func (s *recSession) Send(e transport.Envelope) error {
	s.mu.Lock()
	s.got = append(s.got, e)
	s.mu.Unlock()
	return nil
}

func (s *recSession) Received() <-chan transport.Envelope { return s.in }

func (s *recSession) sent() []transport.Envelope {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]transport.Envelope(nil), s.got...)
}

func seedStore() *memStore {
	store := newMemStore()
	body, _ := baseProfile().JSON()
	store.docs["doc1"] = persistence.Document{ID: "doc1", Kind: "profile", Version: 1, BodyJSON: string(body)}
	return store
}

func TestApplyAndBroadcastDeliversToEditSessions(t *testing.T) {
	store := seedStore()
	fanout := transport.NewFanout()

	editor := newRecSession()
	editMux := transport.NewChannelMux(editor, 0, 0)
	defer editMux.Close()
	fanout.Add(&transport.Subscriber{DeviceUUID: "d1", Mux: editMux, ProfileID: "prof1", EditMode: true})

	// A viewer (not in edit mode) on the same profile must NOT receive layout ops.
	viewer := newRecSession()
	viewMux := transport.NewChannelMux(viewer, 0, 0)
	defer viewMux.Close()
	fanout.Add(&transport.Subscriber{DeviceUUID: "d2", Mux: viewMux, ProfileID: "prof1", EditMode: false})

	// An editor on a DIFFERENT profile must NOT receive these ops.
	other := newRecSession()
	otherMux := transport.NewChannelMux(other, 0, 0)
	defer otherMux.Close()
	fanout.Add(&transport.Subscriber{DeviceUUID: "d3", Mux: otherMux, ProfileID: "prof2", EditMode: true})

	bc := NewBroadcaster(NewOpLog(store), fanout, WithBroadcastClock(func() int64 { return 7 }))
	inv, ver, err := bc.ApplyAndBroadcast(context.Background(), "doc1", "prof1",
		Op{Kind: OpMoveWidget, PageID: "page1", WidgetID: "w1", To: &Placement{Col: 3, Row: 4}})
	if err != nil {
		t.Fatalf("ApplyAndBroadcast: %v", err)
	}
	if ver != 2 || inv.Kind != OpMoveWidget {
		t.Fatalf("got ver=%d inv=%s, want 2 / MoveWidget", ver, inv.Kind)
	}
	if err := fanout.FlushAll(); err != nil {
		t.Fatalf("FlushAll: %v", err)
	}

	envs := editor.sent()
	if len(envs) != 1 {
		t.Fatalf("editor received %d envelopes, want 1", len(envs))
	}
	env := envs[0]
	if env.Ch != transport.ChannelLayout || env.Type != layoutOpType {
		t.Errorf("envelope ch=%q type=%q, want layout/%s", env.Ch, env.Type, layoutOpType)
	}
	var m map[string]any
	if err := json.Unmarshal(env.Payload, &m); err != nil {
		t.Fatalf("payload: %v", err)
	}
	if m["op"] != "MoveWidget" || m["docVersion"] != float64(2) {
		t.Errorf("payload = %v, want MoveWidget docVersion 2", m)
	}
	if to, ok := m["to"].(map[string]any); !ok || to["col"] != float64(3) {
		t.Errorf("payload.to = %v, want col 3", m["to"])
	}

	if len(viewer.sent()) != 0 {
		t.Error("a non-edit-mode viewer must not receive layout ops")
	}
	if len(other.sent()) != 0 {
		t.Error("an editor on another profile must not receive these ops")
	}

	// The document was persisted with the bumped version.
	if store.docs["doc1"].Version != 2 {
		t.Errorf("persisted version = %d, want 2", store.docs["doc1"].Version)
	}
}

func TestApplyAndBroadcastPropagatesApplyError(t *testing.T) {
	store := seedStore()
	bc := NewBroadcaster(NewOpLog(store), transport.NewFanout())
	if _, _, err := bc.ApplyAndBroadcast(context.Background(), "doc1", "prof1",
		Op{Kind: OpMoveWidget, PageID: "nope", WidgetID: "w1", To: &Placement{}}); err == nil {
		t.Error("expected an error for an op targeting a missing page")
	}
	if store.docs["doc1"].Version != 1 {
		t.Errorf("a failed apply must not persist a version bump, got %d", store.docs["doc1"].Version)
	}
}
