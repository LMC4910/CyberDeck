//go:build darwin

package secretstore

import (
	"errors"
	"fmt"
	"os/exec"
	"strings"

	"github.com/shishir/cyberdeck/engine/internal/secrets"
)

// macOS backend: the login Keychain via the `security` CLI (the same approach
// established Go keyring libraries use).
//
// CAVEAT: `security add-generic-password -w <secret>` passes the secret on argv,
// briefly visible in the process list. A cgo Security.framework backend (no argv
// exposure) is a documented hardening follow-up; the secret is never written to
// logs or files by this code.

type darwinStore struct {
	service string
}

func openKeyring(service string) (SecretStore, error) {
	if _, err := exec.LookPath("security"); err != nil {
		return nil, fmt.Errorf("secretstore(darwin): `security` CLI not found: %w", err)
	}
	return &darwinStore{service: service}, nil
}

func (s *darwinStore) Set(key string, value secrets.Secret) error {
	// -U updates the item if it already exists instead of failing on duplicate.
	cmd := exec.Command("security", "add-generic-password",
		"-a", key, "-s", s.service, "-w", value.RevealString(), "-U")
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("secretstore(darwin): add-generic-password: %w: %s", err, strings.TrimSpace(string(out)))
	}
	return nil
}

func (s *darwinStore) Get(key string) (secrets.Secret, error) {
	cmd := exec.Command("security", "find-generic-password",
		"-a", key, "-s", s.service, "-w")
	out, err := cmd.Output()
	if err != nil {
		if isNotFound(err) {
			return secrets.Secret{}, ErrNotFound
		}
		return secrets.Secret{}, fmt.Errorf("secretstore(darwin): find-generic-password: %w", err)
	}
	// `-w` prints the password followed by a newline.
	return secrets.NewString(strings.TrimRight(string(out), "\n")), nil
}

func (s *darwinStore) Delete(key string) error {
	cmd := exec.Command("security", "delete-generic-password",
		"-a", key, "-s", s.service)
	if out, err := cmd.CombinedOutput(); err != nil {
		if isNotFound(err) {
			return ErrNotFound
		}
		return fmt.Errorf("secretstore(darwin): delete-generic-password: %w: %s", err, strings.TrimSpace(string(out)))
	}
	return nil
}

// isNotFound reports whether a `security` invocation failed because the item was
// absent (exit status 44 = errSecItemNotFound).
func isNotFound(err error) bool {
	var ee *exec.ExitError
	if errors.As(err, &ee) {
		return ee.ExitCode() == 44
	}
	return false
}
