package secrets

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"testing"
)

const sentinel = "super-secret-private-key"

func TestSecretRoundTrip(t *testing.T) {
	s := NewString(sentinel)
	if s.RevealString() != sentinel {
		t.Errorf("RevealString = %q, want %q", s.RevealString(), sentinel)
	}
	if !bytes.Equal(s.Reveal(), []byte(sentinel)) {
		t.Error("Reveal bytes mismatch")
	}
	if s.Len() != len(sentinel) {
		t.Errorf("Len = %d, want %d", s.Len(), len(sentinel))
	}
}

func TestRevealReturnsCopy(t *testing.T) {
	s := NewString("abc")
	b := s.Reveal()
	b[0] = 'X'
	if s.RevealString() != "abc" {
		t.Error("mutating Reveal() result mutated the Secret")
	}
}

// TestSecretNeverLeaks asserts no formatting/logging/serialization path emits the
// underlying value (PROJ-121 AC: no secret in logs; PROJ-115 redaction).
func TestSecretNeverLeaks(t *testing.T) {
	s := NewString(sentinel)

	checks := map[string]string{
		"%v":     fmt.Sprintf("%v", s),
		"%s":     fmt.Sprintf("%s", s),
		"%q":     fmt.Sprintf("%q", s),
		"%x":     fmt.Sprintf("%x", s),
		"%#v":    fmt.Sprintf("%#v", s),
		"%+v":    fmt.Sprintf("%+v", s),
		"Stringer": s.String(),
	}
	for verb, out := range checks {
		if strings.Contains(out, sentinel) {
			t.Errorf("%s leaked the secret: %q", verb, out)
		}
		if !strings.Contains(out, Redacted) {
			t.Errorf("%s = %q, want it to contain %q", verb, out, Redacted)
		}
	}

	// Embedded in a struct and JSON-marshaled.
	type holder struct {
		Name string
		Key  Secret
	}
	j, err := json.Marshal(holder{Name: "engine", Key: s})
	if err != nil {
		t.Fatalf("json.Marshal: %v", err)
	}
	if strings.Contains(string(j), sentinel) {
		t.Errorf("JSON leaked the secret: %s", j)
	}
	if !strings.Contains(string(j), Redacted) {
		t.Errorf("JSON = %s, want %q", j, Redacted)
	}

	// Via the standard logger.
	var buf bytes.Buffer
	lg := log.New(&buf, "", 0)
	lg.Printf("storing key=%v for engine", s)
	if strings.Contains(buf.String(), sentinel) {
		t.Errorf("log leaked the secret: %q", buf.String())
	}
}

func TestSecretEqual(t *testing.T) {
	a := NewString("k")
	b := NewString("k")
	c := NewString("different")
	if !a.Equal(b) {
		t.Error("equal secrets reported unequal")
	}
	if a.Equal(c) {
		t.Error("unequal secrets reported equal")
	}
}
