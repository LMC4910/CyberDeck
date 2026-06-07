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
| **Done** | 13 tickets / 30 pts (…111, 113, 123, 112, 114, 115) — **EPIC-2 complete** |
| **In flight** (Ready→Testing) | 1 (PROJ-102 — workflows authored + locally green; live-CI run + branch protection pending repo-owner push) |
| **Blocked** | 57 |
| **Ready now** | 9 (PROJ-103, 125, 141, 161, 162, 163, 164, 170, 201) |
| **Completion** | **15%** (30 / 199 pts) |
| **Critical-path progress** | 11 / 31 pts (121 ✓, 120 ✓, 122 ✓, 123 ✓) |
| **Current wave** | 1 of 10 |

> **[†] Numbering reconciliation (2026-06-07):** the original dashboard labeled PROJ-121="Identity" and PROJ-120="Trust store", but the authoritative Batch-1 *tickets* define **PROJ-121 = per-OS SecretStore** (root) and **PROJ-120 = engine identity** (→121). The dependency shape is identical; titles corrected here to match the tickets (the ticket wins for scope per Agent Instructions §1).

**By priority:** P0 = 47 tickets / 124 pts · P1 = 33 tickets / 75 pts. (P0 must all be Done for phase exit; P2 — none in Phase 1; deferred features live in later phases.)

**Progress bar:** `░░░░░░░░░░░░░░░░░░░░` 0%

---

## 2 · Epic rollup

| Epic | Tickets | Points | Done (tix) | Done (pts) | % complete |
|------|---------|--------|------------|------------|------------|
| EPIC-1 Lifecycle & Packaging | 12 | 32 | 1 | 2 | 6% |
| EPIC-2 Persistence | 6 | 12 | 6 | 12 | 100% |
| EPIC-3 Security & Identity | 8 | 19 | 4 | 11 | 58% |
| EPIC-4 Transport & Connectivity | 11 | 27 | 1 | 2 | 7% |
| EPIC-5 Plugin Host & 1P Capabilities | 11 | 27 | 0 | 0 | 0% |
| EPIC-6 State, Registries & Event Bus | 5 | 13 | 1 | 3 | 23% |
| EPIC-7 Flow Engine Core | 5 | 13 | 0 | 0 | 0% |
| EPIC-8 Client Runtime & Widgets | 10 | 24 | 0 | 0 | 0% |
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
| PROJ-103 | Config loader + schema | EPIC-1 | P0 | 2 | 101 | ⬜ Backlog | Claude | ✅ Ready | 0% |
| PROJ-104 | Engine service skeleton (daemon lifecycle) | EPIC-1 | P0 | 2 | 101,103 | ⬜ Backlog | Claude | ⛔ Blocked | 0% |
| PROJ-105 | Service orchestration (wire subsystems) | EPIC-1 | P0 | 3 | 104,110,150 | ⬜ Backlog | Claude | ⛔ Blocked | 0% |
| PROJ-106 | Build artifacts — Windows | EPIC-1 | P1 | 3 | 105 | ⬜ Backlog | Claude | ⛔ Blocked | 0% |
| PROJ-107 | Build artifacts — macOS | EPIC-1 | P1 | 3 | 105 | ⬜ Backlog | Claude | ⛔ Blocked | 0% |
| PROJ-108 | Build artifacts — Linux | EPIC-1 | P1 | 3 | 105 | ⬜ Backlog | Claude | ⛔ Blocked | 0% |
| PROJ-109 | Tray/menubar control app | EPIC-1 | P1 | 3 | 105,180 | ⬜ Backlog | Claude | ⛔ Blocked | 0% |
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
| PROJ-124 | Pairing token issuance + QR payload | EPIC-3 | P1 | 2 | 123,150 | ⬜ Backlog | Claude | ⛔ Blocked | 0% |
| PROJ-125 | Permission model + authorize() | EPIC-3 | P0 | 3 | 113 | ⬜ Backlog | Claude | ✅ Ready | 0% |
| PROJ-126 | Trust revocation + session teardown | EPIC-3 | P1 | 1 | 123,125 | ⬜ Backlog | Claude | ⛔ Blocked | 0% |
| PROJ-127 | Audit log writer + redaction | EPIC-3 | P1 | 2 | 114,125 | ⬜ Backlog | Claude | ⛔ Blocked | 0% |
| PROJ-130 | Plugin host: launch/supervise/IPC | EPIC-5 | P0 | 3 | 160,103 | ⬜ Backlog | Claude | ⛔ Blocked | 0% |
| PROJ-131 | Plugin host: restart/fault policy | EPIC-5 | P0 | 2 | 130 | ⬜ Backlog | Claude | ⛔ Blocked | 0% |
| PROJ-132 | Plugin manifest validation + registry merge | EPIC-5 | P0 | 2 | 130,161 | ⬜ Backlog | Claude | ⛔ Blocked | 0% |
| PROJ-133 | Permission enforcement at IPC boundary | EPIC-5 | P0 | 2 | 132,125 | ⬜ Backlog | Claude | ⛔ Blocked | 0% |
| PROJ-140 | Endpoint abstraction + ConnectionManager | EPIC-4 | P0 | 2 | — | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-141 | Framing + Serializer seam | EPIC-4 | P0 | 2 | 140 | ⬜ Backlog | Claude | ✅ Ready | 0% |
| PROJ-142 | Encrypted session (reader/writer/demux) | EPIC-4 | P0 | 3 | 141,122 | ⬜ Backlog | Claude | ⛔ Blocked | 0% |
| PROJ-143 | Three channels + backpressure | EPIC-4 | P0 | 3 | 142 | ⬜ Backlog | Claude | ⛔ Blocked | 0% |
| PROJ-144 | Loopback privileged control channel | EPIC-4 | P1 | 2 | 142 | ⬜ Backlog | Claude | ⛔ Blocked | 0% |
| PROJ-145 | Heartbeat / keepalive (sleep-tolerant) | EPIC-4 | P1 | 2 | 142 | ⬜ Backlog | Claude | ⛔ Blocked | 0% |
| PROJ-146 | Reconnect (backoff→mDNS→scan) | EPIC-4 | P1 | 3 | 145,147 | ⬜ Backlog | Claude | ⛔ Blocked | 0% |
| PROJ-147 | Discovery: mDNS advertise/browse | EPIC-4 | P0 | 3 | 141,120 | ⬜ Backlog | Claude | ⛔ Blocked | 0% |
| PROJ-148 | Discovery: manual + active scan | EPIC-4 | P1 | 2 | 147 | ⬜ Backlog | Claude | ⛔ Blocked | 0% |
| PROJ-149 | Versioned resync on gap | EPIC-4 | P1 | 2 | 143 | ⬜ Backlog | Claude | ⛔ Blocked | 0% |
| PROJ-150 | Multi-session fan-out + subscription filter | EPIC-4 | P0 | 3 | 143,160 | ⬜ Backlog | Claude | ⛔ Blocked | 0% |
| PROJ-160 | Typed state model + state store core | EPIC-6 | P0 | 3 | — | ✅ Done | Claude | ✅ Ready | 100% |
| PROJ-161 | Registries (action/widget/flow-node) | EPIC-6 | P0 | 3 | 160,112 | ⬜ Backlog | Claude | ✅ Ready | 0% |
| PROJ-162 | Event bus | EPIC-6 | P0 | 2 | 160 | ⬜ Backlog | Claude | ✅ Ready | 0% |
| PROJ-163 | Session/profile model + activation hook | EPIC-6 | P0 | 3 | 160,113 | ⬜ Backlog | Claude | ✅ Ready | 0% |
| PROJ-164 | Variables (var.*) typed+durable+bindable | EPIC-6 | P1 | 2 | 160,112 | ⬜ Backlog | Claude | ✅ Ready | 0% |
| PROJ-170 | PAL capability interfaces + provider chain | EPIC-5 | P0 | 3 | 160 | ⬜ Backlog | Claude | ✅ Ready | 0% |
| PROJ-171 | 1P plugin: telemetry (CPU/RAM/net/disk) | EPIC-5 | P0 | 3 | 170,132 | ⬜ Backlog | Claude | ⛔ Blocked | 0% |
| PROJ-172 | 1P plugin: GPU telemetry provider chain | EPIC-5 | P1 | 3 | 171 | ⬜ Backlog | Claude | ⛔ Blocked | 0% |
| PROJ-173 | 1P plugin: power actions | EPIC-5 | P0 | 3 | 170,132 | ⬜ Backlog | Claude | ⛔ Blocked | 0% |
| PROJ-174 | 1P plugin: volume (system master) | EPIC-5 | P1 | 2 | 170,132 | ⬜ Backlog | Claude | ⛔ Blocked | 0% |
| PROJ-175 | 1P plugin: launchers + system tools | EPIC-5 | P1 | 2 | 132 | ⬜ Backlog | Claude | ⛔ Blocked | 0% |
| PROJ-176 | 1P plugin: notification count | EPIC-5 | P1 | 2 | 170,132 | ⬜ Backlog | Claude | ⛔ Blocked | 0% |
| PROJ-180 | Client connection mgr + pairing UI (QR) | EPIC-8 | P0 | 3 | 147,123 | ⬜ Backlog | Claude | ⛔ Blocked | 0% |
| PROJ-181 | Renderer registry + layout interpreter | EPIC-8 | P0 | 3 | 180,161 | ⬜ Backlog | Claude | ⛔ Blocked | 0% |
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
| PROJ-200 | Flow model + document persistence | EPIC-7 | P1 | 2 | 112,161 | ⬜ Backlog | Claude | ⛔ Blocked | 0% |
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
| **M2** | Persistence + security base | 110, 111, 112, 113, 114, 115, 120, 121, 122, 125, 127 | ⬜ Not started |
| **M3** | Live telemetry on a phone | 160, 150, 170, 171, 180, 181, 184, 130, 132 | ⬜ Not started |
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
