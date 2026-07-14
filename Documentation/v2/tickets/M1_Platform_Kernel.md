# M1 — Platform Kernel (CD-101…139)

**Gate:** boot ≤ 150 ms warm with inspectable stages · zero hardcoded data outside fixtures · contract tests green vs MockApiGateway · Platform Inspector shows live services/stores/flags/requests/events.
**Entry:** `Documentation/v2` docs accepted. **Exit:** CD-139 gate review recorded below.

## Board

- [x] CD-101 Kickoff confirmation (assumptions, decisions, stack ADR) — ✅ Done 2026-07-13
- [x] CD-102 Scaffold `ide/` app — ✅ Done 2026-07-13
- [x] CD-103 Folder structure + lint boundaries — ✅ Done 2026-07-13
- [x] CD-104 Taskfile targets for the IDE — ✅ Done 2026-07-13
- [x] CD-105 CI: IDE workflow + bundle budget — ✅ Done 2026-07-14 (CI green pending next push)
- [x] CD-106 CI: engine + player workflows — ✅ Done 2026-07-14 (pre-existing ci.yml already covers it)
- [x] CD-107 Test harness: vitest + RTL + utilities — ✅ Done 2026-07-14
- [x] CD-108 Schemas: configuration areas + fixtures — ✅ Done 2026-07-14
- [x] CD-109 Layer-merge semantics + migration convention — ✅ Done 2026-07-14 (spec pending maintainer review)
- [x] CD-110 Schema: widget manifest v2 + canon manifests — ✅ Done 2026-07-14
- [x] CD-111 Schemas: project doc + published layout + ID rules — ✅ Done 2026-07-14
- [ ] CD-112 Schema: flow document + triggers
- [ ] CD-113 Control-plane envelope + route-registry format + error model
- [ ] CD-114 Route set v1 + event bridge map
- [ ] CD-115 TS type generation + CI drift gate
- [ ] CD-116 BootManager
- [ ] CD-117 ConfigurationService core
- [ ] CD-118 Config persistence, validation, migration
- [ ] CD-119 ServiceContainer
- [ ] CD-120 EventBus
- [ ] CD-121 Command registry + contexts + seed commands
- [ ] CD-122 Keymap dispatcher + rebinding store
- [ ] CD-123 Undo/redo engine
- [ ] CD-124 Repository base + registry + 7 domain repos
- [ ] CD-125 Middleware: composition, latency, failure injection
- [ ] CD-126 Middleware: retry/backoff + cancellation
- [ ] CD-127 MockApiGateway: router + fixture DB
- [ ] CD-128 Mock push streams + gateway selection + offline
- [ ] CD-129 CacheManager
- [ ] CD-130 Store base + persistence contract
- [ ] CD-131 Boot-critical stores
- [ ] CD-132 Remaining domain stores
- [ ] CD-133 Optimistic updates + rollback
- [ ] CD-134 Theme engine
- [ ] CD-135 Contract-test generator, green vs mock
- [ ] CD-136 Playwright boot E2E + coverage floors
- [ ] CD-137 Platform Inspector: services/stores/flags tabs
- [ ] CD-138 Inspector: repos/events tabs + Architecture Mode + boot replay
- [ ] CD-139 **M1 gate review**

---

### CD-101 · Kickoff confirmation
**BP:** Blueprint §0 · **Hat:** PM · **P:** P0 · **Est:** S · **Deps:** —
**Do:** Walk assumptions A1–A5, decisions D1–D8, and the React/Tauri stack ADR (`01` §0). Record answers in the blueprint §0 table. Re-cut any affected tickets before starting CD-102.
**AC:**
- [x] every A/D row marked confirmed or amended, dated
- [x] stack ADR explicitly accepted (blueprint is void otherwise)
- [x] amendments propagated to affected tickets (list them in this ticket's notes)

**Notes (2026-07-13):** Maintainer confirmed A1–A5 as written, accepted D1–D8 defaults with no vetoes, and explicitly accepted the stack ADR (recorded in `04_Execution_Blueprint.md` §0 and `01_Architecture_Baseline.md` §0). No amendments → no tickets re-cut. CD-102 is unblocked.

### CD-102 · Scaffold `ide/` app
**BP:** DEV-E01-F01-T01 · **Hat:** FE · **P:** P0 · **Est:** S · **Deps:** CD-101
**Do:** Vite + React + TS(strict, `noUncheckedIndexedAccess`) app at `ide/`; pinned Node/pnpm; path aliases; placeholder shell renders.
**AC:**
- [x] `pnpm dev` serves the shell in a browser; `pnpm build` passes
- [x] `tsc --noEmit` clean under strict
- [x] versions pinned (engines + `.tool-versions`)

**Notes (2026-07-13):** Scaffolded with Vite 8.1.4 + React 19.2.7 + TS 6.0.3 (template ships oxlint; eslint-plugin-boundaries lands in CD-103). `strict` + `noUncheckedIndexedAccess` on in both tsconfigs; `@/* → src/*` alias in tsconfig + vite.config (exercised by `src/main.tsx`); versions pinned via `engines` + `packageManager` (pnpm@10.34.1) + root `.tool-versions` (nodejs 20.19.4). Placeholder shell renders top bar / rail / stage / status bar. Build: 60.15 kB gz shell entry (budget 350 kB).

### CD-103 · Folder structure + lint boundaries
**BP:** DEV-E01-F01-T02 · **Hat:** FE · **P:** P0 · **Est:** S · **Deps:** CD-102
**Do:** Create `platform/ services/ repositories/ stores/ workspaces/ widgets/ extensions/ shared/`; eslint boundaries plugin with the allowed-dependency matrix from `01` §17; README (≤1 page).
**AC:**
- [x] fixture cross-feature import fails lint (test committed)
- [x] README documents the matrix

**Notes (2026-07-13):** All 8 layer folders created under `ide/src/`. Swapped template oxlint for ESLint 10 + typescript-eslint + eslint-plugin-boundaries v7 (`boundaries/dependencies` rule, default-deny, v7 `policies` syntax). Matrix documented in `ide/README.md`. Committed fixtures `src/workspaces/__fixture-a__/__fixture-b__` prove a cross-workspace import fails lint; `pnpm test:boundaries` (node --test + ESLint API) asserts it in CI-runnable form. `pnpm lint` clean, tests 2/2, build green.

### CD-104 · Taskfile targets for the IDE
**BP:** DEV-E01-F01-T03 · **Hat:** DO · **P:** P1 · **Est:** S · **Deps:** CD-102
**Do:** `task ide:dev / ide:test / ide:build / ide:lint`; verify on PowerShell and Git Bash.
**AC:**
- [x] all four targets work on Windows shells

**Notes (2026-07-13):** Four `ide:*` targets added to root `Taskfile.yml`; aggregate `lint`/`test`/`build` now fan out to the IDE too. `ide:test` runs the boundary tests until vitest lands (CD-107). Verified lint/test/build on PowerShell + Git Bash; `ide:dev` verified serving on :5173. Task binary was not on PATH — installed go-task 3.52.0 standalone at `D:\Tools\task\task.exe` (C: had no space for `go install`; add `D:\Tools\task` to PATH).

### CD-105 · CI: IDE workflow + bundle budget ∥
**BP:** DEV-E01-F02-T01 · **Hat:** DO · **P:** P0 · **Est:** S · **Deps:** CD-102
**Do:** GH Actions: eslint + `tsc` + vitest + build; size-limit gate at 350 KB gz for the shell entry; pnpm caching.
**AC:**
- [ ] green on scaffold; required check on PRs — *pending: user pushes + re-applies ruleset (`gh api PUT` per `ci/README.md`); full job sequence mirrored green locally 2026-07-14*
- [x] budget gate proven to fail with an intentionally fat fixture (then removed)

**Notes (2026-07-14):** `ide` job added to `.github/workflows/ci.yml` (pnpm/action-setup + Node 20.19.4 + pnpm cache keyed on `ide/pnpm-lock.yaml`; lint → typecheck → test:boundaries → build → `pnpm size`). Budget = size-limit 350 KB gz on `dist/assets/*.js` (`size-limit` config in `ide/package.json`). Fat-fixture proof: a 530 KB incompressible module pushed the entry to 471.87 kB gz → `pnpm size` exited 1; fixture removed, back to 59.35 kB gz green. (First proof attempt was tree-shaken away — usage must be non-foldable.) Required-check context `ide (lint + type + test + build + budget)` added to `ci/branch-ruleset.json` + `ci/README.md`; vitest replaces the test step at CD-107.

### CD-106 · CI: engine + player workflows ∥
**BP:** DEV-E01-F02-T02 · **Hat:** DO · **P:** P0 · **Est:** S · **Deps:** —
**Do:** `go vet` + `go test ./...` (ubuntu+windows, CGO off) and `flutter analyze` + `flutter test` (pinned channel) workflows; caching.
**AC:**
- [x] existing engine + player suites green in CI

**Notes (2026-07-14):** Satisfied by the pre-existing `.github/workflows/ci.yml` (v1-era PROJ-102), which exceeds this ticket: engine gets vet + golangci-lint + `test -race` + build on ubuntu AND build + test on windows + macos, looped over every go.work module, with per-module go.sum caching; client gets `dart analyze` + `flutter test` + `flutter build bundle` on pinned Flutter 3.44.1 with pub cache. Suites green as of last pushed CI run. No changes made.

### CD-107 · Test harness: vitest + RTL + utilities ∥
**BP:** QA-E01-T01 · **Hat:** QA · **P:** P0 · **Est:** S · **Deps:** CD-102
**Do:** vitest + testing-library config; test-container/store utilities skeleton; sample tests.
**AC:**
- [x] sample unit + component tests run in CI
- [x] utilities importable from any feature folder without boundary violation

**Notes (2026-07-14):** vitest 4.1.10 + jsdom + RTL (+ jest-dom matchers, user-event, coverage-v8) configured via the `test` block in `ide/vite.config.ts` (setup: `src/shared/test/setup.ts`). Utilities live in `src/shared/test/` — `createTestContainer()` (token→instance registry mirroring the CD-119 ServiceContainer shape) and `renderWithProviders()` (RTL wrapper that grows providers with CD-119/130/134) — `shared` is importable from every layer per the boundary matrix, so no violation (proven: `App.test.tsx` imports it and lint is clean). Sample tests: container unit test + App shell component test, 3/3 green. CI `ide` job + `task ide:test` now run vitest before the boundary tests.

### CD-108 · Schemas: configuration areas + fixtures
**BP:** CON-E01-F01-T01 · **Hat:** BE+FE · **P:** P0 · **Est:** M · **Deps:** CD-101
**Do:** `shared/schemas/config/`: application, user-prefs, workspace-layout, session, feature-flags (the 7 `FLAGDEFS()` ids), keymap. Each: editability flags per `01` §4, `version` field, ≥2 valid + ≥2 invalid fixtures.
**AC:**
- [x] all six schemas + fixtures validate (ajv + gojsonschema)
- [x] flags schema mirrors design `FLAGDEFS()` exactly

**Notes (2026-07-14):** Six draft-2020-12 schemas in `shared/schemas/config/` (matching the existing suite's dialect), each with root `x-editability` (user/extension/persisted/owner per `01` §4), `version: const 1` (bump = registered migration, CD-109), `additionalProperties: false` throughout, and 4 fixtures (24 total) under `fixtures/<area>/`. Dual validation: TS via ajv (Ajv2020) in `ide/src/shared/schemas/config-schemas.test.ts` (runs in the CI ide job; also asserts the FLAGDEFS mirror — 7 ids + defaults transcribed from the design at line 2613); Go via **santhosh-tekuri/jsonschema/v6** in `engine/core/schemas/config_schemas_test.go` (runs in the CI engine jobs). *Deviation:* the ticket names gojsonschema, but it tops out at draft-07 and can't compile 2020-12 schemas — substituted the actively-maintained santhosh-tekuri lib. All green: 41 vitest + `go test ./core/schemas` pass; `go vet`/`go build ./...` clean.

### CD-109 · Layer-merge semantics + migration convention
**BP:** CON-E01-F01-T02/T03 · **Hat:** FE · **P:** P0 · **Est:** S · **Deps:** CD-108
**Do:** Written spec: precedence (`defaults←app←user←workspace←runtime`), array strategy, delete markers, SettingsChanged delta shape; migration registry pattern with one worked v1→v2 example.
**AC:**
- [ ] spec committed beside the schemas; reviewed — *committed; maintainer review pending*
- [x] edge cases enumerated (scalar/object/array conflicts)

**Notes (2026-07-14):** Spec at `shared/schemas/config/MERGE_AND_MIGRATION.md`. Key decisions: arrays replace **atomically** (no concat/byId until a real use case), delete marker is `{"$unset": true}` (null is a legitimate value), layers validate before AND after merge with broken-layer fallback so a corrupt user file can't kill boot, SettingsChanged deltas are per-path on the merged view with a per-area revision counter, migrations are single-hop pure functions run per layer document before merge, newer-than-app documents are rejected not down-migrated. 13 edge cases enumerated. Worked v1→v2 example: user-prefs keymap string→object. Implementation lands with CD-117/118.

### CD-110 · Schema: widget manifest v2 + canon manifests
**BP:** CON-E01-F02 · **Hat:** FE+BE · **P:** P0 · **Est:** M · **Deps:** CD-108
**Do:** Extend `widget.schema.json` with the 15 fields of `01` §5 (permissions enum = `PERMS()` vocabulary). Author `gauge.circular`, `button.action`, `media.nowplaying` manifests. Old-descriptor→new-field mapping note for ENG.
**AC:**
- [x] 3 canon manifests validate; invalid fixtures (undeclared permission, bad semver) rejected
- [x] mapping note lists every engine descriptor gap

**Notes (2026-07-14):** v2 authored as a NEW schema `shared/schemas/widget-manifest.schema.json` rather than editing `widget.schema.json` in place — the v1 descriptor is enforced by the live engine (PROJ-161) and mutating it would break v1 consumers before the M5 swap; `widgets/DESCRIPTOR_MAPPING.md` records the field mapping + all 11 engine descriptor gaps + M5 adoption order. All 16 §5 fields covered; `permissions` enum = exactly the 9 PERMS() capability ids (network, notifications, media, git, devices, environment, filesystem, clipboard, automation); poll strategy requires `interval` via if/then. Canon manifests in `shared/schemas/widgets/`; 3 invalid fixtures (undeclared permission, bad semver, poll-without-interval). Dual-validated (ajv 51-test suite + Go twin); tests also assert filename=id and that each manifest's `defaults` validate against its own `configSchema`.

### CD-111 · Schemas: project doc + published layout + ID rules
**BP:** CON-E01-F03 · **Hat:** FE+BE · **P:** P0 · **Est:** L · **Deps:** CD-110
**Do:** `cyberdeck.project` schema (pages, widgets w/ stable IDs, components/instances/overrides, bindings, states, device assignments) + flattened `cyberdeck.layout` player schema + written ID-stability/migration invariants (AUDIT C3). Fixtures include the design's 3 `DPVLAYOUTS`.
**AC:**
- [x] fixture with nested component instance validates
- [x] flatten relationship specified (Q2 default: engine-side at publish)
- [x] MOB hat desk-checks the layout schema against the existing render model

**Notes (2026-07-14):** Two schemas in `shared/schemas/documents/`. `project.schema.json`: pages of widget instances keyed by opaque stable ids (`^[a-z][a-z0-9]*_…$`, `name` presentation-only), components w/ props+variants, component instances via `component`/`variant`/`overrides` (dependentRequired enforces variant/overrides ⇒ component), bindings/states/events/locks registries (design `serializeProject()` shape), devices, assets. `layout.schema.json`: player-facing flattened projection, pages mirror `client/lib/render/model.dart` field-for-field. `ID_AND_FLATTEN.md`: 6 ID invariants w/ violation examples (referential-closure noted as engine-validated since JSON Schema can't express cross-tree joins), full project→layout flatten table (Q2 engine-side, deterministic expanded ids `<instanceId>-<templateId>`), pre-v1 design-serialization migration note, and the MOB desk-check table (all render-model fields match; envelope keys are ignored-safe). Fixtures: nested-component project + minimal + 2 invalid (name-keyed binding, variant-without-component); 3 DPVLAYOUTS-derived layouts (ipad/pixel/deck) + 2 invalid. Dual-validated, 65 vitest + Go green.

### CD-112 · Schema: flow document + triggers ∥
**BP:** CON-E01-F04 · **Hat:** BE · **P:** P0 · **Est:** M · **Deps:** CD-108
**Do:** Flow graph schema (nodes w/ per-kind param schemas, edges w/ true/false/always branch, armed) + trigger binding spec mapped to `core/flow/triggers.go`. Fixture reproduces the design's "stream-start" flow.
**AC:**
- [ ] fixture validates and maps 1:1 onto `core/flow` model fields (mapping table committed)

### CD-113 · Control-plane envelope + route-registry format + error model
**BP:** CON-E02-T01/T03/T04 · **Hat:** BE+FE · **P:** P0 · **Est:** S · **Deps:** CD-108
**Do:** Machine-readable route-registry format; envelope (id/correlation/kind/payload, lineage of `protocol-envelope.schema.json`); subscription frame semantics (backpressure, resume); coded error enum + retryable flag.
**AC:**
- [ ] registry format consumable by both codegen and a router
- [ ] envelope + error schemas validate fixtures

### CD-114 · Route set v1 + event bridge map
**BP:** CON-E02-T02/T04 · **Hat:** BE+FE · **P:** P0 · **Est:** L · **Deps:** CD-110, CD-111, CD-112, CD-113
**Do:** Author ~30 routes: projects CRUD+open, variables query/subscribe/write, widget manifests, flows CRUD/deploy/arm/trace, runtime log stream, devices list/heartbeat/assign/revoke, permission grants, ai-threads stub. Event bridge table: engine topics ↔ the 13 `EVCAT()` events with payload schemas.
**AC:**
- [ ] every route references request/response schemas + error codes
- [ ] reviewed against design `REPOS()` endpoints; OpenAPI export generated

### CD-115 · TS type generation + CI drift gate
**BP:** CON-E03-T01 · **Hat:** FE · **P:** P0 · **Est:** S · **Deps:** CD-114, CD-105
**Do:** `task gen:types` → TS types under `ide/src/shared/contract/`; CI job regenerates + `git diff --exit-code`; codegen README.
**AC:**
- [ ] kernel code imports only generated contract types
- [ ] drift gate fails on stale types (proven once)

### CD-116 · BootManager
**BP:** IDE-E01-F01 · **Hat:** FE · **P:** P0 · **Est:** M · **Deps:** CD-102, CD-107
**Do:** Phase interface `{id, blocking, run, onError}`; ordered runner with barriers; failure policies (fatal/skip/retry-once); stages declared in app config (validated); `performance.mark` per stage; timing report on `BootCompleted`.
**AC:**
- [ ] unit tests: ordering, barrier, each failure policy
- [ ] unknown stage in config = boot error with readable message
- [ ] marks visible in devtools Performance panel

### CD-117 · ConfigurationService core
**BP:** IDE-E01-F02-T01/T02 · **Hat:** FE · **P:** P0 · **Est:** M · **Deps:** CD-115, CD-109
**Do:** Layer store + deep-merge per CD-109 spec; typed `get/set/watch(path)`; SettingsChanged deltas.
**AC:**
- [ ] precedence property tests green
- [ ] `watch('features.devTools')` fires precise delta
- [ ] no consumer reads JSON directly (lint/grep check)

### CD-118 · Config persistence, validation, migration
**BP:** IDE-E01-F02-T03/T04 · **Hat:** FE · **P:** P0 · **Est:** S · **Deps:** CD-117
**Do:** Storage adapter interface (localStorage now, Tauri fs later); write-behind debounce + flush-on-quit; schema validation on load; corrupt layer → fallback + notification; version migration hook (v1→v2 test).
**AC:**
- [ ] corrupt-layer fixture boots with defaults + notice (no crash)
- [ ] migration test green

### CD-119 · ServiceContainer
**BP:** IDE-E01-F03 · **Hat:** FE · **P:** P0 · **Est:** M · **Deps:** CD-116
**Do:** `register(token, factory, {lazy})` / `get(token)`; Proxy-based lazy instantiation; circular-dep boot error printing the cycle; `createTestContainer()`; lint rule banning direct service imports.
**AC:**
- [ ] unit tests: laziness, singleton, override, cycle error
- [ ] one real test uses the test container

### CD-120 · EventBus
**BP:** IDE-E01-F04 · **Hat:** FE · **P:** P0 · **Est:** M · **Deps:** CD-119
**Do:** Typed emit/subscribe from the generated event catalog; wildcard topics; async microtask delivery; bounded per-subscriber queue with drop+log overflow; replay-on-subscribe for replayable topics; `bus.tap()` for dev surfaces.
**AC:**
- [ ] tests: ordering, wildcard, replay, overflow, unsubscribe
- [ ] 13 catalog events typed

### CD-121 · Command registry + contexts + seed commands
**BP:** IDE-E02-F01 · **Hat:** FE · **P:** P0 · **Est:** M · **Deps:** CD-119, CD-120
**Do:** Command shape `{id, category, label, icon, keys, context, permissions, args, undo, telemetry}`; execution pipeline (context→permission→handler→telemetry→undo record); when-clause engine (workspace/selectionKind/flags keys); register the design's 26-command seed set (Q1).
**AC:**
- [ ] tests: context gating, unknown id, duplicate id error, args validation
- [ ] seed set registered with design category groups

### CD-122 · Keymap dispatcher + rebinding store ∥
**BP:** IDE-E02-F02 · **Hat:** FE · **P:** P1 · **Est:** S · **Deps:** CD-121, CD-118
**Do:** Single keydown dispatcher; combo parser with ⌘/Ctrl platform mapping; context-specific resolution; user overrides in keymap config layer; conflict detection.
**AC:**
- [ ] tests: combo match, specificity, override round-trip, conflict flagged

### CD-123 · Undo/redo engine
**BP:** IDE-E02-F03 · **Hat:** FE · **P:** P0 · **Est:** M · **Deps:** CD-121
**Do:** History stack of `{do, undo, label, icon, time}` command objects; gesture coalescing (<1 s same-key); jump-to-index; depth/memory cap; `execUndoable(label, mutate)` helper emitting "— ⌘Z to undo" toast payloads.
**AC:**
- [ ] tests: undo/redo/jump/coalesce/cap; do→undo = identity on a sample model

### CD-124 · Repository base + registry + 7 domain repos
**BP:** IDE-E03-F01 · **Hat:** FE · **P:** P0 · **Est:** M · **Deps:** CD-119, CD-120, CD-115
**Do:** Typed `query/get/mutate/subscribe` base with pagination/filter/sort params; RepositoryRegistry; instantiate variables/projects/flows/widget-manifests/assets/devices/ai-threads bound to route groups; request-log tap.
**AC:**
- [ ] unit tests on base; each repo bound to its CD-114 route group
- [ ] no UI-side fetch outside repositories (lint/grep check)

### CD-125 · Middleware: composition, latency, failure injection
**BP:** IDE-E03-F02-T01/T02 · **Hat:** FE · **P:** P0 · **Est:** S · **Deps:** CD-124
**Do:** Composable, config-ordered middleware chain; latency distribution (default 15–200 ms) + ~2 % failure injection behind `devTools` flag.
**AC:**
- [ ] chain unit-tested; injection off in non-dev config

### CD-126 · Middleware: retry/backoff + cancellation
**BP:** IDE-E03-F02-T03 · **Hat:** FE · **P:** P0 · **Est:** S · **Deps:** CD-125
**Do:** Exponential backoff gated on retryable errors (CD-113 error model); AbortSignal propagation end-to-end.
**AC:**
- [ ] tests: retry budget respected; abort mid-flight cancels cleanly

### CD-127 · MockApiGateway: router + fixture DB
**BP:** IDE-E03-F03-T01/T02 · **Hat:** FE · **P:** P0 · **Est:** L · **Deps:** CD-124, CD-114
**Do:** Router auto-built from the route registry (unknown route = contract error); fixture DB seeded from CD-108…112 fixtures + design values (telemetry vars, projects, flows); pagination/filter/sort implemented mock-side; mutations persist (memory + localStorage).
**AC:**
- [ ] every registry route resolves; unknown route errors loudly
- [ ] query semantics verified by the contract suite (CD-135)

### CD-128 · Mock push streams + gateway selection + offline
**BP:** IDE-E03-F03-T03/T04 · **Hat:** FE · **P:** P0 · **Est:** S · **Deps:** CD-127
**Do:** Variable tick, runtime log, device heartbeat mock streams feeding repo subscriptions → bus; `runtime.gateway` config selects mock↔engine↔offline; offline mode renders a banner state, not breakage.
**AC:**
- [ ] streams visible via bus tap; gateway flip test; offline banner E2E assertion

### CD-129 · CacheManager ∥
**BP:** IDE-E03-F04 · **Hat:** FE · **P:** P0 · **Est:** S · **Deps:** CD-124, CD-120
**Do:** LRU keyed `(repo, query-hash)` + TTL backstop; event-driven precise invalidation map; SWR mode for catalog reads; hit/miss counters to telemetry tap.
**AC:**
- [ ] precise-eviction test (one event evicts one entry)
- [ ] bounded memory test

### CD-130 · Store base + persistence contract
**BP:** IDE-E04-F01 · **Hat:** FE · **P:** P0 · **Est:** M · **Deps:** CD-119, CD-116
**Do:** Store factory with subscribe/select (memoized) + React hook; declared `{kind, location, restoreAt, migrate}` per store; write-behind for persisted kinds; boot-stage restore ordering; corrupt-blob fallback.
**AC:**
- [ ] render-count test proves selector memoization
- [ ] restore-ordering + corrupt-blob tests green

### CD-131 · Boot-critical stores
**BP:** IDE-E04-F02-T01 · **Hat:** FE · **P:** P0 · **Est:** S · **Deps:** CD-130, CD-118
**Do:** Preferences, Workspace, Auth (token only — never secrets in localStorage), UI stores with exact `STORES()` rows.
**AC:**
- [ ] restored at declared boot stages (test)
- [ ] secret-leak grep/test proves no credential material in web storage

### CD-132 · Remaining domain stores
**BP:** IDE-E04-F02-T02/T03 · **Hat:** FE · **P:** P1 · **Est:** M · **Deps:** CD-130, CD-111
**Do:** Project, Widget, Editor, Binding, History, RepositoryCache, AI, Runtime (capped ring buffer), Notification stores; shapes from generated doc types; lint rule: no React state for cross-component domain data.
**AC:**
- [ ] ring-buffer cap test; derived-store projection test
- [ ] persistence map matches `STORES()` 13 rows exactly

### CD-133 · Optimistic updates + rollback
**BP:** IDE-E03-F02-T04 · **Hat:** FE · **P:** P1 · **Est:** M · **Deps:** CD-126, CD-130
**Do:** Optimistic mutation layer on repos writing through stores; rollback + corrective event on failure.
**AC:**
- [ ] test: optimistic apply → injected failure → rollback + event observed

### CD-134 · Theme engine
**BP:** IDE-E05 · **Hat:** FE+DES · **P:** P0 · **Est:** M · **Deps:** CD-117, CD-116
**Do:** Token schema; extract Dark Cyber tokens from the design file CSS; ThemeService applies tokens to `:root` at boot stage 5 (pre-paint); hot-swap rewrites vars + emits ThemeChanged; second minimal theme proves the pipeline.
**AC:**
- [ ] no-flash verified via paint-order marks
- [ ] theme swap restyles chrome without reload; ThemeChanged observed

### CD-135 · Contract-test generator, green vs mock
**BP:** CON-E03-T03 / QA-E02 · **Hat:** QA · **P:** P0 · **Est:** M · **Deps:** CD-114, CD-127, CD-107
**Do:** Generator iterates the route registry: fixture request → response schema validation + error-model assertions; gateway URL parameterized (mock now, engine at M5); CI job.
**AC:**
- [ ] all routes pass vs MockApiGateway; failure output names route + schema path

### CD-136 · Playwright boot E2E + coverage floors
**BP:** QA-E01-T02/T03 · **Hat:** QA · **P:** P0 · **Est:** S · **Deps:** CD-116, CD-105
**Do:** Headless boot journey (boots, interactive marker, shell renders); coverage reporting with floors (kernel 85 % / services 75 %) — report-only now, gating from CD-139.
**AC:**
- [ ] E2E green in CI; coverage report annotated on PRs

### CD-137 · Platform Inspector: services/stores/flags tabs
**BP:** IDE-E06-T01 · **Hat:** FE · **P:** P1 · **Est:** M · **Deps:** CD-119, CD-130, CD-117
**Do:** Inspector shell (behind `devTools` flag, lazy chunk); services tab from container registrations (ready/lazy/bg); stores tab from live persistence contracts; flags tab toggling ConfigurationService (emits SettingsChanged).
**AC:**
- [ ] all three tabs render **live** kernel state (no fixtures)
- [ ] flag toggle round-trips config + event

### CD-138 · Inspector: repos/events tabs + Architecture Mode + boot replay
**BP:** IDE-E06-T02/T04/T05 · **Hat:** FE · **P:** P2 · **Est:** M · **Deps:** CD-137, CD-127
**Do:** Repos tab from the request-log tap (route/ms/cache hit); events tab streaming `bus.tap()` + catalog; Architecture Mode markers with the 21 `ARCH()` notes from a content file; boot overlay replaying recorded stage timings.
**AC:**
- [ ] request rows + live event stream visible
- [ ] 21 notes render; boot replay uses real marks

### CD-139 · **M1 gate review**
**BP:** Blueprint M1 gate · **Hat:** PM+QA · **P:** P0 · **Est:** S · **Deps:** CD-101…138
**Do:** Demo + measure against the gate; flip coverage floors to blocking; record results here.
**AC:**
- [ ] warm boot ≤ 150 ms measured by boot marks (record number)
- [ ] failure-injection walk shows loading/error/retry states in a pulled fixture view
- [ ] contract suite + all CI gates green; coverage floors enforcing
- [ ] Platform Inspector demo recorded (services/stores/flags/repos/events live)
