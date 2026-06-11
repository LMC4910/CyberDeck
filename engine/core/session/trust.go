package session

import (
	"context"
	"errors"

	"github.com/shishir/cyberdeck/engine/core/persistence"
	"github.com/shishir/cyberdeck/engine/core/security"
)

// TrustAdapter bridges the persistence device repository (PROJ-113) to the
// security.TrustStore seam the pairing server needs, keeping the security package
// independent of persistence (the adapter lives in the orchestration layer).
type TrustAdapter struct {
	repo *persistence.DeviceRepo
}

// NewTrustAdapter wraps a device repo as a TrustStore.
func NewTrustAdapter(repo *persistence.DeviceRepo) *TrustAdapter { return &TrustAdapter{repo: repo} }

// Status reports whether a device record exists and whether it is revoked.
func (a *TrustAdapter) Status(ctx context.Context, uuid string) (exists, revoked bool, err error) {
	d, err := a.repo.Get(ctx, uuid)
	if errors.Is(err, persistence.ErrNotFound) {
		return false, false, nil
	}
	if err != nil {
		return false, false, err
	}
	return true, d.Revoked, nil
}

// Save upserts a trust record for a successfully paired device.
func (a *TrustAdapter) Save(ctx context.Context, rec security.TrustRecord) error {
	existing, err := a.repo.Get(ctx, rec.UUID)
	switch {
	case errors.Is(err, persistence.ErrNotFound):
		return a.repo.Insert(ctx, persistence.Device{
			UUID:            rec.UUID,
			Label:           "device",
			PublicKey:       rec.PublicKey,
			DeviceClass:     rec.DeviceClass,
			PermissionsJSON: rec.PermissionsJSON,
			Revoked:         false,
			PairedAt:        rec.PairedAt,
			LastSeen:        rec.PairedAt,
		})
	case err != nil:
		return err
	default:
		// Re-pair: refresh the mutable fields, keep the immutable paired_at + label.
		existing.PublicKey = rec.PublicKey
		existing.DeviceClass = rec.DeviceClass
		existing.PermissionsJSON = rec.PermissionsJSON
		existing.Revoked = false
		existing.LastSeen = rec.PairedAt
		return a.repo.Update(ctx, existing)
	}
}
