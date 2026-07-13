# CyberDeck v2 — Execution Plan

**Status:** Documentation phase (2026-07-13)
**Reading order:** `00_Product_Baseline.md` → `01_Architecture_Baseline.md` → `02_Codebase_Assessment.md` → this plan.
**Planning unit:** phases with acceptance criteria; each phase is demoable. Ordering follows instruction.md's mock-first mandate: the IDE is fully built against mocks (Phases A–C) before the engine is wired (Phase E), so UI work is never blocked on backend work.

---

## Phase 0 — Documentation baseline ✅ (this phase)

Deliverables: the four `Documentation/v2/` docs. Done when reviewed/accepted by the owner.

---

## Phase A — IDE platform kernel (mock-driven)

*The invisible phase: everything instruction.md §§1–2, 4–6, 8–9, 12–16 defines, before any workspace UI.*

Scaffold `ide/` (React + TS + Vite; runs in a plain browser first — the Tauri shell arrives in Phase F). Implement, in dependency order:

1. **Contract v2 first:** extend `shared/schemas/` (widget manifest, config areas, control-plane routes + envelope, layout/flow/project documents) + TS type generation. *Go/Dart generation can lag until Phases E/G, but the schemas are authored now.*
2. Boot Manager (staged lifecycle, performance marks, replayable) · Configuration Service (layered merge, validation, versioned migration, write-behind) · Service Container (lazy proxies, interface resolution) · Event Bus (typed, wildcard, replay-on-subscribe) · Command Registry (+ keymap dispatch, undo stack) · domain stores with persistence contracts · Repository layer + middleware (retry, cache, optimistic, cancellation) · **MockApiGateway** (route table, fixture DB, latency/failure injection) · Theme Engine (token → CSS vars pre-paint) · Notification, Telemetry (buffered), JobScheduler · error boundaries · feature flags.
3. **Dev surfaces** (developer-tools flag): Architecture Mode markers, Platform Inspector (services/repos/stores/events/flags/permissions/loading tabs), boot-sequence overlay — implementing the design's Phase-33 surfaces against the *real* kernel.

**Acceptance:** boot is real and inspectable (≤150 ms to interactive shell on reference hardware, measured by the boot marks); pulling any fixture through the UI shows loading/error/retry states under injected failure; kernel unit tests + contract tests generated from the route table pass; zero hardcoded data outside fixtures.

## Phase B — IDE shell & workspaces

App chrome per the design: workspace rail + manager (workspaces as config contributions), top bar/breadcrumb/status bar as store subscribers, command palette, preferences (incl. rebindable keys rendered from the registry), dock/layout manager (float/pin/auto-hide/peek, per-workspace presets, resize), session restore, themes, density, notifications drawer, focus-visible/keyboard-operable chrome (design AUDIT H6 learnings from day one).

**Acceptance:** all seven workspaces navigable (empty content OK); layouts/dock/session survive restart; every visible control operates or is honestly disabled; palette executes every registered command.

## Phase C — Authoring workspaces (mock-driven)

Three sub-phases, each demoable:

- **C1 Design workspace:** ProjectModel document (stable IDs) + command-based undo/redo; canvas engine (pan/zoom/selection/marquee/snap/guides shared as a PanZoomSurface); layers tree; contextual inspector (per-widget-type sections from manifests, page properties on empty selection); components → variants → overrides → nesting; shared styles, symbols; bindings (static/variable/expression w/ sandboxed parser), states, events→flow wiring.
- **C2 Data workspaces:** Vars manager (full CRUD, computed/expression vars, refs), Library (registry-driven), Projects (repo-driven), Runtime (log + perf from mock stream).
- **C3 Flows workspace:** graph editor on the shared PanZoomSurface, node library from the registry (6 categories), per-port edges w/ true/false branches, per-node-kind inspectors, test-run simulation, armed flows.

**Acceptance:** author a deck end-to-end on mocks — insert manifest widgets, bind variables, define states, build + test-run a flow, see it in Player Preview (design's device-player overlay) — with full undo and session persistence throughout.

## Phase D — Widget & extension platform (mock)

Widget manifests v2 live (dynamic discovery, dependency resolution, lazy chunks, permissions declared/granted); first-party widget catalog converged (design's 61 + player's 28 → one manifest set); IDE extension host (sandboxed workers, RPC bridge, contribution points: widgets/commands/menus/settings/themes/nodes/data providers); two proof extensions (e.g. OBS, Spotify) contributing both widgets and flow nodes.

**Acceptance:** installing/removing an extension changes zero core code; a crashing proof extension leaves the shell healthy; permission grants/denials enforce visibly.

## Phase E — Engine control plane & the great swap

Engine work (parallelizable with C/D once schemas are stable):

1. Control-plane listener (localhost WS + JSON envelope, separate channel from the device data plane): project CRUD, registry queries, flow deploy/arm, variable subscribe, runtime log stream, device management, permission grants.
2. Engine-side gaps from `02_Codebase_Assessment.md` §1: manifest v2 in the registry, v2 layout/project document, variable types, integration/data flow nodes.
3. **EngineGateway** in the IDE honoring the exact MockApiGateway contract (contract tests prove parity); gateway selection by config; engine-offline → graceful fallback.

**Acceptance:** flip one config value → the same IDE runs on the live engine: real telemetry variables in the Vars table, flows deployed and executed by `core/flow`, runtime log streaming from the engine bus; `task interop` extended to cover the control plane.

## Phase F — Desktop packaging

Tauri shell around the IDE: engine as managed sidecar (spawn/attach/health), native menus/tray, single installer per OS (Windows first, then macOS/Linux — engine cross-compiles already; `installers/` scaffolding exists), service-mode preserved (engine survives IDE close), auto-update channel, crash reporting.

**Acceptance:** clean-machine install → author → close IDE → deck still served to players; upgrade path preserves engine data (SQLite migrations).

## Phase G — Player evolution (Flutter)

Refocus `client/` per the assessment: strip designer entry points; consume v2 layout documents (components/variants resolved server-side or in a thin client resolver — decide via spike, prefer thin client); manifest-aligned widget catalog; interaction verbs + haptics per the design's touch simulation; per-device layout assignment; offline cached layout; pairing UX polish (QR + player preview parity with the IDE's Devices workspace).

**Acceptance:** deck authored in the IDE renders on Android + iOS (Mac build) + a spare Windows screen; tap-to-action round-trip < 100 ms LAN; kill wifi → player degrades gracefully and self-heals (existing reconnect behavior preserved); delete `client/designer/` in this phase's closing commit.

## Phase H — Hardening & release

Performance passes against budgets (bundle size, virtualization sweeps, worker offload), accessibility pass 2 (tree/tablist roles, roving tabindex), security review (control-plane authz, extension sandbox escape review, expression sandbox), docs (user + extension-author), store submission prep (APK/Play, iOS/App Store), beta program.

---

## Cross-cutting workstreams

| Workstream | Runs during | Rule |
|---|---|---|
| Contract stewardship (`shared/schemas/`) | A → G | any tier change starts as a schema PR; generated types only, no hand-written duplicates |
| Test pyramid | every phase | kernel unit + generated contract tests (A), component tests per widget (C/D), E2E boot/author journeys (B/C), engine `go test` + interop (E/G) |
| Design sync | B → D | design project remains UI truth; re-export the full Phase-4 HTML before each UI phase (local snapshot is truncated at 256 KiB) |
| Dogfooding | D onward | maintainers run their own deck daily; friction items become backlog |

## Sequencing & parallelism

```
0 ─ A ─ B ─ C1 ─ C2 ─ C3 ─ D ─┬─ F ─ H
        └─(schemas stable)─ E ─┤
                               └─ G ─ H
```

Engine control plane (E) starts as soon as Phase A freezes the route contract; Player evolution (G) starts once E's layout-document push lands. Solo-developer path: strictly A → B → C → D → E → F → G → H, using mock-first to keep every phase demoable without waiting on the engine.

## Top risks & mitigations

1. **Scope gravity of the IDE** (the design encodes 33 phases of features) → phase gates are behavioral (author→run→render journeys), not feature checklists; defer marketplace/AI providers/cloud sync behind flags.
2. **Prototype-porting temptation** → hard rule: the design file is spec, not source; AUDIT.md documents why its architecture must not be copied.
3. **Contract drift across Go/TS/Dart** → generated types + contract tests from one schema source, enforced in CI from Phase A.
4. **Expression semantics divergence** (IDE preview vs engine execution) → one spec, two implementations tested against a shared conformance corpus (engine `flow/expr` tests seed it).
5. **Control-plane security** (an IDE API on localhost is an attack surface) → reuse `core/security` identity + local privileged-channel pattern (console channel precedent); never expose the control plane off-host.

## Definition of done for the documentation phase

- [x] Design imported and mined (Phase-4 file + FEATURES/ROADMAP/AUDIT/steps + 21 Platform Notes + boot sequence)
- [x] Product baseline reflecting the evolved topology (IDE desktop · engine desktop · mobile players · APK/iOS/desktop deliverables)
- [x] Architecture baseline covering all 14 instruction.md requirement areas, mapped to tiers
- [x] Codebase assessed: keep engine + player stacks, retire Flutter designer, build IDE + control plane fresh
- [x] Phased execution plan with acceptance criteria, parallelism, risks
- [ ] Owner review → corrections folded in → Phase A may begin
