package secretstore

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/shishir/cyberdeck/engine/internal/secrets"
)

const contractSecret = "super-secret-private-key-value"

// runContract exercises the full SecretStore contract against any backend.
func runContract(t *testing.T, store SecretStore) {
	t.Helper()
	key := "engine.identity.private"

	// Absent initially.
	if _, err := store.Get(key); !errors.Is(err, ErrNotFound) {
		t.Fatalf("Get(absent) = %v, want ErrNotFound", err)
	}
	// Deleting an absent key reports ErrNotFound.
	if err := store.Delete(key); !errors.Is(err, ErrNotFound) {
		t.Fatalf("Delete(absent) = %v, want ErrNotFound", err)
	}

	// Set then Get round-trips the value.
	want := secrets.NewString(contractSecret)
	if err := store.Set(key, want); err != nil {
		t.Fatalf("Set: %v", err)
	}
	got, err := store.Get(key)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if !got.Equal(want) {
		t.Fatal("Get returned a different secret than Set")
	}

	// Overwrite (rotation).
	rotated := secrets.NewString("rotated-value")
	if err := store.Set(key, rotated); err != nil {
		t.Fatalf("Set(overwrite): %v", err)
	}
	got, err = store.Get(key)
	if err != nil {
		t.Fatalf("Get after overwrite: %v", err)
	}
	if !got.Equal(rotated) {
		t.Fatal("overwrite did not replace the secret")
	}

	// Delete then it's gone.
	if err := store.Delete(key); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if _, err := store.Get(key); !errors.Is(err, ErrNotFound) {
		t.Fatalf("Get(after delete) = %v, want ErrNotFound", err)
	}
}

func TestMemoryStoreContract(t *testing.T) {
	runContract(t, NewMemoryStore())
}

func TestFileStoreContract(t *testing.T) {
	path := filepath.Join(t.TempDir(), "secrets.enc")
	fs, err := OpenFileStore(path, []byte("test-machine-secret"))
	if err != nil {
		t.Fatalf("OpenFileStore: %v", err)
	}
	runContract(t, fs)
}

// TestFileStoreEncryptsAtRest proves the fallback never writes plaintext (2E §7).
func TestFileStoreEncryptsAtRest(t *testing.T) {
	path := filepath.Join(t.TempDir(), "secrets.enc")
	fs, err := OpenFileStore(path, []byte("test-machine-secret"))
	if err != nil {
		t.Fatalf("OpenFileStore: %v", err)
	}
	if err := fs.Set("k", secrets.NewString(contractSecret)); err != nil {
		t.Fatalf("Set: %v", err)
	}

	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read file: %v", err)
	}
	if strings.Contains(string(raw), contractSecret) {
		t.Fatalf("plaintext secret found on disk: %s", raw)
	}
	// Still well-formed JSON with the entry present (as ciphertext).
	var data fileData
	if err := json.Unmarshal(raw, &data); err != nil {
		t.Fatalf("file not valid JSON: %v", err)
	}
	if _, ok := data.Entries["k"]; !ok {
		t.Fatal("entry k missing from file")
	}
}

func TestFileStorePersistsAcrossReopen(t *testing.T) {
	path := filepath.Join(t.TempDir(), "secrets.enc")
	ms := []byte("test-machine-secret")

	fs1, err := OpenFileStore(path, ms)
	if err != nil {
		t.Fatalf("open #1: %v", err)
	}
	if err := fs1.Set("k", secrets.NewString(contractSecret)); err != nil {
		t.Fatalf("Set: %v", err)
	}

	fs2, err := OpenFileStore(path, ms)
	if err != nil {
		t.Fatalf("open #2: %v", err)
	}
	got, err := fs2.Get("k")
	if err != nil {
		t.Fatalf("Get after reopen: %v", err)
	}
	if got.RevealString() != contractSecret {
		t.Error("value not persisted across reopen")
	}
}

// TestFileStoreMachineBound proves the file cannot be decrypted with a different
// machine-bound secret (the documented binding property).
func TestFileStoreMachineBound(t *testing.T) {
	path := filepath.Join(t.TempDir(), "secrets.enc")

	fs1, err := OpenFileStore(path, []byte("machine-A-secret"))
	if err != nil {
		t.Fatalf("open A: %v", err)
	}
	if err := fs1.Set("k", secrets.NewString(contractSecret)); err != nil {
		t.Fatalf("Set: %v", err)
	}

	// Reopen with a different machine secret: decryption must fail.
	fs2, err := OpenFileStore(path, []byte("machine-B-secret"))
	if err != nil {
		t.Fatalf("open B: %v", err)
	}
	if _, err := fs2.Get("k"); err == nil {
		t.Fatal("Get with wrong machine secret succeeded, want decryption failure")
	}
}
