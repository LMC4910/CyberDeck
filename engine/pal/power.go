package pal

import "context"

// Power is the power-actions capability (2G). Actions return an error (rather than
// the (value, ok) read convention) since they are effectful; availability is still
// reported via the provider chain's Probe. The first-party power plugin is
// PROJ-173.
type Power interface {
	Shutdown(ctx context.Context) error
	Restart(ctx context.Context) error
	Sleep(ctx context.Context) error
	Lock(ctx context.Context) error
}
