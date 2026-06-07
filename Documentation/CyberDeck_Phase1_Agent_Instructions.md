# CyberDeck — Phase 1 · Claude Agent Instructions

**Execution-system Document 8 of 8** · Version 0.1 · June 2026 · `com.shishir.cyberdeck`

> The operating manual for the autonomous agent (Claude) executing Phase 1. This document turns the architecture, tickets, dependency graph, and dashboard into a deterministic loop of behavior. Read this once at the start of every session, then follow the loop. **If any instruction here conflicts with a ticket, the ticket wins for scope; this document wins for process.**

---

## 0 · Mission

Build **CyberDeck Phase 1 (Foundation)**: a cross-platform host engine (Go) and client (Flutter) that lets a desktop-authored layout render live on a paired device, showing real telemetry and invoking permissioned actions, over an encrypted LAN connection — with the full security, persistence, transport, plugin, state, flow, and designer foundations in place.

**Definition of victory:** PROJ-303 is Done — all 16 Phase-1 acceptance criteria (P1-AC-01…16) verified green, every P0 ticket Done, the Definition of Done satisfied.

---

## 1 · The documents you work from

| Document | Use it for |
|----------|-----------|
| `CyberDeck_Complete_Documentation.md` (+ the 16 source docs) | The *why* and *how* — architecture, ADRs, subsystem TRDs, phase deep-dives. **Cited by every ticket.** |
| `CyberDeck_Phase1_Tickets_Batch1–4.md` | The *what* — the 80 implementation-ready tickets. Your unit of work. |
| `CyberDeck_Phase1_Dependency_Graph_and_Execution_Plan.md` | The *order* — critical path, waves, chokepoints, risks. |
| `CyberDeck_Phase1_Progress_Dashboard.md` | The *state* — live status of all 80 tickets. **You read and update this every session.** |
| **This document** | The *process* — the loop you run. |

When a ticket cites a doc section (e.g. "2E §3.2", "ADR-0008"), **open it and read it before coding.** The tickets are deliberately terse on rationale because the rationale lives in the architecture docs. Never guess at intent you can look up.

---

## 2 · The core operating loop

Run this loop continuously until PROJ-303 is Done:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. SELECT   → open the Dashboard; pick the next ticket       │
│ 2. PREPARE  → read the ticket + every doc section it cites   │
│ 3. CLAIM    → set ticket to 🟨 In Progress on the Dashboard  │
│ 4. IMPLEMENT→ write code to the ticket's AC + Deliverables   │
│ 5. VALIDATE → run the ticket's exact Validation Commands     │
│ 6. SELF-REVIEW → check every AC + the Completion Checklist   │
│ 7. CLOSE    → set ✅ Done; recompute rollups; release deps   │
│ 8. LOG      → append to the velocity log; advance milestones │
│ 9. REPEAT   → back to step 1                                 │
└─────────────────────────────────────────────────────────────┘
```

Do **one ticket at a time, start to finish.** Do not begin a second ticket while one is In Progress. Do not partially implement several tickets in parallel — the dashboard's value is that "In Progress" means exactly one thing.

---

## 3 · Step 1 — SELECT (which ticket next?)

Pick from the **Ready** set only (a ticket is Ready iff **every** dependency is `✅ Done`). Among Ready tickets, apply this tie-break order:

1. **Priority** — P0 before P1. (No P2 in Phase 1.)
2. **Critical-path membership** — tickets on the 31-point spine (121→120→122→123→180→181→210→211→212→302→303) go first within their priority. The spine must never be the thing waiting.
3. **Fan-out** — higher "unblocks N" first (releases more downstream work). PROJ-160 and PROJ-181 are the two highest-leverage tickets in the graph; clear them as early as their deps allow.
4. **Lower ticket number** — a stable final tie-break.

**At baseline**, the Ready set is exactly: PROJ-101, 102, 110, 121, 140, 160. By the rules above, a reasonable opening order is **160 → 121 → 110 → 140 → 101 → 102** (state store first for fan-out; then the security-spine root; then the persistence and transport roots). Any order among these six is *correct* (they're independent) — the tie-breaks just optimize parallel unlock.

**Never** select a ticket with an unmet dependency, even if you "could" start part of it. Unmet deps mean missing interfaces you'd have to stub and rework — that's how an agent corrupts a codebase.

---

## 4 · Step 2 — PREPARE (read before you write)

Before writing any code:

- Read the **entire ticket** — Objective, Context, Technical Requirements, **all** Acceptance Criteria, Implementation Notes, Deliverables.
- Open and read **every cited doc section.** If the ticket says "implement 2E §4," read 2E §4. If it cites an ADR, read the ADR's decision *and* rationale.
- Check the **Implementation Notes** for the seams you must respect (e.g. "inject the event bus as an interface," "no `if remote` above the ConnectionManager," "reuse the renderer, don't fork it").
- Identify the **Expected Files** so you create files in the right place (`engine/...`, `client/lib/...`, `plugins/...`, `shared/...`).

If after reading you find the ticket **genuinely ambiguous or contradictory with the architecture**, do not guess. Mark it `🟥 Blocked`, write the specific question in the dashboard notes, and select a different Ready ticket. Surface the ambiguity to the human at the next checkpoint. (This should be rare — the tickets cite their sources precisely for this reason.)

---

## 5 · Step 4 — IMPLEMENT (how to write the code)

- Build in the **monorepo layout** from the TRD Master (`engine/`, `client/`, `plugins/`, `shared/`). Respect the package boundaries the tickets name.
- Write to the **interfaces and seams** the architecture defines — these are not optional. The whole forward-compat thesis (remote in Phase 7, plugins in Phase 6, collaboration in Phase 8) depends on them. Specifically:
  - Transport addressing flows through `ConnectionManager`/`TransportEndpoint` — **never** branch on transport kind above it (ADR-0010).
  - All capabilities are **out-of-process plugins** on the same contract — first-party included (ADR-0006). Don't shortcut a first-party capability into the engine core.
  - Layout authority is **engine-side** (ADR-0003). The designer sends ops; the engine applies/versions/persists/broadcasts.
  - State values are **typed**, not formatted strings (ADR-0019). Formatting is presentation-side.
- **Inject dependencies that don't exist yet as interfaces** with test fakes (the tickets call this out — e.g. PROJ-160 injects the event bus and fan-out before they're built). This is how independent tickets compose without rework.
- Match existing code style; keep functions testable; keep the telemetry/state hot paths allocation-conscious (the idle-CPU and 60-FPS NFRs are real).
- Write the tests the ticket's **Testing Requirements** specify *as you go*, not after.

---

## 6 · Step 5 — VALIDATE (the gates are non-negotiable)

Run the ticket's **exact Validation Commands**. The standard gates:

**Go (engine, plugins):**
```bash
go vet ./...
golangci-lint run
go test ./...            # or: go test -race ./...  for concurrent code
go build ./...
```

**Flutter (client, designer):**
```bash
dart analyze
flutter test
flutter build <target>   # the host OS desktop target, or the client target
```

Rules:

- **A ticket is not Done until every one of its validation commands passes clean.** No skipping, no "the lint warning is harmless," no commenting-out a failing test.
- **Use `-race` for any ticket touching concurrency** (state store, event bus, sessions, channels, fan-out, plugin host, flow executor). The tickets that need it say so; when in doubt, add it.
- If a validation command **fails**: fix the code (or the test if the test is wrong), re-run, repeat. Do not advance a failing ticket. Do not weaken an acceptance criterion to make a test pass.
- If a test reveals the **approach is wrong**, revert and reconsider — a red test is information, not an obstacle.

---

## 7 · Step 6 — SELF-REVIEW (before marking Done)

Walk the ticket's **Completion Checklist** explicitly:

`[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

For **AC met**, go criterion by criterion and confirm each is actually satisfied by code + a passing test — not "probably." If an AC says "engine survives an induced plugin panic," there must be a test that induces a panic and asserts survival. If an AC says "wire capture is ciphertext-only," there must be a test that captures and asserts.

Then apply the **global Definition of Done** (from the roadmap):
- All FRs for the ticket implemented and passing automated tests.
- Within the relevant NFR budget (memory < 150 MB steady-state; idle CPU < 2%; 60 FPS render).
- Code is reviewable (clear, documented where non-obvious).
- CHANGELOG updated if the ticket changes externally-visible behavior.

---

## 8 · Step 7–8 — CLOSE, LOG, and keep the Dashboard truthful

After a ticket passes review:

1. Set its **Status → ✅ Done**, Progress → **100%** in the register.
2. **Re-scan dependents:** for every ticket that listed this one as a dep, check if *all* its deps are now Done; if so flip its Readiness `⛔ Blocked → ✅ Ready`.
3. **Recompute** the epic rollup (Done tix/pts), the snapshot (Done pts, completion %, blocked count, Ready-set size), and **critical-path progress** (Done pts on the spine / 31).
4. **Advance milestones:** if a gate's entire ticket set is now Done, flip M-x to ✅.
5. **Append a velocity-log row:** session, tickets closed, points closed, cumulative %, a one-line note.

The dashboard is the project's single source of truth about *state*. If it drifts from reality, the loop breaks. Keep it exact.

---

## 9 · Failure & edge-case handling

| Situation | What to do |
|-----------|-----------|
| **Validation command fails** | Fix and re-run. Never advance red. Never weaken an AC. |
| **A dependency turns out insufficient** (missing interface) | Stop. Mark current ticket 🟥 Blocked with a note naming the gap. Return to the dependency ticket (it may need a follow-up). Do not stub-and-hope. |
| **Ticket is ambiguous / contradicts architecture** | Mark 🟥 Blocked with the specific question; pick another Ready ticket; surface to human at checkpoint. |
| **A ticket you thought was Done regresses** (a later change breaks its tests) | Move it back to 🟨 In Progress, fix, re-validate. The blocked count *rising* is the alarm. |
| **Ready set hits 0 with work remaining** | A dependency is mis-stated somewhere. Stop and audit the dep graph against the dashboard; do not invent work. |
| **Scope creep temptation** (a "quick" extra feature) | Don't. Each ticket states V1 scope and what's deferred to which phase. Build exactly the ticket. File a note for later phases if you spot something. |

---

## 10 · Hard rules (guardrails that never bend)

These override convenience, speed, and any apparent shortcut:

1. **Never start a ticket with an unmet dependency.** Ready means all-deps-Done. Full stop.
2. **Never weaken or skip an acceptance criterion** to make a ticket pass. The AC *is* the spec.
3. **Never compromise the security architecture for convenience.** Specifically:
   - No plaintext on the wire — ever (everything past the handshake is AEAD-encrypted).
   - No secrets in SQLite, config, or logs — credentials go to the OS keystore; logs redact (PROJ-115/127 guard this; don't defeat them).
   - The expression language (PROJ-201) stays sandboxed — **no** host callbacks, file, network, or reflection. It is a security boundary, not a scripting convenience.
   - Permission gates (device→action in PROJ-125, plugin→capability in PROJ-133) are always enforced — flow action-nodes route through `authorize()`, never around it.
   - The loopback control channel (PROJ-144) is loopback-only — a network session can never reach lifecycle/pairing/audit ops.
4. **Never let a plugin crash the engine.** Crash isolation (PROJ-131) is load-bearing; the induced-panic test must always pass.
5. **Never fork the renderer** — the designer canvas reuses the client renderer so "what you design is what the device shows" stays true by construction.
6. **Never destroy or weaken `-race` coverage** on concurrent code.
7. **Keep the dashboard truthful** after every ticket.

---

## 11 · Special-care tickets (slow down here)

These carry outsized risk; give them extra review and a second self-review pass:

| Ticket | Why extra care | Specific guard |
|--------|----------------|----------------|
| **PROJ-122** Crypto suite | A subtle bug silently weakens all encryption | Use a vetted library (NaCl/libsodium-class); never hand-roll primitives; nonce uniqueness; test against known vectors |
| **PROJ-123 / 142** Handshake / encrypted session | The authentication + forward-secrecy core | Test MITM rejection, tamper detection, no nonce reuse, goroutine cleanup on teardown |
| **PROJ-201** Expression language | A sandbox escape = arbitrary execution | Whitelist operators; no host surface; explicit malformed/injection tests |
| **PROJ-130 / 131** Plugin host + fault policy | Crash isolation protects the whole engine | Crashing test-plugin fixture; induced-panic survival test |
| **PROJ-150** Fan-out | Concurrency + the 8-session/60-FPS NFR | `-race`; subscription-filter correctness; 8-session load smoke |
| **PROJ-211 / 212** Op-log + live broadcast | The headline M6 feature; race-prone | Single-writer lock (V1); gap→resync net; measure <200ms reflection |
| **PROJ-300** Security test suite | The gate that proves the security claims | Run it **as soon as PROJ-127 is Done**, not at M7 — early detection of any leak/MITM hole |

For the security chain specifically: **don't defer the PROJ-300 suite to the end.** The moment its deps (PROJ-127, PROJ-180) are Done, run it. A crypto hole found at M7 is a phase-ending surprise; found at wave 5 it's a quick fix.

---

## 12 · Session protocol

**At the start of every session:**
1. Read this document (the loop) and open the Dashboard.
2. Note the current Ready set, critical-path progress, and blocked count.
3. Confirm no ticket is stuck In-Progress from a prior session (if so, finish or revert it first).

**During the session:** run the loop (§2), one ticket at a time.

**At the end of every session:**
1. Ensure no ticket is left half-done in `🟨 In Progress` — either finish it or cleanly revert it to a buildable state and note where you stopped.
2. Confirm the repo **builds green** (`go build ./...` + `flutter build`) before stopping.
3. Update the velocity log with the session's closed points.
4. Write a 2–3 line handoff note: what closed, what's newly Ready, any concern.

**Always leave the repo in a green, buildable state.** The next session (or a human) should never inherit a broken tree.

---

## 13 · The first five moves (concrete kickoff)

To remove all ambiguity about starting:

1. **PROJ-160** — Typed state model + state store core. *(Highest fan-out: unblocks 9. Pure, no deps.)*
2. **PROJ-121** — Identity (Ed25519 keypair + UUID). *(Root of the critical-path security spine.)*
3. **PROJ-110** — Persistence baseline (SQLite + schema v1). *(Highest transitive reach: 55.)*
4. **PROJ-140** — Endpoint abstraction + ConnectionManager. *(Transport root; lock the remote-ready seam early.)*
5. **PROJ-101** — Monorepo bootstrap, then **PROJ-102** CI baseline. *(So every later ticket validates against real gates.)*

After these, the Ready set opens up: PROJ-120, 162, 170, 201 (after 160/121), 111 (after 110), 141 (after 140), 103 (after 101). Follow the loop from there.

> Practical note: although 101/102 set up the repo and CI, you don't have to do them *first* — they're independent of 160/121/110/140. But getting **102 (CI gates)** done early means every subsequent ticket's validation runs against the real pipeline, which is worth front-loading. A defensible alternative opening is **101 → 102 → 110 → 160 → 121 → 140**.

---

## 14 · What "done with Phase 1" looks like

You are finished when, on the Dashboard:

- All 80 tickets are `✅ Done` (or any P1 deferral is explicitly signed off by the human — P0s are non-negotiable).
- All seven milestones M1–M7 are ✅.
- **PROJ-303** is Done: the P1-AC-01…16 traceability matrix is complete, every AC maps to a passing test, the Definition of Done holds, and `docs/phase1_acceptance.md` is committed.
- The repo builds and tests green on all three desktop OSes for the engine and the client target.

At that point Phase 1 (Foundation) is complete, and Phase 2 (Media Integration) — already specified in the architecture deep-dives — becomes the next execution target. The same documents, tickets-style breakdown, and this loop carry forward.

---

*End of Claude Agent Instructions — and of the Phase-1 execution system. The eight execution documents (Kanban board, 4 ticket batches, dependency graph & execution plan, progress dashboard, and these instructions) together with the 16-document architecture set are sufficient to drive Phase 1 from an empty repository to a verified Foundation.*
