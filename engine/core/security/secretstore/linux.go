//go:build linux

package secretstore

import (
	"bytes"
	"errors"
	"fmt"
	"os/exec"
	"strings"

	"github.com/shishir/cyberdeck/engine/internal/secrets"
)

// Linux backend: the Secret Service (GNOME Keyring / KWallet) via libsecret's
// `secret-tool` CLI. `secret-tool store` reads the secret from stdin (no argv
// exposure). When `secret-tool` is absent (e.g. headless server), openKeyring
// returns an error and Open falls back to the encrypted-file store.

type linuxStore struct {
	service string
}

func openKeyring(service string) (SecretStore, error) {
	if _, err := exec.LookPath("secret-tool"); err != nil {
		return nil, fmt.Errorf("secretstore(linux): `secret-tool` not found: %w", err)
	}
	return &linuxStore{service: service}, nil
}

func (s *linuxStore) Set(key string, value secrets.Secret) error {
	cmd := exec.Command("secret-tool", "store", "--label=CyberDeck",
		"service", s.service, "key", key)
	cmd.Stdin = bytes.NewReader(value.Reveal()) // secret via stdin, not argv
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("secretstore(linux): secret-tool store: %w: %s", err, strings.TrimSpace(string(out)))
	}
	return nil
}

func (s *linuxStore) Get(key string) (secrets.Secret, error) {
	cmd := exec.Command("secret-tool", "lookup", "service", s.service, "key", key)
	out, err := cmd.Output()
	if err != nil {
		// `secret-tool lookup` exits non-zero with no output when not found.
		var ee *exec.ExitError
		if errors.As(err, &ee) {
			return secrets.Secret{}, ErrNotFound
		}
		return secrets.Secret{}, fmt.Errorf("secretstore(linux): secret-tool lookup: %w", err)
	}
	if len(out) == 0 {
		return secrets.Secret{}, ErrNotFound
	}
	return secrets.New(out), nil
}

func (s *linuxStore) Delete(key string) error {
	cmd := exec.Command("secret-tool", "clear", "service", s.service, "key", key)
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("secretstore(linux): secret-tool clear: %w: %s", err, strings.TrimSpace(string(out)))
	}
	return nil
}
