package transport

import (
	"encoding/json"
	"fmt"
	"sync"
	"testing"

	"github.com/shishir/cyberdeck/engine/core/state"
)

// capSender is a thread-safe recording sender for fan-out tests.
type capSender struct {
	mu   sync.Mutex
	sent []Envelope
	recv chan Envelope
}

func (s *capSender) Send(e Envelope) error {
	s.mu.Lock()
	s.sent = append(s.sent, e)
	s.mu.Unlock()
	return nil
}
func (s *capSender) Received() <-chan Envelope { return s.recv }
func (s *capSender) snapshot() []Envelope {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]Envelope(nil), s.sent...)
}

func makeSub(t *testing.T, uuid, profile string, edit bool, ids ...string) (*Subscriber, *capSender) {
	t.Helper()
	snd := &capSender{recv: make(chan Envelope)}
	mux := NewChannelMux(snd, 0, 32)
	t.Cleanup(mux.Close)
	return &Subscriber{
		DeviceUUID: uuid, Subs: state.NewSubscriptionSet(ids...), Mux: mux,
		ProfileID: profile, EditMode: edit,
	}, snd
}

func stateIDs(t *testing.T, snd *capSender) []string {
	t.Helper()
	var ids []string
	for _, e := range snd.snapshot() {
		if e.Ch != ChannelState {
			continue
		}
		var d state.Delta
		if err := json.Unmarshal(e.Payload, &d); err != nil {
			t.Fatalf("decode delta: %v", err)
		}
		ids = append(ids, d.ID)
	}
	return ids
}

func countChannel(snd *capSender, ch Channel) int {
	n := 0
	for _, e := range snd.snapshot() {
		if e.Ch == ch {
			n++
		}
	}
	return n
}

func TestFanoutSubscriptionFilter(t *testing.T) {
	f := NewFanout()
	a, sndA := makeSub(t, "A", "", false, "system.cpu.temp")
	b, sndB := makeSub(t, "B", "", false, "system.gpu.temp")
	f.Add(a)
	f.Add(b)

	deltas := []state.Delta{
		{ID: "system.cpu.temp", Value: 42.0, UpdatedAt: 1},
		{ID: "system.gpu.temp", Value: 55.0, UpdatedAt: 1},
	}
	if err := f.BroadcastState(deltas); err != nil {
		t.Fatalf("BroadcastState: %v", err)
	}
	if err := f.FlushAll(); err != nil {
		t.Fatalf("FlushAll: %v", err)
	}

	if got := stateIDs(t, sndA); len(got) != 1 || got[0] != "system.cpu.temp" {
		t.Errorf("A received %v, want [system.cpu.temp]", got)
	}
	if got := stateIDs(t, sndB); len(got) != 1 || got[0] != "system.gpu.temp" {
		t.Errorf("B received %v, want [system.gpu.temp]", got)
	}
}

func TestFanoutProfileIsolation(t *testing.T) { // P1-AC-11
	f := NewFanout()
	game, sndGame := makeSub(t, "A", "game", true)
	work, sndWork := makeSub(t, "B", "work", true)
	gameNoEdit, sndGameNoEdit := makeSub(t, "C", "game", false) // right profile, not edit mode
	f.Add(game)
	f.Add(work)
	f.Add(gameNoEdit)

	f.BroadcastLayout("game", Envelope{Type: "op.move", Payload: []byte("{}")})
	if err := f.FlushAll(); err != nil {
		t.Fatalf("FlushAll: %v", err)
	}

	if countChannel(sndGame, ChannelLayout) != 1 {
		t.Error("game/edit session did not receive the layout op")
	}
	if countChannel(sndWork, ChannelLayout) != 0 {
		t.Error("work session wrongly received a game-profile layout op (isolation broken)")
	}
	if countChannel(sndGameNoEdit, ChannelLayout) != 0 {
		t.Error("game session not in edit mode wrongly received a layout op")
	}
}

func TestFanoutEightSessions(t *testing.T) {
	f := NewFanout()
	snds := make([]*capSender, 8)
	for i := 0; i < 8; i++ {
		sub, snd := makeSub(t, fmt.Sprintf("dev%d", i), "", false, "shared", fmt.Sprintf("only%d", i))
		f.Add(sub)
		snds[i] = snd
	}
	if f.Count() != 8 {
		t.Fatalf("Count = %d, want 8", f.Count())
	}

	deltas := []state.Delta{
		{ID: "shared", Value: 1.0, UpdatedAt: 1},
		{ID: "only3", Value: 2.0, UpdatedAt: 1},
	}
	if err := f.BroadcastState(deltas); err != nil {
		t.Fatalf("BroadcastState: %v", err)
	}
	if err := f.FlushAll(); err != nil {
		t.Fatalf("FlushAll: %v", err)
	}

	for i := 0; i < 8; i++ {
		ids := stateIDs(t, snds[i])
		hasShared, hasOnly3 := false, false
		for _, id := range ids {
			if id == "shared" {
				hasShared = true
			}
			if id == "only3" {
				hasOnly3 = true
			}
		}
		if !hasShared {
			t.Errorf("dev%d missing shared delta", i)
		}
		if hasOnly3 != (i == 3) {
			t.Errorf("dev%d only3 = %v, want %v", i, hasOnly3, i == 3)
		}
	}
}

// TestFanoutConcurrent runs broadcasts concurrently with subscriber churn; under
// -race it asserts no data races (NFR-10 path).
func TestFanoutConcurrent(t *testing.T) {
	f := NewFanout()
	subs := make([]*Subscriber, 8)
	for i := 0; i < 8; i++ {
		sub, _ := makeSub(t, fmt.Sprintf("dev%d", i), "", false, "shared")
		subs[i] = sub
		f.Add(sub)
	}

	var wg sync.WaitGroup
	for g := 0; g < 4; g++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for k := 0; k < 300; k++ {
				_ = f.BroadcastState([]state.Delta{{ID: "shared", Value: float64(k), UpdatedAt: int64(k)}})
				_ = f.FlushAll()
			}
		}()
	}
	wg.Add(1)
	go func() {
		defer wg.Done()
		for k := 0; k < 300; k++ {
			s := subs[k%8]
			f.Remove(s.DeviceUUID)
			f.Add(s)
		}
	}()
	wg.Wait()
}
