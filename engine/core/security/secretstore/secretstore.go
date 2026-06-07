// Package secretstore provides secure at-rest storage for private keys and
// integration credentials behind one interface (2E §7), with per-OS backends:
// Windows Credential Manager, macOS Keychain, Linux Secret Service, and a
// documented encrypted-file fallback for no-keyring environments. Secrets are
// NEVER stored in plaintext and NEVER written to SQLite/config/logs.
package secretstore

import (
	"errors"
	"fmt"
	"log"
	"os"
	"path/filepath"

	"github.com/shishir/cyberdeck/engine/internal/secrets"
)

// DefaultService is the keyring service/namespace under which CyberDeck stores
// its secrets.
const DefaultService = "com.shishir.cyberdeck"

// ErrNotFound is returned by Get/Delete when no secret exists for the key.
var ErrNotFound = errors.New("secretstore: secret not found")

// SecretStore is the at-rest secret storage contract (2E §7).
type SecretStore interface {
	// Set stores (or replaces) the secret under key.
	Set(key string, value secrets.Secret) error
	// Get retrieves the secret for key, or ErrNotFound.
	Get(key string) (secrets.Secret, error)
	// Delete removes the secret for key. Deleting a missing key returns ErrNotFound.
	Delete(key string) error
}

// Open returns the best available secret store for this OS: the platform keyring
// if usable, otherwise the encrypted-file fallback with a logged security caveat
// (never a silent plaintext fallback). service namespaces the entries.
func Open(service string) (SecretStore, error) {
	if service == "" {
		service = DefaultService
	}

	ks, err := openKeyring(service)
	if err == nil {
		return ks, nil
	}

	path, perr := fallbackPath(service)
	if perr != nil {
		return nil, fmt.Errorf("secretstore: keyring unavailable (%v) and no fallback path (%w)", err, perr)
	}
	fs, ferr := OpenFileStore(path, nil)
	if ferr != nil {
		return nil, fmt.Errorf("secretstore: keyring unavailable (%v) and fallback failed (%w)", err, ferr)
	}
	// Caveat is explicit and logged; the path/err carry no secret material.
	log.Printf("WARNING secretstore: OS keyring unavailable (%v); using encrypted-file fallback at %q. "+
		"This is machine-bound only and weaker than a keyring — see docs/adr.", err, path)
	return fs, nil
}

// fallbackPath returns the on-disk location for the encrypted-file fallback.
func fallbackPath(service string) (string, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, service, "secrets.enc"), nil
}
