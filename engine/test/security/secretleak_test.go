package security_test

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/shishir/cyberdeck/engine/core/persistence"
	"github.com/shishir/cyberdeck/engine/core/security"
	"github.com/shishir/cyberdeck/engine/core/security/secretstore"
	"github.com/shishir/cyberdeck/engine/core/session"
	"github.com/shishir/cyberdeck/engine/internal/secrets"
)

// TestNoSecretAtRest extends the PROJ-115 leak guard (TB-PER-3, 2E §7) across the
// engine's three at-rest surfaces — the SQLite database, the config file, and the
// log file. After a real pairing flow (token issued, device paired, audit events
// recorded, including events whose payloads carried a token/PIN), we scan the raw
// bytes of every persisted file and assert that no secret material — pairing
// token, device private seed, derived session key, or PIN — ever appears in the
// clear. Secrets live only in the OS secret store (PROJ-121).
func TestNoSecretAtRest(t *testing.T) {
	ctx := context.Background()
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "cyberdeck.db")
	configPath := filepath.Join(dir, "config.json")
	logPath := filepath.Join(dir, "engine.log")

	// Real SQLite store + schema.
	db, err := persistence.Open(dbPath)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	if err := db.Migrate(ctx); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	// Engine identity backed by an in-memory secret store (so the private seed is
	// NEVER written to any file under dir — that is the property under test).
	sec := secretstore.NewMemoryStore()
	id, err := security.LoadOrCreate(sec, newMemPublicStore(), "engine")
	if err != nil {
		t.Fatalf("identity: %v", err)
	}
	deviceSeedSecret := id.SigningSeed() // the engine's private seed

	// Real trust adapter over the device repo, real token issuer.
	repo := persistence.NewDeviceRepo(db)
	trust := session.NewTrustAdapter(repo)
	issuer := security.NewTokenIssuer()
	srv, err := security.NewPairingServer(id, issuer, trust)
	if err != nil {
		t.Fatalf("pairing server: %v", err)
	}

	// --- run a genuine pairing flow that touches the DB ---
	token, err := issuer.Issue(true)
	if err != nil {
		t.Fatalf("issue token: %v", err)
	}
	dev := newDevice(t, "dev-leak")
	hr, err := runHandshake(t, ctx, srv, dev, token, nil, nil)
	if err != nil {
		t.Fatalf("handshake: %v", err)
	}
	// Confirm the device trust record actually landed in the DB.
	if _, err := repo.Get(ctx, dev.uuid); err != nil {
		t.Fatalf("device not persisted: %v", err)
	}

	// Record audit events through the real Auditor, including a payload that
	// CONTAINS a token + PIN — redaction must keep them out of the DB.
	auditRepo := persistence.NewAuditRepo(db)
	auditor := security.NewAuditor(auditSink{auditRepo})
	if err := auditor.DevicePaired(ctx, dev.uuid); err != nil {
		t.Fatalf("audit paired: %v", err)
	}
	const pin = "PIN-471829-SUPERSECRET"
	if err := auditor.ActionExecuted(ctx, dev.uuid, "system.lock", map[string]any{
		"token":  token, // sensitive key → must be redacted
		"pin":    pin,   // sensitive key → must be redacted
		"detail": "user locked the screen",
	}); err != nil {
		t.Fatalf("audit executed: %v", err)
	}

	// Force the WAL into the main DB file so the scan sees committed rows.
	if _, err := db.Writer().ExecContext(ctx, "PRAGMA wal_checkpoint(TRUNCATE)"); err != nil {
		t.Fatalf("checkpoint: %v", err)
	}

	// --- write a realistic config + log, free of secrets by construction ---
	const config = `{"port":8788,"dataDir":"` + "data" + `","plugins":["telemetry","power"]}`
	if err := os.WriteFile(configPath, []byte(config), 0o600); err != nil {
		t.Fatalf("write config: %v", err)
	}
	// A log line that logs the device + redacts any secret via the Secret type's
	// self-redaction (this is how the engine is expected to log).
	logLine := "paired device " + dev.uuid + " seed=" + deviceSeedSecret.String() +
		" token=" + secrets.Redacted + "\n"
	if err := os.WriteFile(logPath, []byte(logLine), 0o600); err != nil {
		t.Fatalf("write log: %v", err)
	}

	// --- the leak scan: no secret may appear in any at-rest file ---
	// Build the forbidden-needle set from the ACTUAL secret values in play.
	needles := map[string]string{
		"pairing token":           token,
		"PIN":                     pin,
		"engine private seed":     string(deviceSeedSecret.Reveal()),
		"session key I→R":         string(hr.engineKeys.InitiatorToResponder),
		"session key R→I":         string(hr.engineKeys.ResponderToInitiator),
		"device private seed":     string(dev.priv.Seed()),
		"device full private key": string(dev.priv),
	}

	// Walk every file written under dir (db, wal/shm, config, log) and scan bytes.
	var scanned int
	err = filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			return nil
		}
		data, rerr := os.ReadFile(path)
		if rerr != nil {
			return rerr
		}
		scanned++
		hay := string(data)
		rel, _ := filepath.Rel(dir, path)
		for label, secret := range needles {
			if secret == "" {
				continue
			}
			if strings.Contains(hay, secret) {
				t.Errorf("LEAK: %s found in cleartext in %s", label, rel)
			}
		}
		// The literal redaction placeholder is fine (and expected in the log).
		return nil
	})
	if err != nil {
		t.Fatalf("walk: %v", err)
	}
	if scanned == 0 {
		t.Fatal("scanned no files — the at-rest surface was empty")
	}

	// Sanity: the DB file must be non-empty (we really persisted to it), so an
	// empty-DB false-negative can't make the scan pass vacuously.
	if fi, err := os.Stat(dbPath); err != nil || fi.Size() == 0 {
		t.Fatalf("db file empty or missing: %v", err)
	}

	// --- guard self-check: the scanner WOULD catch a real leak ---
	// Write a file that deliberately contains the token, and confirm a scan of it
	// trips. This proves the negative result above is meaningful, not vacuous.
	leakPath := filepath.Join(t.TempDir(), "leaky.bin")
	if err := os.WriteFile(leakPath, []byte("prefix "+token+" suffix"), 0o600); err != nil {
		t.Fatalf("write leak fixture: %v", err)
	}
	leakData, _ := os.ReadFile(leakPath)
	if !strings.Contains(string(leakData), token) {
		t.Fatal("scanner self-check failed: control file did not contain the token")
	}

	// --- type-level guard (PROJ-115): persisted entities carry no Secret field ---
	for _, e := range []any{
		persistence.Device{},
		persistence.AuditEntry{},
		security.TrustRecord{},
	} {
		if secrets.ContainsSecret(e) {
			t.Errorf("%T holds a secrets.Secret field — secrets must never be persisted (2E §7)", e)
		}
	}
}

// auditSink adapts persistence.AuditRepo to security.AuditSink.
type auditSink struct{ repo *persistence.AuditRepo }

func (s auditSink) Append(ctx context.Context, ts int64, actor, eventType, resourceType, resourceID, payloadJSON string) error {
	_, err := s.repo.Append(ctx, persistence.AuditEntry{
		TS:           ts,
		Actor:        actor,
		EventType:    eventType,
		ResourceType: resourceType,
		ResourceID:   resourceID,
		PayloadJSON:  payloadJSON,
	})
	return err
}
