# CyberDeck — Phase 1 · Dependency Graph & Execution Plan

**Execution-system Document 6 of N** · Version 0.1 (Draft) · June 2026 · `com.shishir.cyberdeck`

> Computed from the complete ticket set across Batches 1–4. Every number, edge, and ordering in this document was derived programmatically from the dependency edges declared in each ticket — not hand-estimated. Where the analysis disagrees with earlier planning rollups, this document is the source of truth and the discrepancy is called out.

---

## 0 · Reconciliation note (read this first)

The master Kanban board produced before the ticket batches estimated **45 tickets / 113 points**. The actual specified ticket set across Batches 1–4 totals **80 PROJ-IDs / 199 points**.

The gap is real and intentional. Two effects produced it:

1. **Per-OS triplets were expanded into separate tickets** in the batches because they are separate work items by OS (different toolchain, different bugs, different test environment). The board had collapsed them: e.g. `PROJ-106 Build artifacts` became `PROJ-106/107/108` (Windows/macOS/Linux); `PROJ-190 Installer` became `PROJ-190/191/192`. That is honest tracking — a Windows installer being Done does not get the user a macOS installer.

2. **Point estimates were tightened during specification.** Several tickets that the board sized at 1–2 pts grew to 2–3 pts once their acceptance criteria were written out in full (e.g. PROJ-104 service skeleton; PROJ-125 permissions; the security tests in EPIC-10). Tightening estimates against the actual work-to-be-done is the right direction; under-estimating is the failure mode.

**This document uses the verified figures: 80 tickets, 199 points, critical path 31 points.** The Kanban board will be reconciled before execution starts.

---

## 1 · Dependency Graph

The graph is a DAG over 80 nodes (one per PROJ-ID) with edges from prerequisite → dependent. It is *not* a tree — many tickets have multiple prerequisites (a designer ticket commonly waits on a client ticket *and* a state-store ticket *and* the registries).

### 1.1 The Ready Set — Wave 0 (no dependencies, can start immediately)

| ID | Title | Epic | Pts |
|----|-------|------|-----|
| **PROJ-101** | Monorepo bootstrap (Go + Flutter) | EPIC-1 | 2 |
| **PROJ-102** | Configure CI baseline | EPIC-1 | 2 |
| **PROJ-110** | Persistence baseline (SQLite + schema v1) | EPIC-2 | 2 |
| **PROJ-121** | Identity (Ed25519 keypair + UUID) | EPIC-3 | 3 |
| **PROJ-140** | Transport endpoint abstraction + ConnectionManager | EPIC-4 | 2 |
| **PROJ-160** | Typed state model + state store core | EPIC-6 | 3 |

**14 points across 6 tickets, fully parallelizable from t=0.** These six are the entry points to the graph — every other ticket descends from one of them. They span all five concern groups (build, persistence, security, transport, state) so a small team can grab one per workstream and start immediately.

### 1.2 Wave structure

Each "wave" contains tickets whose prerequisites are *all* satisfied at the previous wave. A ticket's wave = `1 + max(wave of its deps)`, so wave depth is the count of serial steps on its longest dependency chain. The graph has **10 waves** (depth 0–10).

| Wave | Tickets | Points | Notable contents |
|------|---------|--------|------------------|
| **0** | 6 | 14 | Ready set (above) |
| **1** | 7 | 16 | PROJ-103, 111, 120, 141, 162, 170, 201 |
| **2** | 7 | 18 | PROJ-104, 112, 113, 114, 122, 130, 147 |
| **3** | 9 | 22 | PROJ-115, 123, 125, 131, 142, 148, 161, 163, 164 |
| **4** | 8 | 17 | PROJ-126, 127, 132, 143, 144, 145, 180, 200 |
| **5** | 12 | 31 | PROJ-133, 146, 149, **150**, **171**, 173, 174, 175, 176, **181**, 202, 300 |
| **6** | 14 | 34 | PROJ-105, 124, 172, **182–189**, 203, 204, **210** |
| **7** | 7 | 20 | PROJ-106, 107, 108, 109, **211**, 217, **301** |
| **8** | 8 | 22 | PROJ-190, 191, 192, **212**, 213, **214**, 215, 216 |
| **9** | 1 | 3 | **PROJ-302** (E2E journeys) |
| **10** | 1 | 2 | **PROJ-303** (acceptance — phase exit) |

**Wave 5 is the widest** (12 tickets, 31 pts) — it's where the plugin host (PROJ-130/131/132) clears, allowing all five first-party plugins to start in parallel with the client renderer (PROJ-181), fan-out (PROJ-150), flow executor (PROJ-202), and security tests (PROJ-300). If staffing is available, **wave 5 is where parallelism pays out hardest**.

**Waves 9 and 10 are single-ticket gates.** PROJ-302 (E2E) is the integration verifier; PROJ-303 (acceptance) is the phase exit. They are deliberately serial — by design, no work can run in parallel with the acceptance pass.

### 1.3 Critical path — the 31-point spine

> **PROJ-121 → PROJ-120 → PROJ-122 → PROJ-123 → PROJ-180 → PROJ-181 → PROJ-210 → PROJ-211 → PROJ-212 → PROJ-302 → PROJ-303**

The longest chain through the graph by effort, totaling 31 points (~62 hours at 1pt≈2h). Every other ticket fits within the slack of this chain. Any slip on a critical-path ticket pushes Phase 1's exit date 1:1.

**Why this path?** It is the **security → client → designer → acceptance** spine — the only chain that connects every "headline" capability:

| Step | Ticket | What it proves |
|------|--------|----------------|
| 1 | PROJ-121 (identity) | A device has an identity. |
| 2 | PROJ-120 (trust store) | Identities can be trusted. |
| 3 | PROJ-122 (crypto suite) | Trust can encrypt. |
| 4 | PROJ-123 (handshake) | Two parties can authenticate + key-exchange. |
| 5 | PROJ-180 (client + QR pair) | A phone can complete that handshake. |
| 6 | PROJ-181 (renderer) | The phone can paint a layout. |
| 7 | PROJ-210 (designer canvas) | The desktop can edit that layout. |
| 8 | PROJ-211 (op-log) | Edits are versioned operations. |
| 9 | PROJ-212 (live broadcast) | Edits reflect on the phone live. |
| 10 | PROJ-302 (E2E) | The whole loop works end to end. |
| 11 | PROJ-303 (acceptance) | All 16 P1-ACs pass. |

This is the product's reason for existing in eleven steps. Everything else (telemetry, power, smart-home stubs, flow nodes, hardening tests) is *important value* hung off this spine.

**There is a near-tie critical path through PROJ-214 (inspector)** instead of PROJ-212 at the same wave/point depth. They both feed PROJ-302. Either can drag — both need attention.

### 1.4 Chokepoint analysis — the "if this slips, everything slips" nodes

Two metrics matter:

**Transitive unblocks** — how many downstream tickets ultimately depend on this one:

| ID | Transitive | What it gates |
|----|------------|---------------|
| PROJ-110 | 55 | Persistence baseline gates all repos, settings, profiles, audit |
| PROJ-160 | 50 | State store gates registries, fan-out, plugins, expressions, gauges |
| PROJ-111 | 50 | Schema-v1 gates every repository |
| PROJ-121 | 44 | Identity gates the entire security chain |
| PROJ-120 | 43 | Trust store gates handshake → pairing → client |
| PROJ-140 | 41 | Transport endpoint gates all transport |
| PROJ-141 | 40 | Framing gates everything that rides the wire |
| PROJ-122 | 40 | Crypto gates session, pairing, fingerprint |
| PROJ-113 | 35 | Trust repo gates handshake, permissions, session |
| PROJ-112 | 35 | Documents repo gates registry, variables, flow, op-log |

**Direct fan-out** — how many tickets immediately become Ready when this lands:

| ID | Direct unblocks |
|----|-----------------|
| PROJ-160 (state store) | 9 (130, 150, 161, 162, 163, 164, 170, 185, 201) |
| PROJ-181 (renderer) | 9 (all eight widgets + designer canvas) |
| PROJ-180 (client+pairing) | 7 (renderer, degradation, tray, three installers, security tests) |
| PROJ-132 (manifest/merge) | 6 (perm boundary + all five first-party plugins) |
| PROJ-211 (op-log) | 5 (live broadcast, drag-drop, inspector, undo, profiles) |
| PROJ-112 (documents repo) | 5 (audit, registry, variables, flow, op-log) |

**The practical implication:** if velocity is limited, PROJ-160 and PROJ-181 are the two single tickets where getting them green *fastest* pays the biggest parallelism dividend. They each release nine immediate followups. Treat them as P0+ even within their priority tier.

### 1.5 High-level epic DAG

```
                    Wave 0           Wave 1-2         Wave 3-4        Wave 5-6           Wave 7-8        Wave 9-10
                    ──────           ────────         ────────        ────────           ────────        ─────────
EPIC-1 Lifecycle    101,102 ────►    103 ─► 104 ─────────────► 105 ──────► 106/107/108 ─► 190/191/192       │
                                                              │ 109                                          │
                                                              ▼                                              │
EPIC-2 Persist      110 ─────► 111 ─► 112/113/114 ─► 115                                                     │
                                                                                                             │
EPIC-3 Security     121 ─────► 120 ─► 122 ─► 123 ─► 125 ─► 126/127 ──────────────────┐                       │
                                                                          ┌──────────┼──────►  PROJ-300 ───┐ │
EPIC-4 Transport    140 ─────► 141 ─► 142 ─► 143 ─► 144/145 ─► 146/149/150 ──────────┤                     │ │
                                          ▲                                          │                     │ │
                                          └────── 147 ─► 148                         │                     │ │
                                                                                     │                     │ │
EPIC-6 State        160 ─────► 162 ─────► 161 (needs 112) / 163/164 ─────────────────┤                     │ │
                                                                                     │                     │ │
EPIC-5 Plugins                  130 (needs 160,103) ─► 131                           │                     │ │
                                  132 (needs 130,161) ─► 133, 171–176                │                     │ │
                                  170 ─► 171 ─► 172                                  ▼                     │ │
EPIC-8 Client                                       180 ─► 181 ─► 182–189            ───────►   211 ─► 212 ─┤ │
                                                                                                  │  214 ──┤ │
EPIC-7 Flow                                  201 ─► 202 ─► 203/204                                │        │ │
                                                                                                  ▼        │ │
EPIC-9 Designer                                                       210 (181+163) ─► 211 ─► 212/213/214/ │ │
                                                                                              215/216/217  │ │
EPIC-10 Hardening                                                              300 ─► 301 ─► 302 ──────────┤ │
                                                                                                           │ │
                                                                                                           └─┴► 303
                                                                                                            (PHASE EXIT)
```

(Lines indicate dominant dependency direction; not every edge is drawn — see the per-ticket dep lists for the full set.)

---

## 2 · Execution Plan

### 2.1 Sequencing strategy — "pull from Ready, respect waves"

The execution model is single-agent (Claude), pulling tickets in a clear order:

1. **Pull the highest-priority Ready ticket** — Ready = "all deps Done"; priority breaks ties (P0 > P1 > P2).
2. **Within priority**, prefer tickets with **higher direct fan-out** (release more downstream work) and tickets **on the critical path** (don't let the spine drag).
3. **Implement to the ticket's AC and Definition of Done**; run the ticket's validation commands; mark Done only when green.
4. **Re-scan for new Ready tickets** (deps just satisfied) and continue.

This gives a deterministic, dependency-respecting order without requiring scheduling intelligence at the agent level.

**The Ready set always shrinks and grows.** After PROJ-160 is Done, 9 new tickets enter Ready. After PROJ-181 is Done, 9 more enter Ready. The Ready set is widest in waves 5–6 (~12–14 simultaneously pullable tickets); the agent should still pick one at a time, but the ordering by fan-out becomes meaningful.

### 2.2 Parallel workstreams (for multi-agent / staffed teams)

If multiple agents or engineers run concurrently, the graph cleanly decomposes into **nine independent streams** that share only a handful of synchronization points. Each stream is a chain a single agent can own end to end.

| # | Stream | Owner of work | Tickets | Pts | Sync points |
|---|--------|---------------|---------|-----|-------------|
| 1 | **Build & Service** | Lifecycle/packaging | 101, 102, 103, 104, 105, 106, 107, 108, 109, 190, 191, 192 | 32 | needs 110, 150, 180 |
| 2 | **Persistence** | DB + repositories | 110, 111, 112, 113, 114, 115 | 12 | feeds nearly everything |
| 3 | **Security** | Identity, trust, crypto, perms, audit | 121, 120, 122, 123, 125, 124, 126, 127 | 19 | feeds session (142), pairing (180), permissions everywhere |
| 4 | **Transport** | Endpoint, framing, session, channels, discovery, fan-out | 140, 141, 142, 143, 144, 145, 146, 147, 148, 149, 150 | 27 | needs 122 (for 142), feeds the world |
| 5 | **State & Registries** | State store, event bus, registries, session, vars | 160, 161, 162, 163, 164 | 13 | needs 112; feeds plugins, client, flow, designer |
| 6 | **Plugins** | Host + 5 first-party plugins | 130, 131, 132, 133, 170, 171, 172, 173, 174, 175, 176 | 27 | needs 160, 161, 125; feeds telemetry/power/etc. on devices |
| 7 | **Client** | Connection, renderer, widgets, gestures, degradation, theme | 180, 181, 182, 183, 184, 185, 186, 187, 188, 189 | 24 | needs 123, 147, 161; feeds designer + acceptance |
| 8 | **Flow** | Model, expr, executor, nodes, triggers | 200, 201, 202, 203, 204 | 13 | needs 112, 161, 160, 162, 125; mostly self-contained |
| 9 | **Designer** | Canvas, op-log, broadcast, drag/drop, inspector, undo, profiles, grid | 210, 211, 212, 213, 214, 215, 216, 217 | 21 | needs 181, 163, 150; the deepest stream |
| — | **Hardening (sequential)** | 300, 301, 302, 303 | 11 | converges everything; runs at the end |

**Practical staffing implications:**

- **Day 1:** six streams can launch in parallel (Streams 1, 2, 3, 4, 5, plus the parts of 6 and 8 that need only PROJ-160). Six concurrent agents = ~3 days to clear Wave 0–1.
- **By end of Wave 4:** Streams 6, 7, and 8 fully active. Eight streams running in parallel.
- **Wave 5–6 is the widest** — at peak, 12–14 tickets can run simultaneously.
- **Wave 9–10 is the bottleneck** — single-threaded by design (E2E then acceptance).

### 2.3 Milestone gates (M1 → M7)

Phase 1 has seven gates from the Deep Dive. The graph computation tells us exactly when each becomes possible:

| Gate | Definition | Earliest achievable wave | Gating tickets |
|------|------------|--------------------------|----------------|
| **M1** | Bootstrap green (CI green, monorepo healthy) | Wave 1 | 101, 102, 103 |
| **M2** | Persistence + security in place | Wave 4 | 115, 127 (audit needs 125; 115 needs all repos) |
| **M3** | Live telemetry on a phone | **Wave 6** | 171 (telemetry plugin), 150 (fan-out), 184 (gauge), 181 (renderer), 180 (client). All converge at wave 5–6. |
| **M4** | Actions + permissions on a device | Wave 6 | 173/174/175 (action plugins), 125 (perms), 187 (2-tap confirm), 188 (degradation) |
| **M5** | Resilience proven | Wave 5–6 | 146 (reconnect), 145 (heartbeat), 149 (resync), 188 (degradation UI) |
| **M6** | Author on desktop, watch on phone live | **Wave 8** | 212 (the headline ticket); needs 211, 150, 181, 210 |
| **M7** | All P1-ACs green; phase exit | **Wave 10** | 303 (gated by 300, 301, 302) |

**M3 is the first user-visible payoff** (phone shows live CPU). M6 is the **product-defining demo** (designer→device live). M7 is the **business gate** (Phase 1 ships).

### 2.4 Risk register — where this plan can break

Risks ranked by (impact × likelihood):

| Risk | Tickets at risk | Impact | Likelihood | Mitigation |
|------|-----------------|--------|------------|------------|
| **Crypto correctness defects** (the chain breaks silently or weakens) | 122, 123, 142, 300 | Very high (security) | Medium | Vetted libraries (NaCl/libsodium-class); reviewer-mandated; PROJ-300 sniff/MITM tests are mandatory gates, not optional |
| **Sandboxed expression language has a side channel** | 201 | High (security) | Medium | Whitelist operators; no host callbacks; explicit malformed/injection tests in AC; second-pair code review |
| **Plugin host crash-isolation is fragile under real plugins** | 130, 131 | High (NFR-07 / AC-13) | Medium | Crashing test-plugin fixture + induced-panic tests *required* in AC; soak harness (PROJ-301) catches creep |
| **Op-log/live-broadcast race conditions** (the M6 demo flakes) | 211, 212 | High (headline feature) | Medium | Single-writer lock in V1 (deliberate simplification, ADR-0012); gap→resync (PROJ-149) is the safety net |
| **Per-OS work has unequal complexity** (macOS Keychain vs Windows DPAPI differ wildly) | 106/107/108, 190/191/192, 173, 174, 176 | Medium | High | Triplets are intentionally split so one OS being hard doesn't block others (Linux installer might trail); document degradation per OS |
| **GPU telemetry is partial cross-platform** (NVAPI/ADL on Windows; sparse on macOS/Linux) | 172 | Low (degrades) | High | Provider chain (PROJ-170) already designed for this — degrades to `--`, no crash |
| **OS notification access blocked on hardened machines** | 176 | Low (degrades) | Medium | Plugin degrades to unavailable; documented |
| **Fan-out perf doesn't hit 8 sessions @ 60FPS** | 150, 184, 301 | Medium (NFR-03/10) | Low–Medium | 8-session load in PROJ-150 AC; short-soak CI variant catches regressions before the 8h run |
| **Critical-path slip on the security spine** | 121→120→122→123 | Phase exit slips 1:1 | Medium | Start crypto-stream agent on day 1; review on day 2; do not wait for batch reviews |

**The two highest-impact risks both sit in the security chain.** Both have known mitigations, but neither tolerates "we'll review it later" — the gating tests in PROJ-300 should run *as soon as PROJ-127 is Done*, not at M7.

### 2.5 Timeline estimate

Using the convention `1pt ≈ 2h` of focused, validated work (the same convention the tickets were sized to):

| Scenario | Effort assumption | Estimated calendar |
|----------|-------------------|--------------------|
| **Single agent, serial** | 199 pts × 2h = ~400 h | ~10 work-weeks (50 h/week sustained) |
| **Single agent, with thinking/review/rework overhead** | 199 pts × 2.5h = ~500 h | ~12.5 work-weeks |
| **Critical path lower bound** (perfect parallelism, infinite agents) | 31 pts × 2h = ~62 h | ~1.5 work-weeks |
| **Realistic with 3 parallel agents** | ~80–120 h on critical path, others overlap | ~3 work-weeks |
| **Realistic with 6 parallel agents** | Critical path dominates | ~2 work-weeks |

Two notes on these numbers:

1. **The critical path is a hard floor.** No amount of parallelism reduces it below ~62 h. Six engineers cannot ship Phase 1 in less than ~1.5 weeks because the security→client→designer→acceptance chain is strictly serial.
2. **The realistic single-agent estimate (~12.5 weeks) is consistent with the prior 15-week roadmap** from the original scrapped doc — that estimate included the original 7-week split across phases. Phase 1 alone occupying ~10–12 weeks of single-agent effort matches the architecture's actual depth.

---

## 3 · What this analysis tells us

Three takeaways the graph makes hard to argue with:

**The security chain is the spine.** Five of the top ten chokepoints (121, 120, 122, 113, the implicit 123) are security/identity tickets. This is not accidental — every device that talks to the engine must be identified, authenticated, encrypted, and permissioned, and *nothing else can happen until that is in place*. If the build is staffed sequentially, security goes first.

**Two single tickets dominate the parallelism dividend.** PROJ-160 (state store) and PROJ-181 (client renderer) each release **9 immediate followups** when they land. Getting these two green fastest unblocks the widest parallel front. If you have one star engineer, point them at 160 and 181.

**The M6 demo is the entire product in miniature.** The headline "author on desktop, watch it live on the phone" experience (PROJ-212) sits at wave 8 — almost the end of the graph. It depends transitively on at least 30 other tickets. There is no shortcut to it. But it's also the demo that *justifies the whole project* — once it works, every subsequent phase is decoration on top.

The graph also surfaces one unexpected result: **the flow engine (EPIC-7) is relatively independent**. PROJ-201/202/203/204 are mid-depth (wave 4–6) and unblock relatively few downstream nodes in Phase 1. They are real work, but they are not on the critical path and not on the gating fan-out. **The flow engine could realistically slip a wave without affecting M6 or M7.** That gives a known place to absorb slippage if any of the higher-risk security or transport tickets drag.

---

*End of Dependency Graph & Execution Plan. Next: Progress Dashboard (the live tracking table) and Claude Agent Instructions (the operating rules).*
