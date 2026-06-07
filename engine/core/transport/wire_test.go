package transport

import (
	"bytes"
	"encoding/gob"
	"errors"
	"reflect"
	"testing"
)

func TestFrameRoundTrip(t *testing.T) {
	f := NewFramer(0) // default cap
	var buf bytes.Buffer

	payloads := [][]byte{
		[]byte("hello"),
		{},
		bytes.Repeat([]byte{0xAB}, 4096), // larger, binary-safe
	}
	for _, p := range payloads {
		if err := f.Write(&buf, p); err != nil {
			t.Fatalf("Write: %v", err)
		}
	}
	for i, want := range payloads {
		got, err := f.Read(&buf)
		if err != nil {
			t.Fatalf("Read #%d: %v", i, err)
		}
		if !bytes.Equal(got, want) {
			t.Errorf("frame #%d mismatch", i)
		}
	}
}

func TestFrameOversizeRejected(t *testing.T) {
	f := NewFramer(8) // tiny cap

	// Write side rejects oversize.
	if err := f.Write(&bytes.Buffer{}, make([]byte, 9)); !errors.Is(err, ErrFrameTooLarge) {
		t.Errorf("Write oversize = %v, want ErrFrameTooLarge", err)
	}

	// Read side rejects a header that claims more than the cap, before allocating.
	var hdr bytes.Buffer
	hdr.Write([]byte{0x00, 0x00, 0x00, 0x10}) // length 16 > cap 8
	if _, err := f.Read(&hdr); !errors.Is(err, ErrFrameTooLarge) {
		t.Errorf("Read oversize header = %v, want ErrFrameTooLarge", err)
	}
}

func TestSeqMonotonicPerChannel(t *testing.T) {
	s := NewSeqCounter()
	if a, b, c := s.Next(ChannelState), s.Next(ChannelState), s.Next(ChannelState); a != 1 || b != 2 || c != 3 {
		t.Errorf("state seq = %d,%d,%d, want 1,2,3", a, b, c)
	}
	// Independent per channel.
	if a, b := s.Next(ChannelLayout), s.Next(ChannelLayout); a != 1 || b != 2 {
		t.Errorf("layout seq = %d,%d, want 1,2", a, b)
	}
	if next := s.Next(ChannelState); next != 4 {
		t.Errorf("state seq continued = %d, want 4", next)
	}
}

// gobSerializer is a deliberately-different codec used to prove the Serializer
// abstraction: the same call sites work with it unchanged.
type gobSerializer struct{}

func (gobSerializer) Marshal(env Envelope) ([]byte, error) {
	var b bytes.Buffer
	if err := gob.NewEncoder(&b).Encode(env); err != nil {
		return nil, err
	}
	return b.Bytes(), nil
}

func (gobSerializer) Unmarshal(data []byte) (Envelope, error) {
	var env Envelope
	err := gob.NewDecoder(bytes.NewReader(data)).Decode(&env)
	return env, err
}

func (gobSerializer) Name() string { return "gob" }

func roundTrip(t *testing.T, s Serializer, env Envelope) Envelope {
	t.Helper()
	b, err := s.Marshal(env)
	if err != nil {
		t.Fatalf("%s Marshal: %v", s.Name(), err)
	}
	got, err := s.Unmarshal(b)
	if err != nil {
		t.Fatalf("%s Unmarshal: %v", s.Name(), err)
	}
	return got
}

func TestEnvelopeRoundTripAndSerializerSwap(t *testing.T) {
	env := Envelope{
		V: ProtocolVersion, Ch: ChannelState, Type: "state.delta",
		Seq: 42, TS: 1719000000, Payload: []byte("inner-encoded-bytes"),
	}
	// The same code path works for both serializers with no change.
	for _, s := range []Serializer{JSONSerializer{}, gobSerializer{}} {
		got := roundTrip(t, s, env)
		if !reflect.DeepEqual(got, env) {
			t.Errorf("%s round-trip mismatch:\n got %+v\nwant %+v", s.Name(), got, env)
		}
	}
}
