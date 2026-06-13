# CyberDeck — Phase 1 · Progress Dashboard

**Execution-system Document 7 of N** · Version 1.0 (current — **Phase 1 COMPLETE · 100%**) · updated 2026-06-13 · `com.shishir.cyberdeck`

> The single live tracking surface for Phase 1 execution. **Phase 1 is complete: 80/80 tickets · 199/199 points · all 16 acceptance criteria met** (see `docs/phase1_acceptance.md`). The full stack is green — `task lint` 0 issues, `task test` (engine `-race` + 5 plugin modules + 190 Flutter tests), `task build`, darwin/linux cross-compile, and `task interop` (J0/J1/J2/J6 + reconnect/revoke) all pass.

---

## How to read & update this dashboard

**Status values** (a ticket moves left→right):
`⬜ Backlog` → `🟦 Ready` → `🟨 In Progress` → `🟧 Code Review` → `🟪 Testing` → `✅ Done` (and `🟥 Blocked` if a dependency regresses)

**The update loop** (after each ticket):
1. Set the finished ticket to `✅ Done`, progress `100%`.
2. Re-scan dependents: any ticket whose deps are now all Done flips `⛔ Blocked → ✅ Ready` in the Readiness column.
3. Recompute the epic rollup (Done count, Done points) and the snapshot percentages.
4. Advance the milestone tracker if a gate's tickets are all Done.
5. Append a line to the velocity log.

**Readiness column** is derived, not chosen: a ticket is Ready iff every dependency is Done. At baseline only the 6 root tickets are Ready.

---

## 1 · Snapshot (current — 2026-06-13)

| Metric | Value |
|--------|-------|
| **Total tickets** | 80 |
| **Total story points** | 199 |
| **Done** | **80 tickets / 199 pts** — **all 10 epics complete; M1–M7 reached; full stack green (lint/test/build/cross-compile/interop)** |
| **In flight** | 0 |
| **Blocked** | 0 |
| **Ready now** | 0 (all tickets Done) |
| **Completion** | **100%** (199 / 199 pts) |
| **Critical-path progress** | 31 / 31 pts (spine complete incl. 302 E2E + 303 acceptance) |
| **Current wave** | 10 of 10 — PHASE EXIT |

> **[†] Numbering reconciliation (2026-06-07):** the original dashboard labeled PROJ-121="Identity" and PROJ-120="Trust store", but the authoritative Batch-1 *tickets* define **PROJ-121 = per-OS SecretStore** (root) and **PROJ-120 = engine identity** (→121). The dependency shape is identical; titles corrected here to match the tickets (the ticket wins for scope per Agent Instructions §1).

**By priority:** P0 = 47 tickets / 124 pts (all Done) · P1 = 33 tickets / 75 pts (all Done). Phase-exit gate satisfied.

**Progress bar:** `████████████████████` 100%

---

## 2 · Epic rollup

| Epic | Tickets | Points | Done (tix) | Done (pts) | % complete |
|------|---------|--------|------------|------------|------------|
| EPIC-1 Lifecycle & Packaging | 12 | 32 | 12 | 32 | 100% |
| EPIC-2 Persistence | 6 | 12 | 6 | 12 | 100% |
| EPIC-3 Security & Identity | 8 | 19 | 8 | 19 | 100% |
| EPIC-4 Transport & Connectivity | 11 | 27 | 11 | 27 | 100% |
| EPIC-5 Plugin Host & 1P Capabilities | 11 | 27 | 11 | 27 | 100% |
| EPIC-6 State, Registries & Event Bus | 5 | 13 | 5 | 13 | 100% |
| EPIC-7 Flow Engine Core | 5 | 13 | 5 | 13 | 100% |
| EPIC-8 Client Runtime & Widgets | 10 | 24 | 10 | 24 | 100% |
| EPIC-9 Designer | 8 | 21 | 8 | 21 | 100% |
| EPIC-10 Hardening & Acceptance | 4 | 11 | 4 | 11 | 100% |
| **TOTAL** | **80** | **199** | **80** | **199** | **100%** |

---

## 3 · The "what can I pull right now" board

**Nothing left to pull — all 80 tickets are Done.** The final push closed the remaining 23
(the breadth + hardening/acceptance tail) on 2026-06-13:

- **Packaging/lifecycle:** 102 (CI across all modules), 106/107/108 (build artifacts + per-OS
  service), 109 (tray), 190/191/192 (installers — Windows validated; mac/linux documented-manual).
- **Transport:** 144 (loopback control channel), 148 (manual + active scan).
- **Plugins:** 172 (GPU telemetry), 176 (notification count).
- **Client:** 185 (sparkline), 186 (media card + page-nav), 188 (degradation UI), 189 (theme + a11y).
- **Designer:** 215 (undo/redo), 216 (profiles + targeting), 217 (grid editor).
- **Hardening/acceptance:** 300 (security suite), 301 (soak), 302 (E2E J0/J1/J2/J6), 303 (acceptance).

### 🟨 IN PROGRESS (0) — none
### ⛔ BLOCKED (0) — none

---

## 4 · Full ticket register (80)

> Sorted by ID. Columns: **ID · Title · Epic · Pri · Pts · Deps · Status · Assignee · Readiness · Progress.** Update Status/Readiness/Progress as work proceeds.

| ID | Title | Epic | Pri | Pts | Deps | Status | Owner | Ready? | % |
|----|-------|------|-----|-----|------|--------|-------|--------|---|
| PROJ-101 | Monorepo bootstrap (Go + Flutter) | EPIC-1 | P0 | 2 | — | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-102 | CI baseline (lint/test/build gates) | EPIC-1 | P0 | 2 | — | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-103 | Config loader + schema | EPIC-1 | P0 | 2 | 101 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-104 | Engine service skeleton (daemon lifecycle) | EPIC-1 | P0 | 2 | 101,103 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-105 | Service orchestration (wire subsystems) | EPIC-1 | P0 | 3 | 104,110,150 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-106 | Build artifacts — Windows | EPIC-1 | P1 | 3 | 105 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-107 | Build artifacts — macOS | EPIC-1 | P1 | 3 | 105 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-108 | Build artifacts — Linux | EPIC-1 | P1 | 3 | 105 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-109 | Tray/menubar control app | EPIC-1 | P1 | 3 | 105,180 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-110 | Persistence baseline (SQLite + schema v1) | EPIC-2 | P0 | 2 | — | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-111 | Migration framework | EPIC-2 | P0 | 2 | 110 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-112 | Documents repository | EPIC-2 | P0 | 3 | 111 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-113 | Trust repository | EPIC-2 | P0 | 2 | 111 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-114 | Audit repository | EPIC-2 | P1 | 2 | 111 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-115 | Secret-leak guard (persistence scan) | EPIC-2 | P1 | 1 | 112,113,114 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-120 | Engine identity (Ed25519 keypair + UUID) [†] | EPIC-3 | P0 | 2 | 121 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-121 | Per-OS SecretStore abstraction + impls [†] | EPIC-3 | P0 | 3 | — | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-122 | Crypto suite (AEAD + KDF) | EPIC-3 | P0 | 3 | 120 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-123 | Pairing handshake (key exchange) | EPIC-3 | P0 | 3 | 122,113 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-124 | Pairing token issuance + QR payload | EPIC-3 | P1 | 2 | 123,150 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-125 | Permission model + authorize() | EPIC-3 | P0 | 3 | 113 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-126 | Trust revocation + session teardown | EPIC-3 | P1 | 1 | 123,125 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-127 | Audit log writer + redaction | EPIC-3 | P1 | 2 | 114,125 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-130 | Plugin host: launch/supervise/IPC | EPIC-5 | P0 | 3 | 160,103 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-131 | Plugin host: restart/fault policy | EPIC-5 | P0 | 2 | 130 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-132 | Plugin manifest validation + registry merge | EPIC-5 | P0 | 2 | 130,161 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-133 | Permission enforcement at IPC boundary | EPIC-5 | P0 | 2 | 132,125 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-140 | Endpoint abstraction + ConnectionManager | EPIC-4 | P0 | 2 | — | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-141 | Framing + Serializer seam | EPIC-4 | P0 | 2 | 140 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-142 | Encrypted session (reader/writer/demux) | EPIC-4 | P0 | 3 | 141,122 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-143 | Three channels + backpressure | EPIC-4 | P0 | 3 | 142 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-144 | Loopback privileged control channel | EPIC-4 | P1 | 2 | 142 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-145 | Heartbeat / keepalive (sleep-tolerant) | EPIC-4 | P1 | 2 | 142 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-146 | Reconnect (backoff→mDNS→scan) | EPIC-4 | P1 | 3 | 145,147 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-147 | Discovery: mDNS advertise/browse | EPIC-4 | P0 | 3 | 141,120 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-148 | Discovery: manual + active scan | EPIC-4 | P1 | 2 | 147 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-149 | Versioned resync on gap | EPIC-4 | P1 | 2 | 143 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-150 | Multi-session fan-out + subscription filter | EPIC-4 | P0 | 3 | 143,160 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-160 | Typed state model + state store core | EPIC-6 | P0 | 3 | — | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-161 | Registries (action/widget/flow-node) | EPIC-6 | P0 | 3 | 160,112 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-162 | Event bus | EPIC-6 | P0 | 2 | 160 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-163 | Session/profile model + activation hook | EPIC-6 | P0 | 3 | 160,113 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-164 | Variables (var.*) typed+durable+bindable | EPIC-6 | P1 | 2 | 160,112 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-170 | PAL capability interfaces + provider chain | EPIC-5 | P0 | 3 | 160 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-171 | 1P plugin: telemetry (CPU/RAM/net/disk) | EPIC-5 | P0 | 3 | 170,132 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-172 | 1P plugin: GPU telemetry provider chain | EPIC-5 | P1 | 3 | 171 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-173 | 1P plugin: power actions | EPIC-5 | P0 | 3 | 170,132 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-174 | 1P plugin: volume (system master) | EPIC-5 | P1 | 2 | 170,132 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-175 | 1P plugin: launchers + system tools | EPIC-5 | P1 | 2 | 132 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-176 | 1P plugin: notification count | EPIC-5 | P1 | 2 | 170,132 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-180 | Client connection mgr + pairing UI (QR) | EPIC-8 | P0 | 3 | 147,123 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-181 | Renderer registry + layout interpreter | EPIC-8 | P0 | 3 | 180,161 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-182 | Widget: button + toggle | EPIC-8 | P0 | 2 | 181 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-183 | Widget: slider + label + image | EPIC-8 | P0 | 2 | 181 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-184 | Widget: circular + linear gauge | EPIC-8 | P0 | 3 | 181 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-185 | Widget: sparkline (series state) | EPIC-8 | P1 | 2 | 181,160 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-186 | Widget: media card (basic) + page-nav | EPIC-8 | P1 | 2 | 181 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-187 | Gesture capture (all slots) + 2-tap confirm | EPIC-8 | P0 | 3 | 181 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-188 | Degradation UI (dimmed + badge) | EPIC-8 | P0 | 2 | 180,181 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-189 | Theme tokens + accessibility | EPIC-8 | P1 | 2 | 181 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-190 | Installer — Windows | EPIC-1 | P1 | 3 | 106,180 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-191 | Installer — macOS | EPIC-1 | P1 | 3 | 107,180 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-192 | Installer — Linux | EPIC-1 | P1 | 3 | 108,180 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-200 | Flow model + document persistence | EPIC-7 | P1 | 2 | 112,161 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-201 | Expression language (lexer/parser/eval) | EPIC-7 | P1 | 3 | 160 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-202 | Flow executor + run context | EPIC-7 | P1 | 3 | 200,201,162 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-203 | Core nodes (action/if/setVar/wait/loop/…) | EPIC-7 | P1 | 3 | 202,125 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-204 | Triggers (manual/event/stateChange) | EPIC-7 | P1 | 2 | 202,162 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-210 | Designer canvas (renders as target device) | EPIC-9 | P0 | 3 | 181,163 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-211 | Op model + op-log apply/version | EPIC-9 | P0 | 3 | 210,112 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-212 | Op-log broadcast + live device reflection | EPIC-9 | P0 | 3 | 211,150 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-213 | Drag-drop placement + move/resize ghosts | EPIC-9 | P1 | 3 | 211,143 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-214 | Schema-driven inspector | EPIC-9 | P0 | 3 | 211,161 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-215 | Undo/redo (op inverses) | EPIC-9 | P1 | 2 | 211 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-216 | Profile mgmt + explicit device targeting | EPIC-9 | P1 | 2 | 211,163 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-217 | Grid config editor (no caps) | EPIC-9 | P1 | 2 | 210 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-300 | Security test suite (sniff/MITM/rogue/leak) | EPIC-10 | P0 | 3 | 127,180 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-301 | Performance soak (8h, ≥8 sessions) | EPIC-10 | P0 | 3 | 171,150,184 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-302 | E2E journeys (J0/J1/J2/J6) | EPIC-10 | P0 | 3 | 212,214,173,175 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-303 | Phase-1 acceptance (P1-AC-01..16) | EPIC-10 | P0 | 2 | 300,301,302 | ✅ Done | Claude | ✅ Ready | 100% |

---

## 5 · Milestone tracker

Advance a milestone to ✅ only when **every** gating ticket is Done.

| Gate | Milestone | Gating tickets (all must be Done) | Status |
|------|-----------|-----------------------------------|--------|
| **M1** | Bootstrap green | 101, 102, 103 | ✅ Done (2026-06-13 — 102 CI now gates all 6 modules; red-gate proof documented in ci/README.md) |
| **M2** | Persistence + security base | 110, 111, 112, 113, 114, 115, 120, 121, 122, 125, 127 | ✅ Done (2026-06-07) |
| **M3** | Live telemetry on a phone | 160, 150, 170, 171, 180, 181, 184, 130, 132 | ✅ Done — live E2E proven over the encrypted wire by `task interop` (2026-06-11) |
| **M4** | Actions + permissions on device | 125, 133, 173, 174, 175, 187, 188 | ✅ Done (2026-06-13 — 188 degradation dimming shipped; J6 proves permissioned deny+audit) |
| **M5** | Resilience proven | 145, 146, 148, 149, 188 | ✅ Done (2026-06-13 — 148 manual/active scan + 188 degradation shipped) |
| **M6** | Author on desktop, watch live (headline) | 210, 211, 212, 181, 150, 214 | ✅ Done — live op reflection proven over the wire (2026-06-11) |
| **M7** | All P1-ACs green — PHASE EXIT | 300, 301, 302, 303 (+ all P0) | ✅ Done (2026-06-13 — EPIC-10 suite green; all 16 P1-ACs traced in docs/phase1_acceptance.md) |

---

## 6 · Velocity & burndown (log)

Append one row per work session. `Pts closed` = points moved to Done this session. `Cumulative %` = Done pts / 199.

| Session | Date | Tickets closed | Pts closed | Cumulative pts | Cumulative % | Notes |
|---------|------|----------------|------------|----------------|--------------|-------|
| — | (baseline) | 0 | 0 | 0 | 0% | All tickets at Backlog. Ready set = 6 roots. |
| 1 | 2026-06-07 | PROJ-101, 110, 160, 121, 140, 120 (+102 authored) | 14 | 14 | 7% | Toolchain: Go 1.26.4 + Task + golangci-lint 2.12.2 + mingw-w64 gcc 16.1.0 (local `-race`) + Flutter 3.44.1 (+ VS C++). **101** monorepo (engine+Flutter client, `flutter build windows` ✓, full `task lint/test/build` green). **110** pure-Go SQLite WAL + migrations (ADR-0001). **160** typed state store (`-race`). **121** `Secret`+SecretStore (Win Cred Mgr live, AES-GCM fallback, mac/linux cross-compiled). **140** transport endpoint/ConnectionManager seam (ADR-0010). **120** engine identity (Ed25519+UUID, seed in SecretStore only; X25519 ECDH derivation deferred to 122 via SigningSeed() seam). **102** CI workflows authored + locally green (live run + branch protection = repo-owner follow-up). Newly Ready: 122, 141, 162, 170, 201. Critical path 5/31. |
| 2 | 2026-06-07 | PROJ-122, PROJ-111 | 5 | 19 | 10% | **122** Crypto suite (special-care): X25519 ECDH (+Ed25519→X25519 conversion via filippo.io/edwards25519, completing the 120 seam), HKDF-SHA256 directional keys, ChaCha20-Poly1305 AEAD with monotonic per-direction nonce counters, Ed25519 sign/verify. RFC KATs (7748/5869/8439); round-trip/tamper/distinct-session-keys/nonce-uniqueness under `-race`. **111** schema 0001 — 8 durable tables (2B §6) + indexes; round-trip per table, BLOB integrity, AUTOINCREMENT, idempotent. Newly Ready: 112, 113, 114. Critical path 8/31; 123 unblocks once 113 lands. |
| 3 | 2026-06-07 | PROJ-113, PROJ-123 | 5 | 24 | 12% | **113** Trust repo layer (repo_devices CRUD/revoke + BLOB, repo_meta = identity.PublicStore, repo_accounts). **123** Pairing handshake engine state machine (special-care): ClientHello→ServerHello→KeyConfirm→PairResult, Ed25519 nonce-sig auth, fresh nonce_e + ephemeral X25519, reject bad-token/revoked/bad-sig/replay/out-of-order, trust-record write, forward-secret session keys derived + verified by device↔engine encrypted round-trip. Spine: 121→120→122→123 done = 11/31. |
| 3b | 2026-06-07 | PROJ-112, PROJ-114 | 5 | 29 | 15% | **112** doc/registry/variable/workflow repos (thin CRUD + JSON-body validation + WithWriteTx multi-row tx rollback; var.* upsert). **114** append-only audit repo (Append + ByActor/ByEventType/ByTimeRange; reflection guard proves no update/delete). EPIC-2 repo layer complete (5/6; only 115 leak-guard left). Newly Ready: 161, 164, 115. |
| 4 | 2026-06-07 | PROJ-115, PROJ-125 | 4 | 33 | 17% | **115** secret-leak guard (secrets.ContainsSecret reflection + persistence entity scan → EPIC-2 100%). **125** permission model + pure Authorize() 5-step check (exhaustive truth table, check-order, P1-AC-07 destructive-deny, ParsePermissions). Newly Ready: 126, 127. **M2 now gated only on PROJ-127.** EPIC-3 74%. |
| 6 | 2026-06-07 | PROJ-162, PROJ-163 | 5 | 40 | 20% | **162** event bus (ordered per topic, bounded queues, non-blocking publish + overflow drop/log, unsubscribe; `-race`). **163** session/profile model (isolated Session{perms,activeProfile,subscriptions,mode} + Manager create/get/teardown; inert activation hook). EPIC-6 62%. **20% of Phase 1 complete.** |
| 7 | 2026-06-07 | PROJ-161 | 3 | 43 | 22% | Registries keystone: action/widget/flow-node descriptors + schema-of-schemas validation, Merge with ID-collision diagnostics + atomicity, query API (ActionsByCategory/WidgetsAcceptingKind/…), persistence round-trip via injected store (real SQLite test), real shared/schemas/*. Unblocks 132/200/214. EPIC-6 85%. P1-AC-10 backing. |
| 8 | 2026-06-07 | PROJ-164 | 2 | 45 | 23% | Variables-as-state: core/vars VarManager bridges VariableRepo (durable) + state store (live). SetVar → live fan-out + persist; Load restores var.* at startup; typed fidelity (number/string/bool); var.* are bindable states. **EPIC-6 complete (5/5).** Full engine `go test -race ./...` green. |
| 9 | 2026-06-08 | PROJ-141 | 2 | 47 | 24% | Transport framing/serializer seam: uint32 length-prefix Framer (bounded, oversize-rejected), Envelope {v,ch,type,seq,ts,payload} + per-channel monotonic SeqCounter, Serializer interface + JSONSerializer (swap proven via gob fake). Newly Ready: 142 (encrypted session), 147 (mDNS). EPIC-4 15%. |
| 10 | 2026-06-08 | PROJ-142 | 3 | 50 | 25% | Encrypted session (special-care): reader/writer goroutines over a Conn with crypto Cipher (per-direction nonce) + framing; Send/Received/Done/Close; clean teardown. Tests (`-race`): encrypted round-trip with wire capture proving **no plaintext on the wire**, goroutine-leak-free teardown, tamper→AEAD-failure→session error. Implements transport.Session. Newly Ready: 143, 144, 145. **25% of Phase 1.** |
| 11 | 2026-06-08 | PROJ-143 | 3 | 53 | 27% | Three channels + backpressure: ChannelMux over a session — State coalesce latest-wins by id (droppable), Layout ordered/lossless (never drop), Preview bounded drop-oldest (never block); Flush to session in priority order; inbound demux by ch (Layout lossless, State/Preview droppable). Transport chain 141→142→143 complete. Newly Ready: 149, 150 (fan-out). EPIC-4 37%. |
| 12 | 2026-06-08 | PROJ-150 | 3 | 56 | 28% | Multi-session fan-out (special-care): Fanout over per-device Subscribers; BroadcastState filters deltas by each session's SubscriptionSet (encode once), BroadcastLayout gated on edited-profile + edit-mode, FlushAll, per-subscriber isolation. Tests (`-race`): subscription filter, two-profile isolation (P1-AC-11), 8-session fan-out, concurrent broadcast+churn. EPIC-4 48%. Newly Ready: 124. Key unlock toward M3. |
| 13 | 2026-06-08 | PROJ-170 | 3 | 59 | 30% | PAL capability/provider-chain framework: generic Provider[T] + Chain[T] (probe→bind highest-available→Capability (value,ok)→Rebind on fault→degrade to unavailable, no panic); Telemetry/Power capability interface stubs. Tests: bind order, all-unavailable degradation (P1-AC-05), re-probe-on-fault. EPIC-5 started (11%). **30% of Phase 1.** |
| 14 | 2026-06-08 | PROJ-103 | 2 | 61 | 31% | Config loader: typed Config (telemetry/media/smarthome/thresholds/display) + Default() + resilient Load (missing→defaults, malformed→defaults+err, out-of-range→clamped, no crash); no secret fields (115 guard). Sample config.json. Newly Ready: 104 (entrypoint), 130 (plugin host). M1 now gated only on 102 live-CI. EPIC-1 13%. |
| 15 | 2026-06-08 | PROJ-104 | 2 | 63 | 32% | Engine entrypoint: --service/--console/--version/--config flags, config load, staged Boot→READY (documented 2B §7.1 ordering, stub stages), SIGINT/SIGTERM→graceful Shutdown (2B §7.2). lifecycle pkg (Boot/Shutdown + Default stages/steps). Tests: flag parse, boot/shutdown ordering, console-run→shutdown. Newly Ready: 105. EPIC-1 19%. |
| 16 | 2026-06-08 | PROJ-130 | 3 | 66 | 33% | Plugin host (special-care): Host.Launch spawns plugin subprocess over stdio, newline-JSON IPC (init/register/stateUpdate/log/heartbeat/actionResult), stateUpdate→StateSetter, register→callback, log→logger; heartbeat liveness (detect hung); clean Close with kill fallback. Test plugin via TestMain re-exec (normal/hang/crash). Tests (`-race`): launch→init→register→stateUpdate, hung-detect, log capture, crash-exit (engine survives). Newly Ready: 131, 132. EPIC-5 22%. |
| 17 | 2026-06-08 | PROJ-131 | 2 | 68 | 34% | Plugin restart/fault policy (special-care): Supervisor launches via Host, watches Exited/Unhealthy, restarts with capped backoff, FAULTED after N failures; on fault keeps contributions + marks declared states unavailable; READY→RESTARTING→FAULTED. Added Plugin.DeclaredStates() + panic test-plugin mode. Tests (`-race`): crash→restart→fault, **engine survives induced panic (P1-AC-13)**, faulted states unavailable, normal stays READY. Crash-isolation complete. EPIC-5 30%. |
| 18 | 2026-06-08 | PROJ-132 | 2 | 70 | 35% | Plugin manifest validation + registry merge: Manifest{id,name,apiVersion,permissions,contributes} (reuses registry descriptor types); ParseManifest/LoadManifest, CheckAPIVersion (refuse incompatible major), MergeManifest→registry.Merge (collision/persist free), permissions returned for 133; plugin_manifest.schema.json. Tests: valid merge, apiVersion refusal, collision, malformed. **Plugin host cluster (130→131→132) complete — unblocks all five 1P plugins (171/173/174/175/176) + 133.** EPIC-5 37%. |
| 19 | 2026-06-08 | PROJ-133 | 2 | 72 | 36% | Plugin→capability IPC permission gate: stateUpdate for an undeclared state rejected (never reaches the store) + audited via injected AuditDenier; AllowNetwork/AllowFilesystem level checks (none<localhost<outbound; none<own-dir) with audited denial. Added rogue test-plugin mode. Tests (`-race`): undeclared-state reject+audit, network/fs matrices. **Two-gate security model complete (125 device→action + 133 plugin→capability).** EPIC-5 44%. |
| 5 | 2026-06-07 | PROJ-127 | 2 | 35 | 18% | Audit semantics: Auditor over injected AuditSink, full event taxonomy (action.executed/rejected, device.paired/revoked, session.opened/closed, flow.run/failed, permission.denied), redaction (sensitive keys + Secret values → [REDACTED]), AuditedAuthorize ties Authorize→action.rejected. **🏁 Milestone M2 (persistence + security base) COMPLETE.** EPIC-3 84% (only P1 124/126 left). |
| 38 | 2026-06-09 | PROJ-204 | 2 | 125 | 63% | **Triggers — manual / event / stateChange (schedule reserved) — 🏁 EPIC-7 Flow Engine Core 100%.** New `engine/core/flow/triggers.go`: `TriggerManager` arms a flow's trigger and fires it via a `FlowRunner` seam (over `Executor.Start`), decoupled from the concrete event bus by a `Subscriber` seam (the wiring layer adapts `eventbus.Bus`). **manual** → `FireManual(flowID, payload)` (bound to an interaction slot upstream); **event** → a named engine event (`config.event`); **stateChange{stateId, expr}** → consumes `state.changed`, evaluates the sandboxed expr (201) against the changed state's value layered over the global resolver, **edge-triggered** (fires once on the false→true crossing — the first event only primes the baseline so an already-true condition at arm time does not fire) and **debounced** (clock-injectable; suppresses re-crossings inside the window). **schedule{cron|interval}** → config parsed + stored (`Kind`/`Config` accessors) but **no scheduler in V1** (reserved, Phase 3). Unknown kind rejected; `Disarm` stops + unsubscribes; consumers honour ctx cancellation. Tests (`-race`): manual fire + unarmed/wrong-kind error; event fire + missing-config reject; **stateChange edge (one fire on crossing, no re-fire while true, unrelated-state ignored)**; **debounce (suppress-in-window, fire-after-window via injected clock)**; **schedule stored but never fires**; unknown-kind reject; disarm-stops-firing. `go vet`/golangci-lint 0/`-race`/build all green. **EPIC-7 complete (5/5, 13/13 pts).** |
| 37 | 2026-06-09 | PROJ-203 | 3 | 123 | 62% | **Core nodes — the nine built-in flow node types (2D §3).** New `engine/core/flow/nodes` (imports flow; the executor never imports nodes → no cycle; handlers registered via `nodes.Register(executor, Deps)`): `action` (**critical security path** — always `authorize()` (125) → dispatch → audit (127); a denied action is audited + fails, **never dispatched/bypassed**), `if` (sandboxed expr (201) → true/false branch; non-bool → false safe default), `setVar` (eval → `var.*`→durable / else run-local, 164), `wait` (cancellable timer; honours ctx cancel promptly), `loop` (graph-driven body/next edges; **count** or **whileExpr** mode; per-node counter in a run-local; executor iteration cap = ultimate runaway guard), `navigate` (emit page/profile directive to the session, 163), `random` (crypto-rand branch pick; injectable for determinism), `subflow` (**depth-capped** recursion via `RunSubflow`, `ErrSubflowDepthExceeded`), `stop` (new `flow.StopLabel` → ends run regardless of edges). Executor gained `Register` + `StopLabel` handling; `flow.NewRunContext` exported (subflow seeding / node tests). Tests: each node's semantics; **action allow→dispatch+audit / deny→no-dispatch+audit / dispatch-fail→audit**; if true+false; setVar global+local-read-by-expr; wait delay + **cancellation**; navigate directive; random deterministic pick + empty→next; **subflow depth-cap enforced**; stop sentinel; executor integration — **loop count ×3**, **while-loop ×3**, stop-ends-before-next-edge. `go vet`/golangci-lint 0/`-race`/build all green. EPIC-7 85%; unblocks **204** (triggers) to finish EPIC-7. |
| 36 | 2026-06-09 | PROJ-202 | 3 | 120 | 60% | **Flow executor + run context (2D §7/§8, AC P1-AC-08) — 🎯 60%.** `engine/core/flow`: `runcontext.go` (`RunContext`: run-locals + global resolver (states/vars) + `VarWriter`; implements `expr.Context` so conditions read locals-shadow-globals; `Set` routes `var.*`→global else local; cancellation ctx) and `executor.go` (`Executor` over a `NodeRunner` handler registry [impls = 203]; entry-node detection, step loop following `next`/branch edges, **loop-iteration cap** (anti-runaway), **ctx cancellation**, node error/**panic → fail the run safely** + emit `flow.run`/`flow.completed`/`flow.failed` (162), bounded async `Start`). Tests (`-race`): happy path, **branch (P1-AC-08)**, node-failure (engine survives), panic-recover, prompt cancellation, loop cap, local-var-into-expr, async start. golangci-lint 0; engine `-race`+build green. Unblocks **203** (core nodes) + **204** (triggers). EPIC-7 62%. |
| 35 | 2026-06-09 | PROJ-201 | 3 | 117 | 59% | **Sandboxed expression language (security boundary, ADR-0013 / 2D §5).** New `engine/core/flow/expr`: hand-written `lexer.go` (numbers/strings/idents/ops — no call syntax), `parser.go` (recursive-descent precedence, rejects malformed/trailing), `ast.go` (Literal/Ident/Unary/Binary), `eval.go` over a `Context` of states (160) + vars (164). Operators: `+ - * / %`, `== != < <= > >=`, `&& || !`, dotted state tokens. **No function calls, I/O, host callbacks, or reflection — there is no code-execution path.** Unavailable token → nil safe default (comparisons false), never a crash; type-mismatch + div/mod-by-zero → returned errors, not panics. Tests: operator/precedence matrix, state-token eval, **unavailable→safe-default**, type-mismatch errors, div-by-zero, **malformed/injection rejected at parse** (`exec('x')`, `a=1`, backticks, `;`, unbalanced). golangci-lint 0; engine test+build green. Unblocks **202** (flow executor). EPIC-7 38%. |
| 34 | 2026-06-09 | PROJ-200 | 2 | 114 | 57% | **Flow model + document persistence (EPIC-7 started).** New `engine/core/flow`: `model.go` (`Flow{id,label,version,trigger,nodes[],edges[]}` + JSON), `validate.go` (validates against the flow-node **registry** (161): unknown-kind reject, per-param required/numeric-range/bool/choice checks, unique node ids, edges reference real nodes, trigger kind required), `store.go` (`Store` over a `WorkflowStore` seam — `*persistence.WorkflowRepo` satisfies it: `Save` validates → version-bumps (new=1, else +1) → persists; `Load`; invalid flows never written). Op-model/undo deferred to Phase 3 (ADR-0022) — V1 persists whole docs. Tests: save/load round-trip + version increment, reject matrix (no-trigger/unknown-kind/missing-required/below-min/dangling-edge/dup-id), invalid-not-persisted, choice validation, JSON round-trip. golangci-lint 0; engine `go test`+build green. Unblocks 202 (with 201). EPIC-7 15%. |
| 33 | 2026-06-09 | PROJ-187 | 3 | 112 | 56% | **Gesture capture (all slots) + 2-tap confirm (toward M4).** `client/lib/gestures/`: `slots.dart` (slot ids + `InteractionTarget` parse from `node.interaction[slot]`), `capture.dart` (`GestureCapture` maps tap/doubleTap/longPress/pressDown/pressUp/swipe* → slot events; **pressed-state ≤100ms via raw `Listener` pointer events** so it's immediate despite tap-vs-drag arena), `confirm.dart` (`TwoTapConfirmer`: non-destructive executes on first tap; **destructive arms then executes on a second tap within a window** — AC P1-AC-06; + `ConfirmCard`). Tests: interaction parse, confirmer arm/execute/window-expiry/reset, GestureCapture tap+longPress+pressed-state + fling→swipe. `dart analyze` clean; full client suite **97 green**. M4 4/7. EPIC-8 67%. |
| 32 | 2026-06-09 | PROJ-183 | 2 | 109 | 55% | **Slider + label + image widgets.** `render/widgets/slider.dart` (bound numeric within config min/max; reflects state; drag emits `dragValue` slot **with the level** — extended `InteractionSink`/`emit` to carry an optional value), `label.dart` (moved out of registry + **presentation-side unit formatting**, ADR-0019: int as-is, double→1 decimal → "42.0 °C"), `image.dart` (asset via `Image.asset` with broken-image fallback, else a named icon from the built-in set). Registered `slider`/`image` (label re-registered from its file). Tests: label format matrix + bound-value-with-unit render, slider reflect + drag-emits-dragValue-in-range, image renders an icon. `dart analyze` clean; full client suite **90 green**. EPIC-8 54%. |
| 31 | 2026-06-09 | PROJ-182 | 2 | 107 | 54% | **Button + toggle widgets.** `client/lib/render/widgets/button.dart` (action trigger: immediate pressed-state ≤100ms on tap-down via GestureDetector + AnimatedScale; emits its `tap` slot) and `toggle.dart` (Switch bound to a boolean state — reflects host state, emits `tap` on change; the mapped action does the real toggle round-trip). Both apply `valueRules` accent. Added a minimal **`InteractionSink` seam** (typedef + `WidgetRenderContext.onInteraction`/`emit`, threaded through `LayoutInterpreter.interactionSink` → `RenderedWidget`) so interactive widgets emit gesture slots today; PROJ-187 formalises the full gesture vocab + 2-tap. Registered `button`/`toggle` in `withBuiltins`. Tests (widget): button render + **pressed-state on tap-down** + tap-slot emit; toggle **reflects bound bool** + emit on tap. `dart analyze` clean; full client suite **86 green**. EPIC-8 46%. |
| 30 | 2026-06-09 | PROJ-173 | 3 | 105 | 53% | **First-party power-actions plugin (toward M4).** New `plugins/power` module (go.work + `replace`→engine, like 171): `provider.go` (six action ids, `destructive` map [shutdown/restart/hibernate/logoff], optional `delay` for shutdown/restart, a `runner` seam so commands are mockable — never power off CI, `execute`→per-OS `commandFor`), `power_{windows,darwin,linux}.go` (per-OS command tables; unsupported actions degrade cleanly), `main.go` (stdio IPC: register the six `registry.ActionDescriptor`s with destructive flags → handle `MsgInvokeAction` → run via provider → `MsgActionResult`; `CYBERDECK_POWER_DRYRUN` for tests). Added **`pluginhost.Plugin.Invoke`** (host→plugin action RPC: send `MsgInvokeAction` + await `MsgActionResult`) — the send side the host was built for. Tests: provider execute/unsupported/destructive-flags/descriptors, windows command table, **integration dispatch via `pluginhost.Host`** (`-race`: register has 6 actions + correct destructive flags, Invoke lock/shutdown→OK dry-run, bogus→failed result). golangci-lint 0; both modules `go test`+build green; engine pluginhost still green. **AC P1-AC-06** (destructive flag for 2-tap). M4 3/7 (174/175/187/188 left). EPIC-5 67%. |
| 29 | 2026-06-09 | PROJ-214 | 3 | 102 | 51% | **Schema-driven inspector — 🏁 milestone M6 gating complete.** `client/lib/designer/inspector/`: `param_schema.dart` (`ParamSchema{name,type,min,max,choices,default}` + tolerant `parseParamType`), `editor_factory.dart` (the single generic `buildParamEditor` switch: int/number→slider or numeric field, **choice→dropdown**, bool→switch, text/color→field, entity→Phase-4 stub; each keyed `editor-<name>`), `inspector.dart` (renders editors from a widget's schema; each edit commits a `SetConfig` op via `OpBuilder` → broadcasts live via 212). The leverage payoff: a brand-new plugin action's `choice` param renders a working dropdown with **zero inspector code** (P1-AC-10). Tests (widget): per-type editor generation, **new-choice-action dropdown→SetConfig (no code change)**, bool edit→SetConfig op, empty-schema placeholder, type-synonym parsing. `dart analyze` clean; full client suite **84 green**. **🏁 M6 "author on desktop, watch live" gating complete** (210/211/212/181/150/214). EPIC-9 57%. Critical path 26/31 (only 302/303 acceptance left). |
| 28 | 2026-06-09 | PROJ-212 | 3 | 99 | 50% | **Op-log broadcast + live device reflection (CRITICAL PATH; the headline "edit-on-desktop → live-on-device").** Engine `core/layout/broadcast.go`: `Broadcaster.ApplyAndBroadcast(docID, profileID, op)` → `OpLog.Apply` (211) then fan a Layout-channel envelope (`type:"layout.op"`, payload = op JSON stamped with `docVersion=newVersion`) via `transport.Fanout.BroadcastLayout` — only to edit/preview sessions on the edited profile (150). Apply stays transport-free; the broadcast is the one place they meet. Client `net/layout_apply.dart`: `LayoutApplier` applies ops in version order through `LayoutInterpreter` (181, targeted repaint), ignores duplicates, and on a **version gap** fires `onResyncNeeded` instead of replaying (engine = source of truth, PROJ-149). Tests — engine (`-race`): broadcast reaches the editor session with the right payload, **fan-out filters non-edit / other-profile sessions**, persist+version hold, apply-error propagates (no version bump); client: in-order apply, **gap→resync (not applied)**, duplicate ignored, sequential ops. `<200ms` is in-process/manual (live wire awaits the engine accept glue). Lint 0; engine `-race`+build green; client 79 green. **Critical path 26/31** (only 302/303 acceptance left on the spine). M6 5/6 (214 left). |
| 27 | 2026-06-09 | PROJ-211 | 3 | 96 | 48% | **Op model + op-log apply/version (CRITICAL PATH; both halves).** Engine `core/layout/`: `doc.go` (authoritative `Profile{version,pages[]}` / `Page` / `Widget` / `Placement` + JSON round-trip) and `oplog.go` (`Op` pure data + `Profile.Apply(op)` → **inverse op** with **version increment**, for the 2C §4.1 granular set AddWidget/RemoveWidget/Move/Resize/SetStyle/SetBinding/SetInteraction/SetConfig/ChangeGrid/AddPage/RemovePage; `OpLog` with a per-document **single-writer edit lock** + `DocumentStore` load/apply/persist, atomic). Client `designer/op_model.dart`: `OpBuilder` emitting the SAME op JSON the engine + renderer consume. Tests — engine (`-race`): apply matrix, **version monotonic**, **inverse round-trip per kind**, unknown-target errors don't bump version, **single-writer lock**, persist-via-store, JSON round-trip; client: builder JSON per op + **parity** (built ops applied through `LayoutInterpreter`). Apply is transport-free (212 consumes applied ops). Lint 0; engine `go build`+`-race` green; client 75 green. Newly Ready: 212/213/214/215/216 (rest of EPIC-9). Critical path 23/31. |
| 26 | 2026-06-09 | PROJ-210 | 3 | 93 | 47% | **Designer canvas (CRITICAL PATH; EPIC-9 started).** Desktop WYSIWYG canvas that renders a layout through the **same client renderer** (181 — never fork the renderer) at a target device-class grid. Factored the cell geometry onto `GridConfig.cellWidth/cellHeight` (refactored `_LayoutView`) so the canvas grid overlay and rendered widgets share one geometry. `designer/device_class.dart` (interim presets until 217: tablet-landscape-10 24×18, tablet-portrait, phone-portrait + aspect). `designer/placement.dart` (pure `snapToCell`/`clampToGrid`/`overlaps`/`anyOverlap`). `designer/canvas.dart`: `DesignerController` (`tryMove`/`tryAdd` clamp + **reject on overlap** → emit Move/Add op; `setDeviceClass` → ChangeGrid) + `DesignerCanvas` (device-class dropdown + AspectRatio + grid-overlay CustomPaint + `interp.build()`). Tests (9): snap/clamp/overlap+anyOverlap, controller move free vs **occupied-rejected**, add-overlap-rejected, **render-at-grid** + overlay, **device-class switch re-grids**. `dart analyze` clean; full client suite **69 green**; `flutter build windows` green. Newly Ready: 211 (op model — spine), 217. EPIC-9 14%. Critical path 20/31. |
| 25 | 2026-06-09 | PROJ-184 | 3 | 90 | 45% | **Circular + linear gauges — 🏁 milestone M3 (live telemetry on a phone) gating complete.** `client/lib/render/widgets/`: `widget_theme.dart` (interim theme tokens until 189), `gauge_common.dart` (pure `gaugeFraction`/`gaugeAccent`/`formatValue` + config min/max/unit), `gauge_circular.dart` (custom-painted swept arc + centered value/label, FittedBox-safe) and `gauge_linear.dart` (track + proportional fill); both bind a scalar state and apply `valueRules` client-side (red ≥85, zero round-trip). Registered `gauge.circular`/`gauge.linear`/`gauge.bar` in `RendererRegistry.withBuiltins()`. Tests (8): fraction clamp, **accent flips at threshold**, format ("--"/unit), circular **render + update-on-delta** (P1-AC-04), `--`-before-value, linear render, bar alias. `dart analyze` clean; full client suite **60 green**. M3 gating tickets (160/150/170/171/180/181/184/130/132) all Done — live E2E still awaits the engine accept/handshake-over-wire glue. EPIC-8 38%. |
| 24 | 2026-06-09 | PROJ-181 | 3 | 87 | 44% | **Renderer registry + layout interpreter (CRITICAL PATH; one widget from M3).** `client/lib/render/`: layout-doc model (`LayoutPage`/`WidgetNode`/`GridConfig`/`Placement` + JSON, 2C §2/§3); `ClientStateStore` (per-id `ValueNotifier` → a state update repaints only bound widgets); `RendererRegistry` (`widgetType→builder`, unknown→safe placeholder, reference `label` built-in + client-side `valueRules` eval); `LayoutOp` (parse + structural/per-widget split, 2C §4); `LayoutInterpreter` + `LayoutView` building the tree once with **disciplined repaint** (nested `ValueListenableBuilder`: a state update or per-widget op rebuilds only the affected node; structural ops bump a page notifier); exposes `subscriptionSet`. Tests (9): build-from-doc, unknown→placeholder, **state update repaints only the bound widget**, per-widget op targeted repaint, Add/Remove, subscriptionSet+SetBinding, JSON parse, valueRules. `dart analyze` clean; full client suite 53 green. Newly Ready: 182–187 + 210 (designer canvas). EPIC-8 25%. Critical path 17/31. |
| 23 | 2026-06-08 | PROJ-180 | 3 | 84 | 42% | **Client connection manager + pairing (CRITICAL PATH; M3 client side).** Full Dart client stack mirroring the engine wire/crypto: `crypto/crypto.dart` (X25519/Ed25519/HKDF-SHA256/ChaCha20-Poly1305 via package:cryptography + BigInt Ed25519→X25519 conversions) **proven interoperable by cross-language KAT vectors emitted from the Go engine**; `net/{framing,envelope,encrypted_session,channels,conn}.dart` (uint32 frames, base64-payload JSON envelope, per-direction AEAD session, channel router); `net/pairing.dart` (device-side ClientHello→ServerHello→KeyConfirm→PairResult state machine — **engine fingerprint verify (anti-MITM)**, sigD/sigE, forward-secret keys; defines the handshake wire encoding since the engine has none yet; DeviceIdentity + injectable KeyStore); `net/connection_manager.dart` (resolve+dial+pair, candidate fallback, bounded retry/backoff); `app/pairing.dart` (engine list, QR scan — mobile_scanner on Android, manual entry on desktop — fingerprint + error UI). Tests (44, all green): crypto KAT, framing, envelope (byte-exact vs Go JSON), session (round-trip + **no plaintext on the wire** + tamper teardown), pairing vs a faithful Dart mock engine (**pair success / fingerprint mismatch / bad token / forged sig**), connection-manager retry, QR parse, pairing widget. `dart analyze` clean; **`flutter build windows` + `flutter build apk` both green** (dropped flutter_secure_storage to avoid the VS-ATL dep — secure keystore injected per-platform; disabled Kotlin incremental for the mobile_scanner build). P1-AC-02 + P1-AC-03(client) met. Live Go↔Dart interop awaits the engine accept/handshake-over-wire glue (future ticket). Newly Ready: 181, 109. EPIC-8 started (13%). Critical path 14/31. |
| 22 | 2026-06-08 | PROJ-147 | 3 | 81 | 41% | **mDNS / DNS-SD discovery (engine + client).** Engine: `Identity.Fingerprint()` (lowercase hex SHA-256 of the Ed25519 pubkey — the anti-MITM id reused by pairing/QR). `core/transport/discovery_mdns.go` advertises `_cyberdeck._tcp.local` with TXT `{name,uuid,ver,fp}` and browses, via maintained `github.com/libp2p/zeroconf/v2`; pure `encodeTXT`/`parseTXT` codec (uuid+fp required, unknown keys tolerated); `DiscoveredEngine.Endpoint()` maps onto the `SourceMDNS` candidate (kind stays below the manager); `MDNSService` Start/Stop adapter (structurally satisfies the lifecycle Service seam — no import coupling) ready to wire into the boot mDNS stage once identity is constructed in main. Client: `net/discovery.dart` — `DiscoveredEngine` model + pure `fromTxt`/`parseTxtEntries` + `MdnsEngineDiscovery` (official `multicast_dns`, PTR→SRV→TXT→A). Tests: engine (`-race`) codec round-trip, required-field rejection, unknown-key tolerance, endpoint mapping, in-memory advertise→browse through the seams, fingerprint determinism, + best-effort real-multicast round-trip (skips cleanly when multicast blocked); client (9 tests) fromTxt/equality/TXT parsing. `dart analyze` + `flutter test` green. Discovery is the happy path, not a hard pairing dep (148 manual is the fallback). Newly Ready: 148. EPIC-4 59%. |
| 21 | 2026-06-08 | PROJ-105 | 3 | 78 | 39% | **Real boot wiring + graceful shutdown + single-instance guard.** `lifecycle.Subsystems` (injected interfaces: Migrator/Closer/Service + InitCore/FlushCore funcs; any nil = logged+skipped so not-yet-built stages — LAN listener/mDNS, 147 — hold their documented place) drives `BuildStages` (config→SQLite→core→plugin host→transport→mDNS→READY, 2B §7.1) and `BuildShutdownSteps` (stop sessions→flush→stop plugins→close SQLite, 2B §7.2). Single-instance guard: portable `AcquireInstance(name, onFocus)` over an OS lock listener with per-OS endpoints — `singleinstance_{linux(abstract socket),darwin(TMPDIR socket+unlink),windows(loopback TCP)}.go`; second launch dials + signals focus then returns `ErrAlreadyRunning`. Added `Host.Shutdown` (close all plugins). Entrypoint now opens+migrates real SQLite, builds core (state store + plugin host), claims the instance lock, boots on its own context (signal drives only the post-boot shutdown wait), `--data` dir flag. Tests (`-race`): boot/shutdown order with fakes, stage-error abort, nil-skip, single-instance refusal+focus + re-acquire, **integration boot with real SQLite→READY→clean close**; cross-compiles linux/darwin. Newly Ready: 106/107/108. EPIC-1 28%. |
| 20 | 2026-06-08 | PROJ-171 | 3 | 75 | 38% | **First real out-of-process 1P plugin (M3 engine-side).** Factored the IPC wire protocol into a stdlib-only `engine/pluginhost/ipcproto` pkg (Message/payloads/MsgType + Encode/Decode); pluginhost re-exports via type aliases so host + all tests stay green. Added root `go.work` (engine + plugins/telemetry) and the **`plugins/telemetry` module** (gopsutil v4, `replace` → ../../engine): `providers.Gopsutil` implements `pal.Telemetry` ((value,ok) per metric — cpu/ram/net-delta/disk/uptime); `Publisher` emits typed `system.*` stateUpdates on per-metric cadences (cpu/ram/net 1s, disk 10s, uptime 60s) + under→over threshold events (cpu>85, ram>90); `main.go` stdio IPC loop (init→register→publish→heartbeat→exit on stdin close); manifest.json (telemetry.read). Tests (`-race`, both modules): deterministic Publisher (clock-driven cadence + threshold-transition + unavailable-skip), gopsutil smoke (contract), **end-to-end via `pluginhost.Host` launching the plugin as a real subprocess → `system.uptime` reaches the state setter** (P1-AC-04 pipeline + IPC declared-state gate). Newly Ready: 172 (GPU chain). EPIC-5 56%. |
| 39 | 2026-06-11 | PROJ-124 | 2 | 127 | 64% | **"Living Deck" — the live wire goes end-to-end.** Built the engine **front door**: handshake-over-wire codec matching the client `pairing.dart`, a TCP listener (accept→handshake→session), the session **Server** (serve layout snapshot + filtered state, dispatch interactions via authorize()+audit), a 500ms state pump, the **default deck** (`layout.DefaultProfile`), and **PROJ-124** (single-use token issuer + QR payload). Assembled the client app (identity→pair via QR→deck→interact). Added a **real Dart↔Go interop test** (spawns the engine, real `ConnectionManager` over a socket → snapshot + telemetry + interaction) — **it passes**, so M3 + M6 live-E2E caveats clear. `docs/RUNNING.md` quickstart. EPIC-3 → 100%. |
| 40 | 2026-06-11 | PROJ-213 | 3 | 130 | 65% | **Demo-Mode pivot + Designer edit mode.** Reframed the client around a **DeckSource seam** (`MockDeckSource` Demo Mode with 3 seed decks + live mock telemetry / `EngineDeckSource` live), so the app is **standalone-testable** (no engine) on Windows + Android. **PROJ-213**: the desktop **deck editor** — select / **drag-move** (DesignerController) / schema inspector / rename / add / remove, saved to the deck. App shell: landing → deck list → deck/editor. Tests: Demo journey (widget) + the real interop test; `flutter test` green, windows + apk build. EPIC-9 → 71%. |
| 41 | 2026-06-11 | PROJ-126, 145, 146, 149, 174, 175 | 12 | 142 | 71% | **Live-engine robustness + two more plugins.** **145** heartbeat (engine ping→pong + lastSeen reaper) + client watchdog; **146** bounded auto-reconnect via a **tokenless known-device handshake** (sig still proven) — survives wifi/sleep blips with no re-scan; **149** versioned **resync** on gap; **126** trust **revocation** kill-switch + immediate session teardown + engine console `list`/`revoke <uuid>`. **174** volume plugin (`system.volume`/`muted` + `volume.set`/`mute`) and **175** launchers plugin (`launch.app`/`launch.url`), both wired into the default deck. Extended `task interop` proves **pair→telemetry→drop→tokenless-reconnect→revoke→refused** against the real engine. EPIC-3 100%, EPIC-4 85%, EPIC-5 81%. **71% of Phase 1.** |
| 42–44 | 2026-06-13 | PROJ-172, 176, 144, 148, 185, 186, 188, 189, 215, 216, 217 | 26 | 168 | 84% | **Breadth wave (multi-agent).** GPU telemetry chain (172) + notification-count plugin (176); loopback control channel (144) + manual/active-scan discovery (148); sparkline (185) + media-card/page-nav (186); degradation-UI dimming (188); theme tokens + WCAG-AA a11y (189); Designer undo/redo (215) + profiles/targeting (216) + uncapped grid editor (217). Integrated into the live deck (GPU gauges + notif badge); all modules build/`-race`/lint green. |
| 45 | 2026-06-13 | PROJ-102, 106, 107, 108, 109, 190, 191, 192 | 21 | 189 | 95% | **Packaging + lifecycle.** CI now gates all 6 Go modules + client with a win/mac matrix and documented red-gate proof (102); cross-compiled build artifacts + `dist:*` + per-OS service registration Win SCM/launchd/systemd (106/107/108); system-tray control app over the loopback channel (109); native installers — Inno Setup (validated), nfpm `.deb`/`.rpm` + AppImage, `.dmg`/`.pkg` + notarize config (190/191/192; mac/linux build documented-manual). |
| 46 | 2026-06-13 | PROJ-300, 301, 302, 303 | 10 | 199 | 100% | **🏁 Hardening + acceptance — PHASE 1 COMPLETE.** Security suite (300: sniff/MITM/rogue/secret-leak); soak harness short+8h variants (301); E2E journeys J0/J1/J2/J6 wired into `task interop` (302); acceptance traceability for all 16 P1-ACs + CHANGELOG (303). Stabilized the tree (fixed `serve()` mode announcement + lock-isolation flake) and verified the full gate: `task lint` 0, `task test` (`-race` + 5 plugins + 190 Flutter), `task build`, darwin/linux cross-compile, `task interop` all green. **M1–M7 reached. 199/199 pts.** |

**Burndown target line** (for reference; assumes ~10 pts/session sustained):

```
Pts remaining
199 ┤●  ← baseline
180 ┤ ╲
160 ┤  ╲
140 ┤   ╲
120 ┤    ╲
100 ┤     ╲
 80 ┤      ╲
 60 ┤       ╲
 40 ┤        ╲
 20 ┤         ╲
  0 ┤          ●  ← M7 (≈ session 20)
    └┬─┬─┬─┬─┬─┬─┬─┬─┬─┬
     0 2 4 6 8 …      20  sessions
```

(The real burndown will be plotted from the velocity log as sessions accrue. The straight line is only a planning reference, not a commitment — early sessions clear cheap root tickets faster; the middle waves 5–6 are the heaviest.)

---

## 7 · Quick health indicators (recompute each session)

| Indicator | Baseline | Healthy signal |
|-----------|----------|----------------|
| Critical-path progress | 0 / 31 pts | Tracks ahead of overall % (the spine shouldn't lag) |
| Blocked count | 74 | Falls steadily; a *rising* blocked count = a regression upstream |
| P0 remaining | 124 pts | Burns down faster than P1 (P0 gates exit) |
| Ready-set size | 6 | Stays > 0 until near the end; if it hits 0 with work remaining, a dependency is mis-stated |
| Oldest In-Progress | — | No ticket sits In-Progress across many sessions (a stuck ticket = an unsurfaced blocker) |

---

*Progress Dashboard — current as of 2026-06-12 (Phase 1 ~71%, usable end-to-end). The operating rules that drive this dashboard are in the Claude Agent Instructions doc.*
