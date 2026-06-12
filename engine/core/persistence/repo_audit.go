package persistence

import (
	"context"
	"fmt"
)

// AuditEntry is one row to append to the audit log (2E §6). It carries no
// secret-typed fields by construction; the caller (PROJ-127) is responsible for
// redacting any sensitive detail before it reaches payload_json.
type AuditEntry struct {
	TS           int64  // epoch ms UTC
	Actor        string // device uuid | "local-ui" | "system" | "flow:<id>"
	EventType    string // action.executed | action.rejected | device.paired | ...
	ResourceType string // action | flow | device | session
	ResourceID   string
	PayloadJSON  string // type-specific, secret-free
}

// AuditRecord is a stored entry with its assigned id.
type AuditRecord struct {
	ID int64
	AuditEntry
}

// AuditRepo is the insert-only accessor for the audit_log table (ADR-0014). By
// design it exposes NO update or delete path — the audit log is append-only.
type AuditRepo struct{ db *DB }

// NewAuditRepo binds an AuditRepo to the store.
func NewAuditRepo(db *DB) *AuditRepo { return &AuditRepo{db: db} }

// Append inserts an audit entry and returns its assigned id. It does not validate
// payload_json: recording the event reliably (FR-4.4) takes priority, and the
// caller guarantees the payload is secret-free.
func (r *AuditRepo) Append(ctx context.Context, e AuditEntry) (int64, error) {
	res, err := r.db.Writer().ExecContext(ctx,
		`INSERT INTO audit_log(ts,actor,event_type,resource_type,resource_id,payload_json)
		 VALUES(?,?,?,?,?,?)`,
		e.TS, e.Actor, e.EventType, e.ResourceType, e.ResourceID, e.PayloadJSON)
	if err != nil {
		return 0, fmt.Errorf("persistence: append audit: %w", err)
	}
	id, err := res.LastInsertId()
	if err != nil {
		return 0, fmt.Errorf("persistence: audit last id: %w", err)
	}
	return id, nil
}

// ByActor returns audit records for an actor, newest first (uses the actor index).
func (r *AuditRepo) ByActor(ctx context.Context, actor string) ([]AuditRecord, error) {
	return r.query(ctx, `WHERE actor=? ORDER BY ts DESC, id DESC`, actor)
}

// ByEventType returns audit records of an event type (uses the event_type index).
func (r *AuditRepo) ByEventType(ctx context.Context, eventType string) ([]AuditRecord, error) {
	return r.query(ctx, `WHERE event_type=? ORDER BY ts DESC, id DESC`, eventType)
}

// Recent returns the most recent audit records, newest first, bounded by limit
// (a non-positive limit returns no rows). The control channel (PROJ-144) reads
// back the tail of the log through this.
func (r *AuditRepo) Recent(ctx context.Context, limit int) ([]AuditRecord, error) {
	if limit <= 0 {
		return nil, nil
	}
	return r.query(ctx, `ORDER BY ts DESC, id DESC LIMIT ?`, limit)
}

// ByTimeRange returns audit records with from <= ts <= to, oldest first.
func (r *AuditRepo) ByTimeRange(ctx context.Context, from, to int64) ([]AuditRecord, error) {
	return r.query(ctx, `WHERE ts BETWEEN ? AND ? ORDER BY ts ASC, id ASC`, from, to)
}

func (r *AuditRepo) query(ctx context.Context, where string, args ...any) ([]AuditRecord, error) {
	rows, err := r.db.Reader().QueryContext(ctx,
		`SELECT id,ts,actor,event_type,resource_type,resource_id,payload_json FROM audit_log `+where, args...)
	if err != nil {
		return nil, fmt.Errorf("persistence: query audit: %w", err)
	}
	defer func() { _ = rows.Close() }()
	var out []AuditRecord
	for rows.Next() {
		var a AuditRecord
		if err := rows.Scan(&a.ID, &a.TS, &a.Actor, &a.EventType, &a.ResourceType, &a.ResourceID, &a.PayloadJSON); err != nil {
			return nil, fmt.Errorf("persistence: scan audit: %w", err)
		}
		out = append(out, a)
	}
	return out, rows.Err()
}
