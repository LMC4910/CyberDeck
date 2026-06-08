//go:build darwin

package lifecycle

import (
	"fmt"
	"os"
	"path/filepath"
)

// instanceEndpoint uses a unix domain socket file under the OS temp dir. macOS has
// no abstract sockets, so the file is unlinked on Release (and stale files from a
// crashed instance are cleaned up by removeStale).
func instanceEndpoint(name string) (network, addr string) {
	return "unix", filepath.Join(os.TempDir(), fmt.Sprintf("cyberdeck-%08x.sock", nameHash(name)))
}

// removeStale unlinks a socket file left behind by a crashed instance.
func removeStale(addr string) error {
	if err := os.Remove(addr); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}
