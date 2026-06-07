//go:build windows

package secretstore

import "testing"

// TestWindowsCredStoreContract round-trips against the real Windows Credential
// Manager under a test service namespace, cleaning up after itself via the
// contract's Delete step.
func TestWindowsCredStoreContract(t *testing.T) {
	store, err := openKeyring("com.shishir.cyberdeck.test")
	if err != nil {
		t.Fatalf("openKeyring: %v", err)
	}
	runContract(t, store)
}
