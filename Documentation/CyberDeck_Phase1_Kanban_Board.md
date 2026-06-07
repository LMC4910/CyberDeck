# CyberDeck — Phase 1 (Foundation) · Master Kanban Board

**Execution-system Document 1 of N · Master Kanban Board**
Version 0.1 (Draft) · June 2026 · Codebase ID: `com.shishir.cyberdeck`
Default assignee: **Claude** (autonomous senior-engineer agent)

> Single-pane index of every Phase-1 ticket. Tickets are derived 1:1 from the Phase-1 Deep Dive workstreams (WS-1…WS-9), milestones (M1…M7), and acceptance criteria (P1-AC-01…16). The full per-ticket breakdown (objective, technical requirements, acceptance criteria, agent instructions, validation commands) lands in the **Jira Ticket Breakdown** document that follows this board; this board is the navigation + status layer over it.
>
> **Scope: Phase 1 only.** Phases 2–8 are out of scope here — every one of their tickets would sit in `Backlog` with unmet dependencies on Phase 1, so they are deferred to their own boards when Phase 1 nears completion.

---

## 0. How to read this board

- **Columns** follow the required Kanban flow: `Backlog → Ready → In Progress → Code Review → Testing → Blocked → Done`.
- A ticket is **Ready** only when *all* its dependencies are `Done`. The agent (§ Claude Operating Rules, in the Agent Instructions doc) may only pull from **Ready**.
- At project start, tickets with **no dependencies** begin in `Ready`; everything else begins in `Backlog` and is promoted to `Ready` automatically as its dependencies complete.
- **Ticket ID scheme:** `PROJ-1xx` where the hundreds digit groups by workstream is *not* used (dependencies cross workstreams); instead IDs are assigned in critical-path order so a human scanning ascending IDs sees a roughly valid execution order. The authoritative order is the **Dependency Graph** doc, not the ID number.
- **Priority:** P0 = blocks the critical path / nothing proceeds without it · P1 = required for the phase's Definition of Done · P2 = required but parallelizable / lower-risk · P3 = polish within the phase.
- **Story points:** Fibonacci (1/2/3/5/8). Per the granularity rule, **1 pt ≈ 2h, 2 pt ≈ 3h, 3 pt ≈ 4h.** Anything that estimated >3 pt was split; no ticket exceeds ~4h of implementation.

---

## 1. Board snapshot (current state)

> Initial state — nothing started. As the agent works, it moves tickets across columns and updates the Progress Dashboard.

### 🟦 Backlog (dependencies not yet met) — 38 tickets
All tickets except the seven foundation tickets below. Promoted to **Ready** as dependencies clear.

### 🟩 Ready (dependencies met, pickable now) — 7 tickets
| ID | Title | Pri | Pts |
|----|-------|-----|-----|
| PROJ-101 | Monorepo scaffold + tooling (Go engine, Flutter client, shared schemas) | P0 | 2 |
| PROJ-102 | CI pipeline: lint / typecheck / test / build gates | P0 | 2 |
| PROJ-110 | SQLite open + WAL + migration runner | P0 | 2 |
| PROJ-120 | Engine identity: Ed25519 keypair + UUID generation | P0 | 2 |
| PROJ-121 | Per-OS secret store abstraction + impls | P0 | 3 |
| PROJ-140 | Transport endpoint abstraction + ConnectionManager interfaces | P0 | 2 |
| PROJ-160 | Typed state model + state store core | P0 | 3 |

### 🟨 In Progress — 0
### 🟧 Code Review — 0
### 🟪 Testing — 0
### 🟥 Blocked — 0
### ✅ Done — 0

---

## 2. Full ticket register (single-pane view)

> Columns: ID · Title · Priority · Points · Dependencies · Status · Assignee · Definition of Done (DoD).
> Status legend: `BACKLOG` `READY` `IN_PROGRESS` `REVIEW` `TESTING` `BLOCKED` `DONE`.
> Grouped by workstream for readability; **execution order is the Dependency Graph, not these groups**.

### WS-1 — Engine bootstrap, service lifecycle & packaging

| ID | Title | Pri | Pts | Dependencies | Status | Assignee | Definition of Done |
|----|-------|-----|-----|--------------|--------|----------|--------------------|
| PROJ-101 | Monorepo scaffold + tooling | P0 | 2 | — | READY | Claude | Repo tree per TRD Master §7.1; `go build`, `flutter build` stubs compile; CI green |
| PROJ-102 | CI pipeline (lint/typecheck/test/build) | P0 | 2 | — | READY | Claude | All four gates run on push; failing gate blocks merge |
| PROJ-103 | Config loader (`config.json` schema + defaults) | P0 | 2 | PROJ-101 | BACKLOG | Claude | Loads/validates config; defaults applied; bad config → safe defaults + warning |
| PROJ-104 | Engine entrypoint (service vs console mode) | P0 | 2 | PROJ-101, PROJ-103 | BACKLOG | Claude | `--service`/`--console` parsed; boot sequence stub runs to READY |
| PROJ-105 | Boot sequence + graceful shutdown + single-instance guard | P0 | 3 | PROJ-104, PROJ-110, PROJ-150 | BACKLOG | Claude | Boots in documented order; shutdown flushes+stops cleanly; 2nd instance refused |
| PROJ-106 | OS service registration — Windows Service | P1 | 3 | PROJ-105 | BACKLOG | Claude | Installs/starts on boot; survives UI close; AC P1-AC-01 (Win) |
| PROJ-107 | OS service registration — macOS launchd | P1 | 3 | PROJ-105 | BACKLOG | Claude | LaunchAgent starts on boot; survives UI close; AC P1-AC-01 (mac) |
| PROJ-108 | OS service registration — Linux systemd | P1 | 3 | PROJ-105 | BACKLOG | Claude | systemd user service starts on boot; survives UI close; AC P1-AC-01 (Linux) |
| PROJ-109 | System-tray presence (status/reopen/pause-quit/QR) | P1 | 3 | PROJ-105, PROJ-180 | BACKLOG | Claude | Tray shows engine status; reopen UI; pause/quit engine; show-pairing-QR entry |
| PROJ-190 | Native installer — Windows (.exe/.msi) | P2 | 3 | PROJ-106, PROJ-180 | BACKLOG | Claude | Installer drops engine+UI+1P plugins; service registered; AC P1-AC-15 (Win) |
| PROJ-191 | Native installer — macOS (.dmg/.pkg, sign+notarize) | P2 | 3 | PROJ-107, PROJ-180 | BACKLOG | Claude | Signed/notarized; installs service+UI; AC P1-AC-15 (mac) |
| PROJ-192 | Native installer — Linux (.deb/.rpm/.AppImage) | P2 | 3 | PROJ-108, PROJ-180 | BACKLOG | Claude | flutter_distributor + packaging; AC P1-AC-15 (Linux) |

### WS-2 — Persistence & core data layer

| ID | Title | Pri | Pts | Dependencies | Status | Assignee | Definition of Done |
|----|-------|-----|-----|--------------|--------|----------|--------------------|
| PROJ-110 | SQLite open + WAL + migration runner | P0 | 2 | — | READY | Claude | Opens single file; WAL on; `meta.schema_version` migrations forward-only |
| PROJ-111 | Schema migration 0001 (9 tables) | P0 | 2 | PROJ-110 | BACKLOG | Claude | All 9 tables per 2B §6 created; idempotent; round-trip test |
| PROJ-112 | Repo layer: documents/registry/variables/workflows | P0 | 3 | PROJ-111 | BACKLOG | Claude | Typed CRUD + tx; JSON bodies validated; unit tests |
| PROJ-113 | Repo layer: devices/accounts/meta | P0 | 2 | PROJ-111 | BACKLOG | Claude | Typed CRUD; tx; unit tests |
| PROJ-114 | Repo layer: audit_log (append-only) | P0 | 2 | PROJ-111 | BACKLOG | Claude | Insert-only API; no update/delete path; query helpers |
| PROJ-115 | Secret-leak guard test (no secret reaches a repo) | P1 | 1 | PROJ-112, PROJ-113, PROJ-114 | BACKLOG | Claude | Static/test assertion: no secret-typed field persisted to SQLite |

### WS-3 — Security & identity

| ID | Title | Pri | Pts | Dependencies | Status | Assignee | Definition of Done |
|----|-------|-----|-----|--------------|--------|----------|--------------------|
| PROJ-120 | Engine identity (Ed25519 keypair + UUID) | P0 | 2 | — | READY | Claude | Generated once at first launch; account-independent; AC P1-AC (identity) |
| PROJ-121 | Per-OS secret store abstraction + impls | P0 | 3 | — | READY | Claude | `SecretStore` iface + Win Cred Mgr/Keychain/Secret Service; encrypted-file fallback |
| PROJ-122 | Crypto suite (X25519 ECDH + HKDF + AEAD) | P0 | 3 | PROJ-120 | BACKLOG | Claude | Vetted libs; forward-secret session keys; KAT vectors pass |
| PROJ-123 | Pairing handshake — server (engine) state machine | P0 | 3 | PROJ-122, PROJ-113 | BACKLOG | Claude | ClientHello→ServerHello→KeyConfirm→PairResult; bad token/fingerprint rejected |
| PROJ-124 | Pairing token issuance (privileged local channel) | P0 | 2 | PROJ-123, PROJ-150 | BACKLOG | Claude | Single-use, time-limited token; issuable only over loopback control channel |
| PROJ-125 | Permission model + `authorize()` | P0 | 3 | PROJ-113 | BACKLOG | Claude | 5-step order (2E §5.2); exhaustive matrix unit test; AC P1-AC-07 |
| PROJ-126 | Device revocation | P1 | 1 | PROJ-123, PROJ-125 | BACKLOG | Claude | `revoked=1` rejects at handshake + tears down live session |
| PROJ-127 | Audit semantics (append on every action/event) | P0 | 2 | PROJ-114, PROJ-125 | BACKLOG | Claude | Executed+rejected actions logged w/ actor/type/resource/ts; secrets redacted |

### WS-4 — Transport & connectivity

| ID | Title | Pri | Pts | Dependencies | Status | Assignee | Definition of Done |
|----|-------|-----|-----|--------------|--------|----------|--------------------|
| PROJ-140 | Endpoint abstraction + ConnectionManager | P0 | 2 | — | READY | Claude | `TransportEndpoint`/`ConnectionManager` ifaces; LAN endpoint only; no `if remote` |
| PROJ-141 | Framing + Serializer seam (length-prefix + JSON) | P0 | 2 | PROJ-140 | BACKLOG | Claude | Length-prefixed frames; JSON via Serializer abstraction; envelope per Master §6.3 |
| PROJ-142 | Session (reader/writer/demux) over encrypted conn | P0 | 3 | PROJ-141, PROJ-122 | BACKLOG | Claude | Per-session goroutines; AEAD-encrypted frames; clean teardown on drop |
| PROJ-143 | Three channels (State/Layout/Preview) + backpressure | P0 | 3 | PROJ-142 | BACKLOG | Claude | State coalesces; Layout ordered/lossless; Preview drop-on-overflow |
| PROJ-144 | Loopback privileged control channel | P0 | 2 | PROJ-142 | BACKLOG | Claude | Loopback-only bind; not network-routable; carries lifecycle/pairing/audit |
| PROJ-145 | Heartbeat / keepalive (sleep-tolerant) | P1 | 2 | PROJ-142 | BACKLOG | Claude | Bidirectional heartbeat; grace bound across OS sleep; drop detection |
| PROJ-146 | Reconnect (backoff → mDNS → scan) | P1 | 3 | PROJ-145, PROJ-147 | BACKLOG | Claude | Reconnect <5s on LAN; AC P1-AC-12 |
| PROJ-147 | Discovery — mDNS advertise/browse | P0 | 3 | PROJ-141, PROJ-120 | BACKLOG | Claude | Advertises `_cyberdeck._tcp` w/ name/uuid/ver/fp; client browses |
| PROJ-148 | Discovery — manual + bounded active scan | P1 | 2 | PROJ-147 | BACKLOG | Claude | Manual addr+PIN; UUID-confirmed subnet scan; rate-limited |
| PROJ-149 | Versioned resync on gap | P1 | 2 | PROJ-143 | BACKLOG | Claude | seq gap → full doc resync request; AC (resync) |
| PROJ-150 | Multi-session fan-out + subscription filtering | P0 | 3 | PROJ-143, PROJ-160 | BACKLOG | Claude | Per-session isolation; delta filtered by subscription; AC P1-AC-11; ≥8 sessions |

### WS-5 — Plugin host & first-party capability plugins

| ID | Title | Pri | Pts | Dependencies | Status | Assignee | Definition of Done |
|----|-------|-----|-----|--------------|--------|----------|--------------------|
| PROJ-130 | Plugin host — launch/supervise/IPC | P0 | 3 | PROJ-160, PROJ-103 | BACKLOG | Claude | Spawns plugin process; JSON-envelope IPC; heartbeat; logs captured |
| PROJ-131 | Plugin host — restart/fault policy | P0 | 2 | PROJ-130 | BACKLOG | Claude | Crash→restart w/ backoff; repeated→faulted; engine survives; AC P1-AC-13 |
| PROJ-132 | Plugin manifest validation + registry merge | P0 | 2 | PROJ-130, PROJ-161 | BACKLOG | Claude | Manifest schema check; apiVersion gate; contributions merged; collisions rejected |
| PROJ-133 | Permission enforcement at IPC boundary | P0 | 2 | PROJ-132, PROJ-125 | BACKLOG | Claude | Plugin only publishes declared states / accesses declared resources |
| PROJ-170 | PAL capability interfaces + provider-chain framework | P0 | 3 | PROJ-160 | BACKLOG | Claude | `(value,ok)` ifaces; probe→bind→degrade; unavailable is graceful; AC P1-AC-05 |
| PROJ-171 | 1P plugin: telemetry (CPU/RAM/net/disk/uptime) | P0 | 3 | PROJ-170, PROJ-132 | BACKLOG | Claude | gopsutil provider; cadences per Doc 0 §14; threshold events; AC P1-AC-04 |
| PROJ-172 | 1P plugin: GPU telemetry provider chain | P1 | 3 | PROJ-171 | BACKLOG | Claude | GPUtil→AMD/OHM→vendor→unavailable; degrades clean on unsupported |
| PROJ-173 | 1P plugin: power (shutdown/restart/sleep/etc.) | P0 | 3 | PROJ-170, PROJ-132 | BACKLOG | Claude | All 6 power actions; destructive flags; unsaved-work warning; AC P1-AC-06 |
| PROJ-174 | 1P plugin: volume (system master) | P1 | 2 | PROJ-170, PROJ-132 | BACKLOG | Claude | Get/set system master volume per OS |
| PROJ-175 | 1P plugin: launchers + system-tool launch | P1 | 2 | PROJ-132 | BACKLOG | Claude | Steam/Epic/Chrome/Discord/custom + Task Mgr etc.; toast on not-found |
| PROJ-176 | 1P plugin: notification count | P2 | 2 | PROJ-170, PROJ-132 | BACKLOG | Claude | Unread count from OS action center; AC P1-AC-08(badge) |

### WS-6 — State store, registries & event bus

| ID | Title | Pri | Pts | Dependencies | Status | Assignee | Definition of Done |
|----|-------|-----|-----|--------------|--------|----------|--------------------|
| PROJ-160 | Typed state model + state store core | P0 | 3 | — | READY | Claude | Typed states; delta suppression; ring buffers in-memory; AC P1-AC (typed) |
| PROJ-161 | Registries: action/widget/flow-node (schema-driven) | P0 | 3 | PROJ-160, PROJ-112 | BACKLOG | Claude | Schema-declared; merge/validate/query; collision reject; AC P1-AC-10 backing |
| PROJ-162 | Event bus | P0 | 2 | PROJ-160 | BACKLOG | Claude | Topics per 2B §4; ordered per-topic; bounded queue; flow/audit subscribe |
| PROJ-163 | Session/profile model + activation-rule field+hook | P0 | 3 | PROJ-160, PROJ-113 | BACKLOG | Claude | Per-device session; profile w/ activation-rule field + inert eval hook |
| PROJ-164 | Variables (`var.*`) typed + durable + bindable | P1 | 2 | PROJ-160, PROJ-112 | BACKLOG | Claude | `var.*` backed by SQLite; bindable as states; fans out on write |

### WS-7 — Flow engine core

| ID | Title | Pri | Pts | Dependencies | Status | Assignee | Definition of Done |
|----|-------|-----|-----|--------------|--------|----------|--------------------|
| PROJ-200 | Flow model + document persistence | P1 | 2 | PROJ-112, PROJ-161 | BACKLOG | Claude | Flow graph schema; versioned; stored in `workflows` |
| PROJ-201 | Expression language (lexer/parser/AST/eval) | P1 | 3 | PROJ-160 | BACKLOG | Claude | Sandboxed; typed token resolution; no eval/IO; unavailable→safe; unit tests |
| PROJ-202 | Flow executor + run context | P1 | 3 | PROJ-200, PROJ-201, PROJ-162 | BACKLOG | Claude | Step loop; async; cancellable; node-failure safe; AC P1-AC-08 |
| PROJ-203 | Core nodes (action/if/setVar/wait/loop/navigate/random/subflow/stop) | P1 | 3 | PROJ-202, PROJ-125 | BACKLOG | Claude | All 9 nodes; loop iteration-cap; action node respects permissions+audit |
| PROJ-204 | Triggers (manual/event/stateChange, schedule reserved) | P1 | 2 | PROJ-202, PROJ-162 | BACKLOG | Claude | Manual/event/stateChange arm+fire; edge-trigger+debounce; schedule field reserved |

### WS-8 — Client runtime & widget vocabulary

| ID | Title | Pri | Pts | Dependencies | Status | Assignee | Definition of Done |
|----|-------|-----|-----|--------------|--------|----------|--------------------|
| PROJ-180 | Client connection manager + pairing UI (QR scan) | P0 | 3 | PROJ-147, PROJ-123 | BACKLOG | Claude | Discover/pair/reconnect/demux; QR scan + fingerprint verify; AC P1-AC-02/03 |
| PROJ-181 | Renderer registry + layout interpreter | P0 | 3 | PROJ-180, PROJ-161 | BACKLOG | Claude | widgetType→builder; build tree from doc; targeted repaint; unknown→placeholder |
| PROJ-182 | Widget: button + toggle | P0 | 2 | PROJ-181 | BACKLOG | Claude | Render+gesture; bound state; pressed-state ≤100ms |
| PROJ-183 | Widget: slider + label + image | P1 | 2 | PROJ-181 | BACKLOG | Claude | Render+bindings; dragValue slot for slider |
| PROJ-184 | Widget: circular gauge + linear gauge/bar | P0 | 3 | PROJ-181 | BACKLOG | Claude | Bind scalar; valueRules client-side; AC P1-AC-04 render |
| PROJ-185 | Widget: sparkline (series state) | P1 | 2 | PROJ-181, PROJ-160 | BACKLOG | Claude | Renders ring-buffer series; appends on delta; 60 FPS |
| PROJ-186 | Widget: media card (basic) + page-nav | P1 | 2 | PROJ-181 | BACKLOG | Claude | Basic now-playing + page/profile nav widget |
| PROJ-187 | Gesture capture (all slots) + 2-tap confirm | P0 | 3 | PROJ-181 | BACKLOG | Claude | tap/double/long/down/up/drag/swipe → slot events; destructive 2-tap; AC P1-AC-06 |
| PROJ-188 | Degradation UI (dimmed last value + connection badge) | P1 | 2 | PROJ-180, PROJ-181 | BACKLOG | Claude | Disconnect→dimmed last value + badge; `--` for unavailable; AC P1-AC-12 |
| PROJ-189 | Theme tokens (neon palette/typography/spacing) + a11y | P1 | 2 | PROJ-181 | BACKLOG | Claude | Design tokens applied; WCAG AA 4.5:1; ≥48×48 targets; AC P1-AC-16 |

### WS-9 — Designer (desktop)

| ID | Title | Pri | Pts | Dependencies | Status | Assignee | Definition of Done |
|----|-------|-----|-----|--------------|--------|----------|--------------------|
| PROJ-210 | Designer canvas (renders as target device class) | P0 | 3 | PROJ-181, PROJ-163 | BACKLOG | Claude | WYSIWYG grid; renders via same registry; snap-to-grid; no overlap |
| PROJ-211 | Op model + op-log apply/version | P0 | 3 | PROJ-210, PROJ-112 | BACKLOG | Claude | Versioned ops; authoritative doc; apply/diff; persisted |
| PROJ-212 | Op-log broadcast + live device reflection | P0 | 3 | PROJ-211, PROJ-150 | BACKLOG | Claude | Op→subscribed sessions→targeted repaint <200ms; AC P1-AC-09 |
| PROJ-213 | Drag-drop placement + move/resize w/ preview ghosts | P0 | 3 | PROJ-211, PROJ-143 | BACKLOG | Claude | AddWidget/Move/Resize ops; throttled Preview ghosts; commit-on-drop |
| PROJ-214 | Schema-driven inspector (auto-generated param editors) | P0 | 3 | PROJ-211, PROJ-161 | BACKLOG | Claude | int→slider/choice→dropdown/entity→picker; zero per-action UI; AC P1-AC-10 |
| PROJ-215 | Undo/redo (op inverses) | P1 | 2 | PROJ-211 | BACKLOG | Claude | Every op invertible; undo/redo reflect on device; AC P1-AC-09 |
| PROJ-216 | Profile management + explicit device targeting | P1 | 2 | PROJ-211, PROJ-163 | BACKLOG | Claude | Create/assign/activate profile; designer always names target device |
| PROJ-217 | Grid config editor (no caps) | P1 | 2 | PROJ-210 | BACKLOG | Claude | cols/rows/gutter/margins/aspect/bg; no caps; ChangeGrid op |

### Phase-level hardening (cross-workstream)

| ID | Title | Pri | Pts | Dependencies | Status | Assignee | Definition of Done |
|----|-------|-----|-----|--------------|--------|----------|--------------------|
| PROJ-300 | Security test suite (sniff/MITM/rogue/secret-leak) | P0 | 3 | PROJ-127, PROJ-180 | BACKLOG | Claude | Ciphertext-only on wire; MITM/rogue blocked; AC P1-AC-03; secrets never logged |
| PROJ-301 | Performance soak (8h, ≥8 sessions) | P1 | 3 | PROJ-171, PROJ-150, PROJ-184 | BACKLOG | Claude | RSS growth <5MB/h; idle CPU <2%; 60 FPS; AC P1-AC-14 |
| PROJ-302 | E2E journeys (J0/J1/J2/J6) | P1 | 3 | PROJ-212, PROJ-214, PROJ-173, PROJ-175 | BACKLOG | Claude | Pair/author-live/gaming-start/permissioned-2nd-device pass |
| PROJ-303 | Phase-1 acceptance verification (P1-AC-01…16) | P0 | 2 | PROJ-300, PROJ-301, PROJ-302 | BACKLOG | Claude | All 16 ACs verified; Definition of Done (deep dive §1) met |

---

## 3. Counts & priority distribution

| Metric | Value |
|--------|-------|
| **Total Phase-1 tickets** | 45 |
| **Total story points** | 113 |
| Ready now (no deps) | 7 |
| In Backlog (deps pending) | 38 |
| P0 (critical path) | 22 |
| P1 (DoD-required) | 18 |
| P2 (parallelizable) | 4 |
| P3 (polish) | 1 |
| Estimated implementation hours (≈) | ~150–165h |

> Velocity/burn-down lives in the **Progress Dashboard** doc; the dependency-correct execution order lives in the **Dependency Graph** doc. This board is the status surface those two drive.

---

## 4. Board operating rules (summary — full rules in Agent Instructions doc)

1. The agent pulls **only** from `Ready` (all dependencies `Done`), highest priority first, lowest ID as tiebreak.
2. On pull: `Ready → In Progress`; implement only that ticket.
3. On implementation complete + self-review: `In Progress → Code Review`.
4. On validation commands green: `Code Review → Testing`.
5. On tests + acceptance criteria satisfied: `Testing → Done`; then promote any newly-unblocked `Backlog` tickets to `Ready`.
6. If blocked by an external/unmet condition mid-work: `→ Blocked` with a recorded reason; never silently stall.
7. Never start a ticket with an incomplete dependency.

---

*End of Phase 1 Master Kanban Board (Draft v0.1). Next execution-system documents: Jira Epic List → Jira Ticket Breakdown (full per-ticket detail) → Dependency Graph → Execution Plan → Progress Dashboard → Claude Agent Instructions.*
