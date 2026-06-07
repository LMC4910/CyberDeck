//go:build windows

package secretstore

import (
	"errors"
	"fmt"
	"runtime"
	"unsafe"

	"golang.org/x/sys/windows"

	"github.com/shishir/cyberdeck/engine/internal/secrets"
)

// Windows backend: the Windows Credential Manager (generic credentials), which
// stores the blob in the user's vault encrypted at rest via DPAPI.

const (
	credTypeGeneric         = 1 // CRED_TYPE_GENERIC
	credPersistLocalMachine = 2 // CRED_PERSIST_LOCAL_MACHINE
)

var (
	modadvapi32    = windows.NewLazySystemDLL("advapi32.dll")
	procCredWriteW = modadvapi32.NewProc("CredWriteW")
	procCredReadW  = modadvapi32.NewProc("CredReadW")
	procCredDelete = modadvapi32.NewProc("CredDeleteW")
	procCredFree   = modadvapi32.NewProc("CredFree")
)

// winCredential mirrors the Win32 CREDENTIALW layout (amd64 alignment).
type winCredential struct {
	Flags              uint32
	Type               uint32
	TargetName         *uint16
	Comment            *uint16
	LastWritten        windows.Filetime
	CredentialBlobSize uint32
	CredentialBlob     *byte
	Persist            uint32
	AttributeCount     uint32
	Attributes         uintptr
	TargetAlias        *uint16
	UserName           *uint16
}

type windowsStore struct {
	service string
}

func openKeyring(service string) (SecretStore, error) {
	return &windowsStore{service: service}, nil
}

func (s *windowsStore) target(key string) string { return s.service + ":" + key }

func (s *windowsStore) Set(key string, value secrets.Secret) error {
	target, err := windows.UTF16PtrFromString(s.target(key))
	if err != nil {
		return fmt.Errorf("secretstore(win): target: %w", err)
	}
	userName, err := windows.UTF16PtrFromString(s.service)
	if err != nil {
		return fmt.Errorf("secretstore(win): username: %w", err)
	}

	blob := value.Reveal()
	cred := winCredential{
		Type:       credTypeGeneric,
		TargetName: target,
		Persist:    credPersistLocalMachine,
		UserName:   userName,
	}
	if len(blob) > 0 {
		cred.CredentialBlob = &blob[0]
		cred.CredentialBlobSize = uint32(len(blob))
	}

	ret, _, callErr := procCredWriteW.Call(uintptr(unsafe.Pointer(&cred)), 0)
	runtime.KeepAlive(blob)
	runtime.KeepAlive(cred)
	if ret == 0 {
		return fmt.Errorf("secretstore(win): CredWriteW: %w", callErr)
	}
	return nil
}

func (s *windowsStore) Get(key string) (secrets.Secret, error) {
	target, err := windows.UTF16PtrFromString(s.target(key))
	if err != nil {
		return secrets.Secret{}, fmt.Errorf("secretstore(win): target: %w", err)
	}

	var pcred *winCredential
	ret, _, callErr := procCredReadW.Call(
		uintptr(unsafe.Pointer(target)),
		credTypeGeneric,
		0,
		uintptr(unsafe.Pointer(&pcred)),
	)
	if ret == 0 {
		if errors.Is(callErr, windows.ERROR_NOT_FOUND) {
			return secrets.Secret{}, ErrNotFound
		}
		return secrets.Secret{}, fmt.Errorf("secretstore(win): CredReadW: %w", callErr)
	}
	defer func() { _, _, _ = procCredFree.Call(uintptr(unsafe.Pointer(pcred))) }()

	blob := unsafe.Slice(pcred.CredentialBlob, pcred.CredentialBlobSize)
	out := make([]byte, len(blob))
	copy(out, blob)
	return secrets.New(out), nil
}

func (s *windowsStore) Delete(key string) error {
	target, err := windows.UTF16PtrFromString(s.target(key))
	if err != nil {
		return fmt.Errorf("secretstore(win): target: %w", err)
	}
	ret, _, callErr := procCredDelete.Call(uintptr(unsafe.Pointer(target)), credTypeGeneric, 0)
	if ret == 0 {
		if errors.Is(callErr, windows.ERROR_NOT_FOUND) {
			return ErrNotFound
		}
		return fmt.Errorf("secretstore(win): CredDeleteW: %w", callErr)
	}
	return nil
}
