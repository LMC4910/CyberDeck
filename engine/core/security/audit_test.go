package security

import (
	"context"
	"strings"
	"testing"

	"github.com/shishir/cyberdeck/engine/internal/secrets"
)

type auditRow struct {
	ts                                    int64
	actor, eventType, rType, rID, payload string
}

type fakeAuditSink struct {
	rows []auditRow
}

func (s *fakeAuditSink) Append(_ context.Context, ts int64, actor, et, rt, rid, payload string) error {
	s.rows = append(s.rows, auditRow{ts, actor, et, rt, rid, payload})
	return nil
}

func newAuditor(t *testing.T) (*Auditor, *fakeAuditSink) {
	t.Helper()
	sink := &fakeAuditSink{}
	var tick int64
	return NewAuditor(sink, WithAuditClock(func() int64 { tick++; return tick })), sink
}

func TestActionExecutedAndRejectedAudited(t *testing.T) {
	ctx := context.Background()
	a, sink := newAuditor(t)

	if err := a.ActionExecuted(ctx, "dev-1", "media.play", map[string]any{"level": 50}); err != nil {
		t.Fatalf("ActionExecuted: %v", err)
	}
	if err := a.ActionRejected(ctx, "dev-1", "system.shutdown", ReasonDestructive); err != nil {
		t.Fatalf("ActionRejected: %v", err)
	}
	if len(sink.rows) != 2 {
		t.Fatalf("got %d rows, want 2", len(sink.rows))
	}
	ex := sink.rows[0]
	if ex.actor != "dev-1" || ex.eventType != string(EventActionExecuted) || ex.rType != "action" || ex.rID != "media.play" || ex.ts == 0 {
		t.Errorf("executed row wrong: %+v", ex)
	}
	rej := sink.rows[1]
	if rej.eventType != string(EventActionRejected) || !strings.Contains(rej.payload, string(ReasonDestructive)) {
		t.Errorf("rejected row wrong: %+v", rej)
	}
}

func TestAuditedAuthorizeRecordsRejection(t *testing.T) {
	ctx := context.Background()
	a, sink := newAuditor(t)

	// Denied: destructive action without allowPowerActions.
	ctxAuth := AuthContext{Authenticated: true, Perms: Permissions{AllowedCategories: []string{"system"}}}
	d := AuditedAuthorize(ctx, a, ctxAuth, "dev-1", actionDesc{id: "system.reboot", category: "system", destructive: true})
	if d.Allowed {
		t.Fatal("expected denial")
	}
	if len(sink.rows) != 1 || sink.rows[0].eventType != string(EventActionRejected) {
		t.Fatalf("expected one action.rejected row, got %+v", sink.rows)
	}

	// Allowed: no audit row from AuditedAuthorize (caller records execution).
	sink.rows = nil
	ctxOK := AuthContext{Authenticated: true, Perms: Permissions{AllowPowerActions: true, AllowedCategories: []string{"system"}}}
	if d := AuditedAuthorize(ctx, a, ctxOK, "dev-1", actionDesc{id: "system.reboot", category: "system", destructive: true}); !d.Allowed {
		t.Fatal("expected allow")
	}
	if len(sink.rows) != 0 {
		t.Errorf("allow should not auto-audit, got %+v", sink.rows)
	}
}

func TestAuditRedaction(t *testing.T) {
	ctx := context.Background()
	a, sink := newAuditor(t)

	secret := secrets.NewString("super-secret-token-value")
	err := a.ActionExecuted(ctx, "dev-1", "integration.connect", map[string]any{
		"token":      "plaintext-token-1234", // sensitive key → redacted
		"creds":      secret,                 // Secret value → self-redacts
		"safe_field": "visible",
	})
	if err != nil {
		t.Fatalf("ActionExecuted: %v", err)
	}
	payload := sink.rows[0].payload
	if strings.Contains(payload, "plaintext-token-1234") {
		t.Errorf("sensitive-key value leaked: %s", payload)
	}
	if strings.Contains(payload, "super-secret-token-value") {
		t.Errorf("Secret value leaked: %s", payload)
	}
	if !strings.Contains(payload, secrets.Redacted) {
		t.Errorf("payload missing %q: %s", secrets.Redacted, payload)
	}
	if !strings.Contains(payload, "visible") {
		t.Errorf("non-sensitive field wrongly removed: %s", payload)
	}
}

func TestAuditTaxonomy(t *testing.T) {
	ctx := context.Background()
	a, sink := newAuditor(t)

	_ = a.DevicePaired(ctx, "dev-1")
	_ = a.DeviceRevoked(ctx, "dev-1")
	_ = a.SessionOpened(ctx, "dev-1")
	_ = a.SessionClosed(ctx, "dev-1")
	_ = a.FlowRun(ctx, "dev-1", "flow-9")
	_ = a.FlowFailed(ctx, "dev-1", "flow-9", "boom")
	_ = a.PermissionDenied(ctx, "dev-1", "x", ReasonCategory)

	want := []string{
		string(EventDevicePaired), string(EventDeviceRevoked),
		string(EventSessionOpened), string(EventSessionClosed),
		string(EventFlowRun), string(EventFlowFailed), string(EventPermissionDenied),
	}
	if len(sink.rows) != len(want) {
		t.Fatalf("got %d rows, want %d", len(sink.rows), len(want))
	}
	for i, w := range want {
		if sink.rows[i].eventType != w {
			t.Errorf("row %d eventType = %q, want %q", i, sink.rows[i].eventType, w)
		}
	}
}
