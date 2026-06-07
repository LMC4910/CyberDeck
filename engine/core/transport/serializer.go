package transport

import (
	"encoding/json"
	"fmt"
)

// Serializer encodes/decodes the wire envelope. The abstraction (ADR-0015) lets a
// future binary codec (MessagePack/CBOR) replace JSON per channel with no
// call-site change — realistically only the State channel ever would.
type Serializer interface {
	Marshal(env Envelope) ([]byte, error)
	Unmarshal(data []byte) (Envelope, error)
	Name() string
}

// JSONSerializer is the V1 serializer (ADR-0015).
type JSONSerializer struct{}

// Marshal encodes the envelope as JSON.
func (JSONSerializer) Marshal(env Envelope) ([]byte, error) {
	b, err := json.Marshal(env)
	if err != nil {
		return nil, fmt.Errorf("transport: marshal envelope: %w", err)
	}
	return b, nil
}

// Unmarshal decodes a JSON envelope.
func (JSONSerializer) Unmarshal(data []byte) (Envelope, error) {
	var env Envelope
	if err := json.Unmarshal(data, &env); err != nil {
		return Envelope{}, fmt.Errorf("transport: unmarshal envelope: %w", err)
	}
	return env, nil
}

// Name identifies the codec.
func (JSONSerializer) Name() string { return "json" }
