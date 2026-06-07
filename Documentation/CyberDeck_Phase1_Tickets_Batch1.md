# CyberDeck — Phase 1 · Jira Epic List + Ticket Breakdown (Batch 1)

**Execution-system Document 2 of N** · Version 0.1 (Draft) · June 2026 · `com.shishir.cyberdeck`
Default assignee: **Claude** (autonomous senior-engineer agent)

> This document contains (a) the **Jira Epic List** for all of Phase 1, and (b) the **full implementation-ready tickets for Batch 1** — the critical-path foundation: **EPIC-1 (Lifecycle/WS-1)**, **EPIC-2 (Persistence/WS-2)**, **EPIC-3 (Security/WS-3)**. These hold 6 of the 7 Ready-now tickets and unblock everything downstream. Remaining batches (transport, state/registries, plugins, flow, client, designer, hardening) follow in subsequent documents.
>
> Every ticket here is grounded in the Phase-1 Deep Dive (WS sections), the subsystem TRDs (2A–2G), and the ADR log. Cross-references like `2E §3.2` and `ADR-0008` point into the documentation set.

---

## Part A — Jira Epic List (all of Phase 1)

| Epic | Title | Workstream | Tickets | Points | Owning TRD(s) | Phase milestone(s) |
|------|-------|-----------|---------|--------|---------------|--------------------|
| **EPIC-1** | Engine Bootstrap, Service Lifecycle & Packaging | WS-1 | PROJ-101,102,103,104,105,106,107,108,109,190,191,192 | 31 | 2B §7, Master §3 | M1, M7 |
| **EPIC-2** | Persistence & Core Data Layer | WS-2 | PROJ-110,111,112,113,114,115 | 12 | 2B §6 | M1 |
| **EPIC-3** | Security & Identity | WS-3 | PROJ-120,121,122,123,124,125,126,127 | 18 | 2E | M2 |
| **EPIC-4** | Transport & Connectivity | WS-4 | PROJ-140,141,142,143,144,145,146,147,148,149,150 | 26 | 2A | M2 |
| **EPIC-5** | Plugin Host & First-Party Capabilities | WS-5 | PROJ-130,131,132,133,170,171,172,173,174,175,176 | 27 | 2F, 2G | M3, M4 |
| **EPIC-6** | State Store, Registries & Event Bus | WS-6 | PROJ-160,161,162,163,164 | 13 | 2B §2–§5 | M3 |
| **EPIC-7** | Flow Engine Core | WS-7 | PROJ-200,201,202,203,204 | 13 | 2D | M5 |
| **EPIC-8** | Client Runtime & Widget Vocabulary | WS-8 | PROJ-180,181,182,183,184,185,186,187,188,189 | 24 | 2C §7, 2A | M3, M4 |
| **EPIC-9** | Designer (Desktop) | WS-9 | PROJ-210,211,212,213,214,215,216,217 | 21 | 2C §8 | M6 |
| **EPIC-10** | Phase-1 Hardening & Acceptance | cross | PROJ-300,301,302,303 | 11 | all | M7 |

**Epic execution order (high level):** EPIC-1/2/3 (parallel foundation) → EPIC-4 (transport) → EPIC-6 (state/registries) → EPIC-5 (plugins) → EPIC-8 (client) → EPIC-7 (flows) → EPIC-9 (designer) → EPIC-10 (hardening). Matches the critical path in the Phase-1 Deep Dive §3.

---

## Part B — Conventions for every ticket

- **Validation commands** assume the monorepo tooling stood up by PROJ-101/102. Until those merge, the literal commands may be stubs; each ticket lists the commands it *must* pass at its completion.
- Standard Go gate (engine/plugins): `go vet ./... && golangci-lint run && go test ./... && go build ./...`
- Standard Flutter gate (client): `dart analyze && flutter test && flutter build <target>`
- **Completion checklist** (applies to every ticket; repeated per ticket for the agent):
  `[ ] Code implemented · [ ] Tests passing · [ ] Docs/comments updated · [ ] No lint errors · [ ] No type errors · [ ] Acceptance criteria satisfied · [ ] Ticket status moved`
- **Branch/PR convention:** `proj-<id>-<slug>`; PR title `PROJ-<id>: <summary>`; PR body links the acceptance criteria.

---

# EPIC-1 — Engine Bootstrap, Service Lifecycle & Packaging (WS-1)

---

## PROJ-101 — Monorepo scaffold + tooling

**Summary:** Stand up the monorepo skeleton (Go engine, Flutter client, shared schemas) with build tooling so all later tickets have a place to land.

**Objective:** A buildable, lint-clean repository tree matching TRD Master §7.1, with engine and client compiling as empty-but-valid programs.

**Context:** Everything depends on this. The repo layout is fixed by TRD Master §7.1 (Doc 2). No business logic here — scaffolding only.

**Technical Requirements:**
- Create the directory tree: `engine/` (Go module), `plugins/`, `client/` (Flutter app), `shared/schemas/`, `installers/`, `docs/`.
- `engine/`: Go module `github.com/shishir/cyberdeck/engine` (or chosen path); `cmd/cyberdeck/main.go` prints version and exits; package dirs `core/`, `pluginhost/`, `pal/`, `internal/` with `doc.go` placeholders.
- `client/`: Flutter app (`flutter create`), folders `lib/{net,render,gestures,app,theme,tray,designer}` with placeholder files.
- `shared/schemas/`: empty JSON-schema placeholder files for action/widget/flownode/state descriptors + protocol envelope.
- Root: `README.md`, `.editorconfig`, `.gitignore` (Go + Flutter + build artifacts), `Makefile`/`Taskfile` with `lint`, `test`, `build` targets that fan out to engine + client.

**Acceptance Criteria:**
- `go build ./...` succeeds from `engine/`.
- `flutter build <host-os-desktop>` succeeds from `client/` (debug).
- Repo tree matches TRD Master §7.1 (verified by a checked-in `STRUCTURE.md` listing intended paths).
- `make lint && make test && make build` (or task equivalents) exits 0.

**Implementation Notes:** Use Go 1.22+. Flutter stable channel. Keep `main.go` trivial. Do not add dependencies beyond what scaffolding needs. The Designer lives under `client/lib/designer/` but is compiled only for desktop targets — add a build flag placeholder, don't implement gating yet (that's a later DX concern).

**Testing Requirements:**
- Unit: a trivial passing test in both `engine` and `client` to prove the test runners are wired.
- Integration/E2E: none.

**Deliverables:** Repo tree; `cmd/cyberdeck/main.go`; Flutter app shell; `Makefile`/`Taskfile`; `README.md`; `STRUCTURE.md`; `.gitignore`.

**Dependencies:** none. **Effort:** 2 pts (~3h), low complexity.

**Agent Instructions:**
1. Read TRD Master §7.1 for the exact tree.
2. Create the Go module and Flutter app; add placeholder packages/files.
3. Write the `Makefile`/`Taskfile` fan-out targets.
4. Add one trivial passing test each side.
5. Run validation commands; fix until green.

**Expected Files Modified/Created:** the whole initial tree (see Deliverables).

**Validation Commands:**
```bash
cd engine && go vet ./... && go build ./... && go test ./...
cd ../client && dart analyze && flutter test
make lint && make test && make build
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## PROJ-102 — CI pipeline (lint / typecheck / test / build gates)

**Summary:** A CI workflow that runs the four gates on every push/PR and blocks merge on failure.

**Objective:** Automated enforcement of lint, typecheck, test, build for engine + client.

**Context:** The agent's per-ticket validation runs locally; CI is the backstop that keeps `main` green. Required by the Claude operating rules (validation before Done).

**Technical Requirements:**
- CI config (GitHub Actions or chosen CI) with jobs: `engine-go` (vet, golangci-lint, test, build), `client-flutter` (analyze, test, build), each on Linux runners; macOS/Windows build jobs may be a matrix where feasible.
- Cache Go modules and Flutter pub for speed.
- Fail the workflow if any gate fails; require it as a merge check.

**Acceptance Criteria:**
- Pushing a branch triggers all gates.
- A deliberately-broken lint/test fails the workflow (verified once, then reverted).
- Merge to `main` is blocked while any gate is red.

**Implementation Notes:** Keep runners minimal in Batch 1; per-OS build matrices for installers come with PROJ-190/191/192. Pin tool versions (Go, Flutter, golangci-lint) for reproducibility.

**Testing Requirements:** Self-validating (the pipeline is the test). Include a short `ci/README.md` documenting how to run gates locally.

**Deliverables:** CI workflow file(s); `ci/README.md`; branch-protection note.

**Dependencies:** none (can run alongside PROJ-101; if PROJ-101 not yet merged, target its branch). **Effort:** 2 pts (~3h), low.

**Agent Instructions:** Write the workflow; verify it runs the four gates; prove a red gate blocks; document local commands.

**Expected Files:** `.github/workflows/*.yml` (or equivalent), `ci/README.md`.

**Validation Commands:**
```bash
# locally mirror CI:
cd engine && go vet ./... && golangci-lint run && go test ./... && go build ./...
cd ../client && dart analyze && flutter test
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## PROJ-103 — Config loader (`config.json` schema + defaults)

**Summary:** Load and validate the non-secret engine config, applying safe defaults.

**Objective:** A `config` package that reads `config.json`, validates it, and exposes typed settings; bad/missing config yields defaults + a logged warning (never a crash).

**Context:** Schema carried from Doc 0 §16 (intervals, thresholds, HA URL placeholder, display prefs). Read at startup; hot-reload is deferred (Doc 0 §12). Secrets are NOT here (2E §7).

**Technical Requirements:**
- Define the config struct + JSON tags matching Doc 0 §16 (`version`, `telemetry.{cpu,gpu,storage}_interval_ms`, `media.*`, `smarthome.ha_base_url`, `thresholds.{cpu_temp_warn,gpu_temp_warn,ram_warn_percent}`).
- Validation: types, ranges (e.g. intervals > 0), version present.
- On parse error or missing file: start with documented defaults, log a WARNING (per Error Handling: "Plugin starts with defaults").
- Provide `Load(path) (*Config, error)` and `Default() *Config`.

**Acceptance Criteria:**
- Valid config loads into the typed struct.
- Malformed JSON → defaults returned + warning logged, no panic.
- Out-of-range values → rejected/clamped per documented rule.
- Unit tests cover valid/malformed/missing/out-of-range.

**Implementation Notes:** Keep secrets out by construction (no token fields). Put under `engine/internal/config/`.

**Testing Requirements:** Unit: valid, malformed, missing-file, out-of-range, defaults-equality.

**Deliverables:** `engine/internal/config/{config.go,defaults.go,validate.go}`, tests, sample `config.json`.

**Dependencies:** PROJ-101. **Effort:** 2 pts (~3h), low.

**Agent Instructions:** Implement struct+load+validate+defaults; write the four+ unit tests; run gate.

**Expected Files:** `engine/internal/config/*`, `engine/internal/config/*_test.go`, sample config.

**Validation Commands:**
```bash
cd engine && go vet ./... && golangci-lint run && go test ./internal/config/... && go build ./...
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## PROJ-104 — Engine entrypoint (service vs console mode)

**Summary:** The `cyberdeck` entrypoint parses `--service`/`--console` and drives the boot sequence stub.

**Objective:** A real entrypoint that selects run mode, loads config, and calls into a (stubbed) boot sequence reaching a READY state in console mode.

**Context:** TRD 2B §7.1 boot sequence; Master §3 process model. The full boot wiring (SQLite, core, plugin host, transport) is PROJ-105; this ticket establishes the mode-select + lifecycle skeleton.

**Technical Requirements:**
- Flag parsing: `--service` (run under OS service manager), `--console` (foreground/dev), default = console.
- Load config (PROJ-103); init a structured logger (rotating file handler placeholder per 2B §7/Logging).
- Call `lifecycle.Boot(ctx, cfg)` which currently logs the documented boot stages and reaches READY (real subsystems wired in PROJ-105).
- Handle SIGINT/SIGTERM → `lifecycle.Shutdown`.

**Acceptance Criteria:**
- `cyberdeck --console` boots to READY and logs the staged sequence.
- `cyberdeck --service` selects service mode (no crash even if service glue not yet installed — that's PROJ-106/7/8).
- SIGTERM triggers graceful shutdown logging.

**Implementation Notes:** Keep boot stages as named steps so PROJ-105 fills them in. Logger: INFO default, DEBUG via config.

**Testing Requirements:** Unit: flag parsing; boot-stage ordering (with stubbed steps); shutdown handler invoked on signal (use an injected signal in test).

**Deliverables:** `engine/cmd/cyberdeck/main.go`, `engine/internal/lifecycle/{boot.go,shutdown.go}` (stubs with real ordering), tests.

**Dependencies:** PROJ-101, PROJ-103. **Effort:** 2 pts (~3h), low-medium.

**Agent Instructions:** Implement flag parse + logger + staged boot stub + signal handling; test ordering and shutdown.

**Expected Files:** `engine/cmd/cyberdeck/main.go`, `engine/internal/lifecycle/*`, tests.

**Validation Commands:**
```bash
cd engine && go vet ./... && golangci-lint run && go test ./... && go build ./...
./cyberdeck --console   # observe staged boot to READY, then Ctrl-C for graceful shutdown
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## PROJ-105 — Boot sequence + graceful shutdown + single-instance guard

**Summary:** Wire the real boot sequence (config → SQLite → core → plugin host → transport → READY), graceful shutdown, and a single-instance guard.

**Objective:** The engine boots all subsystems in the documented order, refuses a second instance, and shuts down cleanly.

**Context:** TRD 2B §7.1/§7.2. This is the integration point that turns the stub (PROJ-104) into the real lifecycle once its dependencies exist.

**Technical Requirements:**
- Boot order (2B §7.1): load config → open/migrate SQLite (PROJ-110) → init core (state store PROJ-160) → start plugin host (PROJ-130) → start transport (PROJ-150/147) → mDNS advertise → READY. Use injected interfaces so each subsystem can be a real impl or a test fake.
- Graceful shutdown (2B §7.2): stop accepting sessions → flush durable writes → SIGTERM plugins (grace) → kill → close SQLite.
- Single-instance guard: OS-appropriate lock (named mutex / lockfile / abstract socket); second launch focuses UI (signal) and exits.

**Acceptance Criteria:**
- Engine boots through every stage in order (log-verified) to READY.
- Second instance is refused; first instance receives a "focus UI" signal.
- Shutdown performs all steps in order; no data loss; SQLite closed cleanly.
- AC P1-AC-01 (service survives UI close) supported by this lifecycle (full per-OS in PROJ-106/7/8).

**Implementation Notes:** Depends on subsystem constructors existing; if a subsystem ticket isn't done, this ticket is BLOCKED until its deps (PROJ-110, PROJ-150) complete — do not stub real subsystems to fake done. Keep boot/shutdown idempotent.

**Testing Requirements:** Unit: boot-order with fakes; shutdown-order; single-instance (two boots in a test → second refused). Integration: boot with real SQLite (PROJ-110) reaching READY.

**Deliverables:** `engine/internal/lifecycle/{boot.go,shutdown.go,singleinstance_{windows,darwin,linux}.go}`, tests.

**Dependencies:** PROJ-104, PROJ-110, PROJ-150. **Effort:** 3 pts (~4h), medium.

**Agent Instructions:** Replace boot stubs with real subsystem wiring via interfaces; implement shutdown ordering + single-instance per OS; test ordering and refusal.

**Expected Files:** `engine/internal/lifecycle/*`, tests.

**Validation Commands:**
```bash
cd engine && go vet ./... && golangci-lint run && go test ./internal/lifecycle/... && go build ./...
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## PROJ-106 / 107 / 108 — OS service registration (Windows / macOS / Linux)

> Three parallel tickets, identical shape, one per OS. Listed once; the agent implements each as its own ticket/PR.

**Summary:** Register the engine as an OS background service that starts on boot and survives Desktop-UI close.

**Objective:** Per-OS service glue so `cyberdeck --service` runs under the platform service manager.

**Context:** TRD Master §3 / ADR-0005. Windows Service (106), launchd LaunchAgent/Daemon (107), systemd user service (108).

**Technical Requirements (per OS):**
- 106 Windows: register as a Windows Service (or, fallback, a startup-registered tray process); handle service control events (start/stop); start-on-boot default; user-toggleable.
- 107 macOS: launchd plist (LaunchAgent for user session; document LaunchDaemon variant); RunAtLoad; KeepAlive sensible.
- 108 Linux: systemd **user** service unit; `WantedBy=default.target`; enable-on-install.

**Acceptance Criteria (per OS):**
- Service installs and starts on boot.
- Engine continues running when the Desktop UI window is closed (**AC P1-AC-01** for that OS).
- Stop/disable works; logs the lifecycle.

**Implementation Notes:** Service registration is performed by the installer (PROJ-190/1/2) but the *glue + control handling* lives here under `engine/internal/service/{windows,darwin,linux}.go`. Start-on-boot default ON; expose a toggle.

**Testing Requirements:** Integration on the target OS (or CI runner where possible): install → reboot/relogin → service running → close UI → still running → stop. Where reboot isn't testable in CI, simulate via service restart + a documented manual test step.

**Deliverables:** `engine/internal/service/<os>.go`, service manifest/unit templates, per-OS test/notes.

**Dependencies:** PROJ-105. **Effort:** 3 pts each (~4h), medium.

**Agent Instructions:** Implement the OS service glue + control handlers; provide the unit/plist/service template; run the integration/manual test for that OS; record results.

**Expected Files:** `engine/internal/service/<os>.go`, `installers/<os>/service.*` template.

**Validation Commands:**
```bash
cd engine && go vet ./... && golangci-lint run && go test ./internal/service/... && go build ./...
# + documented per-OS install/boot/close-UI manual verification
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## PROJ-109 — System-tray presence

**Summary:** A desktop tray icon showing engine status with reopen-UI, pause/quit-engine, and show-pairing-QR actions.

**Objective:** Tray UX per TRD 2B WS-1 §4.2 / Master §3, talking to the engine over the privileged local control channel.

**Context:** The tray is part of the Desktop UI (Flutter) or a lightweight tray helper. It must reflect engine status (connected/degraded/error) and let the user manage the engine without the main window.

**Technical Requirements:**
- Tray icon with status indication (3 states).
- Menu: Open/Focus UI; Pause Engine; Quit Engine; Show Pairing QR (triggers PROJ-124 token issuance over the control channel).
- Talks to the engine via the loopback privileged control channel (PROJ-144).

**Acceptance Criteria:**
- Tray shows correct status; updates on engine state change.
- Reopen UI works; pause/quit engine works; show-pairing-QR surfaces a QR.
- Closing the main UI window leaves the tray + engine alive.

**Implementation Notes:** Depends on the control channel (PROJ-144) and pairing UI bits (PROJ-180). Desktop-only.

**Testing Requirements:** Widget/integration test for menu actions issuing the right control-channel messages (mock channel); manual visual check per OS.

**Deliverables:** `client/lib/tray/*`, control-channel client calls.

**Dependencies:** PROJ-105, PROJ-180. **Effort:** 3 pts (~4h), medium.

**Agent Instructions:** Implement tray UI + menu → control-channel calls; test action dispatch; manual visual check.

**Expected Files:** `client/lib/tray/*`, tests.

**Validation Commands:**
```bash
cd client && dart analyze && flutter test && flutter build <host-os-desktop>
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## PROJ-190 / 191 / 192 — Native installers (Windows / macOS / Linux)

> Three parallel tickets. Listed once; implement each separately. These are **P2** and land near M7.

**Summary:** Build native installers that drop engine + Desktop UI + bundled first-party plugins and register the service.

**Objective:** A working `.exe`/`.msi` (190), `.dmg`/`.pkg` signed+notarized (191), `.deb`/`.rpm`/`.AppImage` (192).

**Context:** TRD Master §3 packaging table. **AC P1-AC-15.**

**Technical Requirements (per OS):**
- Bundle the engine binary, the Flutter desktop app, and the bundled first-party plugin binaries.
- Register the engine service (invokes PROJ-106/7/8 glue).
- 190: Inno Setup/WiX/MSIX. 191: codesign + notarize → dmg. 192: `flutter_distributor` + native `.deb`/`.rpm`/AppImage.

**Acceptance Criteria (per OS):**
- Installer produces a working install: engine service registered, UI launchable, 1P plugins present.
- **AC P1-AC-15** for that OS.
- Uninstall removes cleanly.

**Implementation Notes:** Depends on service glue (106/7/8) and the assembled UI (PROJ-180). macOS notarization requires signing identity — document the credential/setup steps; do not commit secrets.

**Testing Requirements:** Build the installer in CI (matrix); a clean-VM install/uninstall smoke test where feasible, else documented manual steps.

**Deliverables:** `installers/<os>/*` scripts/configs; CI build job; install/uninstall notes.

**Dependencies:** PROJ-106/107/108 (respectively), PROJ-180. **Effort:** 3 pts each (~4h), medium.

**Agent Instructions:** Author the packaging config; wire the CI build job; run the clean-install smoke test; record artifact paths.

**Expected Files:** `installers/<os>/*`, CI workflow additions.

**Validation Commands:**
```bash
# per OS, e.g. Linux:
make installer-linux   # produces .deb/.rpm/.AppImage
# clean-VM or documented manual install/uninstall smoke test
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

# EPIC-2 — Persistence & Core Data Layer (WS-2)

---

## PROJ-110 — SQLite open + WAL + migration runner

**Summary:** Open the single SQLite store in WAL mode and run forward-only migrations keyed by `meta.schema_version`.

**Objective:** A `persistence` package that opens/creates the DB, enables WAL, and applies pending migrations on startup.

**Context:** TRD 2B §6 / ADR-0014. Single embedded file; durable data only (live state is in-memory). Append-only audit log is created by a migration (PROJ-111).

**Technical Requirements:**
- Open a single SQLite file at a configured path; create if absent.
- Enable WAL; a single writer connection + a read pool (so `var.*` reads don't block).
- Migration runner: ordered SQL migrations under `migrations/`; track applied version in `meta.schema_version`; forward-only; transactional per migration.
- `Open(path) (*DB, error)` and `Migrate(ctx) error`.

**Acceptance Criteria:**
- Opening a fresh path creates the DB + `meta` and applies all migrations.
- Re-open is idempotent (no re-apply).
- WAL confirmed active.
- Unit tests: fresh, re-open, partial-then-resume.

**Implementation Notes:** Use a maintained pure-Go or cgo SQLite driver (decide and pin; note the choice in the ADR log if it has trade-offs). Migrations live as embedded `.sql` files. Put under `engine/core/persistence/`.

**Testing Requirements:** Unit: fresh open+migrate; idempotent re-open; WAL pragma check; migration version bookkeeping.

**Deliverables:** `engine/core/persistence/{db.go,migrate.go}`, `migrations/` dir + runner, tests.

**Dependencies:** none (Ready now). **Effort:** 2 pts (~3h), low-medium.

**Agent Instructions:** Implement open+WAL+runner; add an empty initial migration harness (tables come in PROJ-111); test idempotency.

**Expected Files:** `engine/core/persistence/*`, `engine/core/persistence/migrations/*`, tests.

**Validation Commands:**
```bash
cd engine && go vet ./... && golangci-lint run && go test ./core/persistence/... && go build ./...
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## PROJ-111 — Schema migration 0001 (9 tables)

**Summary:** Create the nine durable tables from TRD 2B §6.

**Objective:** Migration `0001_init.sql` creating `documents, registry_items, variables, workflows, devices, accounts, audit_log, meta` (+ any index) exactly per 2B §6.

**Context:** 2B §6 defines columns. `audit_log` is append-only (enforced at the repo layer, PROJ-114). `accounts` is reserved for Phase 7 but the table exists now.

**Technical Requirements:**
- SQL matching 2B §6 column lists; sensible types; primary keys; `audit_log.id AUTOINCREMENT`.
- Indexes for expected queries (e.g. `audit_log(actor)`, `audit_log(event_type)`, `documents(device_class)`).
- Idempotent via the migration runner (PROJ-110).

**Acceptance Criteria:**
- All 9 tables created with the specified columns.
- A round-trip insert/select test per table passes.
- Re-running the migration is a no-op.

**Implementation Notes:** Keep `*_json` columns as TEXT; validation happens at the repo layer. Don't add Phase-2+ columns.

**Testing Requirements:** Unit/integration: apply migration to a fresh DB; assert schema; round-trip each table.

**Deliverables:** `migrations/0001_init.sql`, schema test.

**Dependencies:** PROJ-110. **Effort:** 2 pts (~3h), low.

**Agent Instructions:** Author the SQL from 2B §6; add indexes; write the schema + round-trip test.

**Expected Files:** `engine/core/persistence/migrations/0001_init.sql`, tests.

**Validation Commands:**
```bash
cd engine && go vet ./... && go test ./core/persistence/... && go build ./...
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## PROJ-112 — Repo layer: documents / registry / variables / workflows

**Summary:** Typed repository accessors (CRUD + transactions) for the document/registry/variable/workflow tables.

**Objective:** Go repos exposing typed read/write with JSON-body validation against the owning subsystem schemas.

**Context:** 2B §6 repo layer. `body_json`/`schema_json` validated against `shared/schemas` (the schemas themselves are placeholders until PROJ-161; validate against whatever exists, fail closed on unknown).

**Technical Requirements:**
- `repo_documents.go`, `repo_registry.go`, `repo_variables.go`, `repo_workflows.go`.
- CRUD + multi-row transactions; typed structs; JSON marshal/unmarshal with validation hook.
- Variables repo supports typed `var.*` get/set with `value_type`.

**Acceptance Criteria:**
- CRUD round-trips for each table with typed structs.
- Transaction rollback on error leaves no partial writes.
- Invalid JSON body rejected with a clear error.
- Unit tests cover CRUD, tx-rollback, invalid-body.

**Implementation Notes:** Keep repos thin; no business logic. Inject the `*DB` from PROJ-110.

**Testing Requirements:** Unit: per-repo CRUD; tx rollback; invalid body.

**Deliverables:** `engine/core/persistence/repo_{documents,registry,variables,workflows}.go`, tests.

**Dependencies:** PROJ-111. **Effort:** 3 pts (~4h), medium.

**Agent Instructions:** Implement the four repos + validation hook; write CRUD/tx/invalid tests.

**Expected Files:** `engine/core/persistence/repo_*.go`, tests.

**Validation Commands:**
```bash
cd engine && go vet ./... && golangci-lint run && go test ./core/persistence/... && go build ./...
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## PROJ-113 — Repo layer: devices / accounts / meta

**Summary:** Typed repos for the trust table (`devices`), the reserved `accounts`, and `meta`.

**Objective:** CRUD for devices (incl. permissions/locator-hints JSON, revoked flag), accounts (reserved), meta key/value.

**Context:** 2B §6; 2E §2.3 defines `devices` semantics. `accounts` is structurally present but unused until P7.

**Technical Requirements:**
- `repo_devices.go`: insert/get/list/update/revoke; `permissions_json`, `locator_hints_json`, `public_key` BLOB, `revoked` flag.
- `repo_accounts.go`: minimal CRUD (reserved).
- `repo_meta.go`: get/set key/value.

**Acceptance Criteria:**
- Device CRUD + revoke round-trip; public-key BLOB preserved.
- Meta get/set works (used by migrations).
- Unit tests for devices (incl. revoke) and meta.

**Implementation Notes:** Do not store secrets here (public keys are fine; private keys live in the secret store, PROJ-121). `last_seen` updatable.

**Testing Requirements:** Unit: device CRUD/revoke, BLOB integrity, meta.

**Deliverables:** `engine/core/persistence/repo_{devices,accounts,meta}.go`, tests.

**Dependencies:** PROJ-111. **Effort:** 2 pts (~3h), low-medium.

**Agent Instructions:** Implement the three repos; test device revoke + BLOB integrity.

**Expected Files:** `engine/core/persistence/repo_{devices,accounts,meta}.go`, tests.

**Validation Commands:**
```bash
cd engine && go vet ./... && go test ./core/persistence/... && go build ./...
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## PROJ-114 — Repo layer: audit_log (append-only)

**Summary:** An insert-only audit repository with query helpers; no update/delete path.

**Objective:** `repo_audit.go` exposing `Append(entry)` and read queries (by actor, event_type, time range) — and *no* mutation API.

**Context:** 2E §6 / ADR-0014. Append-only is a design guarantee; the repo must not offer update/delete. Secrets never written (redaction is the caller's duty; the repo asserts no secret-typed fields).

**Technical Requirements:**
- `Append(ctx, AuditEntry) error` (insert only).
- Query helpers: `ByActor`, `ByEventType`, `ByTimeRange`, with the SQL the indexes (PROJ-111) support.
- Compile-time/runtime guarantee there is no update/delete method.

**Acceptance Criteria:**
- Append inserts; queries return expected rows.
- No update/delete API exists (verified by test/inspection).
- Unit tests: append + each query.

**Implementation Notes:** This repo backs FR-4.4 (every executed/rejected action logged). The actual logging calls come from PROJ-127.

**Testing Requirements:** Unit: append; query-by-actor/type/time; assert no mutation method.

**Deliverables:** `engine/core/persistence/repo_audit.go`, tests.

**Dependencies:** PROJ-111. **Effort:** 2 pts (~3h), low.

**Agent Instructions:** Implement append + queries; ensure no mutation path; test.

**Expected Files:** `engine/core/persistence/repo_audit.go`, tests.

**Validation Commands:**
```bash
cd engine && go vet ./... && go test ./core/persistence/... && go build ./...
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## PROJ-115 — Secret-leak guard test (no secret reaches a repo)

**Summary:** A test/lint that asserts no secret-typed value is ever persisted to SQLite, config, or logs.

**Objective:** A guard proving the 2E §7 rule ("secrets only in the OS secure store").

**Context:** 2E §7 / TB-6. This is a guard, not a feature — it protects the persistence + logging boundary.

**Technical Requirements:**
- Define a `Secret` type (or tag) used wherever credentials/private keys are handled (by PROJ-121/122/124).
- A test that scans repo write paths + log formatters to assert no `Secret`-typed field is serialized to SQLite/config/logs (reflection-based or a vet-style check).
- A redaction helper assertion (logs show `[REDACTED]`).

**Acceptance Criteria:**
- Attempting to persist/log a `Secret` value fails the test.
- Redaction helper produces `[REDACTED]`.
- Guard runs in CI.

**Implementation Notes:** Coordinate the `Secret` type with PROJ-121 (secret store) — define it here or there, but one canonical type. If PROJ-121 lands first, reuse its type.

**Testing Requirements:** Unit: positive (clean write passes) + negative (secret write fails) cases; redaction.

**Deliverables:** `engine/internal/secrets/guard_test.go` (+ the `Secret` type if not owned by PROJ-121), redaction helper.

**Dependencies:** PROJ-112, PROJ-113, PROJ-114. **Effort:** 1 pt (~2h), low.

**Agent Instructions:** Define/locate the `Secret` type; write the guard test + redaction; wire into CI.

**Expected Files:** `engine/internal/secrets/*`, test.

**Validation Commands:**
```bash
cd engine && go vet ./... && go test ./... && go build ./...
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

# EPIC-3 — Security & Identity (WS-3)

---

## PROJ-120 — Engine identity (Ed25519 keypair + UUID)

**Summary:** Generate the engine's long-lived Ed25519 keypair + 128-bit UUID at first launch, account-independent.

**Objective:** An `identity` module that creates-on-first-launch and loads-thereafter the engine identity; private key in the secret store, public/UUID/label in SQLite/secure prefs.

**Context:** 2E §2 / ADR-0008 / ADR-0016. Identity exists from first launch with NO account. Loss of private key = identity reset (no escrow).

**Technical Requirements:**
- On first launch: generate Ed25519 keypair + random 128-bit UUID; derive X25519 key for ECDH (used by PROJ-122).
- Store private key via the secret store (PROJ-121); store public key + UUID + label via `repo_devices`/meta or secure prefs.
- `LoadOrCreate() (Identity, error)`; idempotent on subsequent launches.

**Acceptance Criteria:**
- First launch creates identity; second launch loads the same identity.
- Private key never written to SQLite/config/logs (PROJ-115 guard passes).
- UUID stable across restarts; identity works with no account present (**AC: account-independent**).
- Unit tests: create, load, stability.

**Implementation Notes:** Depends on the secret store (PROJ-121) for the private key. If PROJ-121 isn't done, this is BLOCKED — don't fake key storage.

**Testing Requirements:** Unit: create-then-load equality; no-account path; guard integration.

**Deliverables:** `engine/core/security/identity.go`, tests.

**Dependencies:** PROJ-121 (for private-key storage). *(Note: listed Ready in the board because it can begin against a stubbed SecretStore interface; integration completes once PROJ-121 lands. Implement the interface use first, then wire the real store.)* **Effort:** 2 pts (~3h), low-medium.

**Agent Instructions:** Implement keypair+UUID gen against the `SecretStore` interface; LoadOrCreate; tests; confirm guard passes.

**Expected Files:** `engine/core/security/identity.go`, tests.

**Validation Commands:**
```bash
cd engine && go vet ./... && golangci-lint run && go test ./core/security/... && go build ./...
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## PROJ-121 — Per-OS secret store abstraction + implementations

**Summary:** A `SecretStore` interface with Windows Credential Manager / macOS Keychain / Linux Secret Service implementations + documented encrypted-file fallback.

**Objective:** Secure at-rest storage for private keys and (later) integration credentials, per 2E §7.

**Context:** 2E §7. Never plaintext. Headless-Linux fallback = encrypted file keyed by a machine-bound secret, with an explicit security caveat (no silent plaintext).

**Technical Requirements:**
- `SecretStore` interface: `Set(key, Secret) error`, `Get(key) (Secret, error)`, `Delete(key) error`.
- Implementations: Windows Credential Manager (DPAPI-backed); macOS Keychain; Linux Secret Service (libsecret); fallback encrypted file for no-keyring Linux.
- The canonical `Secret` type (coordinate with PROJ-115).

**Acceptance Criteria:**
- Set/Get/Delete round-trip on each available OS backend.
- Fallback path works on a no-keyring environment with the documented caveat.
- No secret value appears in logs (redacted).
- Unit/integration tests per backend (CI matrix where possible; documented manual where not).

**Implementation Notes:** Behind one interface (PAL-style; note it's a host concern, not a downloadable plugin). Provider-chain-ish selection: real keyring → encrypted-file fallback with warning.

**Testing Requirements:** Unit: interface contract w/ a memory backend; integration: each OS backend round-trip; fallback path.

**Deliverables:** `engine/core/security/secretstore/{secretstore.go,windows.go,darwin.go,linux.go,fallback.go}`, tests.

**Dependencies:** none (Ready now). **Effort:** 3 pts (~4h), medium.

**Agent Instructions:** Define interface + `Secret`; implement each backend + fallback; test round-trips; confirm redaction.

**Expected Files:** `engine/core/security/secretstore/*`, tests.

**Validation Commands:**
```bash
cd engine && go vet ./... && golangci-lint run && go test ./core/security/secretstore/... && go build ./...
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## PROJ-122 — Crypto suite (X25519 ECDH + HKDF + AEAD)

**Summary:** The session crypto primitives: forward-secret key agreement and authenticated encryption.

**Objective:** A `crypto` module providing X25519 ECDH (long-term + ephemeral), HKDF key derivation, and an AEAD (e.g. ChaCha20-Poly1305) for record encryption — the *how* behind 2E §4 / 2A §5.3.

**Context:** 2E §4 / 2A §5.3 / ADR-0009. Must be forward-secret. Use vetted libraries; do not hand-roll primitives.

**Technical Requirements:**
- Key agreement: X25519 ECDH combining paired long-term keys + per-session ephemerals → shared secret → HKDF → per-direction AEAD keys.
- Record encryption: AEAD with per-direction nonce counters.
- Ed25519 sign/verify helpers for handshake nonces.
- Known-answer test (KAT) vectors for each primitive.

**Acceptance Criteria:**
- ECDH + HKDF + AEAD round-trip; tamper → AEAD auth failure.
- Two sessions derive distinct keys (forward secrecy via ephemerals).
- KAT vectors pass.
- Unit tests: round-trip, tamper-detect, distinct-session-keys.

**Implementation Notes:** Use `golang.org/x/crypto` (curve25519, chacha20poly1305, hkdf) + stdlib ed25519. Wrap in a small API so the wire layer (PROJ-141/142) just calls encrypt/decrypt.

**Testing Requirements:** Unit: KATs; round-trip; tamper; nonce-reuse guard.

**Deliverables:** `engine/core/security/crypto/{ecdh.go,kdf.go,aead.go,sign.go}`, tests + vectors.

**Dependencies:** PROJ-120. **Effort:** 3 pts (~4h), medium-high.

**Agent Instructions:** Implement primitives via vetted libs; add KATs; test round-trip/tamper/distinct-keys.

**Expected Files:** `engine/core/security/crypto/*`, tests.

**Validation Commands:**
```bash
cd engine && go vet ./... && golangci-lint run && go test ./core/security/crypto/... && go build ./...
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## PROJ-123 — Pairing handshake: server (engine) state machine

**Summary:** The engine-side pairing handshake: ClientHello → ServerHello → KeyConfirm → PairResult, writing a trust record on success.

**Objective:** Implement 2E §3.2 server side, rejecting bad tokens, wrong fingerprints, and revoked devices.

**Context:** 2E §3 / ADR-0008/0009. Proves device key possession, verifies engine fingerprint (client side), authorizes via token/PIN. On success writes `devices` trust record and derives session keys (PROJ-122).

**Technical Requirements:**
- State machine handling the four messages with nonces + Ed25519 signatures over nonces.
- Token validation (single-use, unexpired — token issuance is PROJ-124) OR local PIN approval.
- Reject: bad/expired token, signature mismatch, revoked/absent device.
- On success: write trust record (`repo_devices`), derive session keys (PROJ-122), hand off to session (PROJ-142).

**Acceptance Criteria:**
- Happy path completes and writes a trust record.
- Bad token, wrong signature, and revoked device are each rejected (distinct, tested).
- **AC P1-AC-02** (QR pair w/ token+fingerprint; rogue/wrong rejected) supported.
- Unit tests for happy path + each rejection.

**Implementation Notes:** Client-side handshake + QR scan is PROJ-180. Token issuance is PROJ-124. This ticket is the engine half.

**Testing Requirements:** Unit: happy path; bad-token; bad-signature; revoked-device; replay (nonce reuse rejected).

**Deliverables:** `engine/core/security/pairing.go`, tests.

**Dependencies:** PROJ-122, PROJ-113. **Effort:** 3 pts (~4h), medium-high.

**Agent Instructions:** Implement the server state machine + rejections; test happy + all rejection paths + replay.

**Expected Files:** `engine/core/security/pairing.go`, tests.

**Validation Commands:**
```bash
cd engine && go vet ./... && golangci-lint run && go test ./core/security/... && go build ./...
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## PROJ-124 — Pairing token issuance (privileged local channel)

**Summary:** Issue single-use, time-limited pairing tokens — only over the privileged loopback control channel.

**Objective:** Token mint/validate, surfaced as the QR payload, issuable only locally (a LAN client can never mint a token).

**Context:** 2E §3.1 / ADR-0005. Tokens + PINs come only via the privileged control channel (PROJ-144). Single-use, time-limited.

**Technical Requirements:**
- `IssueToken() (Token, QRPayload)` callable only from the control channel handler.
- Token: random, single-use, TTL (configurable, short).
- `ValidateToken(t)` used by PROJ-123; consumes on use.
- QR payload encodes candidate addresses + port + token + engine fingerprint (2E §3.1).

**Acceptance Criteria:**
- Token issuance works only via the privileged channel; a non-loopback request is refused.
- Token is single-use (second use rejected) and expires.
- QR payload contains the required fields.
- Unit tests: issue/validate/consume/expire; non-privileged-issue refused.

**Implementation Notes:** Depends on the control channel (PROJ-144) to enforce "privileged only." If PROJ-144 isn't done, gate behind the interface and complete on integration.

**Testing Requirements:** Unit: single-use, expiry, privileged-only, QR fields.

**Deliverables:** `engine/core/security/pairing_token.go`, QR payload encoder, tests.

**Dependencies:** PROJ-123, PROJ-150 *(control-channel dep is PROJ-144; tracked via the transport epic — begin against the interface)*. **Effort:** 2 pts (~3h), low-medium.

**Agent Instructions:** Implement token mint/validate/consume + QR payload; enforce privileged-only; test.

**Expected Files:** `engine/core/security/pairing_token.go`, tests.

**Validation Commands:**
```bash
cd engine && go vet ./... && go test ./core/security/... && go build ./...
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## PROJ-125 — Permission model + `authorize()`

**Summary:** The per-device permission model and the pure `authorize(session, action)` function enforced on every interaction.

**Objective:** Implement 2E §5 with the 5-step check order; exhaustively unit-tested.

**Context:** 2E §5.2 / FR-4.1/4.2. Enforced engine-side on every interaction event, never trusted to the client/layout. **AC P1-AC-07.**

**Technical Requirements:**
- Permission struct: `{allowPowerActions, allowedCategories[], deniedActions[], allowEditTrigger}` (per device, from `repo_devices`).
- `authorize(session, actionDescriptor) → allow | reason`: (1) authenticated & not revoked; (2) category allowed; (3) not in deniedActions; (4) destructive & !allowPowerActions → reject; (5) plugin perms (deferred to PROJ-133 boundary) → returns allow.
- Pure function (no side effects); caller audits (PROJ-127).

**Acceptance Criteria:**
- Each of the 5 steps rejects in its case; allow only when all pass.
- A destructive action is denied to a device without `allowPowerActions` (**AC P1-AC-07**).
- Exhaustive truth-table unit test.

**Implementation Notes:** Action descriptors (category/destructive/elevated) come from the registry (PROJ-161); use a minimal descriptor interface so this can be tested before PROJ-161 lands.

**Testing Requirements:** Unit: exhaustive matrix over the 5 steps; revoked; destructive-without-permission.

**Deliverables:** `engine/core/security/permissions.go`, tests.

**Dependencies:** PROJ-113. **Effort:** 3 pts (~4h), medium.

**Agent Instructions:** Implement the model + `authorize()`; write the exhaustive matrix test; confirm P1-AC-07 case.

**Expected Files:** `engine/core/security/permissions.go`, tests.

**Validation Commands:**
```bash
cd engine && go vet ./... && golangci-lint run && go test ./core/security/... && go build ./...
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## PROJ-126 — Device revocation

**Summary:** Revoke a device so its key is rejected at next handshake and any live session is torn down.

**Objective:** `Revoke(uuid)` setting `revoked=1` and severing live sessions immediately.

**Context:** 2E §5.3 / FR-4.3. Instant; no key rotation needed (the device's key simply becomes untrusted).

**Technical Requirements:**
- `Revoke(ctx, uuid)`: set `revoked=1` (`repo_devices`); signal the session manager to tear down any live session for that UUID.
- Handshake (PROJ-123) already rejects revoked devices; verify the integration.

**Acceptance Criteria:**
- Revoked device's live session is torn down promptly.
- Revoked device is rejected at next handshake.
- Unit/integration test: revoke-with-live-session; revoke-then-reconnect-refused.

**Implementation Notes:** Needs the session manager hook (PROJ-150/163). Audit the revoke (PROJ-127).

**Testing Requirements:** Integration: revoke tears down session; reconnect refused.

**Deliverables:** `engine/core/security/revoke.go` (or in permissions), tests.

**Dependencies:** PROJ-123, PROJ-125. **Effort:** 1 pt (~2h), low.

**Agent Instructions:** Implement revoke + session teardown signal; test both paths.

**Expected Files:** `engine/core/security/*`, tests.

**Validation Commands:**
```bash
cd engine && go vet ./... && go test ./core/security/... && go build ./...
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## PROJ-127 — Audit semantics (append on every action/event)

**Summary:** Wire append-only audit logging into the action path: every executed and rejected action + pairing/revoke/session/flow events.

**Objective:** Implement 2E §6 semantics over the audit repo (PROJ-114): actor, event_type, resource, timestamp; secrets redacted.

**Context:** 2E §6 / FR-4.4 / ADR-0014. The repo is PROJ-114; this ticket is the *calls* + event taxonomy + redaction.

**Technical Requirements:**
- An `audit.Append` wrapper used by: action execute/reject (via `authorize` + executor), pairing, revoke, session open/close, flow run/fail.
- Event taxonomy per 2E §6 (`action.executed|rejected`, `device.paired|revoked`, `flow.run|failed`, `permission.denied`, `session.opened|closed`).
- Redaction: secrets/tokens never written (`[REDACTED]`); coordinate with PROJ-115 guard.

**Acceptance Criteria:**
- Every executed and rejected action produces an audit row with correct actor/type/resource/ts (**FR-4.4**).
- Secrets never appear in audit rows (guard passes).
- Unit/integration: action→audit; reject→audit; redaction.

**Implementation Notes:** Hook points: the interaction-handling path (transport→authorize→execute) and the security/flow modules. Keep `payload_json` minimal and secret-free.

**Testing Requirements:** Unit/integration: executed+rejected audit rows; redaction; taxonomy coverage.

**Deliverables:** `engine/core/security/audit.go`, integration into the action path, tests.

**Dependencies:** PROJ-114, PROJ-125. **Effort:** 2 pts (~3h), medium.

**Agent Instructions:** Implement the audit wrapper + taxonomy + redaction; wire into authorize/execute; test executed/rejected/redaction.

**Expected Files:** `engine/core/security/audit.go`, tests.

**Validation Commands:**
```bash
cd engine && go vet ./... && golangci-lint run && go test ./core/security/... && go build ./...
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## Batch 1 — dependency-correct execution order (within these three epics)

```
Ready now:        PROJ-101  PROJ-102  PROJ-110  PROJ-120*  PROJ-121
                     │         │         │          │         │
PROJ-101 ─► PROJ-103 ─► PROJ-104 ─► PROJ-105 (also needs PROJ-110, PROJ-150[EPIC-4])
PROJ-110 ─► PROJ-111 ─► PROJ-112, PROJ-113, PROJ-114 ─► PROJ-115
PROJ-121 ─► PROJ-120 ─► PROJ-122 ─► PROJ-123 ─► PROJ-124
PROJ-113 ─► PROJ-125 ─► PROJ-126, PROJ-127 (127 also needs PROJ-114)
PROJ-105 ─► PROJ-106/107/108 ─► PROJ-190/191/192 ; PROJ-109 (needs PROJ-180[EPIC-8])
```
*PROJ-120 is listed Ready because it can begin against the `SecretStore` interface; it integration-completes once PROJ-121 lands.

**Cross-epic blockers to note:** PROJ-105 needs PROJ-150 (transport, EPIC-4); PROJ-124 needs the control channel PROJ-144 (EPIC-4); PROJ-109 needs PROJ-180 (client, EPIC-8). These are called out so the agent doesn't pull them prematurely.

---

*End of Batch 1 (EPIC-1/2/3 full tickets). Next batches: EPIC-4 (Transport) + EPIC-6 (State/Registries); then EPIC-5 (Plugins) + EPIC-8 (Client); then EPIC-7 (Flow) + EPIC-9 (Designer) + EPIC-10 (Hardening). Then: Dependency Graph → Execution Plan → Progress Dashboard → Claude Agent Instructions.*
