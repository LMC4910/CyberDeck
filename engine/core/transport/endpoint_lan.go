package transport

import (
	"context"
	"fmt"
	"net"
	"time"
)

// LanEndpoint is the V1 endpoint: a direct LAN TCP socket. The remote phase adds
// a RelayEndpoint alongside it behind the same TransportEndpoint interface.
type LanEndpoint struct {
	info   EndpointInfo
	dialer *net.Dialer
}

// NewLanEndpoint builds a LAN endpoint for address (host:port), tagged with the
// discovery source that produced it.
func NewLanEndpoint(address string, source CandidateSource) *LanEndpoint {
	return &LanEndpoint{
		info:   EndpointInfo{Kind: KindLAN, Address: address, Source: source},
		dialer: &net.Dialer{Timeout: 5 * time.Second},
	}
}

// Dial opens a TCP connection to the endpoint address.
func (e *LanEndpoint) Dial(ctx context.Context) (Conn, error) {
	conn, err := e.dialer.DialContext(ctx, "tcp", e.info.Address)
	if err != nil {
		return nil, fmt.Errorf("transport: dial %s (%s): %w", e.info.Address, e.info.Source, err)
	}
	return conn, nil // net.Conn satisfies Conn
}

// Describe returns the endpoint's info.
func (e *LanEndpoint) Describe() EndpointInfo { return e.info }
