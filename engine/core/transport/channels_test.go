package transport

import (
	"testing"
	"time"
)

type recordingSender struct {
	sent []Envelope
	recv chan Envelope
}

func (s *recordingSender) Send(e Envelope) error     { s.sent = append(s.sent, e); return nil }
func (s *recordingSender) Received() <-chan Envelope { return s.recv }

func newMux(t *testing.T, previewDepth int) (*ChannelMux, *recordingSender) {
	t.Helper()
	snd := &recordingSender{recv: make(chan Envelope, 16)}
	m := NewChannelMux(snd, previewDepth, 16)
	t.Cleanup(m.Close)
	return m, snd
}

func TestStateCoalesceLatestWins(t *testing.T) {
	m, snd := newMux(t, 0)

	m.SendState("system.cpu.temp", Envelope{Payload: []byte("v1")})
	m.SendState("system.cpu.temp", Envelope{Payload: []byte("v2")})
	m.SendState("system.cpu.temp", Envelope{Payload: []byte("v3")}) // coalesces
	m.SendState("system.gpu.temp", Envelope{Payload: []byte("g1")})

	if err := m.Flush(); err != nil {
		t.Fatalf("Flush: %v", err)
	}
	if len(snd.sent) != 2 {
		t.Fatalf("sent %d, want 2 (cpu coalesced + gpu)", len(snd.sent))
	}
	if string(snd.sent[0].Payload) != "v3" { // latest cpu, older dropped
		t.Errorf("cpu payload = %q, want v3 (latest)", snd.sent[0].Payload)
	}
	if string(snd.sent[1].Payload) != "g1" {
		t.Errorf("gpu payload = %q, want g1", snd.sent[1].Payload)
	}
}

func TestLayoutOrderedLossless(t *testing.T) {
	m, snd := newMux(t, 0)
	for i := 0; i < 100; i++ {
		m.SendLayout(Envelope{Type: "op", Payload: []byte{byte(i)}})
	}
	if err := m.Flush(); err != nil {
		t.Fatalf("Flush: %v", err)
	}
	if len(snd.sent) != 100 {
		t.Fatalf("Layout dropped messages: sent %d, want 100", len(snd.sent))
	}
	for i := 0; i < 100; i++ {
		if snd.sent[i].Payload[0] != byte(i) {
			t.Fatalf("Layout out of order at %d", i)
		}
		if snd.sent[i].Seq != uint64(i+1) {
			t.Errorf("Layout seq at %d = %d, want %d", i, snd.sent[i].Seq, i+1)
		}
	}
}

func TestPreviewDropOldestKeepsLatest(t *testing.T) {
	m, snd := newMux(t, 2) // preview depth 2

	for i := 0; i < 5; i++ {
		m.SendPreview(Envelope{Payload: []byte{byte(i)}}) // never blocks
	}
	if err := m.Flush(); err != nil {
		t.Fatalf("Flush: %v", err)
	}
	if len(snd.sent) != 2 {
		t.Fatalf("preview kept %d, want 2 (bounded)", len(snd.sent))
	}
	// Oldest dropped, latest kept: should be frames 3 and 4.
	if snd.sent[0].Payload[0] != 3 || snd.sent[1].Payload[0] != 4 {
		t.Errorf("preview kept %v,%v, want 3,4 (latest)", snd.sent[0].Payload[0], snd.sent[1].Payload[0])
	}
}

func TestInboundDemuxRoutesByChannel(t *testing.T) {
	m, snd := newMux(t, 0)

	snd.recv <- Envelope{Ch: ChannelLayout, Type: "op"}
	snd.recv <- Envelope{Ch: ChannelState, Type: "delta"}
	snd.recv <- Envelope{Ch: ChannelPreview, Type: "ghost"}
	snd.recv <- Envelope{Ch: ChannelControl, Type: "lifecycle"}

	expect := func(name string, ch <-chan Envelope, wantType string) {
		select {
		case env := <-ch:
			if env.Type != wantType {
				t.Errorf("%s channel got type %q, want %q", name, env.Type, wantType)
			}
		case <-time.After(2 * time.Second):
			t.Fatalf("%s channel: no envelope delivered", name)
		}
	}
	expect("layout", m.LayoutInbound(), "op")
	expect("state", m.StateInbound(), "delta")
	expect("preview", m.PreviewInbound(), "ghost")
	expect("control", m.ControlInbound(), "lifecycle")
}
