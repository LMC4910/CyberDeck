package lifecycle

import (
	"context"
	"errors"
	"io"
	"log"
	"path/filepath"
	"sync"
	"testing"

	"github.com/shishir/cyberdeck/engine/core/persistence"
)

// recorder collects the order in which subsystem hooks fire.
type recorder struct {
	mu  sync.Mutex
	log []string
}

func (r *recorder) add(s string) {
	r.mu.Lock()
	r.log = append(r.log, s)
	r.mu.Unlock()
}

func (r *recorder) snapshot() []string {
	r.mu.Lock()
	defer r.mu.Unlock()
	return append([]string(nil), r.log...)
}

type fakeDB struct {
	r      *recorder
	migErr error
}

func (f *fakeDB) Migrate(context.Context) error { f.r.add("migrate"); return f.migErr }
func (f *fakeDB) Close() error                  { f.r.add("close"); return nil }

type fakeService struct {
	r    *recorder
	name string
}

func (f *fakeService) Start(context.Context) error { f.r.add("start:" + f.name); return nil }
func (f *fakeService) Stop(context.Context) error  { f.r.add("stop:" + f.name); return nil }

func wiredSubsystems(r *recorder, db *fakeDB) Subsystems {
	return Subsystems{
		DB:         db,
		DBCloser:   db,
		InitCore:   func(context.Context) error { r.add("core"); return nil },
		FlushCore:  func(context.Context) error { r.add("flush"); return nil },
		PluginHost: &fakeService{r, "host"},
		Transport:  &fakeService{r, "transport"},
		MDNS:       &fakeService{r, "mdns"},
	}
}

func equal(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

func TestBootRunsStagesInDocumentedOrder(t *testing.T) {
	r := &recorder{}
	logger := log.New(io.Discard, "", 0)
	if err := Boot(context.Background(), logger, BuildStages(wiredSubsystems(r, &fakeDB{r: r}))); err != nil {
		t.Fatalf("Boot: %v", err)
	}
	want := []string{"migrate", "core", "start:host", "start:transport", "start:mdns"}
	if got := r.snapshot(); !equal(got, want) {
		t.Errorf("boot order = %v, want %v", got, want)
	}
}

func TestShutdownRunsStepsInDocumentedOrder(t *testing.T) {
	r := &recorder{}
	logger := log.New(io.Discard, "", 0)
	if err := Shutdown(context.Background(), logger, BuildShutdownSteps(wiredSubsystems(r, &fakeDB{r: r}))); err != nil {
		t.Fatalf("Shutdown: %v", err)
	}
	// 2B §7.2: stop sessions (transport+mDNS) → flush → stop plugins → close SQLite.
	want := []string{"stop:transport", "stop:mdns", "flush", "stop:host", "close"}
	if got := r.snapshot(); !equal(got, want) {
		t.Errorf("shutdown order = %v, want %v", got, want)
	}
}

func TestBootAbortsOnStageError(t *testing.T) {
	r := &recorder{}
	logger := log.New(io.Discard, "", 0)
	boom := errors.New("migrate failed")
	subs := wiredSubsystems(r, &fakeDB{r: r, migErr: boom})
	err := Boot(context.Background(), logger, BuildStages(subs))
	if !errors.Is(err, boom) {
		t.Fatalf("Boot error = %v, want wrapping %v", err, boom)
	}
	// Nothing after the failed migrate stage should have run.
	for _, e := range r.snapshot() {
		if e == "core" || e == "start:host" {
			t.Errorf("stage %q ran after migrate failure", e)
		}
	}
}

func TestNilSubsystemsAreSkipped(t *testing.T) {
	// An empty Subsystems must still boot+shutdown to completion (every stage a
	// no-op), proving stages whose deps aren't built yet hold their place.
	logger := log.New(io.Discard, "", 0)
	if err := Boot(context.Background(), logger, BuildStages(Subsystems{})); err != nil {
		t.Fatalf("Boot with nil subsystems: %v", err)
	}
	if err := Shutdown(context.Background(), logger, BuildShutdownSteps(Subsystems{})); err != nil {
		t.Fatalf("Shutdown with nil subsystems: %v", err)
	}
}

// TestBootWithRealSQLiteReachesREADY is the integration gate (ticket): boot with a
// real persistence.DB opens + migrates the schema and the lifecycle reaches READY;
// shutdown closes SQLite cleanly.
func TestBootWithRealSQLiteReachesREADY(t *testing.T) {
	db, err := persistence.Open(filepath.Join(t.TempDir(), "engine.db"))
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	subs := Subsystems{DB: db, DBCloser: db}

	logger := log.New(io.Discard, "", 0)
	if err := Boot(context.Background(), logger, BuildStages(subs)); err != nil {
		t.Fatalf("Boot real SQLite: %v", err)
	}
	if err := Shutdown(context.Background(), logger, BuildShutdownSteps(subs)); err != nil {
		t.Fatalf("Shutdown real SQLite: %v", err)
	}
	// DB is closed: a further migrate must fail.
	if err := db.Migrate(context.Background()); err == nil {
		t.Error("expected error using DB after shutdown closed it")
	}
}
