# CyberDeck v2 — Execution Blueprint

**Status:** Planning artifact · 2026-07-13 · all items **Status: Not Started** unless marked otherwise
**Role of this document:** the sprint-executable decomposition of `03_Execution_Plan.md`. Architecture lives in `01_Architecture_Baseline.md`; reuse decisions in `02_Codebase_Assessment.md`. This document does not restate architecture — it references it.
**Design truth:** `design/CyberDeck IDE (Phase 4).dc.html` (now complete, 5,642 lines) + design-project companion docs. Canonical platform data: `ARCH()` (21 Platform Notes), `BOOTSEQ()` (10 boot stages), `SERVICES()` (13 services), `REPOS()` (7 repositories + routes), `STORES()` (13 stores + persistence map), `EVCAT()` (13 events), `FLAGDEFS()` (7 flags), `PERMS()` (capability matrix).

---

## 0. Context, Assumptions & Open Questions

The intake template's context fields were unfilled. They are filled here from the repository's own record; every inference is flagged. **A = assumption to confirm; D = default decision taken so planning can proceed — veto any of them and the plan sections that shift are listed.**

### Filled context

| Field | Value | Source |
|---|---|---|
| Project goal | Ship CyberDeck v2: desktop IDE (React/TS/Tauri) + Go engine + Flutter players (Android APK, iOS, desktop player builds) replacing Stream Deck / Touch Portal-class tools | `00_Product_Baseline.md` |
| Target users | Streamers, gamers/sim-rig builders, smart-home operators, developer power users | `00_Product_Baseline.md` §5 |
| Success criteria | Behavioral gates per milestone (§L1 metrics below); GA = author → run → render on real devices, installable on all 5 targets | `03_Execution_Plan.md` |
| Tech stack | **Fixed** by ADR: IDE = TypeScript/React/Vite/Tauri; Engine = Go (existing); Player = Flutter (existing); contract = JSON Schema in `shared/schemas/` — **ADR explicitly accepted by maintainer 2026-07-13 (CD-101)** | `01_Architecture_Baseline.md` §0 |
| Regulatory | Local-first, no hosted backend → no server-side PII. Remaining surface: telemetry/crash consent (GDPR-style opt-in), Google Play + Apple App Store policies, OSS license hygiene, code-signing | assessed below (SEC/REL workstreams) |

### Assumptions (confirm before Sprint 1)

> **CD-101 (2026-07-13): A1–A5 all confirmed as written by the maintainer. No amendments.**

- **A1 — Team = 1 maintainer + AI coding agents.** ✅ Confirmed 2026-07-13. Inferred from commit conventions (single author) and repo history. Workstream "owners" below are **hats, not headcount**. Parallel lanes assume agent-assisted parallelism of ~2 concurrent tracks; strictly serial work stretches the timeline ×~1.4.
- **A2 — Budget ≈ $0 external** plus unavoidable fees: Apple Developer $99/yr, Google Play $25 one-time, code-signing certificate (Windows OV ~$70–200/yr, or self-signed for beta — D6). No paid infra: CI on GitHub Actions free tier, no hosted services. ✅ Confirmed 2026-07-13.
- **A3 — No hard external deadline.** Plan targets **15 two-week sprints (~30 weeks) to GA** with 20 % buffer built in (§L13). ✅ Confirmed 2026-07-13.
- **A4 — A Mac is available (or obtainable) by Sprint 12** for iOS builds and macOS packaging. If not: iOS and macOS installers move post-GA (§L9 external dependencies). ✅ Confirmed 2026-07-13.
- **A5 — Windows is the primary dev/host platform**; Windows installer is the GA gate, macOS/Linux installers may trail by one sprint. ✅ Confirmed 2026-07-13.

### Default decisions (D)

> **CD-101 (2026-07-13): D1–D8 all accepted as written by the maintainer. No vetoes.**

| # | Decision | Default | Status | If vetoed |
|---|---|---|---|---|
| D1 | Marketplace in v1? | **No** — extension *loading* ships (flag `marketplace` off); browsing/install UI post-GA | ✅ Accepted 2026-07-13 | adds ~2 sprints (EXT + REL work) |
| D2 | Cloud sync in v1? | **No** — non-goal; flag exists, dark | ✅ Accepted 2026-07-13 | adds sync service + conflict model, ~3 sprints |
| D3 | Monetization in v1? | **None** — free, no license keys | ✅ Accepted 2026-07-13 | adds payments/licensing workstream |
| D4 | Telemetry default | **Opt-in at first run**, local buffer, no third-party sink until a self-hosted endpoint exists (post-GA) | ✅ Accepted 2026-07-13 | opt-out default raises compliance work |
| D5 | Store distribution at GA | **Sideload APK + TestFlight**; Play/App Store listings fast-follow (REL-E04 post-GA gate) | ✅ Accepted 2026-07-13 | store review time enters the critical path |
| D6 | Windows code signing for beta | **Self-signed + SmartScreen caveat documented**; purchase OV cert before GA | ✅ Accepted 2026-07-13 | $ + 1–2 week procurement lead |
| D7 | AI features in v1 | **Interface only** (AIService + flag `aiProviders`); no bundled provider | ✅ Accepted 2026-07-13 | adds provider integration + key management |
| D8 | Player desktop build | Windows player ships from the same Flutter codebase (cheap); macOS/Linux player post-GA | ✅ Accepted 2026-07-13 | none — it's a freebie today |

### Open questions (do not block Sprint 1–3; must close by the sprint noted)

1. **Q1 (close by S4):** exact keyboard-shortcut default set — adopt the design's `CMDS()` 26-command map as-is? (Default: yes.)
2. **Q2 (close by S6):** component/variant resolution on players — resolve in engine at publish time vs thin resolver in player (`03_Execution_Plan.md` Phase G spike). Default: engine-side flattening at publish.
3. **Q3 (close by S8):** flow node catalog v1 cut — which of the design's 6 categories × ~30 nodes ship at GA. Default: all Triggers/Logic/Actions/Structure; Integrations limited to OBS/Spotify/HTTP/MQTT; Data nodes = Math/Text/DateTime.
4. **Q4 (close by S10):** control-plane transport — WebSocket+JSON envelope (default, reuses existing serializer) vs gRPC. Default: WS+JSON.

---

## L1 — Product Vision

- **Objective:** replace the Stream Deck / Touch Portal category with an IDE-grade authoring environment (desktop) + always-on runtime engine (desktop service) + touch players (Android/iOS/spare screens), fully configuration-driven per `instruction.md`.
- **User problem:** existing tools are either hardware-locked (Stream Deck), visually dated and modal-heavy (Touch Portal), or automation-weak (both). Power users juggle 6–10 apps for control, telemetry, media, smart home, and streaming — none authorable like real software.
- **Value proposition:** *"Design your deck like you're in VS Code + Figma, run it from your desktop engine, touch it on any screen you own."* Functional components (bindings, states, flows) — not pictures of buttons.
- **Scope (GA):** the seven IDE workspaces; component/binding/flow authoring; widget platform with manifests; two proof integrations (OBS, Spotify) + system plugins (existing telemetry/volume/power/launchers/notifications); engine control plane; Windows/macOS/Linux IDE installers; Android APK + iOS TestFlight player; docs + beta program.
- **Non-goals (GA):** marketplace UI (D1), cloud sync (D2), monetization (D3), bundled AI provider (D7), collaborative editing (design shows presence avatars — post-GA), non-LAN/remote access, hardware deck peripherals.
- **Success metrics (measured, not aspirational):**

| Metric | Target | Measured by |
|---|---|---|
| IDE boot → interactive | ≤ 150 ms warm / ≤ 400 ms cold | boot perf marks (BOOT stage 8) |
| Player tap → engine action ack | < 100 ms LAN p95 | interop suite timing |
| Canvas frame rate @ 200 widgets | ≥ 55 fps sustained | perf harness (QA-E04) |
| Contract parity mock vs engine | 100 % generated contract tests pass on both gateways | CI |
| Crash-free IDE sessions | > 99.5 % during beta | crash reporter |
| New-user time to first live deck | < 10 min (install → deck on phone) | moderated beta sessions |
| Keyboard operability | 100 % of chrome reachable/actionable without mouse | a11y audit checklist |
| Initial shell bundle | < 350 KB gzipped (excl. lazy chunks) | CI budget gate |

---

## L2 — Major Workstreams

| ID | Workstream | Mission | Primary hat |
|---|---|---|---|
| PROD | Product & Design | design-source stewardship, UX spec extraction, scope gates, dogfooding | PM/Design |
| CON | Contracts & Schemas | `shared/schemas/` v2, control-plane API contract, type generation, contract tests | Backend+Frontend |
| IDE | IDE Application | platform kernel, shell, all workspaces, widget platform, extension host | Frontend |
| ENG | Engine | control plane, document/registry/variable/flow v2, runtime streaming | Backend |
| PLY | Player (Mobile) | Flutter player refocus, layout v2 renderer, interactions, offline, iOS | Mobile |
| EXT | Extensions & Integrations | extension SDK, OBS + Spotify proofs, first-party widget catalog | Frontend+Backend |
| DEV | DevOps & Packaging | monorepo CI, Tauri shell + sidecar, installers, signing, auto-update, store pipelines | DevOps |
| QA | Quality | test harnesses, contract test generation, interop v2, perf/a11y gates, release regression | QA |
| SEC | Security | control-plane authz, sandbox review, expression sandbox, supply chain, threat model | Security |
| DOC | Documentation | user docs, extension-author docs, runbooks, in-app onboarding | Docs |
| REL | Release & Marketing | brand/site, launch assets, beta program, store listings | Marketing |
| SUP | Support & Community | issue templates/triage, community channel, feedback loop | Support |

---

## L14 (format) — Master Tree & ID scheme

**ID scheme:** `WS-E##` epic → `-F##` feature → `-S##` story → `-T##` task → `.n` subtask. Every task row carries **ID · Priority (P0 blocker / P1 GA-gate / P2 should / P3 post-GA) · Owner · Estimate (XS ≤1 h, S ≤4 h, M ≤1 d, L 2–3 d, XL 1 wk — L/XL allowed only above subtask level; every subtask is ≤ 4 h) · Dependencies · Definition of Done**. Status is **Not Started** for every item — omitted from rows to avoid 500 repetitions.

**Decomposition policy (rolling wave — a deliberate TPM decision, not a gap):** epics inside the first execution window (Sprints 1–5: CON, DEV-E01, IDE-E01…E08, QA-E01/E02) are decomposed to L7 subtasks **in this document**. Later epics are decomposed to L5 stories + L6 tasks now, and to L7 at their sprint boundary *using the same template*, gated by the phase acceptance criteria in `03_Execution_Plan.md`. Decomposing Sprint-13 work to 4-hour granularity today would be fiction that rots; the policy line for each epic says when its L7 pass happens.

```
CyberDeck v2 (GA)
├── PROD Product & Design
│   ├── PROD-E01 Design-source stewardship        F: re-export cadence · spec deltas · Q1–Q4 closure
│   ├── PROD-E02 UX spec extraction               F: per-workspace spec sheets · interaction inventory · a11y annotations
│   └── PROD-E03 Dogfooding program               F: maintainer deck · friction log · beta cohort briefs
├── CON Contracts & Schemas
│   ├── CON-E01 Schema suite v2                   F: config areas · widget manifest · layout/project doc · flow doc · theme/flags
│   ├── CON-E02 Control-plane contract            F: route registry · envelope · event bridge map · error model
│   └── CON-E03 Type generation & contract tests  F: TS codegen · Go codegen · Dart codegen · CI drift gate · test generation
├── IDE IDE Application
│   ├── IDE-E01 Platform kernel                   F: scaffold · BootManager · ConfigurationService · ServiceContainer · EventBus
│   ├── IDE-E02 Command system & undo             F: registry · keymap+rebind · undo stack · palette datasource
│   ├── IDE-E03 Data layer                        F: repo base · middleware · MockApiGateway · CacheManager · optimistic+subscribe
│   ├── IDE-E04 State stores                      F: store base+persistence contract · 13 domain stores · migration
│   ├── IDE-E05 Theme engine                      F: token schema · pre-paint apply · theme switch · second theme proof
│   ├── IDE-E06 Dev surfaces                      F: Platform Inspector (7 tabs) · Architecture Mode · boot replay
│   ├── IDE-E07 Shell & chrome                    F: rail+workspace mgr · top/status bars · palette UI · prefs · notifications · session restore
│   ├── IDE-E08 Docking & layout                  F: resizable panels · tool windows (float/pin/auto-hide/peek) · presets · persistence
│   ├── IDE-E09 Design canvas                     F: PanZoomSurface · selection engine · snap/guides · layers tree · minimap+mirror
│   ├── IDE-E10 Component system                  F: ProjectModel doc · components/variants/overrides/nesting · shared styles · symbols
│   ├── IDE-E11 Bindings, states, events          F: bind popover (static/var/expr) · sandboxed expressions · states · event→flow wiring
│   ├── IDE-E12 Vars workspace                    F: table CRUD · scopes/filters · computed vars · inspector · refs
│   ├── IDE-E13 Library workspace                 F: components tab · styles tab · symbols tab (registry-driven)
│   ├── IDE-E14 Projects workspace                F: dashboard · browse table · project inspector · new-project wizard
│   ├── IDE-E15 Runtime workspace                 F: exec log (virtualized) · perf panel · flow/queue/timer rails
│   ├── IDE-E16 Flows workspace                   F: graph editor · node library · per-node inspectors · edges/branches · test run · armed
│   ├── IDE-E17 Devices workspace                 F: device cards · player preview (3 devices × 2 orientations) · touch sim → real dispatch
│   ├── IDE-E18 Widget platform                   F: manifest loader · dynamic registry · lazy chunks · permissions UI · error boundaries
│   ├── IDE-E19 Extension host                    F: worker sandbox · RPC bridge · contribution points · lifecycle · crash isolation
│   └── IDE-E20 Accessibility & input             F: focus-visible+roles · keyboard activation · focus-trapped modals · reduced motion
├── ENG Engine
│   ├── ENG-E01 Control-plane listener            F: localhost WS · authz · envelope · request routing · separate channel from data plane
│   ├── ENG-E02 Document service v2               F: cyberdeck.project doc · save/load/migrate · publish/flatten for players
│   ├── ENG-E03 Registry manifest v2              F: manifest fields · validation · plugin-contributed widgets
│   ├── ENG-E04 Variables v2                      F: 13 value types · computed/expression vars · subscriptions
│   ├── ENG-E05 Flow engine extensions            F: node catalog v2 · deploy/arm API · run traces
│   ├── ENG-E06 Runtime streaming                 F: log stream · perf counters · event bridge to IDE bus
│   ├── ENG-E07 Device layout push v2             F: layout doc v2 over data plane · per-device assignment · asset transfer
│   └── ENG-E08 Plugin manifest v2                F: manifest schema · integration-pair packaging (engine+IDE halves)
├── PLY Player
│   ├── PLY-E01 Player shell refocus              F: remove designer entry points · player navigation · settings
│   ├── PLY-E02 Layout v2 renderer                F: doc consumption · component instances · pages · per-device assignment
│   ├── PLY-E03 Widget catalog alignment          F: manifest-driven registry · parity matrix vs IDE catalog
│   ├── PLY-E04 Interactions & haptics            F: tap/hold/slide/toggle verbs · confirm gesture · haptic feedback
│   ├── PLY-E05 Offline & resilience              F: cached layout · reconnect UX · degraded states
│   ├── PLY-E06 Pairing UX v2                     F: QR flow polish · device naming · trust screens
│   └── PLY-E07 iOS bring-up                      F: Mac build · platform quirks · TestFlight
├── EXT Extensions & Integrations
│   ├── EXT-E01 Extension SDK                     F: package format · API typings · dev harness · docs (with DOC-E02)
│   ├── EXT-E02 OBS integration (proof)           F: engine plugin (WS to OBS) · IDE widgets/nodes · scene actions
│   ├── EXT-E03 Spotify integration (proof)       F: auth · now-playing variables · transport actions · widgets
│   └── EXT-E04 Widget catalog convergence        F: 61-design + 28-player → one manifest catalog · gap builds
├── DEV DevOps & Packaging
│   ├── DEV-E01 Monorepo & CI                     F: ide/ scaffold in repo · lint boundaries · CI matrix · bundle budgets
│   ├── DEV-E02 Tauri shell & sidecar             F: shell · engine spawn/attach/health · tray/menus · IPC allowlist
│   ├── DEV-E03 Installers & signing              F: Windows MSI/NSIS · macOS dmg+notarize · Linux AppImage/deb · signing
│   ├── DEV-E04 Auto-update & crash reporting     F: update channels · delta updates · crash capture+symbolication
│   └── DEV-E05 Store pipelines                   F: Android build/sign/track · iOS archive/TestFlight · store metadata
├── QA Quality
│   ├── QA-E01 Test infrastructure                F: unit (vitest) · component (testing-library) · E2E (Playwright) · Go/Flutter suites wired
│   ├── QA-E02 Contract tests                     F: generation from route registry · dual-gateway runs · fixture governance
│   ├── QA-E03 Interop suite v2                   F: extend task interop → control plane + layout push + player render
│   ├── QA-E04 Perf & a11y gates                  F: boot budget · fps harness · bundle budget · axe/keyboard audits in CI
│   └── QA-E05 Release regression                 F: manual QA checklists · beta triage flow · release sign-off template
├── SEC Security
│   ├── SEC-E01 Control-plane authz               F: local identity · privileged channel · non-exposure guarantees
│   ├── SEC-E02 Sandbox review                    F: worker isolation · RPC surface audit · permission enforcement tests
│   ├── SEC-E03 Expression sandbox                F: parser (no eval) · resource limits · conformance vs engine expr
│   ├── SEC-E04 Supply chain                      F: lockfiles · dependency audit · signed releases · SBOM
│   └── SEC-E05 Threat model & pentest pass       F: STRIDE pass · pairing/crypto review · findings burn-down
├── DOC Documentation
│   ├── DOC-E01 User docs                         F: getting started · workspace guides · flows cookbook
│   ├── DOC-E02 Extension-author docs             F: SDK guide · manifest reference · sample extension
│   ├── DOC-E03 Runbooks                          F: install/upgrade/rollback · troubleshooting · support macros
│   └── DOC-E04 In-app onboarding                 F: first-run tour v2 · empty states · sample project
├── REL Release & Marketing
│   ├── REL-E01 Brand & website                   F: name/mark check · landing page · demo video
│   ├── REL-E02 Launch assets                     F: screenshots · release notes pipeline · press kit
│   ├── REL-E03 Beta program                      F: cohort recruitment · feedback instrumentation · exit criteria
│   └── REL-E04 Store listings (post-GA gate)     F: Play listing · App Store listing · review compliance
└── SUP Support & Community
    ├── SUP-E01 Issue intake                      F: templates · labels · triage SLA
    ├── SUP-E02 Community channel                 F: Discord/GitHub Discussions · moderation baseline
    └── SUP-E03 Feedback loop                     F: telemetry review ritual · friction log → backlog pipeline
```

---

# L5–L7 — Sprint-ready decomposition (execution window: Sprints 1–5)

Owner legend: **BE** backend/Go · **FE** frontend/TS · **MOB** Flutter · **DO** DevOps · **QA** · **DES** design/PM · **SEC**. Every subtask ≤ 4 h. Stories use the template: *As a / I want / So that / AC*.

## DEV-E01 — Monorepo & CI *(Sprint 1 · gates everything)*

### DEV-E01-F01 IDE app scaffold

**DEV-E01-F01-S01** — As a **developer**, I want an `ide/` app scaffolded in the monorepo with strict tooling, so that every later feature lands on enforced structure instead of convention.
AC: `pnpm dev` serves the empty shell in a browser · TS `strict` on · ESLint boundary rule fails a cross-feature import · folder layout matches `01_Architecture_Baseline.md` §17 · README explains layout in ≤ 1 page.

| ID | Task | P | Est | Owner | Deps | DoD |
|---|---|---|---|---|---|---|
| …T01 | Scaffold Vite+React+TS app at `ide/` | P0 | S | FE | — | dev server runs; strict TS; CI-able `build` |
| …T02 | Folder structure + lint boundaries | P0 | S | FE | T01 | `platform/ services/ repositories/ stores/ workspaces/ widgets/ extensions/ shared/` created; eslint-plugin-boundaries denies cross-feature imports; violation test proves it |
| …T03 | Taskfile integration | P1 | XS | DO | T01 | `task ide:dev / ide:test / ide:build` work on Windows |

Subtasks — T01: create app (pnpm, vite react-ts template) · pin Node/pnpm versions (`.tool-versions`/engines) · enable strict+noUncheckedIndexedAccess · add path aliases · smoke-render placeholder shell. T02: install/configure boundaries plugin · write allowed-dependency matrix · add failing-import fixture test · document in README. T03: add Taskfile targets · verify on PowerShell + Git Bash.

### DEV-E01-F02 CI pipeline

**DEV-E01-F02-S01** — As a **maintainer**, I want CI running lint/tests/builds for all three languages on every PR, so that contract or boundary breakage is caught before merge.
AC: GH Actions runs eslint+vitest+`tsc --noEmit`+vite build (IDE), `go vet`+`go test ./...` (engine), `flutter analyze`+`flutter test` (player) · bundle-budget check fails > 350 KB gz shell · schema/typegen drift check fails when generated types are stale · required checks block merge.

| ID | Task | P | Est | Owner | Deps | DoD |
|---|---|---|---|---|---|---|
| …T01 | IDE workflow (lint/type/test/build+budget) | P0 | S | DO | F01-T01 | green on scaffold; budget gate proven with an intentionally fat fixture |
| …T02 | Engine + player workflows | P0 | S | DO | — | existing suites green in CI on ubuntu+windows matrix (engine), ubuntu (flutter) |
| …T03 | Drift gate for generated types | P0 | S | DO | CON-E03-F01 | regenerating types in CI + `git diff --exit-code` |

Subtasks — T01: workflow file · pnpm cache · size-limit config + check · badge. T02: Go matrix w/ CGO off (pure-Go sqlite) · Flutter pinned channel · cache pub/gradle. T03: `task gen:types` in CI · diff gate · failure message links runbook.

---

## CON-E01 — Schema suite v2 *(Sprint 1–2 · the contract freeze that unblocks ENG parallelism)*

Policy: every schema ships with ≥ 2 example fixtures (valid) + ≥ 2 invalid fixtures, a `version` field, and a migration note. Fixtures double as MockApiGateway seed data (IDE-E03) and contract-test vectors (QA-E02).

### CON-E01-F01 Config-area schemas

**CON-E01-F01-S01** — As the **platform**, I want JSON Schemas for every configuration area (application, user prefs, workspace layout, session, feature flags, keymap), so that ConfigurationService validates every layer on load and rejects drift.
AC: schemas exist under `shared/schemas/config/` · each declares editability flags (user/extension/runtime/persisted/system) per `01` §4 matrix · fixtures round-trip validation · flag registry mirrors design `FLAGDEFS()` (7 flags).

| ID | Task | P | Est | Owner | Deps | DoD |
|---|---|---|---|---|---|---|
| …T01 | Author 6 config-area schemas | P0 | M | BE+FE | — | schemas + fixtures pass ajv/gojsonschema |
| …T02 | Layer-merge semantics spec | P0 | S | FE | T01 | written rule set: precedence, array strategy, delete markers, delta events; reviewed |
| …T03 | Version/migration convention doc | P1 | S | BE | T01 | `version` stamp + migration registry pattern documented with one worked example |

Subtasks — T01: app schema · prefs schema · workspace-layout schema (lpw/rpw/hide/docks/presets — mirror design `cdk-layout`) · session schema · flags schema (7 ids) · keymap schema · valid+invalid fixtures each. T02: precedence table · merge edge cases (scalar vs object vs array) · SettingsChanged delta shape. T03: migration interface + example v1→v2 prefs migration.

### CON-E01-F02 Widget manifest schema v2

**CON-E01-F02-S01** — As a **widget author**, I want one manifest schema covering metadata/config/permissions/data/lifecycle, so that a widget is installable by dropping a manifest — no core edits.
AC: schema extends existing `widget.schema.json` with the 15 fields of `01` §5 · existing engine descriptors validate after mechanical mapping · 3 real manifests authored (gauge.circular, button.action, media.nowplaying) as canon fixtures.

| ID | Task | P | Est | Owner | Deps | DoD |
|---|---|---|---|---|---|---|
| …T01 | Author manifest v2 schema | P0 | M | FE+BE | — | all §5 fields, permissions enum matches `PERMS()` vocabulary |
| …T02 | Map 3 canon widgets to manifests | P0 | S | FE | T01 | fixtures validate; reviewed against design Insert-browser metadata |
| …T03 | Back-compat mapping note for engine descriptors | P1 | S | BE | T01 | table: old field → new field; gaps listed for ENG-E03 |

Subtasks — T01: metadata block · configSchema-as-JSON-Schema · permissions/deps · dataProvider/refresh/caching · lifecycle/chunk · actions/events/persistedState · invalid fixtures (undeclared permission, bad semver). T02/T03: as stated (each ≤ 4 h).

### CON-E01-F03 Layout & project document schema v2

**CON-E01-F03-S01** — As the **engine**, I want a versioned `cyberdeck.project` document schema (pages, widgets with stable IDs, components/variants/overrides, bindings, states, per-device assignments), so that IDE, engine and player share one serialization.
AC: schema covers the design's `serializeProject()` shape *plus* components/variants/overrides/pages/device-assignments · stable-ID rules stated (no display-name keys — AUDIT C3) · publish-flattened variant (`cyberdeck.layout` for players) specified · fixtures include the design's three seeded device layouts (`DPVLAYOUTS`).

| ID | Task | P | Est | Owner | Deps | DoD |
|---|---|---|---|---|---|---|
| …T01 | Project doc schema | P0 | L | FE+BE | F02-T01 | validates design-derived fixture with nested component instance |
| …T02 | Published layout doc schema (player-facing) | P0 | M | BE+MOB | T01 | flattened doc renders conceptually on existing player model (desk check w/ MOB) |
| …T03 | Doc-migration + ID-stability rules | P0 | S | BE | T01 | written invariants; violation examples |

Subtasks — T01: pages/artboards · widget node (id/type/frame/config/locked) · component defs + instance refs + override map · binding entries (static/var/expr) · state overrides · fixtures. T02: flatten rules (variant resolution per Q2 default) · asset refs · per-device doc. T03: as stated.

### CON-E01-F04 Flow document schema v2

**CON-E01-F04-S01** — As the **flow engine**, I want flow graphs (nodes, typed params, edges with branches, arm state, triggers) schema-defined, so that IDE-authored flows deploy to `core/flow` without translation ambiguity.
AC: node kinds cover Q3 default catalog · edge schema carries true/false/always branch · param schemas per node kind · one fixture reproduces the design's "stream-start" demo flow · engine team signs off mapping to `core/flow` model.

| ID | Task | P | Est | Owner | Deps | DoD |
|---|---|---|---|---|---|---|
| …T01 | Flow doc schema + node param schemas | P0 | M | BE | — | fixture flow validates; maps to `flow.model` fields |
| …T02 | Trigger binding spec (events/schedule/state) | P1 | S | BE | T01 | trigger kinds documented against `core/flow/triggers.go` |

Subtasks — T01: node envelope · per-kind params (trigger debounce/once, condition op/negate, action retry/timeout, etc. — mirror design Phase 15) · edges+branches · arm flag. T02: as stated.

### CON-E02 — Control-plane contract *(Sprint 2 · freezes ENG start line)*

**CON-E02-F01-S01** — As the **IDE**, I want a route registry + message envelope for the control plane, so that MockApiGateway and the Go engine implement the *same* table and can never drift.
AC: route registry file (machine-readable) lists method/path/params/request/response schema/error model/subscription topics for: projects CRUD+open, variables query+subscribe+write, widget manifests, flows CRUD+deploy+arm+trace, runtime log stream, devices list+heartbeat+assign+revoke, permissions grants, ai threads (stub) · envelope reuses `protocol-envelope.schema.json` lineage (id/correlation/kind/payload) · error model: coded errors + retryable flag · event bridge table maps engine bus topics → IDE event names (`EVCAT()` 13).

| ID | Task | P | Est | Owner | Deps | DoD |
|---|---|---|---|---|---|---|
| …T01 | Route registry format + tooling | P0 | S | FE | — | JSON/TS registry consumed by both codegen and mock router |
| …T02 | Author v1 route set (≈30 routes) | P0 | L | BE+FE | T01, CON-E01 | every route references request/response schemas; reviewed against design `REPOS()` endpoints |
| …T03 | Envelope + subscription semantics | P0 | M | BE | T01 | request/response/stream frames; backpressure + resume rules written |
| …T04 | Error model + event bridge map | P0 | S | BE+FE | T02 | coded error enum; 13-event map with payload schemas |

Subtasks — T02: projects group · variables group · flows group · widgets/extensions group · devices group · runtime group · permissions+ai group (each group ≤ 4 h authoring+fixtures). Others as stated.

### CON-E03 — Type generation & contract tests *(Sprint 2)*

**CON-E03-F01-S01** — As a **developer in any tier**, I want generated TS (now) and Go/Dart (when their phases start) types from the schemas, so that no tier hand-writes contract types.
AC: `task gen:types` emits TS types consumed by IDE kernel · Go generation targets chosen + spiked (one schema end-to-end) · CI drift gate live (DEV-E01-F02-T03) · codegen README.

| ID | Task | P | Est | Owner | Deps | DoD |
|---|---|---|---|---|---|---|
| …T01 | TS codegen pipeline | P0 | S | FE | CON-E01 | json-schema-to-typescript (or ts-json-schema) wired; output committed under `ide/src/shared/contract/` |
| …T02 | Go codegen spike + decision | P1 | S | BE | CON-E01 | one schema → Go struct pipeline proven; ADR note |
| …T03 | Contract-test generator skeleton | P0 | M | QA | CON-E02-T02 | for each route: fixture request → schema-validated response test, runnable against any gateway URL (mock now, engine later) |

Subtasks — T03: test-runner harness (vitest) · route iteration + fixture loading · response schema validation + error-model assertions · gateway-URL parameterization · CI job.

---

## IDE-E01 — Platform kernel *(Sprints 1–2 · the spine)*

### IDE-E01-F01 BootManager

**IDE-E01-F01-S01** — As the **application**, I want an ordered, observable boot lifecycle, so that the shell is interactive ≤ 150 ms while everything else loads behind it.
AC: stages match `BOOTSEQ()` (10) and are **configuration**, not code order · shell-critical stages block first paint, later stages run post-interactive · `performance.mark/measure` per stage, reported to TelemetryService · a stage failure degrades per its policy (fatal vs skippable) instead of white-screening · boot is replayable (feeds IDE-E06 overlay).

| ID | Task | P | Est | Owner | Deps | DoD |
|---|---|---|---|---|---|---|
| …T01 | Boot contribution interface + runner | P0 | M | FE | DEV-E01-F01 | `BootManager.run(phases)` with barriers; unit tests incl. failure policies |
| …T02 | Boot manifest config + validation | P0 | S | FE | CON-E01-F01 | stages declared in app config; unknown stage = boot error |
| …T03 | Perf marks + timing report | P1 | S | FE | T01 | marks visible in devtools; timing object emitted on `BootCompleted` |

Subtasks — T01: phase interface `{id, blocking, run, onError}` · sequential runner w/ barrier groups · failure policy (fatal/skip/retry-once) · unit tests (order, barrier, failure) · docs comment. T02/T03 as stated.

### IDE-E01-F02 ConfigurationService

**IDE-E01-F02-S01** — As **any service**, I want layered config (`defaults ← app ← user ← workspace ← runtime`) with validated writes and change deltas, so that nothing reads JSON directly and nothing is hardcoded.
AC: merge follows CON-E01-F01-T02 spec · reads are typed (`config.get('features.devTools')`) · writes debounce into the owning layer (write-behind, "saved · hh:mm" surface later) · every load validates against schema; invalid layer falls back + notifies · `SettingsChanged` carries precise deltas · migration runs on version mismatch.

| ID | Task | P | Est | Owner | Deps | DoD |
|---|---|---|---|---|---|---|
| …T01 | Layer store + merge engine | P0 | M | FE | CON-E01-F01 | property tests for precedence/edge cases |
| …T02 | Typed accessor + watch API | P0 | S | FE | T01 | `get/set/watch(path)`; TS types from generated schema types |
| …T03 | Write-behind persistence + debounce | P0 | S | FE | T01 | user/workspace layers persist to app-data dir (browser: localStorage adapter; Tauri: fs adapter behind one interface) |
| …T04 | Validation + migration on load | P0 | S | FE | T01, CON-E01-F01-T03 | corrupt layer → fallback + notification; migration test v1→v2 |

Subtasks — T01: layer model · deep-merge w/ array policy · delta computation · property-based tests. T03: storage adapter interface · debounce+flush-on-quit · saved-indicator event. Others as stated.

### IDE-E01-F03 ServiceContainer

**IDE-E01-F03-S01** — As the **platform**, I want DI with lazy proxies and interface resolution, so that services are mockable/swappable and never import each other directly.
AC: `container.register(IThemeService, factory, {lazy})` / `container.get(I)` · circular dependency = boot-time error with the cycle printed · lazy service instantiates on first call · test container allows per-test overrides · lint rule bans direct service imports outside the container module.

| ID | Task | P | Est | Owner | Deps | DoD |
|---|---|---|---|---|---|---|
| …T01 | Container core + lazy proxies | P0 | M | FE | F01-T01 | unit tests: laziness, singleton, override |
| …T02 | Cycle detection + boot integration | P0 | S | FE | T01 | cycle test fails boot with readable error |
| …T03 | Test-container utilities + lint rule | P1 | S | FE+QA | T01 | `createTestContainer()` used in ≥ 1 real test; eslint rule active |

Subtasks — T01: token/interface typing · registration map · Proxy-based lazy wrapper · unit tests. Others as stated.

### IDE-E01-F04 EventBus

**IDE-E01-F04-S01** — As **widgets and services**, I want typed pub/sub with wildcards and replay-on-subscribe, so that features never call each other directly and late lazy widgets never miss state.
AC: topics are typed (generated from event catalog) · wildcard subscribe (`variable.*`) · async delivery, per-subscriber bounded queue, overflow drops+logs (mirror engine bus semantics) · replay-on-subscribe of last event per replayable topic · dev hook streams to Platform Inspector.

| ID | Task | P | Est | Owner | Deps | DoD |
|---|---|---|---|---|---|---|
| …T01 | Bus core (typed emit/subscribe) | P0 | M | FE | F03-T01 | unit tests: ordering, async, unsubscribe |
| …T02 | Wildcards + replay + overflow policy | P0 | S | FE | T01 | tests for each behavior |
| …T03 | Event catalog types + inspector tap | P1 | S | FE | T01, CON-E02-T04 | 13 catalog events typed; `bus.tap()` for dev surfaces |

Subtasks — T01: topic typing scheme · subscriber registry · microtask delivery · tests. Others as stated.

---

## IDE-E02 — Command system & undo *(Sprint 2)*

### IDE-E02-F01 Command registry

**IDE-E02-F01-S01** — As **every UI surface**, I want all actions defined as registry commands (`id, category, label, icon, keys, context, permissions, args, undo, telemetry`), so that palette/keys/menus/buttons share one execution path.
AC: `commands.register/execute(id, args)` with context (when-clause) gating · execution emits telemetry + optional undo record · duplicate id = registration error · design's 26-command set registered as the seed (Q1).

| ID | Task | P | Est | Owner | Deps | DoD |
|---|---|---|---|---|---|---|
| …T01 | Registry + execution pipeline | P0 | M | FE | IDE-E01-F03 | tests: context gating, unknown id, args validation |
| …T02 | When-clause context engine | P0 | S | FE | T01 | context keys (workspace, selectionKind, flags) evaluated; tests |
| …T03 | Seed command set (26) | P1 | S | FE | T01 | commands registered with categories matching design `CMDS()` groups |

Subtasks — T01: command shape type · register/validate · execute pipeline (context→permission→handler→telemetry→undo) · tests. Others as stated.

### IDE-E02-F02 Keymap & rebinding

**IDE-E02-F02-S01** — As a **keyboard-heavy user**, I want default keybindings I can rebind, so that the IDE fits my muscle memory.
AC: single keydown dispatcher resolves combos → commands by context specificity · user overrides persist in keymap config layer · conflicts surfaced at rebind time · Preferences → Keyboard renders **from the registry** (no duplicated list — AUDIT M14).

| ID | Task | P | Est | Owner | Deps | DoD |
|---|---|---|---|---|---|---|
| …T01 | Combo parser + dispatcher | P0 | S | FE | F01-T01 | mod-combo matching incl. platform (⌘/Ctrl) mapping; tests |
| …T02 | Rebind store + conflict detection | P1 | S | FE | T01, IDE-E01-F02 | overrides round-trip config; conflict test |

Subtasks — as stated (each ≤ 4 h).

### IDE-E02-F03 Undo/redo engine

**IDE-E02-F03-S01** — As a **user**, I want every mutation reversible with ⌘Z/⇧⌘Z, coalesced gestures, and a history timeline, so that exploration is safe (AUDIT C1).
AC: command objects carry `do/undo` against the document model (never DOM snapshots) · gesture coalescing (< 1 s nudges = one entry) · history stack drives a Timeline datasource (UI later) · destructive commands produce "— ⌘Z to undo" toast payloads · depth cap + memory bound documented.

| ID | Task | P | Est | Owner | Deps | DoD |
|---|---|---|---|---|---|---|
| …T01 | History stack + do/undo protocol | P0 | M | FE | F01-T01 | tests: undo/redo/jump/coalesce/cap |
| …T02 | Undoable-command integration helpers | P0 | S | FE | T01 | `execUndoable(label, mutate)` helper + toast payload emit |

Subtasks — T01: stack model · coalescing keys · jump-to-index · tests. T02 as stated.

---

## IDE-E03 — Data layer *(Sprint 2–3)*

### IDE-E03-F01 Repository base + registry

**IDE-E03-F01-S01** — As a **feature developer**, I want typed repositories (`query/get/mutate/subscribe` with pagination/filter/sort), so that no UI code ever fetches directly.
AC: base class + per-domain repos registered in RepositoryRegistry · all seven design repos (`REPOS()`) instantiated: variables, projects, flows, widget-manifests, assets, devices, ai-threads · every request passes the middleware stack · request log tap for Platform Inspector.

| ID | Task | P | Est | Owner | Deps | DoD |
|---|---|---|---|---|---|---|
| …T01 | Repo base + registry + request pipeline | P0 | M | FE | IDE-E01-F03/F04 | typed query params; tests |
| …T02 | Instantiate 7 domain repos | P0 | S | FE | T01, CON-E02-T02 | each bound to its route group |

Subtasks — T01: request descriptor type · pipeline invocation · registry · log tap · tests. T02 as stated.

### IDE-E03-F02 Middleware stack

**IDE-E03-F02-S01** — As the **platform**, I want latency/retry/failure/caching/optimistic/cancellation middleware on every request, so that the UI is forced to handle real network behavior from day one.
AC: middlewares composable + config-ordered · retry = exponential backoff + retryable-error gate · failure injection behind `devTools` flag · cancellation via AbortSignal propagates · optimistic mutations roll back on failure and emit corrective events.

| ID | Task | P | Est | Owner | Deps | DoD |
|---|---|---|---|---|---|---|
| …T01 | Middleware composition core | P0 | S | FE | F01-T01 | order configurable; unit-tested chain |
| …T02 | Latency + failure injection | P0 | S | FE | T01 | distributions configurable (15–200 ms, 2 % fail default) |
| …T03 | Retry/backoff + cancellation | P0 | S | FE | T01 | tests: retry budget, abort mid-flight |
| …T04 | Optimistic update + rollback | P1 | M | FE | T01, IDE-E04-F01 | test: optimistic apply → injected failure → rollback + event |

Subtasks — each middleware = write + unit tests (≤ 4 h each); T04 splits into apply-layer, rollback-layer, event emission, tests.

### IDE-E03-F03 MockApiGateway

**IDE-E03-F03-S01** — As the **IDE**, I want a simulated REST gateway resolving the CON-E02 route table from fixture data, so that the app is fully functional with zero engine.
AC: router auto-built **from the route registry** (drift impossible) · fixture DB seeded from CON-E01 fixtures · pagination/filter/sort implemented server-side (in the mock) · subscription routes emit mock push streams (variables tick, runtime log, heartbeats) · swap point: gateway chosen by `runtime.gateway` config.

| ID | Task | P | Est | Owner | Deps | DoD |
|---|---|---|---|---|---|---|
| …T01 | Route-registry-driven mock router | P0 | M | FE | CON-E02-T02 | unknown route = contract error; contract tests pass |
| …T02 | Fixture DB + query semantics | P0 | M | FE | T01 | page/filter/sort verified by contract tests |
| …T03 | Mock push streams | P0 | S | FE | T01 | variable tick + log stream visible via bus |
| …T04 | Gateway selection + offline simulation | P0 | S | FE | T01 | config flip mock↔(future)engine↔offline; offline renders banner state |

Subtasks — T02: fixture loader · query engine (filter/sort/page) · mutation persistence (in-memory + localStorage) · seed data from design values (telemetry vars, projects, flows). Others as stated.

### IDE-E03-F04 CacheManager

**IDE-E03-F04-S01** — As the **platform**, I want LRU + persisted caching with **event-driven invalidation**, so that repeat reads are free and caches stay trustworthy.
AC: keyed by `(repo, query-hash)` · TTL fallback only as backstop; primary invalidation via bus events (`VariableChanged` evicts precisely) · hit/miss counters to telemetry + Platform Inspector · stale-while-revalidate mode for catalog-type reads.

| ID | Task | P | Est | Owner | Deps | DoD |
|---|---|---|---|---|---|---|
| …T01 | LRU core + key scheme + counters | P0 | S | FE | F01-T01 | bounded memory; tests |
| …T02 | Event invalidation map + SWR mode | P0 | S | FE | T01, IDE-E01-F04 | precise-eviction test: event evicts one entry, not all |

Subtasks — as stated.

## IDE-E04 — State stores *(Sprint 2–3)*

### IDE-E04-F01 Store base + persistence contract

**IDE-E04-F01-S01** — As the **platform**, I want a store base where each domain store declares `{kind: persisted|temp|derived|cached|server, location, restoreAt, migrate}`, so that the app's persistence map is explicit and inspectable (design `STORES()`).
AC: subscription API with memoized selectors · persisted stores write-behind to their own key and restore at their declared boot stage · version-stamped migration hook · the live persistence map renders in Platform Inspector → State Stores.

| ID | Task | P | Est | Owner | Deps | DoD |
|---|---|---|---|---|---|---|
| …T01 | Store base (subscribe/select/update) | P0 | M | FE | IDE-E01-F03 | React binding hook; render-count test proves selector memoization |
| …T02 | Persistence contract + boot-stage restore | P0 | S | FE | T01, IDE-E01-F01 | restore ordering test; corrupt-blob fallback |
| …T03 | Migration hook + registry | P1 | S | FE | T02 | v1→v2 sample migration test |

Subtasks — T01: store factory · selector memoization · React hook · tests. Others as stated.

### IDE-E04-F02 The 13 domain stores

**IDE-E04-F02-S01** — As **features**, I want the 13 stores of the design's persistence map instantiated with correct kinds, so that later epics never invent ad-hoc state.
AC: UI, Preferences, Workspace, Project, Widget, Editor, Binding, History, RepositoryCache, AI, Runtime (ring-buffer capped), Auth (token only — never secrets in localStorage), Notification stores exist with the exact kind/location/restore rows of `STORES()` · lint rule: no React state for cross-component domain data.

| ID | Task | P | Est | Owner | Deps | DoD |
|---|---|---|---|---|---|---|
| …T01 | Boot-critical stores (Prefs/Workspace/Auth/UI) | P0 | S | FE | F01 | restored at declared stages; tests |
| …T02 | Content stores (Project/Editor/Binding/History) | P0 | M | FE | F01 | shapes match CON-E01-F03 doc schema |
| …T03 | Stream/cache stores (Runtime/Cache/Notification/AI/Widget) | P1 | S | FE | F01 | ring-buffer cap test; derived-store projection test |

Subtasks — one subtask per store: define shape from schema types · declare persistence row · wire restore · unit test (each ≤ 4 h; boot-critical four are ≤ 2 h each).

## IDE-E05 — Theme engine *(Sprint 3)*

**IDE-E05-F01-S01** — As a **user**, I want token-based themes applied before first paint, so that the IDE never flashes and extensions can contribute themes with zero per-widget code.
AC: theme = token document (schema in CON-E01) resolved by ThemeService at boot stage 5 · tokens land as CSS custom properties on `:root` · hot-swap rewrites variables only + emits `ThemeChanged` · Dark Cyber (design tokens: `--accent/--ink/--line/--panel`, Rajdhani/JetBrains Mono/Exo 2) is default; one secondary theme proves the pipeline · canvas-rendered widgets re-render on `ThemeChanged`.

| ID | Task | P | Est | Owner | Deps | DoD |
|---|---|---|---|---|---|---|
| …T01 | Token schema + Dark Cyber theme doc | P0 | S | FE+DES | CON-E01-F01 | tokens extracted from design file CSS vars |
| …T02 | ThemeService (pre-paint apply, swap, event) | P0 | S | FE | T01, IDE-E01-F01 | no-flash verified (paint before/after marks); swap test |
| …T03 | Second theme + contribution point stub | P2 | S | FE | T02 | switching themes restyles all chrome; extension hook documented |

Subtasks — as stated (each ≤ 4 h).

## IDE-E06 — Dev surfaces *(Sprint 3 · behind `devTools` flag)*

**IDE-E06-F01-S01 Platform Inspector** — As a **developer**, I want the 7-tab Platform Inspector (services/repos/stores/events/flags/permissions/loading) rendering **live kernel state**, so that the architecture is observable, not asserted.
AC: services tab lists container registrations + lazy/ready/bg status · repos tab shows the real request log (route, ms, cache HIT/MISS) from the middleware tap · stores tab renders the live persistence map · events tab streams the bus tap + catalog with real subscriber counts · flags tab toggles ConfigurationService values (emitting `SettingsChanged`) · perms tab renders manifest-declared capabilities · loading tab shows startup/lazy/background assignment from the boot manifest + job scheduler.

**IDE-E06-F02-S01 Architecture Mode + boot replay** — As a **developer**, I want the violet Platform Note markers and the boot-sequence overlay from the design, so that embedded architecture docs survive into the product.
AC: markers anchor to live UI regions, popover shows WHAT/HOW/WHY/IMPL from a content file (not hardcoded JSX) · boot overlay replays real recorded stage timings.

| ID | Task | P | Est | Owner | Deps | DoD |
|---|---|---|---|---|---|---|
| …T01 | Inspector shell + services/stores/flags tabs | P1 | M | FE | IDE-E01..E04 | live data, not fixtures |
| …T02 | Repos/events tabs (log + bus taps) | P1 | S | FE | IDE-E03 | request rows + stream visible |
| …T03 | Perms/loading tabs | P2 | S | FE | IDE-E18 (perms enrich later) | initial render from manifests/boot manifest |
| …T04 | Architecture Mode markers + note content file | P2 | S | FE+DES | T01 | 21 notes ported from `ARCH()` |
| …T05 | Boot replay overlay | P2 | S | FE | IDE-E01-F01-T03 | replays recorded marks; row click → note |

Subtasks — per tab: datasource hook · render · interaction · test (each tab ≤ 4 h given kernel taps exist).

## QA-E01 / QA-E02 — Test infrastructure & contract tests *(Sprints 1–3, continuous)*

**QA-E01-F01-S01** — As the **team**, I want unit/component/E2E harnesses wired from Sprint 1, so that every epic lands with tests instead of retrofitting them.
AC: vitest + testing-library configured with store/container test utilities · Playwright E2E runs the boot journey headless in CI · engine `go test` and player `flutter test` already green stay required · coverage floors: kernel 85 %, services 75 % lines (report-only until S3, gating after).

| ID | Task | P | Est | Owner | Deps | DoD |
|---|---|---|---|---|---|---|
| QA-E01-T01 | vitest+RTL config + utilities | P0 | S | QA | DEV-E01-F01 | sample tests green in CI |
| QA-E01-T02 | Playwright boot-journey E2E | P0 | S | QA | IDE-E01-F01 | boots, asserts interactive marker + workspace render |
| QA-E01-T03 | Coverage reporting + floors | P1 | S | QA | T01 | CI annotation; gate flips on at S3 |
| QA-E02-T01 | Contract tests green vs MockApiGateway | P0 | S | QA | CON-E03-T03, IDE-E03-F03 | all routes pass; failure output names route+schema |

Subtasks — as stated (each ≤ 4 h).

---

## IDE-E07 — Shell & chrome *(Sprints 4–5 · Phase B gate)*

### IDE-E07-F01 Workspace manager + rail

**S01** — As a **user**, I want the left rail switching seven workspaces with per-workspace state preserved, so that the IDE feels like one application, not pages (AUDIT H4).
AC: workspaces are config contributions (id/icon/order/lazy pane) · switching preserves scroll/zoom/selection per workspace · `WorkspaceChanged` emitted · lazy pane mount on first entry · deep-link/back-forward navigation stack (⌘[ / ⌘]).

| ID | Task | P | Est | Owner | Deps | DoD |
|---|---|---|---|---|---|---|
| …T01 | WorkspaceService + contribution registry | P0 | M | FE | IDE-E01, E04 | config-driven list; tests |
| …T02 | Rail UI + lazy pane host | P0 | S | FE | T01 | keyboard operable; pane code-split proven |
| …T03 | Per-ws context preservation + nav history | P1 | S | FE | T01 | switch→return restores context; history walk test |

Subtasks — T01: contribution type · registry + validation · store wiring · tests. T02: rail component · roving tabindex · lazy `import()` per pane · chunk assertion. T03: context snapshot map · history stack · shortcuts.

### IDE-E07-F02 Top bar, breadcrumb, status bar

**S01** — As a **user**, I want a live breadcrumb (`Project › Workspace › Selection`, clickable) and a per-workspace status bar, so that location and state are always visible and navigable.
AC: both are **store subscribers** (no imperative sync — AUDIT C2) · status segments swap per workspace (design: flows = node/armed counts, vars = row count, design = cursor/snap/selection) · saved-state indicator reflects ConfigurationService write-behind.

| …T01 | Breadcrumb subscriber component | P1 | S | FE | F01-T01 | clickable segments navigate; tests |
| …T02 | Status bar + per-ws segment registry | P1 | S | FE | F01-T01 | segments render from config registry |

Subtasks — as stated.

### IDE-E07-F03 Command palette UI

**S01** — As a **user**, I want ⌘K fuzzy palette executing any registered command with shortcut hints, so that everything is reachable from the keyboard.
AC: renders **from the command registry** (context-filtered) · fuzzy match + recent-weighting · Enter executes, Esc restores focus (trap per IDE-E20) · insert-widget rows appear once IDE-E18 registers them.

| …T01 | Palette component + fuzzy index | P0 | M | FE | IDE-E02-F01 | keyboard-complete; virtualized list |
| …T02 | Recents/weighting + section groups | P2 | S | FE | T01 | matches design groups |

Subtasks — T01: overlay + focus trap reuse · fuzzy scorer (or fuse.js) · virtualized results · execution wiring · tests.

### IDE-E07-F04 Preferences window

**S01** — As a **user**, I want preferences (general/appearance/keyboard/flags) bound to ConfigurationService, so that settings are real, persistent and searchable.
AC: keyboard pane renders from command registry with rebinding (IDE-E02-F02) · appearance pane drives ThemeService · settings search filters panes · every control writes through config (no local component state).

| …T01 | Prefs shell + general/appearance panes | P1 | S | FE | IDE-E01-F02, E05 | round-trip persist test |
| …T02 | Keyboard pane + rebind UX | P1 | S | FE | IDE-E02-F02 | conflict warning shown |
| …T03 | Settings search | P2 | S | FE | T01 | matches pane content |

### IDE-E07-F05 Notifications

**S01** — As **any service**, I want `notify({priority, source, actions})` producing toasts/drawer/badges with dedupe and rate-limiting, so that producers never own UI.
AC: priorities low/normal/critical · undoable-action toasts route through here (IDE-E02-F03) · drawer is a Notification-store projection · toast policy per AUDIT M4 (no ambient-success noise).

| …T01 | NotificationService + store + toasts | P1 | S | FE | IDE-E04 | dedupe/rate-limit tests |
| …T02 | Drawer UI + mark-all-read | P2 | S | FE | T01 | keyboard operable |

### IDE-E07-F06 Session restore

**S01** — As a **user**, I want the IDE reopening exactly as I left it (workspace, panels, selection, zoom), so that restarts are free.
AC: one session blob written on change (debounced) · restored at boot stage 4 · corrupt session falls back to defaults with a notice · E2E: quit/relaunch restores state.

| …T01 | Session capture/restore wiring | P0 | S | FE | IDE-E04-F02-T01 | Playwright restart test green |

## IDE-E08 — Docking & layout *(Sprint 5)*

### IDE-E08-F01 Resizable panels

**S01** — As a **user**, I want draggable panel edges with per-workspace persisted widths and hide/show, so that the IDE adapts to my screen (AUDIT C4).
AC: 180–480 px clamp · widths/visibility persist per workspace (Workspace store) · ⌘B/⌘J toggles · reopen affordance when hidden.

| …T01 | Resize handles + width store wiring | P0 | S | FE | IDE-E07-F01 | persist/restore test |
| …T02 | Hide/show + reopen chips | P1 | S | FE | T01 | keyboard + palette commands |

### IDE-E08-F02 Tool windows (dock engine)

**S01** — As a **user**, I want tool windows (Live Mirror, minimap, future panels) that float, dock to rails, pin, auto-hide and peek, so that tool-window semantics match desktop IDE expectations.
AC: DockManager owns `{mode, side, size, pinned}` per window · drop zones on drag · pinned rails inset the canvas · unpinned collapse to edge tabs with hover-peek · all state persists and restores · registration is declarative (`dock.register({id, defaultSide, minSize})`) so any future panel docks for free.

| …T01 | DockManager model + persistence | P0 | M | FE | IDE-E04 | state machine unit tests (float↔dock↔autohide↔peek) |
| …T02 | Drag-to-dock UI + zones + insets | P0 | M | FE | T01 | E2E: dock/pin/peek/restore journey |
| …T03 | Declarative registration API | P1 | S | FE | T01 | second dummy window docks with zero new dock code |

Subtasks — T01: state model · transitions · persistence rows · tests. T02: drag controller · zone overlay · inset computation · peek hover logic · E2E.

### IDE-E08-F03 Layout presets

**S01** — As a **user**, I want named layout presets per workspace (Balanced/Focus/Explorer/custom-saved), so that I can switch working modes instantly.
AC: preset = pure configuration `{lpw, rpw, hideL, hideR, docks}` · manual changes flip label to "Custom" · user presets savable/deletable · applied via status-bar menu, palette, ⌥⌘P.

| …T01 | Preset model + apply/save/delete | P1 | S | FE | F01, F02 | round-trip test |
| …T02 | Preset menu UI | P2 | S | FE | T01 | mini layout diagrams per row |

**Milestone gates recap:** **M1 (end S3)** = kernel demo: boot ≤ 150 ms with inspectable stages, config-driven everything, contract tests green vs mock, Platform Inspector live. **M2 (end S5)** = shell demo: 7 navigable workspaces, palette, prefs, docking, session restore; every visible control operable or honestly disabled.

---

# L5–L6 — Planning-window epics (Sprints 6–15; L7 pass at each sprint boundary)

Stories carry full AC; tasks are sized but not yet subtask-split. **Rolling-wave rule:** an epic's L7 decomposition is a named deliverable of the sprint *before* it starts (owner: PM hat), using the Part-2 template.

## IDE-E09 — Design canvas *(S6–7)*

**S01 Canvas engine** — As a **designer**, I want an infinite pan/zoom canvas with marquee/lasso selection, snapping, smart guides and 8-handle resize + rotation, so that layout editing feels desktop-grade.
AC: shared `PanZoomSurface` (reused by Flows) · zoom-to-cursor, fit, ⌘0/⌘±, Space/Hand pan · selection engine: click/⇧/⌘, marquee, lasso, Tab-cycle, Esc, selection history `[`/`]` · snap to edges/centers/grid with ⇧ bypass · guides render at 60 fps with 200 widgets (perf harness) · every mutation goes through undoable commands · widgets render from ProjectModel — **no DOM-as-truth**.
Tasks: T01 PanZoomSurface module (M) · T02 selection engine + store (M) · T03 drag/resize/rotate controllers w/ zoom-corrected math (M) · T04 snap+guides (M) · T05 keyboard nudge/shortcuts (S) · T06 perf harness fixture, 200-widget board (S, QA).

**S02 Layers panel** — As a **designer**, I want a virtualized layer tree with rename/lock/hide/color/drag-nest/group, so that structure is manageable at scale.
AC: tree renders from ProjectModel · drag reorder + nest with drop indicators · ⌘G/⇧⌘G group/ungroup (undoable) · filter chips + search · double-click rename w/ Esc-cancel · `role=tree` + roving tabindex.
Tasks: T01 virtualized tree component (M) · T02 mutations→commands (S) · T03 filters/search (S) · T04 a11y tree semantics (S).

**S03 Contextual inspector** — As a **designer**, I want inspector sections driven by selection type (gauge≠button≠text≠page), so that properties are relevant (AUDIT H1).
AC: `sectionsFor(selection)` built from widget manifests · empty selection = page properties · multi = align/distribute · beginner density shows Advanced stub, not silent hiding.
Tasks: T01 section registry + renderer (M) · T02 type sections for 10 canon kinds (L — split per-kind at L7) · T03 page-properties + multi states (S).

**S04 Minimap + Live Mirror** — tool windows (host = IDE-E08) rendering from the **single board model**; mirror device-switchable. Tasks: T01 board-model selector (S) · T02 minimap (S) · T03 mirror + device cycle (S).

## IDE-E10 — Component system *(S7–8)*

**S01 ProjectModel document** — As the **IDE**, I want the full document model (stable IDs, pages, components, instances, overrides) as the single source of truth serialized to `cyberdeck.project`, so that save/load/undo/publish are one implementation site.
AC: conforms to CON-E01-F03 schema · IDs never derived from names · `render(dirtyIds)` reconciles model→React · serialize/restore round-trip property test · autosave through ProjectService repo.
Tasks: T01 model classes + invariants (L) · T02 React reconciliation bindings (M) · T03 serialize/restore + autosave (M) · T04 round-trip property tests (S, QA).

**S02 Components/variants/overrides/nesting** — As a **designer**, I want group→component conversion, variant registry, per-instance overrides with revert, and deep-instantiating nested components, so that decks are built from reusable functional parts.
AC: create component (⌘⌥K/context) · master↔instance links survive rename/duplicate · variant swap per instance (`,`/`.`), default pinning, delete-remap · override any exposed field w/ purple dot + revert + reset-all; never touches master/siblings · nested instantiation generates fresh IDs, registry counts correct · find-all-instances + go-to-master + detach.
Tasks: T01 component registry in model (M) · T02 create/instantiate/detach commands (M) · T03 variants model+UI (M) · T04 overrides model+UI (M) · T05 nesting/deep-instantiate (M) · T06 inspector Component section (S).

**S03 Shared styles + symbols** — registry-backed Fill/Stroke/Typography/Effect/Radius styles with linked-propagation recolor; symbol assets (icon/SVG/Lottie) with use-counts. Tasks: T01 style registry + link chips (M) · T02 propagation + ref counts (S) · T03 symbols registry + Library tab feed (S).

## IDE-E11 — Bindings, states, events *(S8)*

**S01 Bindings** — As a **designer**, I want any property bound to static/variable/expression with live preview, so that widgets show real data.
AC: bind popover w/ searchable variable catalog (live values from VariablesRepository) · expression mode uses the **sandboxed parser** (SEC-E03 — no `eval`), variable-insert chips, live evaluated preview, prettified errors ("Unknown variable 'fps.max'") · bound fields lock w/ chip; bind-dot on canvas · persists in document.
Tasks: T01 binding model in doc (S) · T02 popover UI (M) · T03 expression editor + preview (M) · T04 apply/runtime update path (S).

**S02 States & events** — per-widget state chips (Default/Hover/Pressed/Focus/Disabled/custom) with per-state overrides and live preview; event rows (tap/hold/value-change/double-tap) opening the flow drawer to attach/edit/test a flow.
Tasks: T01 states model+UI (M) · T02 events model+UI (S) · T03 flow drawer + assignment (S).

## IDE-E12–E15 — Data workspaces *(S8–9)*

- **E12 Vars:** virtualized table from VariablesRepository (scopes rail, filters, sort, multi-select, inline edit for non-plugin scopes, masked secrets), computed/expression vars, inspector w/ history+references ("used by" navigates). Tasks: T01 table+scopes (M) · T02 CRUD+inline edit (M) · T03 computed vars (S) · T04 inspector+refs (S).
- **E13 Library:** components/styles/symbols tabs all reading the same registries as Insert/canvas (single source of truth), hover preview cards, favorites, double-click insert. Tasks: T01 gallery shell (S) · T02 three tab feeds (S) · T03 insert path (S).
- **E14 Projects:** dashboard cards + browse table from ProjectRepository (sort/select/row menu), project inspector, new-project wizard (validated), open → `ProjectOpened`. Tasks: T01 table+inspector (M) · T02 wizard (S) · T03 recents/open flow (S).
- **E15 Runtime:** virtualized log (level/source filters, selectable text, pause/step/clear), perf panel (CPU/mem/fps heat bars), running-flows + queue + timers rails — all from RuntimeRepository streams. Tasks: T01 log view (M) · T02 perf panel (S) · T03 rails (S).

## IDE-E16 — Flows workspace *(S9–10)*

**S01 Graph editor** — As an **automation author**, I want a node graph with the same nav vocabulary as the canvas, so that flow editing is first-class.
AC: reuses PanZoomSurface (zoom/pan/fit/minimap-free) · palette drag-to-add + double-click · node drag w/ live edge redraw · per-port anchoring; conditions expose T/F out-ports · edge select/delete/branch toggle · marquee multi-select, multi-drag, ⌘D duplicate · flow tabs (rename, new, armed toggle) · all mutations undoable.
Tasks: T01 flow model bound to CON-E01-F04 (M) · T02 node render + palette (M) · T03 edge engine (M) · T04 multi-select/dup (S) · T05 per-kind param inspectors (M) · T06 tabs+armed (S).

**S02 Test run** — graph-walk simulation: execution order from roots, node pulse/done states, animated edges, step log in inspector, stop/replay; runs **locally against mock** now, against engine traces post-swap (ENG-E05).
Tasks: T01 walk simulator (S) · T02 run visuals + log (S) · T03 engine-trace adapter stub (S).

## IDE-E17 — Devices workspace *(S10)*

**S01** — device cards from DeviceRepository (status, heartbeat, revoke) + **Player Preview**: 3 device frames × portrait/landscape rendering the published layout with touch simulation (press/ripple/haptic nudge, tap-vs-hold verbs) and per-device layout assignment.
AC: preview renders from the *published* doc (flatten path proven pre-player) · assignment writes through repo · revoke round-trips (mock now, engine later).
Tasks: T01 cards+status (S) · T02 player preview frames + touch sim (M) · T03 assignment flow (S).

## IDE-E18 — Widget platform *(S10–11)*

**S01** — As the **platform**, I want manifests discovered/validated/registered dynamically with per-widget lazy chunks, declared permissions and error boundaries, so that hundreds of widgets scale without shell cost.
AC: registry validates schema+permissions at registration (bad manifest = rejected + notification, not crash) · each widget chunk loads on first render; loading/error/fallback states standard · Insert browser/Library/canvas/palette all consume the registry · per-widget error boundary renders fallback card + telemetry · permissions UI: grant/deny per widget, undeclared API access throws.
Tasks: T01 manifest loader+validator (M) · T02 lazy chunk loader + boundary wrapper (M) · T03 registry→surfaces wiring (S) · T04 permissions store+UI (M) · T05 convert canon widget set to platform loading (M).

## IDE-E19 — Extension host *(S11)*

**S01** — As a **third-party developer**, I want extensions running in sandboxed workers contributing via manifest, so that the core never changes and crashes stay isolated.
AC: worker host + RPC bridge with permission-mediated API surface · contribution points: widgets/commands/menus/settings/themes/nodes/data-providers · lazy activation on first use · kill/restart on crash with notification; shell unaffected (chaos test) · `pluginSandbox` flag hard-on for third-party.
Tasks: T01 worker host + lifecycle (M) · T02 RPC bridge + API typings (L) · T03 contribution point registration (M) · T04 crash isolation chaos test (S, QA) · T05 sample extension template (S — feeds EXT-E01).

## IDE-E20 — Accessibility & input *(threads through S4–S12; audit gate S12)*

AC (program-level): focus-visible ring on every interactive element · roles/labels stamped (button/tab/tree/dialog) · Enter/Space activation everywhere · focus-trapped modals with focus restore · Esc cancels renames · reduced-motion mode · axe + keyboard-only journey in CI (QA-E04).
Tasks: T01 a11y primitives library (S) · T02 per-epic audit checklist hook in DoD (XS, process) · T03 final audit + fixes (M, S12).

---

## ENG — Engine epics *(parallel lane, S6–S12)*

- **ENG-E01 Control-plane listener** *(S6–7)* — S01: As the **IDE**, I want a localhost WS control plane with authz, so that the IDE operates the engine securely. AC: separate listener/channel from device data plane (QoS isolation) · local privileged auth reusing `core/security` identity (console-channel precedent) · envelope + route dispatch generated-from/validated-against CON-E02 registry · contract tests green vs engine. Tasks: T01 listener+auth (M) · T02 route dispatch + handlers scaffold (M) · T03 subscription frames + backpressure (M) · T04 contract-test CI target (S).
- **ENG-E02 Document service v2** *(S7–8)* — project doc CRUD/migrate on `core/persistence`; publish/flatten pipeline (Q2) producing player layout docs. Tasks: T01 doc repo v2 (M) · T02 open/save/recents routes (S) · T03 flatten/publish (M) · T04 doc migration test (S).
- **ENG-E03 Registry manifest v2** *(S8)* — extend `core/registry` descriptors to manifest v2; plugin-contributed widget manifests. Tasks: T01 fields+validation (M) · T02 plugin contribution path (S) · T03 manifests route (S).
- **ENG-E04 Variables v2** *(S8–9)* — 13 value types, computed/expression vars (shared conformance corpus w/ SEC-E03), subscription fan-out to control plane. Tasks: T01 types (M) · T02 computed engine (M) · T03 subscribe bridge (S).
- **ENG-E05 Flow extensions** *(S9–10)* — node catalog v2 (Q3 cut), deploy/arm routes, run traces streamed for IDE test-run. Tasks: T01 nodes (L — split per node group) · T02 deploy/arm (S) · T03 trace stream (S).
- **ENG-E06 Runtime streaming** *(S10)* — log/perf/event bridge (engine bus → control plane → IDE bus, 13-event map). Tasks: T01 log stream (S) · T02 perf counters (S) · T03 event bridge (S).
- **ENG-E07 Device layout push v2** *(S10–11)* — layout doc v2 over data plane, per-device assignment, asset transfer, versioned re-push. Tasks: T01 push protocol rev (M) · T02 assignment store (S) · T03 asset chunks (M).
- **ENG-E08 Plugin manifest v2** *(S11)* — manifest schema alignment; integration-pair packaging convention (engine half + IDE half, one package ID). Tasks: T01 manifest v2 (S) · T02 pairing convention + loader (S).

**Milestone M5 (end S12) — The Great Swap:** flip `runtime.gateway=engine` → same IDE, live engine: real variables in Vars, flows executing in `core/flow`, runtime log streaming, devices live. Contract suite green on both gateways. `task interop` extended (QA-E03).

## PLY — Player epics *(S12–14)*

- **PLY-E01 Shell refocus** *(S12)* — remove designer entry points, player navigation/settings; keep demo mode. Tasks: T01 strip+nav (M) · T02 settings (S). *(Designer code deleted at end of PLY-E02 per assessment transition rule.)*
- **PLY-E02 Layout v2 renderer** *(S12–13)* — S01: As a **deck user**, I want my published deck rendering identically on any device, so that the promise of the product holds. AC: consumes flattened `cyberdeck.layout` · pages, per-device assignment, component instances render · parity screenshots vs IDE Player Preview within tolerance · existing reconnect/degradation preserved (34 tests stay green). Tasks: T01 doc parser→render model (M) · T02 renderer updates (L) · T03 parity harness (S, QA) · T04 delete `client/designer/` (S).
- **PLY-E03 Catalog alignment** *(S13)* — manifest-driven widget registry; parity matrix; build missing GA widgets. Tasks: T01 registry adapter (S) · T02 parity matrix (S, QA) · T03 gap widgets (M–L per gap).
- **PLY-E04 Interactions & haptics** *(S13)* — verbs (tap/hold/slide/toggle/confirm) mapped to interaction events; haptic feedback; <100 ms p95 round-trip measured. Tasks: T01 verb capture (S) · T02 haptics (S) · T03 latency instrumentation (S).
- **PLY-E05 Offline & resilience** *(S13–14)* — cached last layout, offline banner, interaction disable states, self-heal preserved. Tasks: T01 layout cache (S) · T02 offline UX (S).
- **PLY-E06 Pairing UX v2** *(S14)* — QR flow polish, naming, trust screen parity with IDE Devices. Tasks: T01 flow polish (S) · T02 naming/trust (S).
- **PLY-E07 iOS bring-up** *(S14, needs Mac — A4)* — build, quirks (background sockets, ATS/local-network permission prompts), TestFlight. Tasks: T01 build+entitlements (M) · T02 quirk fixes (M) · T03 TestFlight (S).

## EXT / DEV / SEC / DOC / REL / SUP — remaining lanes (summary; L7 at sprint boundaries)

- **EXT-E01 SDK** *(S11–12)*: package format (manifest+chunk), typed API package, dev harness (load unpacked), sample extension. **EXT-E02 OBS** *(S12–13)*: engine plugin (obs-websocket), scene/source variables+actions, IDE widgets/nodes. **EXT-E03 Spotify** *(S13)*: auth (PKCE), now-playing vars, transport actions, widgets. **EXT-E04 Catalog convergence** *(S11–13)*: 61-design ∪ 28-player audit → GA catalog list (PROD signs off), gap builds.
- **DEV-E02 Tauri shell** *(S11–12)*: window shell, sidecar spawn/attach/health/restart, tray/menu, IPC allowlist (SEC review), fs/config path adapters. **DEV-E03 Installers** *(S13)*: Windows NSIS/MSI + signing (D6), macOS dmg+notarize (A4), Linux AppImage/deb; engine service registration preserved. **DEV-E04 Updates+crash** *(S13–14)*: update channels (beta/stable), Tauri updater, crash capture + symbol upload. **DEV-E05 Store pipelines** *(S14)*: Android bundle/sign/internal track; iOS archive/TestFlight.
- **SEC-E01** *(S7, with ENG-E01)*: control-plane threat review, non-exposure tests (refuses non-localhost), privilege model. **SEC-E02** *(S11–12)*: sandbox RPC audit, permission enforcement tests, escape attempts. **SEC-E03** *(S8, with IDE-E11)*: expression parser (no eval), resource limits, conformance corpus vs `flow/expr`. **SEC-E04** *(continuous)*: lockfile audit gate, SBOM, signed releases. **SEC-E05** *(S14)*: STRIDE pass over pairing/control-plane/sandbox, findings burn-down before GA.
- **DOC-E01** *(S12–15)*: getting started, workspace guides, flows cookbook. **DOC-E02** *(S12–13, with EXT-E01)*: SDK guide + manifest reference + sample walkthrough. **DOC-E03** *(S14)*: install/upgrade/rollback runbooks, troubleshooting (port, firewall, pairing). **DOC-E04** *(S12)*: first-run tour v2 + sample project + empty states.
- **REL-E01** *(S10–12)*: name/trademark sanity check, landing page, 90-second demo video. **REL-E02** *(S13–14)*: screenshots, release-notes pipeline (from conventional commits), press kit. **REL-E03** *(S12–15)*: 20–50-user beta cohort, feedback instrumentation (D4-consented), weekly triage, exit criteria = success metrics table. **REL-E04** *(post-GA)*: store listings + review compliance.
- **SUP-E01** *(S12)*: issue templates/labels/triage SLA. **SUP-E02** *(S12)*: Discussions or Discord + moderation baseline. **SUP-E03** *(S13+)*: telemetry review ritual; friction log → backlog.

---

# L8 — Risk register (per epic)

| Epic(s) | Technical risk | Business risk | Edge cases | Failure scenario | Mitigation |
|---|---|---|---|---|---|
| CON-E01/02 | schema over-design freezes wrong shapes | rework across 3 tiers | doc migrations mid-beta | contract change post-swap breaks player in field | version stamps + migration registry from day 1; contract tests dual-gateway; additive-only after M5 |
| IDE-E01 | boot budget missed once real services pile in | "feels slow" first impression | corrupt config layer; storage quota | white screen on boot failure | per-stage budgets in CI; failure policies (skip/fallback) tested; corrupt-layer fixtures |
| IDE-E02 | undo model diverges from doc model | data-loss reputation | coalescing across workspace switch; redo after external doc change | undo corrupts document | do/undo only via model commands; property tests (do→undo = identity); history cleared on doc reload with notice |
| IDE-E03 | mock drifts from engine reality | swap milestone slips | pagination boundaries; aborted in-flight mutations | optimistic update ghosts wrong state | router generated from route registry; contract tests both gateways; rollback tests |
| IDE-E04 | store sprawl / duplicated truth | — | migration of persisted stores across versions | restore loop crashes boot | store base owns persistence; lint bans ad-hoc state; corrupt-blob fallback |
| IDE-E05 | token gaps force per-widget styling | theme feature underwhelms | canvas-rendered widgets miss ThemeChanged | flash of wrong theme | tokens extracted from design CSS first; no-flash test; second theme proof |
| IDE-E06 | inspector reads private internals | — | flag toggles mid-operation | dev surface crashes prod path | read via public taps only; devTools flag gates chunks entirely |
| IDE-E07/08 | docking complexity balloons (classic sink) | shell slips M2 | multi-monitor DPI; tiny windows; RTL later | layout store corruption locks UI | state-machine unit tests; reset-layout command; min-window floor; time-box docking to spec'd modes only |
| IDE-E09 | canvas perf at 200+ widgets | "toy" perception | zoomed transforms + drag math drift; huge boards | fps collapse during drag | perf harness early (S6); rAF batching; cached rects per gesture; virtualized layers |
| IDE-E10 | model complexity (nesting+overrides) breeds corruption bugs | flagship differentiator broken | detach with nested overrides; circular nesting; variant delete w/ overrides | doc corrupts silently | invariant checks + property tests; circular-nesting guard; fuzz round-trips |
| IDE-E11 | expression sandbox escapes or diverges from engine | security + trust | unknown vars; type coercion; infinite loops | injection via expression | SEC-E03 parser (no eval), op/time limits, shared conformance corpus |
| IDE-E12–15 | table perf; stale caches | — | 10k variables; masked secret leak in UI | log floods memory | virtualization; ring buffers; secret masking test |
| IDE-E16 | graph editor scope creep | automation is a core pillar — slips hurt | cycles; dangling edges; concurrent test-run + edit | armed flow executes while editing | Q3 catalog cut; cycle detection; edit locks during test-run; arm confirm |
| IDE-E17 | preview diverges from real player | broken WYSIWYG promise | orientation swap mid-render | assignment to revoked device | parity harness (PLY-E02-T03); assignment validation |
| IDE-E18/19 | sandbox RPC surface too wide; chunk loading races | third-party trust | extension updates while active; manifest downgrade | malicious extension exfiltrates | permission mediation + SEC-E02 audit; version pinning; kill-switch per extension |
| ENG-E01 | control plane exposed beyond localhost | security incident | multi-IDE instances; engine restart mid-session | unauthorized project mutation | bind 127.0.0.1 only + identity check + non-exposure test; session resume protocol |
| ENG-E02–07 | v2 doc/flow migrations break v1 pairings | beta users stranded | mixed-version engine/player | layout push crashes old player | protocol version negotiation (exists in handshake); doc version gates; interop matrix in QA-E03 |
| PLY-E02–05 | renderer parity gaps per platform | reviews cite inconsistency | notches/safe areas; font scaling; 32-bit devices | offline cache renders stale bindings | parity screenshots per device class; safe-area tests; cache stamped with doc version |
| PLY-E07 | Apple local-network permission + background socket policies | iOS slips GA | ATS exceptions; TestFlight review | app rejected | early S14 spike; local-network usage strings; fallback: iOS beta post-GA (A4) |
| EXT-E02/03 | third-party API changes (Spotify auth, OBS versions) | proof integrations break demos | token expiry mid-stream | OBS ws protocol mismatch | pin obs-websocket v5; PKCE refresh handling; integration smoke tests nightly |
| DEV-E02–04 | Tauri sidecar lifecycle on Windows services; signing/notarization friction | install experience = first impression | engine already running as service when IDE spawns sidecar | updater bricks install | attach-before-spawn logic; staged rollout beta→stable; rollback = keep previous version binary |
| SEC-* | findings late in cycle | launch delay | — | pairing crypto flaw | threat-model early (S7 for control plane), not just S14 pass |
| REL/SUP | beta cohort too small/quiet | ship blind | — | GA with unknown crash rate | recruit at S12; crash-free metric gate in readiness review |

---

# L9 — Dependencies

**Blocking chains (hard):**
- CON-E01 → everything (schemas are the freeze line). CON-E02 → IDE-E03-F03 (mock router) and ENG-E01 (engine router).
- IDE-E01 → E02/E03/E04 → E05/E06/E07 → E08 → E09 → E10 → E11 → E16/E17 → E18 → E19.
- ENG-E01 → ENG-E02..E06 → M5 swap → PLY-E02 (needs published docs from ENG-E02/E07).
- DEV-E02 (Tauri) → DEV-E03/E04 → GA. QA-E02 (contract tests) → M5 gate. SEC-E03 → IDE-E11 expression editor ship.

**Parallel lanes (safe to run concurrently):** IDE lane (E07+) ∥ ENG lane (E01+ after CON freeze) ∥ EXT-E01 SDK design ∥ REL-E01 branding ∥ DOC drafts ∥ SEC reviews shadowing their target epics. Within IDE: E12–E15 parallelize after E04/E03; E20 threads through everything.

**Critical path (GA):**
`CON-E01/02 → IDE-E01 → IDE-E03 → IDE-E07 → IDE-E08 → IDE-E09 → IDE-E10 → IDE-E11 → IDE-E18 → [M5 swap w/ ENG-E01..E06] → DEV-E02 → DEV-E03 → PLY-E02 → QA-E05 sign-off → GA`
Slack exists in: E05/E06 (can trail), E12–E15 (parallel), E13 Library, EXT-E03, DOC, REL. **No slack** in: schemas, kernel, canvas/component/binding chain, swap, Tauri packaging, player renderer.

**Cross-team (cross-hat) dependencies:** manifest fields (FE↔BE, CON-E01-F02) · flatten semantics Q2 (BE↔MOB) · expression conformance corpus (FE↔BE↔SEC) · parity harness (MOB↔QA↔FE) · IPC allowlist (DO↔SEC).

**External dependencies:** Apple Developer account + **Mac hardware (A4 — the only physical blocker; needed S13–14)** · Google Play account · Windows signing cert (D6, 1–2 wk procurement, order by S11) · OBS (obs-websocket v5) and Spotify API availability · GitHub Actions free-tier limits (mitigate w/ path filters + caching) · Tauri/Flutter/Go toolchain stability (pin versions).

---

# L10 — Testing plan (per feature area)

| Area | Unit | Integration | Regression | Performance | Security | Accessibility | Manual QA checklist |
|---|---|---|---|---|---|---|---|
| Kernel (E01–E04) | stage runner, merge engine, DI, bus, middleware, stores (85 % floor) | boot journey E2E; config round-trips; mock-gateway contract suite | contract suite on every PR | boot budget gate ≤150 ms | config injection fixtures; no secrets in localStorage test | n/a | corrupt-config recovery; offline flip; flag toggles |
| Shell (E07–E08) | ws registry, dock state machine, palette scorer | Playwright: nav/palette/prefs/session-restore/dock journeys | journey suite per PR | ws-switch <100 ms; chunk-size budgets | IPC allowlist test (with DEV-E02) | axe pass; keyboard-only journey; focus-trap tests | 7-ws walkthrough; resize extremes; multi-monitor DPI |
| Canvas+components (E09–E11) | model invariants, command do/undo identity, expression parser conformance | author-journey E2E (insert→bind→state→undo→save→reload) | doc round-trip property/fuzz tests nightly | 200-widget fps harness; drag-latency probe | expression sandbox escape corpus | canvas keyboard ops; layer tree semantics | full authoring script; nesting/variant/override edge script |
| Data workspaces (E12–E15) | table models, filters | repo-driven CRUD E2E | snapshot of virtualized tables | 10k-row scroll fps | secret masking; log injection escaping | table roles/roving focus | vars CRUD; log filters; project open |
| Flows (E16) | graph model, walk simulator | build+test-run E2E; deploy (post-M5) | fixture flows re-run | 100-node graph pan/zoom | node param validation | graph keyboard access | authoring + test-run + arm script |
| Widget/ext platform (E18–E19) | manifest validation, loader | extension install/activate/crash E2E | sample-extension suite | chunk-load timing; memory after dispose | sandbox escape attempts; undeclared-API throw; permission UI | fallback-card semantics | install/upgrade/kill extension script |
| Engine (ENG-*) | Go unit (existing 62 files + new) | contract suite vs engine; interop v2 | full `go test` + interop nightly | control-plane latency; fan-out under 10 devices | non-exposure (external iface refusal); authz; fuzz envelope | n/a | console ops; service install/uninstall |
| Player (PLY-*) | render model, verb capture | pair→receive→render→interact interop | 34 existing tests + parity screenshots | tap round-trip p95; startup time | pairing trust screens; cert pinning behavior | TalkBack/VoiceOver labels on tiles | device matrix script (2 Android, 1 iOS, tablet, desktop) |
| Packaging (DEV-*) | — | install/upgrade/rollback VM tests | updater staged-rollout dry run | installed size; cold start | signature verification; SBOM diff | installer keyboard nav | clean-machine install script per OS |

Manual QA cadence: per-milestone checklist run (M2, M4, M5, M7), full matrix at GA candidate; beta cohort acts as continuous field QA (REL-E03).

---

# L11 — Deployment plan

**Environments.** This is a local-first desktop product — "environments" are build channels, not servers:
- **Development:** `pnpm dev` (IDE, browser, mock gateway) · `task run:engine` · `flutter run`. Mock gateway = the everyday backend.
- **Staging = Beta channel:** signed builds from `main` on tag `v*-beta.*`; auto-update ring for the beta cohort; failure injection + devTools flags available.
- **Production = Stable channel:** tagged releases after QA-E05 sign-off; staged rollout (25 % → 100 % over 48 h via updater metadata).

**Rollback:** updater keeps previous version for one-click revert; engine SQLite migrations are forward-only with backup-on-migrate (documented in DOC-E03); project docs carry version stamps → older engine refuses newer docs with a clear error instead of corrupting.

**Monitoring/health:** in-product only (no server): boot timings, crash-free-session counter, engine health checks surfacing in the status chip; beta builds send consented crash reports + anonymized metrics (D4). Player reports connection quality to the engine (visible in Devices workspace).

**Logging:** IDE structured logs (ring buffer + export bundle command "Save diagnostics ZIP"); engine logs per existing audit/logging; player logs attached to diagnostics on demand.

**Alerts:** repo-level — CI failure, nightly interop failure, crash-rate threshold in beta telemetry review (SUP-E03 ritual); no pager (A1-scale team).

**Feature flags:** the 7 platform flags (`FLAGDEFS()`) + release flags per risky subsystem (docking modes, extension host, engine gateway). Flags gate lazy chunks (off = zero bytes). Kill-switch flags for: extensions, automation arming, telemetry.

---

# L12 — Deliverables inventory

| Artifact | Owner | Due | Notes |
|---|---|---|---|
| Design source (Phase 4 file + companions) | PROD | ✅ exists | claude.ai/design project; re-export cadence per PROD-E01 |
| Baseline docs 00–03 + this blueprint (04) | PROD | ✅ this phase | `Documentation/v2/` |
| Per-workspace UX spec sheets | PROD/DES | sprint before each UI epic | PROD-E02 |
| Schema suite + fixtures (`shared/schemas/` v2) | CON | S2 | the contract |
| Control-plane route registry + envelope spec | CON | S2 | machine-readable; API contract = OpenAPI-equivalent (route registry is the source; an OpenAPI export is a S2 subtask) |
| Generated types (TS/Go/Dart) + codegen README | CON | S2/S6/S12 | drift-gated in CI |
| ER diagram (engine SQLite v2 deltas) | ENG | S7 | extends existing persistence docs |
| Architecture diagrams (tier + kernel + dataflow) | PROD | S3 | derived from `01`, kept in `Documentation/v2/diagrams/` |
| PRD equivalents | PROD | ✅ | `00` + design FEATURES.md serve as PRD; deltas logged per epic |
| Test plans + conformance corpus | QA | per milestone | L10 tables instantiated |
| Runbooks (install/upgrade/rollback/troubleshoot) | DOC | S14 | DOC-E03 |
| User docs + extension SDK docs | DOC | S12–15 | DOC-E01/E02 |
| Sample extension + template repo | EXT | S12 | EXT-E01 |
| Beta program brief + exit criteria | REL | S12 | REL-E03 |
| Landing page + demo video + press kit | REL | S12–14 | REL-E01/E02 |
| Release notes pipeline | REL | S13 | from conventional commits |
| Store listings + assets | REL | post-GA gate | REL-E04 |
| Training/onboarding (in-app tour + sample project) | DOC | S12 | DOC-E04 |
| Signed installers + APK + TestFlight build | DEV | S13–14 | GA artifacts |
| SBOM + license report | SEC | S14 | SEC-E04 |

---

# L13 — Timeline (15 × 2-week sprints ≈ 30 weeks + buffer)

| Sprint (wk) | IDE lane | Parallel lane | Milestone gate |
|---|---|---|---|
| S1 (1–2) | DEV-E01 · IDE-E01 start | CON-E01 start · QA-E01 | — |
| S2 (3–4) | IDE-E01 done · E02 · E03 start | CON-E01/02/03 done | **Contract freeze** |
| S3 (5–6) | IDE-E03/E04 done · E05 · E06 | QA-E02 green vs mock | **M1 kernel** |
| S4 (7–8) | IDE-E07 | SEC-E01 prep · PROD-E02 sheets | — |
| S5 (9–10) | IDE-E07 done · E08 | ENG-E01 start | **M2 shell** |
| S6 (11–12) | IDE-E09 | ENG-E01 · SEC-E01 | — |
| S7 (13–14) | IDE-E09 done · E10 start | ENG-E01 done · E02 | — |
| S8 (15–16) | IDE-E10 done · E11 (+SEC-E03) | ENG-E03/E04 | **M3 authoring core** (author+bind+undo on mocks) |
| S9 (17–18) | IDE-E12–E15 · E16 start | ENG-E04/E05 | — |
| S10 (19–20) | IDE-E16 done · E17 | ENG-E05/E06/E07 start · REL-E01 | **M4 all workspaces on mocks** |
| S11 (21–22) | IDE-E18 · E19 start | ENG-E07/E08 · DEV-E02 · EXT-E01 · order signing cert | — |
| S12 (23–24) | IDE-E19 done · E20 audit prep · DOC-E04 | **gateway swap** · EXT-E02 · REL-E03 beta opens · SUP-E01/02 | **M5 live engine** |
| S13 (25–26) | polish + beta fixes | PLY-E01/E02 · EXT-E02/03 · DEV-E03 | **M6 packaged IDE (Win)** |
| S14 (27–28) | E20 final audit | PLY-E03–E07 (Mac needed) · DEV-E04/E05 · SEC-E05 · DOC-E03 | **M7 players on devices** |
| S15 (29–30) | QA-E05 regression + fixes | REL-E02 · staged beta→stable | **M8 GA candidate** |
| Buffer (31–36) | 20 % program buffer — absorbs docking (S5), component model (S7–8), swap (S12), iOS (S14) overruns | | **GA** |

Weekly rhythm: Mon plan (rolling-wave L7 pass for next epic) · daily agent-lane check · Fri demo against the milestone gate + friction log. Expected completion: **GA week 30, worst-case week 36.**

---

# Project Readiness Review

**Ready to start? YES for Sprints 1–3 (contract + kernel), conditional beyond** — conditions below.

**Green (proven/exists):** runtime backend ~80 % exists with tests (engine); player networking/rendering proven end-to-end (`task interop`); design spec is unusually complete (behavior + embedded architecture contract, now un-truncated); baseline docs 00–04 aligned; toolchain installed and verified.

**Confirm before S1 (blockers if wrong):** A1 team shape (owners are hats — if a second human joins, re-cut the parallel lanes); A2 budget for cert/store fees; stack ADR acceptance (React/Tauri — this blueprint is void if vetoed).

**Unknowns with planned closure:** Q1 keymap (S4) · Q2 flatten location (S6 spike) · Q3 node catalog cut (S8) · Q4 transport (S10) · iOS local-network/App-Store behavior (S14 spike — the only unknown with store-review dependency).

**Hard external blockers:** Mac hardware by S13 (A4 — else iOS/macOS slip post-GA, Android/Windows/Linux GA unaffected) · signing cert procurement by S12 (D6).

**Top 3 program risks:** (1) IDE scope gravity — mitigated by behavioral milestone gates M1–M8 and D1/D2/D3/D7 scope cuts; (2) mock↔engine drift — mitigated by generated contract tests running against both gateways from S3; (3) solo-capacity variance — mitigated by strict critical-path protection (slack lanes named in L9) and 20 % buffer.

**First five actions (Sprint 1, day 1):** confirm A1–A5/D1–D8 → scaffold `ide/` (DEV-E01-F01-T01) → author config-area schemas (CON-E01-F01-T01) → CI matrix (DEV-E01-F02) → BootManager (IDE-E01-F01-T01).




