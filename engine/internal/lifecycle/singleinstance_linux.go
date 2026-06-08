//go:build linux

package lifecycle

import "fmt"

// instanceEndpoint uses a Linux abstract unix domain socket (leading NUL, written
// here as "@"). Abstract sockets have no filesystem entry and are reclaimed by the
// kernel when the holder exits, so there is never a stale file to clean up.
func instanceEndpoint(name string) (network, addr string) {
	return "unix", fmt.Sprintf("@cyberdeck-%08x", nameHash(name))
}

// removeStale is a no-op on Linux: abstract sockets cannot be (and need not be)
// unlinked.
func removeStale(string) error { return nil }
