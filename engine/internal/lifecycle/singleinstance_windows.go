//go:build windows

package lifecycle

import "fmt"

// instanceEndpoint uses a loopback TCP listener on a deterministic high port
// derived from the instance name. Binding the port is the lock; a second instance
// fails to bind and dials the port to deliver the focus request. (A loopback
// listener is the most portable Windows primitive here — named pipes would pull in
// a non-stdlib dependency.)
func instanceEndpoint(name string) (network, addr string) {
	// Dynamic/ephemeral range is 49152–65535; map the hash into it.
	port := 49152 + int(nameHash(name)%(65535-49152))
	return "tcp", fmt.Sprintf("127.0.0.1:%d", port)
}

// removeStale is a no-op for TCP: the OS releases the port when the holder exits.
func removeStale(string) error { return nil }
