# CyberDeck v2 — Ticket System (Index)

**Generated:** 2026-07-13 · from `04_Execution_Blueprint.md` · **182 tickets** (M1: 39 · M2: 19 · M3: 30 · M4: 25 · M5: 19 · M6: 19 · M7: 15 · M8: 16) · all **Status: Not Started**
**Verified:** no duplicate IDs · no dangling references · every dependency has a smaller ID than its ticket (ascending-order execution is always valid)
**Prime directive:** execute tickets in **ascending ID order**. Every ticket's dependencies have smaller IDs — a single executor who finishes CD-101 → CD-816 in sequence ships the product. Tickets marked **∥** may run in a parallel lane (second human/agent) without breaking the sequence for anyone else; a solo executor simply ignores the marks.

## Milestones

| Milestone | Tickets | Gate (demo that must pass to proceed) | Blueprint sprints |
|---|---|---|---|
| **M1 — Platform Kernel** | CD-101…139 | Boot ≤ 150 ms with inspectable stages; everything config-driven; contract tests green vs MockApiGateway; Platform Inspector live | S1–S3 |
| **M2 — Shell & Chrome** | CD-201…219 | 7 workspaces navigable; palette, prefs, docking, session restore; every visible control operable or honestly disabled | S4–S5 |
| **M3 — Authoring Core** | CD-301…330 | On mocks: insert → bind → state → undo → save → reload authoring journey, incl. components/variants/overrides | S6–S8 |
| **M4 — Workspaces Complete + Widget Platform** | CD-401…425 | Every workspace functional on mocks; flows test-run; player preview; widgets load from manifests as lazy chunks | S9–S11 |
| **M5 — Engine Swap** | CD-501…519 | One config flip → same IDE on the live Go engine: real variables, deployed flows, streamed runtime, device push; contract suite green on BOTH gateways | S11–S12 |
| **M6 — Extensibility & Desktop Packaging** | CD-601…619 | Sandboxed extension installs/crashes safely; OBS + Spotify integrations work; clean-machine Windows install; deck survives IDE close | S12–S13 |
| **M7 — Players** | CD-701…715 | Deck authored in IDE renders on Android + iOS + desktop player; tap round-trip < 100 ms p95; wifi-kill self-heals | S13–S14 |
| **M8 — GA Hardening & Release** | CD-801…816 | Success-metrics table green; beta soak complete; staged rollout to stable | S15 + buffer |

## Ticket format

```
### CD-xxx · Title                       (∥ = parallel-lane eligible)
**BP:** blueprint ref · **Hat:** FE/BE/MOB/DO/QA/SEC/DES/PM · **P:** P0–P2 · **Est:** S ≤4h · M ≤1d · L 2–3d
**Deps:** CD-…
**Do:** what to build (subtask detail lives in the blueprint ref).
**AC:** checkboxes — ticket is Done only when every box is checked *and* the Global DoD holds.
```

## Global Definition of Done (applies to every ticket)

1. Code + tests merged; CI fully green (lint, type, unit, E2E where touched); no boundary-rule violations.
2. New behavior covered by tests at the level the ticket names (unit/E2E/contract) — not merely exercised manually.
3. UI tickets: keyboard operable, focus-visible, labeled (a11y primitives from CD-201 onward); no dead controls introduced (wire it or disable-with-reason).
4. Contract-touching tickets: schema change lands in `shared/schemas/` first; generated types regenerated; drift gate green.
5. Anything user-visible added to the running release-notes draft; anything operational noted in the runbook draft.
6. Tick the ticket's checkbox in the milestone board and set your status marker.

## Rules of execution

- **Gate tickets are hard stops** — CD-139, CD-219, CD-330, CD-425, CD-519, CD-619, CD-715, CD-816. Do not start the next milestone's tickets until the gate demo passes and is recorded in the milestone file.
- **Parallel lanes** if a second lane exists: at M4, the ENG lane may start CD-501…513 (engine work) while the IDE lane finishes CD-4xx — this is the only sanctioned overlap; both lanes must merge for CD-514.
- **Scope guard:** anything not covered by a ticket goes to a `BACKLOG.md` entry, not into the current milestone. New tickets get the next free ID in their milestone range (gaps are fine).
- **Rolling detail:** each ticket cites its blueprint section (BP ref); if a ticket feels > its estimate, split it there using the blueprint's subtasks before starting, never mid-flight.
- **Assumption guard:** CD-101 confirms A1–A5 / D1–D8 / stack ADR from the blueprint §0. If any answer changes, re-cut affected tickets *before* proceeding.

## Files

- `M1_Platform_Kernel.md` · `M2_Shell_Chrome.md` · `M3_Authoring_Core.md` · `M4_Workspaces_WidgetPlatform.md` · `M5_Engine_Swap.md` · `M6_Extensibility_Packaging.md` · `M7_Players.md` · `M8_GA.md`
- `BACKLOG.md` — created on first out-of-scope idea; reviewed at each gate.
