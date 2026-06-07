package secretstore

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/hkdf"
	"crypto/rand"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"github.com/shishir/cyberdeck/engine/internal/secrets"
)

// FileStore is the no-keyring fallback: an AES-256-GCM encrypted file whose key
// is derived (HKDF-SHA256) from a machine-bound secret plus a per-file salt.
//
// SECURITY CAVEAT (2E §7): this protects secrets at rest against exfiltration of
// the file to another machine, but a local attacker who can read the same
// machine-bound secret can derive the key. It is strictly weaker than a real OS
// keyring and is used only when no keyring is available (e.g. headless Linux),
// always with a logged warning — never as a silent plaintext fallback.
type FileStore struct {
	mu   sync.Mutex
	path string
	key  []byte // 32-byte AES key
}

const (
	fileStoreVersion = 1
	hkdfInfo         = "cyberdeck-secretstore-v1"
	saltLen          = 16
	keyLen           = 32
)

// fileData is the on-disk JSON shape. Salt is public; entry values are ciphertext
// (nonce||sealed), base64-encoded. Keys (entry names) are not secret.
type fileData struct {
	Version int               `json:"version"`
	Salt    []byte            `json:"salt"`
	Entries map[string][]byte `json:"entries"`
}

// OpenFileStore opens (or prepares) an encrypted file store at path. If
// machineSecret is nil, a best-effort machine identifier is used (see machineID).
func OpenFileStore(path string, machineSecret []byte) (*FileStore, error) {
	if path == "" {
		return nil, errors.New("secretstore: empty file store path")
	}
	if machineSecret == nil {
		machineSecret = machineID()
	}

	data, err := readFileData(path)
	if err != nil {
		return nil, err
	}
	if len(data.Salt) == 0 {
		data.Salt = make([]byte, saltLen)
		if _, err := rand.Read(data.Salt); err != nil {
			return nil, fmt.Errorf("secretstore: generate salt: %w", err)
		}
		if err := writeFileData(path, data); err != nil {
			return nil, err
		}
	}

	key, err := hkdf.Key(sha256.New, machineSecret, data.Salt, hkdfInfo, keyLen)
	if err != nil {
		return nil, fmt.Errorf("secretstore: derive key: %w", err)
	}
	return &FileStore{path: path, key: key}, nil
}

// Set stores or replaces the secret under key.
func (s *FileStore) Set(key string, value secrets.Secret) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	data, err := readFileData(s.path)
	if err != nil {
		return err
	}
	if data.Entries == nil {
		data.Entries = make(map[string][]byte)
	}
	ct, err := s.seal(value.Reveal())
	if err != nil {
		return err
	}
	data.Entries[key] = ct
	return writeFileData(s.path, data)
}

// Get retrieves and decrypts the secret for key, or ErrNotFound.
func (s *FileStore) Get(key string) (secrets.Secret, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	data, err := readFileData(s.path)
	if err != nil {
		return secrets.Secret{}, err
	}
	ct, ok := data.Entries[key]
	if !ok {
		return secrets.Secret{}, ErrNotFound
	}
	pt, err := s.open(ct)
	if err != nil {
		return secrets.Secret{}, err
	}
	return secrets.New(pt), nil
}

// Delete removes the secret for key, or ErrNotFound if absent.
func (s *FileStore) Delete(key string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	data, err := readFileData(s.path)
	if err != nil {
		return err
	}
	if _, ok := data.Entries[key]; !ok {
		return ErrNotFound
	}
	delete(data.Entries, key)
	return writeFileData(s.path, data)
}

// seal encrypts plaintext with AES-256-GCM, returning nonce||ciphertext.
func (s *FileStore) seal(plaintext []byte) ([]byte, error) {
	gcm, err := s.gcm()
	if err != nil {
		return nil, err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, fmt.Errorf("secretstore: nonce: %w", err)
	}
	return gcm.Seal(nonce, nonce, plaintext, nil), nil
}

// open decrypts nonce||ciphertext.
func (s *FileStore) open(blob []byte) ([]byte, error) {
	gcm, err := s.gcm()
	if err != nil {
		return nil, err
	}
	ns := gcm.NonceSize()
	if len(blob) < ns {
		return nil, errors.New("secretstore: ciphertext too short")
	}
	nonce, ct := blob[:ns], blob[ns:]
	pt, err := gcm.Open(nil, nonce, ct, nil)
	if err != nil {
		return nil, fmt.Errorf("secretstore: decrypt: %w", err)
	}
	return pt, nil
}

func (s *FileStore) gcm() (cipher.AEAD, error) {
	block, err := aes.NewCipher(s.key)
	if err != nil {
		return nil, fmt.Errorf("secretstore: cipher: %w", err)
	}
	return cipher.NewGCM(block)
}

// readFileData loads the store file, returning a zero-value (empty) fileData when
// the file does not yet exist.
func readFileData(path string) (fileData, error) {
	b, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return fileData{Version: fileStoreVersion, Entries: map[string][]byte{}}, nil
	}
	if err != nil {
		return fileData{}, fmt.Errorf("secretstore: read %q: %w", path, err)
	}
	var data fileData
	if err := json.Unmarshal(b, &data); err != nil {
		return fileData{}, fmt.Errorf("secretstore: parse %q: %w", path, err)
	}
	if data.Entries == nil {
		data.Entries = map[string][]byte{}
	}
	return data, nil
}

// writeFileData persists the store file atomically with 0600 permissions.
func writeFileData(path string, data fileData) error {
	data.Version = fileStoreVersion
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return fmt.Errorf("secretstore: mkdir: %w", err)
	}
	b, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("secretstore: marshal: %w", err)
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, b, 0o600); err != nil {
		return fmt.Errorf("secretstore: write tmp: %w", err)
	}
	if err := os.Rename(tmp, path); err != nil {
		return fmt.Errorf("secretstore: rename: %w", err)
	}
	return nil
}

// machineID returns a best-effort machine-bound identifier. It is intentionally
// derived from a stable per-machine value so the fallback file cannot be
// decrypted by simply copying it to another host.
func machineID() []byte {
	for _, p := range []string{"/etc/machine-id", "/var/lib/dbus/machine-id"} {
		if b, err := os.ReadFile(p); err == nil {
			if id := bytes.TrimSpace(b); len(id) > 0 {
				return id
			}
		}
	}
	host, _ := os.Hostname()
	return []byte("cyberdeck-host:" + host)
}
