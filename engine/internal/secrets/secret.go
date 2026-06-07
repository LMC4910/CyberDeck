// Package secrets defines the canonical Secret type used everywhere credentials
// and private keys are handled (2E §7). Secret is redaction-safe by construction:
// it can never be printed, logged, or JSON-serialized in the clear, which is what
// the PROJ-115 leak guard relies on. Secret values live only in the OS secret
// store (PROJ-121) — never in SQLite, config, or logs (TB-PER-3).
package secrets

import (
	"crypto/subtle"
	"fmt"
	"io"
)

// Redacted is the placeholder shown wherever a Secret would otherwise render.
const Redacted = "[REDACTED]"

// Secret wraps sensitive bytes so they cannot leak through fmt/log/JSON. The only
// way to obtain the underlying value is the explicit Reveal* methods, which call
// sites and code review can audit.
type Secret struct {
	b []byte
}

// New copies b into a new Secret (the caller's slice is not retained).
func New(b []byte) Secret {
	cp := make([]byte, len(b))
	copy(cp, b)
	return Secret{b: cp}
}

// NewString builds a Secret from a string.
func NewString(s string) Secret { return New([]byte(s)) }

// Reveal returns a copy of the underlying bytes. Use only where the secret is
// genuinely needed (e.g. a secret-store backend write).
func (s Secret) Reveal() []byte {
	cp := make([]byte, len(s.b))
	copy(cp, s.b)
	return cp
}

// RevealString returns the secret as a string. Same caution as Reveal.
func (s Secret) RevealString() string { return string(s.b) }

// Len reports the secret length without revealing it.
func (s Secret) Len() int { return len(s.b) }

// IsZero reports whether the secret holds no bytes.
func (s Secret) IsZero() bool { return len(s.b) == 0 }

// Equal compares two secrets in constant time.
func (s Secret) Equal(o Secret) bool {
	return subtle.ConstantTimeCompare(s.b, o.b) == 1
}

// String redacts. Implements fmt.Stringer.
func (s Secret) String() string { return Redacted }

// GoString redacts under %#v. Implements fmt.GoStringer.
func (s Secret) GoString() string { return Redacted }

// Format redacts for every fmt verb (%v, %s, %q, %x, ...). Implements
// fmt.Formatter, which takes precedence over String/GoString, so there is no verb
// that can print the underlying bytes.
func (s Secret) Format(f fmt.State, _ rune) { _, _ = io.WriteString(f, Redacted) }

// MarshalJSON redacts so a Secret embedded in any struct never serializes in the
// clear.
func (s Secret) MarshalJSON() ([]byte, error) { return []byte(`"` + Redacted + `"`), nil }
