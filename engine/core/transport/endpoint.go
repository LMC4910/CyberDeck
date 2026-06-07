// Package transport owns how bytes move between the engine and devices (2A). The
// endpoint abstraction (ADR-0010) is the single most important forward-compat
// seam: all addressing flows through TransportEndpoint/ConnectionManager, V1
// resolves to direct LAN sockets, and NOTHING above the ConnectionManager knows
// the endpoint kind — so Phase 7 can add a RelayEndpoint here with no change
// above it (TA-EP-1/2).
package transport

import (
	"context"
	"io"
	"sort"
)

// Conn is a minimal raw byte-stream. Keeping it minimal (just ReadWriteClose) is
// what lets a relay-backed connection slot in later behind the same interface.
// A net.Conn satisfies it directly.
type Conn interface {
	io.ReadWriteCloser
}

// EndpointKind identifies the transport behind an endpoint. It is known ONLY
// within this package and below the ConnectionManager (TA-EP-1).
type EndpointKind string

const (
	KindLAN      EndpointKind = "lan"      // direct LAN socket (V1)
	KindLoopback EndpointKind = "loopback" // engine↔Desktop UI control channel
	// KindRelay is intentionally absent in Phase 1; it is added in the remote
	// phase as an additional candidate without changes above the manager.
)

// CandidateSource is how an endpoint candidate was discovered. Its ordinal value
// is the candidate priority (lower = preferred): last-known IP, then mDNS, then
// active scan (2A §2). A future relay source sorts after these so LAN stays
// preferred when both are reachable.
type CandidateSource int

const (
	SourceLastKnownIP CandidateSource = iota // last-known direct IP (locator hint)
	SourceMDNS                               // mDNS-resolved address
	SourceActiveScan                         // active subnet scan result
)

func (s CandidateSource) String() string {
	switch s {
	case SourceLastKnownIP:
		return "last-known-ip"
	case SourceMDNS:
		return "mdns"
	case SourceActiveScan:
		return "active-scan"
	default:
		return "unknown"
	}
}

// EndpointInfo describes an endpoint's kind, address and how it was found.
type EndpointInfo struct {
	Kind    EndpointKind
	Address string // host:port
	Source  CandidateSource
}

// TransportEndpoint is one addressable way to reach a device (ADR-0010).
type TransportEndpoint interface {
	// Dial opens a raw transport connection.
	Dial(ctx context.Context) (Conn, error)
	// Describe reports the endpoint's kind, address and discovery source.
	Describe() EndpointInfo
}

// Session is the post-handshake secure session. Its full shape is owned by
// PROJ-142 (encrypted session) / PROJ-163 (session model); this minimal seam is
// the ConnectionManager's return type so this ticket carries no crypto.
type Session interface {
	DeviceUUID() string
	Close() error
}

// Handshaker turns a freshly-dialed Conn into a Session. PROJ-142 provides the
// real forward-secret AEAD handshake; injecting it keeps crypto out of the
// connection manager.
type Handshaker interface {
	Handshake(ctx context.Context, deviceUUID string, conn Conn, info EndpointInfo) (Session, error)
}

// EndpointResolver produces candidate endpoints for a device from locator hints
// and discovery (PROJ-147/148 provide the real one).
type EndpointResolver interface {
	Resolve(ctx context.Context, deviceUUID string) ([]TransportEndpoint, error)
}

// orderCandidates returns the endpoints sorted by candidate-source priority
// (stable, so equal-priority candidates keep their resolver order). This is the
// one place candidate ordering is decided — and it lives below the manager, not
// above it.
func orderCandidates(eps []TransportEndpoint) []TransportEndpoint {
	out := make([]TransportEndpoint, len(eps))
	copy(out, eps)
	sort.SliceStable(out, func(i, j int) bool {
		return out[i].Describe().Source < out[j].Describe().Source
	})
	return out
}
