# CyberDeck — Phase 1 · Progress Dashboard

**Execution-system Document 7 of N** · Version 0.1 (Baseline — all tickets at 0%) · June 2026 · `com.shishir.cyberdeck`

> The single live tracking surface for Phase 1 execution. The agent (Claude) updates this document as it works — moving tickets through statuses, recomputing rollups, and advancing the milestone tracker. This baseline shows every ticket at `⬜ Backlog / 0%`. **80 tickets · 199 points · default assignee Claude.**

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

## 1 · Snapshot (baseline)

| Metric | Value |
|--------|-------|
| **Total tickets** | 80 |
| **Total story points** | 199 |
| **Done** | 35 tickets / 84 pts (…171, 105, 147, 180) — **EPIC-2 & EPIC-6 complete; M2 reached** |
| **In flight** (Ready→Testing) | 1 (PROJ-102 — workflows authored + locally green; live-CI run + branch protection pending repo-owner push) |
| **Blocked** | 28 |
| **Ready now** | 18 (106, 107, 108, 109, 124, 126, 144, 145, 148, 149, 172, 173, 174, 175, 176, 181, 200, 201) |
| **Completion** | **42%** (84 / 199 pts) |
| **Critical-path progress** | 14 / 31 pts (121 ✓, 120 ✓, 122 ✓, 123 ✓, 180 ✓) |
| **Current wave** | 1 of 10 |

> **[†] Numbering reconciliation (2026-06-07):** the original dashboard labeled PROJ-121="Identity" and PROJ-120="Trust store", but the authoritative Batch-1 *tickets* define **PROJ-121 = per-OS SecretStore** (root) and **PROJ-120 = engine identity** (→121). The dependency shape is identical; titles corrected here to match the tickets (the ticket wins for scope per Agent Instructions §1).

**By priority:** P0 = 47 tickets / 124 pts · P1 = 33 tickets / 75 pts. (P0 must all be Done for phase exit; P2 — none in Phase 1; deferred features live in later phases.)

**Progress bar:** `░░░░░░░░░░░░░░░░░░░░` 0%

---

## 2 · Epic rollup

| Epic | Tickets | Points | Done (tix) | Done (pts) | % complete |
|------|---------|--------|------------|------------|------------|
| EPIC-1 Lifecycle & Packaging | 12 | 32 | 4 | 9 | 28% |
| EPIC-2 Persistence | 6 | 12 | 6 | 12 | 100% |
| EPIC-3 Security & Identity | 8 | 19 | 6 | 16 | 84% |
| EPIC-4 Transport & Connectivity | 11 | 27 | 6 | 16 | 59% |
| EPIC-5 Plugin Host & 1P Capabilities | 11 | 27 | 6 | 15 | 56% |
| EPIC-6 State, Registries & Event Bus | 5 | 13 | 5 | 13 | 100% |
| EPIC-7 Flow Engine Core | 5 | 13 | 0 | 0 | 0% |
| EPIC-8 Client Runtime & Widgets | 10 | 24 | 1 | 3 | 13% |
| EPIC-9 Designer | 8 | 21 | 0 | 0 | 0% |
| EPIC-10 Hardening & Acceptance | 4 | 11 | 0 | 0 | 0% |
| **TOTAL** | **80** | **199** | **0** | **0** | **0%** |

---

## 3 · The "what can I pull right now" board

At baseline the Ready column holds the six root tickets. As tickets complete, this board is the agent's pull-queue. **Order within Ready: P0 before P1; then higher fan-out first (the parenthetical "unblocks N").**

### 🟦 READY (pull these now)
| ID | Title | Pri | Pts | Unblocks |
|----|-------|-----|-----|----------|
| PROJ-160 | Typed state model + state store core | P0 | 3 | **9** ← pull early |
| PROJ-121 | Identity (Ed25519 keypair + UUID) | P0 | 3 | 44 transitive |
| PROJ-110 | Persistence baseline (SQLite + schema v1) | P0 | 2 | 55 transitive |
| PROJ-140 | Endpoint abstraction + ConnectionManager | P0 | 2 | 41 transitive |
| PROJ-101 | Monorepo bootstrap (Go + Flutter) | P0 | 2 | gates lifecycle |
| PROJ-102 | CI baseline (lint/test/build gates) | P0 | 2 | gates all CI |

### ⛔ BLOCKED (74) — released wave by wave
The next tickets to unlock once the Ready set clears:
- **After PROJ-160:** 161*, 162, 163*, 164, 170, 185, 201, 130*, 150* (*also need other deps)
- **After PROJ-110:** 111 → then 112/113/114
- **After PROJ-121:** 120 → 122 → 123 (the security spine)
- **After PROJ-140:** 141 → 142 (needs 122 too)
- **After PROJ-101:** 103 → 104

(Full per-ticket dependency lists are in the register below and in the Dependency Graph doc.)

---

## 4 · Full ticket register (80)

> Sorted by ID. Columns: **ID · Title · Epic · Pri · Pts · Deps · Status · Assignee · Readiness · Progress.** Update Status/Readiness/Progress as work proceeds.

| ID | Title | Epic | Pri | Pts | Deps | Status | Owner | Ready? | % |
|----|-------|------|-----|-----|------|--------|-------|--------|---|
| PROJ-101 | Monorepo bootstrap (Go + Flutter) | EPIC-1 | P0 | 2 | — | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-102 | CI baseline (lint/test/build gates) | EPIC-1 | P0 | 2 | — | 🟨 In Progress | Claude | ✅ Ready | 70% |
| PROJ-103 | Config loader + schema | EPIC-1 | P0 | 2 | 101 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-104 | Engine service skeleton (daemon lifecycle) | EPIC-1 | P0 | 2 | 101,103 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-105 | Service orchestration (wire subsystems) | EPIC-1 | P0 | 3 | 104,110,150 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-106 | Build artifacts — Windows | EPIC-1 | P1 | 3 | 105 | ⬜ Backlog | Claude | ✅ Ready | 0% |
| PROJ-107 | Build artifacts — macOS | EPIC-1 | P1 | 3 | 105 | ⬜ Backlog | Claude | ✅ Ready | 0% |
| PROJ-108 | Build artifacts — Linux | EPIC-1 | P1 | 3 | 105 | ⬜ Backlog | Claude | ✅ Ready | 0% |
| PROJ-109 | Tray/menubar control app | EPIC-1 | P1 | 3 | 105,180 | ⬜ Backlog | Claude | ✅ Ready | 0% |
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
| PROJ-124 | Pairing token issuance + QR payload | EPIC-3 | P1 | 2 | 123,150 | ⬜ Backlog | Claude | ✅ Ready | 0% |
| PROJ-125 | Permission model + authorize() | EPIC-3 | P0 | 3 | 113 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-126 | Trust revocation + session teardown | EPIC-3 | P1 | 1 | 123,125 | ⬜ Backlog | Claude | ✅ Ready | 0% |
| PROJ-127 | Audit log writer + redaction | EPIC-3 | P1 | 2 | 114,125 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-130 | Plugin host: launch/supervise/IPC | EPIC-5 | P0 | 3 | 160,103 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-131 | Plugin host: restart/fault policy | EPIC-5 | P0 | 2 | 130 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-132 | Plugin manifest validation + registry merge | EPIC-5 | P0 | 2 | 130,161 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-133 | Permission enforcement at IPC boundary | EPIC-5 | P0 | 2 | 132,125 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-140 | Endpoint abstraction + ConnectionManager | EPIC-4 | P0 | 2 | — | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-141 | Framing + Serializer seam | EPIC-4 | P0 | 2 | 140 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-142 | Encrypted session (reader/writer/demux) | EPIC-4 | P0 | 3 | 141,122 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-143 | Three channels + backpressure | EPIC-4 | P0 | 3 | 142 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-144 | Loopback privileged control channel | EPIC-4 | P1 | 2 | 142 | ⬜ Backlog | Claude | ✅ Ready | 0% |
| PROJ-145 | Heartbeat / keepalive (sleep-tolerant) | EPIC-4 | P1 | 2 | 142 | ⬜ Backlog | Claude | ✅ Ready | 0% |
| PROJ-146 | Reconnect (backoff→mDNS→scan) | EPIC-4 | P1 | 3 | 145,147 | ⬜ Backlog | Claude | ⛔ Blocked | 0% |
| PROJ-147 | Discovery: mDNS advertise/browse | EPIC-4 | P0 | 3 | 141,120 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-148 | Discovery: manual + active scan | EPIC-4 | P1 | 2 | 147 | ⬜ Backlog | Claude | ✅ Ready | 0% |
| PROJ-149 | Versioned resync on gap | EPIC-4 | P1 | 2 | 143 | ⬜ Backlog | Claude | ✅ Ready | 0% |
| PROJ-150 | Multi-session fan-out + subscription filter | EPIC-4 | P0 | 3 | 143,160 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-160 | Typed state model + state store core | EPIC-6 | P0 | 3 | — | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-161 | Registries (action/widget/flow-node) | EPIC-6 | P0 | 3 | 160,112 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-162 | Event bus | EPIC-6 | P0 | 2 | 160 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-163 | Session/profile model + activation hook | EPIC-6 | P0 | 3 | 160,113 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-164 | Variables (var.*) typed+durable+bindable | EPIC-6 | P1 | 2 | 160,112 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-170 | PAL capability interfaces + provider chain | EPIC-5 | P0 | 3 | 160 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-171 | 1P plugin: telemetry (CPU/RAM/net/disk) | EPIC-5 | P0 | 3 | 170,132 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-172 | 1P plugin: GPU telemetry provider chain | EPIC-5 | P1 | 3 | 171 | ⬜ Backlog | Claude | ✅ Ready | 0% |
| PROJ-173 | 1P plugin: power actions | EPIC-5 | P0 | 3 | 170,132 | ⬜ Backlog | Claude | ✅ Ready | 0% |
| PROJ-174 | 1P plugin: volume (system master) | EPIC-5 | P1 | 2 | 170,132 | ⬜ Backlog | Claude | ✅ Ready | 0% |
| PROJ-175 | 1P plugin: launchers + system tools | EPIC-5 | P1 | 2 | 132 | ⬜ Backlog | Claude | ✅ Ready | 0% |
| PROJ-176 | 1P plugin: notification count | EPIC-5 | P1 | 2 | 170,132 | ⬜ Backlog | Claude | ✅ Ready | 0% |
| PROJ-180 | Client connection mgr + pairing UI (QR) | EPIC-8 | P0 | 3 | 147,123 | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-181 | Renderer registry + layout interpreter | EPIC-8 | P0 | 3 | 180,161 | ⬜ Backlog | Claude | ✅ Ready | 0% |
| PROJ-182 | Widget: button + toggle | EPIC-8 | P0 | 2 | 181 | ⬜ Backlog | Claude | ⛔ Blocked | 0% |
| PROJ-183 | Widget: slider + label + image | EPIC-8 | P0 | 2 | 181 | ⬜ Backlog | Claude | ⛔ Blocked | 0% |
| PROJ-184 | Widget: circular + linear gauge | EPIC-8 | P0 | 3 | 181 | ⬜ Backlog | Claude | ⛔ Blocked | 0% |
| PROJ-185 | Widget: sparkline (series state) | EPIC-8 | P1 | 2 | 181,160 | ⬜ Backlog | Claude | ⛔ Blocked | 0% |
| PROJ-186 | Widget: media card (basic) + page-nav | EPIC-8 | P1 | 2 | 181 | ⬜ Backlog | Claude | ⛔ Blocked | 0% |
| PROJ-187 | Gesture capture (all slots) + 2-tap confirm | EPIC-8 | P0 | 3 | 181 | ⬜ Backlog | Claude | ⛔ Blocked | 0% |
| PROJ-188 | Degradation UI (dimmed + badge) | EPIC-8 | P0 | 2 | 180,181 | ⬜ Backlog | Claude | ⛔ Blocked | 0% |
| PROJ-189 | Theme tokens + accessibility | EPIC-8 | P1 | 2 | 181 | ⬜ Backlog | Claude | ⛔ Blocked | 0% |
| PROJ-190 | Installer — Windows | EPIC-1 | P1 | 3 | 106,180 | ⬜ Backlog | Claude | ⛔ Blocked | 0% |
| PROJ-191 | Installer — macOS | EPIC-1 | P1 | 3 | 107,180 | ⬜ Backlog | Claude | ⛔ Blocked | 0% |
| PROJ-192 | Installer — Linux | EPIC-1 | P1 | 3 | 108,180 | ⬜ Backlog | Claude | ⛔ Blocked | 0% |
| PROJ-200 | Flow model + document persistence | EPIC-7 | P1 | 2 | 112,161 | ⬜ Backlog | Claude | ✅ Ready | 0% |
| PROJ-201 | Expression language (lexer/parser/eval) | EPIC-7 | P1 | 3 | 160 | ⬜ Backlog | Claude | ✅ Ready | 0% |
| PROJ-202 | Flow executor + run context | EPIC-7 | P1 | 3 | 200,201,162 | ⬜ Backlog | Claude | ⛔ Blocked | 0% |
| PROJ-203 | Core nodes (action/if/setVar/wait/loop/…) | EPIC-7 | P1 | 3 | 202,125 | ⬜ Backlog | Claude | ⛔ Blocked | 0% |
| PROJ-204 | Triggers (manual/event/stateChange) | EPIC-7 | P1 | 2 | 202,162 | ⬜ Backlog | Claude | ⛔ Blocked | 0% |
| PROJ-210 | Designer canvas (renders as target device) | EPIC-9 | P0 | 3 | 181,163 | ⬜ Backlog | Claude | ⛔ Blocked | 0% |
| PROJ-211 | Op model + op-log apply/version | EPIC-9 | P0 | 3 | 210,112 | ⬜ Backlog | Claude | ⛔ Blocked | 0% |
| PROJ-212 | Op-log broadcast + live device reflection | EPIC-9 | P0 | 3 | 211,150 | ⬜ Backlog | Claude | ⛔ Blocked | 0% |
| PROJ-213 | Drag-drop placement + move/resize ghosts | EPIC-9 | P1 | 3 | 211,143 | ⬜ Backlog | Claude | ⛔ Blocked | 0% |
| PROJ-214 | Schema-driven inspector | EPIC-9 | P0 | 3 | 211,161 | ⬜ Backlog | Claude | ⛔ Blocked | 0% |
| PROJ-215 | Undo/redo (op inverses) | EPIC-9 | P1 | 2 | 211 | ⬜ Backlog | Claude | ⛔ Blocked | 0% |
| PROJ-216 | Profile mgmt + explicit device targeting | EPIC-9 | P1 | 2 | 211,163 | ⬜ Backlog | Claude | ⛔ Blocked | 0% |
| PROJ-217 | Grid config editor (no caps) | EPIC-9 | P1 | 2 | 210 | ⬜ Backlog | Claude | ⛔ Blocked | 0% |
| PROJ-300 | Security test suite (sniff/MITM/rogue/leak) | EPIC-10 | P0 | 3 | 127,180 | ⬜ Backlog | Claude | ⛔ Blocked | 0% |
| PROJ-301 | Performance soak (8h, ≥8 sessions) | EPIC-10 | P0 | 3 | 171,150,184 | ⬜ Backlog | Claude | ⛔ Blocked | 0% |
| PROJ-302 | E2E journeys (J0/J1/J2/J6) | EPIC-10 | P0 | 3 | 212,214,173,175 | ⬜ Backlog | Claude | ⛔ Blocked | 0% |
| PROJ-303 | Phase-1 acceptance (P1-AC-01..16) | EPIC-10 | P0 | 2 | 300,301,302 | ⬜ Backlog | Claude | ⛔ Blocked | 0% |

---

## 5 · Milestone tracker

Advance a milestone to ✅ only when **every** gating ticket is Done.

| Gate | Milestone | Gating tickets (all must be Done) | Status |
|------|-----------|-----------------------------------|--------|
| **M1** | Bootstrap green | 101, 102, 103 | ⬜ Not started |
| **M2** | Persistence + security base | 110, 111, 112, 113, 114, 115, 120, 121, 122, 125, 127 | ✅ Done (2026-06-07) |
| **M3** | Live telemetry on a phone | 160, 150, 170, 171, 180, 181, 184, 130, 132 | 🟨 In progress (7/9 — 181, 184 left) |
| **M4** | Actions + permissions on device | 125, 133, 173, 174, 175, 187, 188 | ⬜ Not started |
| **M5** | Resilience proven | 145, 146, 148, 149, 188 | ⬜ Not started |
| **M6** | Author on desktop, watch live (headline) | 210, 211, 212, 181, 150, 214 | ⬜ Not started |
| **M7** | All P1-ACs green — PHASE EXIT | 300, 301, 302, 303 (+ all P0) | ⬜ Not started |

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
| 23 | 2026-06-08 | PROJ-180 | 3 | 84 | 42% | **Client connection manager + pairing (CRITICAL PATH; M3 client side).** Full Dart client stack mirroring the engine wire/crypto: `crypto/crypto.dart` (X25519/Ed25519/HKDF-SHA256/ChaCha20-Poly1305 via package:cryptography + BigInt Ed25519→X25519 conversions) **proven interoperable by cross-language KAT vectors emitted from the Go engine**; `net/{framing,envelope,encrypted_session,channels,conn}.dart` (uint32 frames, base64-payload JSON envelope, per-direction AEAD session, channel router); `net/pairing.dart` (device-side ClientHello→ServerHello→KeyConfirm→PairResult state machine — **engine fingerprint verify (anti-MITM)**, sigD/sigE, forward-secret keys; defines the handshake wire encoding since the engine has none yet; DeviceIdentity + injectable KeyStore); `net/connection_manager.dart` (resolve+dial+pair, candidate fallback, bounded retry/backoff); `app/pairing.dart` (engine list, QR scan — mobile_scanner on Android, manual entry on desktop — fingerprint + error UI). Tests (44, all green): crypto KAT, framing, envelope (byte-exact vs Go JSON), session (round-trip + **no plaintext on the wire** + tamper teardown), pairing vs a faithful Dart mock engine (**pair success / fingerprint mismatch / bad token / forged sig**), connection-manager retry, QR parse, pairing widget. `dart analyze` clean; **`flutter build windows` + `flutter build apk` both green** (dropped flutter_secure_storage to avoid the VS-ATL dep — secure keystore injected per-platform; disabled Kotlin incremental for the mobile_scanner build). P1-AC-02 + P1-AC-03(client) met. Live Go↔Dart interop awaits the engine accept/handshake-over-wire glue (future ticket). Newly Ready: 181, 109. EPIC-8 started (13%). Critical path 14/31. |
| 22 | 2026-06-08 | PROJ-147 | 3 | 81 | 41% | **mDNS / DNS-SD discovery (engine + client).** Engine: `Identity.Fingerprint()` (lowercase hex SHA-256 of the Ed25519 pubkey — the anti-MITM id reused by pairing/QR). `core/transport/discovery_mdns.go` advertises `_cyberdeck._tcp.local` with TXT `{name,uuid,ver,fp}` and browses, via maintained `github.com/libp2p/zeroconf/v2`; pure `encodeTXT`/`parseTXT` codec (uuid+fp required, unknown keys tolerated); `DiscoveredEngine.Endpoint()` maps onto the `SourceMDNS` candidate (kind stays below the manager); `MDNSService` Start/Stop adapter (structurally satisfies the lifecycle Service seam — no import coupling) ready to wire into the boot mDNS stage once identity is constructed in main. Client: `net/discovery.dart` — `DiscoveredEngine` model + pure `fromTxt`/`parseTxtEntries` + `MdnsEngineDiscovery` (official `multicast_dns`, PTR→SRV→TXT→A). Tests: engine (`-race`) codec round-trip, required-field rejection, unknown-key tolerance, endpoint mapping, in-memory advertise→browse through the seams, fingerprint determinism, + best-effort real-multicast round-trip (skips cleanly when multicast blocked); client (9 tests) fromTxt/equality/TXT parsing. `dart analyze` + `flutter test` green. Discovery is the happy path, not a hard pairing dep (148 manual is the fallback). Newly Ready: 148. EPIC-4 59%. |
| 21 | 2026-06-08 | PROJ-105 | 3 | 78 | 39% | **Real boot wiring + graceful shutdown + single-instance guard.** `lifecycle.Subsystems` (injected interfaces: Migrator/Closer/Service + InitCore/FlushCore funcs; any nil = logged+skipped so not-yet-built stages — LAN listener/mDNS, 147 — hold their documented place) drives `BuildStages` (config→SQLite→core→plugin host→transport→mDNS→READY, 2B §7.1) and `BuildShutdownSteps` (stop sessions→flush→stop plugins→close SQLite, 2B §7.2). Single-instance guard: portable `AcquireInstance(name, onFocus)` over an OS lock listener with per-OS endpoints — `singleinstance_{linux(abstract socket),darwin(TMPDIR socket+unlink),windows(loopback TCP)}.go`; second launch dials + signals focus then returns `ErrAlreadyRunning`. Added `Host.Shutdown` (close all plugins). Entrypoint now opens+migrates real SQLite, builds core (state store + plugin host), claims the instance lock, boots on its own context (signal drives only the post-boot shutdown wait), `--data` dir flag. Tests (`-race`): boot/shutdown order with fakes, stage-error abort, nil-skip, single-instance refusal+focus + re-acquire, **integration boot with real SQLite→READY→clean close**; cross-compiles linux/darwin. Newly Ready: 106/107/108. EPIC-1 28%. |
| 20 | 2026-06-08 | PROJ-171 | 3 | 75 | 38% | **First real out-of-process 1P plugin (M3 engine-side).** Factored the IPC wire protocol into a stdlib-only `engine/pluginhost/ipcproto` pkg (Message/payloads/MsgType + Encode/Decode); pluginhost re-exports via type aliases so host + all tests stay green. Added root `go.work` (engine + plugins/telemetry) and the **`plugins/telemetry` module** (gopsutil v4, `replace` → ../../engine): `providers.Gopsutil` implements `pal.Telemetry` ((value,ok) per metric — cpu/ram/net-delta/disk/uptime); `Publisher` emits typed `system.*` stateUpdates on per-metric cadences (cpu/ram/net 1s, disk 10s, uptime 60s) + under→over threshold events (cpu>85, ram>90); `main.go` stdio IPC loop (init→register→publish→heartbeat→exit on stdin close); manifest.json (telemetry.read). Tests (`-race`, both modules): deterministic Publisher (clock-driven cadence + threshold-transition + unavailable-skip), gopsutil smoke (contract), **end-to-end via `pluginhost.Host` launching the plugin as a real subprocess → `system.uptime` reaches the state setter** (P1-AC-04 pipeline + IPC declared-state gate). Newly Ready: 172 (GPU chain). EPIC-5 56%. |

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

*End of Progress Dashboard (baseline). Final document next: Claude Agent Instructions — the operating rules that drive this dashboard.*
