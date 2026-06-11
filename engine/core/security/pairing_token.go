package security

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"sync"
	"time"
)

// Pairing token issuance (2E §3.1 / ADR-0005). Tokens are minted ONLY on the
// privileged local channel (the loopback control channel, PROJ-144, or the local
// console) — a LAN client can never mint one. Each token is random, single-use, and
// short-lived; it is consumed by the pairing handshake (PROJ-123) via the
// PairingAuthorizer seam.

// DefaultTokenTTL is the lifetime of a freshly issued pairing token.
const DefaultTokenTTL = 3 * time.Minute

// tokenBytes is the entropy of a pairing token before base64url encoding.
const tokenBytes = 24

// Sentinel errors.
var (
	// ErrNotPrivileged is returned when token issuance is attempted from a
	// non-privileged (e.g. LAN-originated) request.
	ErrNotPrivileged = errors.New("pairing: token issuance is allowed only on the privileged local channel")
	// ErrTokenInvalid is returned when a token is unknown, already used, or expired.
	ErrTokenInvalid = errors.New("pairing: token is invalid, already used, or expired")
)

// TokenIssuer mints and validates single-use, time-limited pairing tokens. It
// implements PairingAuthorizer so the handshake consumes a token during pairing.
// Safe for concurrent use.
type TokenIssuer struct {
	ttl  time.Duration
	now  func() time.Time
	rand func([]byte) (int, error)

	mu   sync.Mutex
	live map[string]time.Time // token → expiry
}

// TokenOption configures a TokenIssuer.
type TokenOption func(*TokenIssuer)

// WithTokenTTL sets the token lifetime (≤0 keeps the default).
func WithTokenTTL(d time.Duration) TokenOption {
	return func(i *TokenIssuer) {
		if d > 0 {
			i.ttl = d
		}
	}
}

// WithTokenClock injects the clock (testing).
func WithTokenClock(now func() time.Time) TokenOption {
	return func(i *TokenIssuer) {
		if now != nil {
			i.now = now
		}
	}
}

// NewTokenIssuer builds a token issuer.
func NewTokenIssuer(opts ...TokenOption) *TokenIssuer {
	i := &TokenIssuer{
		ttl:  DefaultTokenTTL,
		now:  time.Now,
		rand: rand.Read,
		live: map[string]time.Time{},
	}
	for _, o := range opts {
		o(i)
	}
	return i
}

// Issue mints a single-use, time-limited token. privileged MUST be true: only the
// loopback control-channel handler (PROJ-144) or the local console may mint tokens.
// A LAN-originated request passes false and is refused (2E §3.1).
func (i *TokenIssuer) Issue(privileged bool) (string, error) {
	if !privileged {
		return "", ErrNotPrivileged
	}
	b := make([]byte, tokenBytes)
	if _, err := i.rand(b); err != nil {
		return "", err
	}
	tok := base64.RawURLEncoding.EncodeToString(b)

	i.mu.Lock()
	i.live[tok] = i.now().Add(i.ttl)
	i.gcLocked()
	i.mu.Unlock()
	return tok, nil
}

// Validate consumes a token: it must exist and be unexpired. A token is single-use —
// it is removed whether or not it was still valid, so a replay always fails.
func (i *TokenIssuer) Validate(tok string) error {
	i.mu.Lock()
	defer i.mu.Unlock()
	exp, ok := i.live[tok]
	if !ok {
		return ErrTokenInvalid
	}
	delete(i.live, tok) // single-use
	if i.now().After(exp) {
		return ErrTokenInvalid
	}
	return nil
}

// Authorize satisfies PairingAuthorizer: the handshake consumes the token in the
// ClientHello. (An empty token is invalid like any other.)
func (i *TokenIssuer) Authorize(_ context.Context, hello ClientHello) error {
	return i.Validate(hello.Token)
}

// gcLocked drops expired tokens so the map cannot grow unbounded. Caller holds mu.
func (i *TokenIssuer) gcLocked() {
	now := i.now()
	for tok, exp := range i.live {
		if now.After(exp) {
			delete(i.live, tok)
		}
	}
}
