package security

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"github.com/shishir/cyberdeck/engine/internal/secrets"
)

// Audit semantics (2E §6 / FR-4.4 / ADR-0014). Every executed and rejected action
// — plus pairing, revocation, session, and flow events — is appended to the
// append-only audit log with actor/type/resource/timestamp. Secrets and tokens
// are NEVER written (redacted to [REDACTED]); this works with the PROJ-115 guard.

// EventType is the audit event taxonomy (2E §6).
type EventType string

const (
	EventActionExecuted   EventType = "action.executed"
	EventActionRejected   EventType = "action.rejected"
	EventDevicePaired     EventType = "device.paired"
	EventDeviceRevoked    EventType = "device.revoked"
	EventFlowRun          EventType = "flow.run"
	EventFlowFailed       EventType = "flow.failed"
	EventPermissionDenied EventType = "permission.denied"
	EventSessionOpened    EventType = "session.opened"
	EventSessionClosed    EventType = "session.closed"
)

// AuditSink persists a finalized audit row. It is expressed in primitive terms so
// the wiring layer (PROJ-105) trivially adapts it to persistence.AuditRepo.Append
// without this package depending on persistence.
type AuditSink interface {
	Append(ctx context.Context, ts int64, actor, eventType, resourceType, resourceID, payloadJSON string) error
}

// Auditor records audit events through an AuditSink, applying redaction.
type Auditor struct {
	sink AuditSink
	now  func() int64
}

// AuditorOption configures an Auditor.
type AuditorOption func(*Auditor)

// WithAuditClock injects a timestamp source (unix millis) for tests.
func WithAuditClock(now func() int64) AuditorOption {
	return func(a *Auditor) {
		if now != nil {
			a.now = now
		}
	}
}

// NewAuditor builds an Auditor over the given sink.
func NewAuditor(sink AuditSink, opts ...AuditorOption) *Auditor {
	a := &Auditor{sink: sink, now: func() int64 { return time.Now().UnixMilli() }}
	for _, o := range opts {
		o(a)
	}
	return a
}

// record encodes (with redaction) and appends one event.
func (a *Auditor) record(ctx context.Context, actor string, et EventType, resType, resID string, payload map[string]any) error {
	return a.sink.Append(ctx, a.now(), actor, string(et), resType, resID, encodeRedacted(payload))
}

// ActionExecuted records a successfully executed action (FR-4.4).
func (a *Auditor) ActionExecuted(ctx context.Context, actor, actionID string, payload map[string]any) error {
	return a.record(ctx, actor, EventActionExecuted, "action", actionID, payload)
}

// ActionRejected records a rejected action with its reason (FR-4.4).
func (a *Auditor) ActionRejected(ctx context.Context, actor, actionID string, reason Reason) error {
	return a.record(ctx, actor, EventActionRejected, "action", actionID, map[string]any{"reason": string(reason)})
}

// PermissionDenied records a permission-specific denial.
func (a *Auditor) PermissionDenied(ctx context.Context, actor, actionID string, reason Reason) error {
	return a.record(ctx, actor, EventPermissionDenied, "action", actionID, map[string]any{"reason": string(reason)})
}

// DevicePaired records a successful pairing.
func (a *Auditor) DevicePaired(ctx context.Context, deviceUUID string) error {
	return a.record(ctx, deviceUUID, EventDevicePaired, "device", deviceUUID, nil)
}

// DeviceRevoked records a revocation.
func (a *Auditor) DeviceRevoked(ctx context.Context, deviceUUID string) error {
	return a.record(ctx, deviceUUID, EventDeviceRevoked, "device", deviceUUID, nil)
}

// SessionOpened / SessionClosed record session lifecycle.
func (a *Auditor) SessionOpened(ctx context.Context, deviceUUID string) error {
	return a.record(ctx, deviceUUID, EventSessionOpened, "session", deviceUUID, nil)
}

func (a *Auditor) SessionClosed(ctx context.Context, deviceUUID string) error {
	return a.record(ctx, deviceUUID, EventSessionClosed, "session", deviceUUID, nil)
}

// FlowRun / FlowFailed record flow execution outcomes.
func (a *Auditor) FlowRun(ctx context.Context, actor, flowID string) error {
	return a.record(ctx, actor, EventFlowRun, "flow", flowID, nil)
}

func (a *Auditor) FlowFailed(ctx context.Context, actor, flowID, detail string) error {
	return a.record(ctx, actor, EventFlowFailed, "flow", flowID, map[string]any{"error": detail})
}

// AuditedAuthorize runs Authorize and, on denial, records an action.rejected event
// (capturing the reason). On allow it records nothing — the caller records
// ActionExecuted after the action actually runs. This is the authorize→audit hook
// the interaction path (PROJ-133) and flow action-nodes route through; audit
// append errors are best-effort and do not change the authorization decision.
func AuditedAuthorize(ctx context.Context, a *Auditor, s AuthContext, actor string, action ActionDescriptor) Decision {
	d := Authorize(s, action)
	if !d.Allowed {
		_ = a.ActionRejected(ctx, actor, action.ActionID(), d.Reason)
	}
	return d
}

// sensitiveKeys are payload keys whose values are always redacted (defence in
// depth; Secret-typed values self-redact via their MarshalJSON regardless).
var sensitiveKeys = map[string]bool{
	"token": true, "pin": true, "secret": true, "password": true, "passwd": true,
	"credential": true, "credentials": true, "apikey": true, "api_key": true,
	"authorization": true, "privatekey": true, "private_key": true,
}

// encodeRedacted JSON-encodes a payload, redacting sensitive keys. Any
// secrets.Secret value also self-redacts to [REDACTED] via its MarshalJSON.
func encodeRedacted(payload map[string]any) string {
	if len(payload) == 0 {
		return "{}"
	}
	clean := make(map[string]any, len(payload))
	for k, v := range payload {
		if sensitiveKeys[strings.ToLower(k)] {
			clean[k] = secrets.Redacted
			continue
		}
		clean[k] = v
	}
	b, err := json.Marshal(clean)
	if err != nil {
		return `{"_audit_encode_error":true}`
	}
	return string(b)
}
