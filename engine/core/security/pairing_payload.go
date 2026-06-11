package security

import (
	"encoding/json"
	"fmt"
	"net"
)

// PairingPayload is the QR / manual pairing payload presented by the engine (2E
// §3.1): the LAN addresses to try, the listening port, a single-use token, and the
// engine's public-key fingerprint (anti-MITM). Its JSON shape matches the client's
// parser (client/lib/net/pairing.dart): keys addresses / port / token / fp.
type PairingPayload struct {
	Addresses []string `json:"addresses"`
	Port      int      `json:"port"`
	Token     string   `json:"token"`
	FP        string   `json:"fp"`
}

// JSON encodes the payload to the wire/QR string the client scans or pastes.
func (p PairingPayload) JSON() (string, error) {
	b, err := json.Marshal(p)
	if err != nil {
		return "", fmt.Errorf("pairing: encode payload: %w", err)
	}
	return string(b), nil
}

// BuildPairingPayload assembles a payload from this host's non-loopback IPv4
// addresses, the listening port, a freshly issued token, and the engine fingerprint.
func BuildPairingPayload(port int, token, fingerprint string) (PairingPayload, error) {
	addrs, err := LocalIPv4s()
	if err != nil {
		return PairingPayload{}, err
	}
	return PairingPayload{Addresses: addrs, Port: port, Token: token, FP: fingerprint}, nil
}

// LocalIPv4s returns this host's non-loopback IPv4 addresses (the candidate
// addresses a device on the LAN can dial).
func LocalIPv4s() ([]string, error) {
	ifaces, err := net.InterfaceAddrs()
	if err != nil {
		return nil, fmt.Errorf("pairing: enumerate interfaces: %w", err)
	}
	var out []string
	for _, a := range ifaces {
		ipnet, ok := a.(*net.IPNet)
		if !ok || ipnet.IP.IsLoopback() || ipnet.IP.IsLinkLocalUnicast() {
			continue // skip loopback + 169.254.x.x autoconfig addrs (not dialable)
		}
		if v4 := ipnet.IP.To4(); v4 != nil {
			out = append(out, v4.String())
		}
	}
	return out, nil
}
