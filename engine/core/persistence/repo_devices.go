package persistence

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
)

// Device is a trust record (2E §2.3): the engine's stored relationship with a
// known device. public_key is the identity anchor; IP/hostname in locator_hints
// are hints only, never used for trust decisions. NO private key is ever stored
// here (those live in the OS secret store, PROJ-121).
type Device struct {
	UUID             string
	Label            string
	PublicKey        []byte // device Ed25519 public key (BLOB)
	DeviceClass      string
	PermissionsJSON  string // owned/parsed by the permission model (PROJ-125)
	LocatorHintsJSON string // {lastIp, hostname} — hints only
	Revoked          bool
	PairedAt         int64
	LastSeen         int64
}

// DeviceRepo is the typed accessor for the devices table.
type DeviceRepo struct {
	db *DB
}

// NewDeviceRepo binds a DeviceRepo to the store.
func NewDeviceRepo(db *DB) *DeviceRepo { return &DeviceRepo{db: db} }

// Insert writes a new device trust record.
func (r *DeviceRepo) Insert(ctx context.Context, d Device) error {
	_, err := r.db.Writer().ExecContext(ctx,
		`INSERT INTO devices
		   (uuid,label,public_key,device_class,permissions_json,locator_hints_json,revoked,paired_at,last_seen)
		 VALUES (?,?,?,?,?,?,?,?,?)`,
		d.UUID, d.Label, d.PublicKey, d.DeviceClass, d.PermissionsJSON, d.LocatorHintsJSON,
		boolToInt(d.Revoked), d.PairedAt, d.LastSeen)
	if err != nil {
		return fmt.Errorf("persistence: insert device %s: %w", d.UUID, err)
	}
	return nil
}

// Get returns the device by UUID, or ErrNotFound.
func (r *DeviceRepo) Get(ctx context.Context, uuid string) (Device, error) {
	row := r.db.Reader().QueryRowContext(ctx,
		`SELECT uuid,label,public_key,device_class,permissions_json,locator_hints_json,revoked,paired_at,last_seen
		   FROM devices WHERE uuid = ?`, uuid)
	return scanDevice(row)
}

// List returns all device trust records ordered by UUID.
func (r *DeviceRepo) List(ctx context.Context) ([]Device, error) {
	rows, err := r.db.Reader().QueryContext(ctx,
		`SELECT uuid,label,public_key,device_class,permissions_json,locator_hints_json,revoked,paired_at,last_seen
		   FROM devices ORDER BY uuid`)
	if err != nil {
		return nil, fmt.Errorf("persistence: list devices: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var out []Device
	for rows.Next() {
		d, err := scanDevice(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("persistence: list devices: %w", err)
	}
	return out, nil
}

// Update replaces the mutable fields of an existing device (everything except the
// immutable paired_at). Returns ErrNotFound if the device does not exist.
func (r *DeviceRepo) Update(ctx context.Context, d Device) error {
	res, err := r.db.Writer().ExecContext(ctx,
		`UPDATE devices SET
		   label=?, public_key=?, device_class=?, permissions_json=?, locator_hints_json=?,
		   revoked=?, last_seen=?
		 WHERE uuid=?`,
		d.Label, d.PublicKey, d.DeviceClass, d.PermissionsJSON, d.LocatorHintsJSON,
		boolToInt(d.Revoked), d.LastSeen, d.UUID)
	if err != nil {
		return fmt.Errorf("persistence: update device %s: %w", d.UUID, err)
	}
	return requireAffected(res, d.UUID)
}

// Revoke marks a device untrusted (2E §5.3). The next handshake rejects it and
// any live session is torn down by the caller (PROJ-126).
func (r *DeviceRepo) Revoke(ctx context.Context, uuid string) error {
	res, err := r.db.Writer().ExecContext(ctx,
		`UPDATE devices SET revoked=1 WHERE uuid=?`, uuid)
	if err != nil {
		return fmt.Errorf("persistence: revoke device %s: %w", uuid, err)
	}
	return requireAffected(res, uuid)
}

// UpdateLastSeen records the last activity timestamp for a device.
func (r *DeviceRepo) UpdateLastSeen(ctx context.Context, uuid string, ts int64) error {
	res, err := r.db.Writer().ExecContext(ctx,
		`UPDATE devices SET last_seen=? WHERE uuid=?`, ts, uuid)
	if err != nil {
		return fmt.Errorf("persistence: update last_seen %s: %w", uuid, err)
	}
	return requireAffected(res, uuid)
}

// rowScanner is satisfied by both *sql.Row and *sql.Rows.
type rowScanner interface {
	Scan(dest ...any) error
}

func scanDevice(s rowScanner) (Device, error) {
	var d Device
	var revoked int
	err := s.Scan(&d.UUID, &d.Label, &d.PublicKey, &d.DeviceClass, &d.PermissionsJSON,
		&d.LocatorHintsJSON, &revoked, &d.PairedAt, &d.LastSeen)
	if errors.Is(err, sql.ErrNoRows) {
		return Device{}, ErrNotFound
	}
	if err != nil {
		return Device{}, fmt.Errorf("persistence: scan device: %w", err)
	}
	d.Revoked = revoked != 0
	return d, nil
}

func requireAffected(res sql.Result, key string) error {
	n, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("persistence: rows affected: %w", err)
	}
	if n == 0 {
		return fmt.Errorf("persistence: %q: %w", key, ErrNotFound)
	}
	return nil
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}
