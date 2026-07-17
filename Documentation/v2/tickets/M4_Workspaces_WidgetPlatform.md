# M4 — Workspaces Complete + Widget Platform (CD-401…425)

**Gate (on mocks):** all seven workspaces functional · flows author + test-run · devices workspace with player preview from the published doc · widgets load from manifests as lazy chunks with permissions + error boundaries · dead-control sweep clean. This is "IDE feature-complete on mocks".
**Entry:** CD-330 passed. **Exit:** CD-425 recorded. *(Parallel lane may start CD-501…513 once CD-407/409 land — see INDEX rules.)*

## Board

- [x] CD-401 Vars: table + scopes + filters/sort — ✅ Done 2026-07-17
- [x] CD-402 Vars: CRUD + inline edit + secret masking — ✅ Done 2026-07-17
- [ ] CD-403 Vars: computed vars + inspector + references
- [ ] CD-404 Library workspace (3 registry tabs)
- [x] CD-405 Projects: dashboard + browse + inspector — ✅ Done 2026-07-17
- [x] CD-406 Projects: wizard + open flow + recents — ✅ Done 2026-07-17
- [x] CD-407 Runtime: log view — ✅ Done 2026-07-17 (Runtime workspace replaces Home placeholder)
- [ ] CD-408 Runtime: perf panel + rails — 🚧 feed groundwork stashed; perf/rails UI not built
- [x] CD-409 Flows: model + tabs + armed — ✅ Done 2026-07-17
- [ ] CD-410 Flows: node render + palette + drag-add
- [ ] CD-411 Flows: edge engine + branches
- [ ] CD-412 Flows: multi-select/duplicate + graph nav parity
- [ ] CD-413 Flows: per-node param inspectors
- [ ] CD-414 Flows: test-run simulator
- [ ] CD-415 Devices: cards + status (mock)
- [ ] CD-416 Publish/flatten v0 (shared TS lib)
- [ ] CD-417 Devices: player preview frames
- [ ] CD-418 Devices: touch sim + layout assignment
- [ ] CD-419 Widget platform: manifest loader/validator
- [ ] CD-420 Widget platform: lazy chunks + error boundaries
- [ ] CD-421 Widget platform: registry→surfaces wiring
- [ ] CD-422 Widget platform: permissions store + UI
- [ ] CD-423 Canon widget set on platform loading
- [ ] CD-424 Density (Beginner/Power) + advanced stubs
- [ ] CD-425 **M4 gate review**

---

### CD-401 · Vars: table + scopes + filters/sort
**BP:** IDE-E12-T01 · **Hat:** FE · **P:** P0 · **Est:** M · **Deps:** CD-330
**Do:** Virtualized table from VariablesRepository (server-side query semantics); scopes rail (All/Global/Page/Runtime/Computed/Expression/Environment/Plugin/System); search + scope/plugin filters; sortable columns; row select → Selection store.
**AC:**
- [ ] 10k-row fixture scrolls at 60 fps (virtualization proof)
- [ ] filters/sort round-trip through repo params (not client hacks)

### CD-402 · Vars: CRUD + inline edit + secret masking
**BP:** IDE-E12-T02 · **Hat:** FE · **P:** P0 · **Est:** M · **Deps:** CD-401
**Do:** New Variable dialog (typed — the 13 design types); inline value edit (dbl-click, Esc cancels, plugin-owned read-only); delete w/ reference warning; multi-select ops; masked secret values with reveal-on-hold + no-copy default.
**AC:**
- [ ] CRUD persists via repo (optimistic + rollback path exercised)
- [ ] secret masking test: value never rendered in DOM until reveal

### CD-403 · Vars: computed vars + inspector + references ∥
**BP:** IDE-E12-T03/T04 · **Hat:** FE · **P:** P1 · **Est:** M · **Deps:** CD-402, CD-323
**Do:** Computed/expression variables using the sandbox (dependency-tracked re-eval); right inspector (details/history/refs); "used by" reference list navigating to page/component/flow.
**AC:**
- [ ] computed var updates when dependency ticks; cycle rejected with message
- [ ] reference click navigates and selects the target

### CD-404 · Library workspace (3 registry tabs) ∥
**BP:** IDE-E13 · **Hat:** FE · **P:** P1 · **Est:** M · **Deps:** CD-315, CD-321, CD-322
**Do:** Components / Styles / Symbols tabs reading the *same* registries as Insert/inspector (single source of truth); category chips, search, favorites, hover preview cards; double-click inserts into Design.
**AC:**
- [ ] registry change (e.g. new component) appears in Library without wiring (test)
- [ ] style recolor from Library propagates to canvas (CD-321 path)

### CD-405 · Projects: dashboard + browse + inspector
**BP:** IDE-E14-T01 · **Hat:** FE · **P:** P0 · **Est:** M · **Deps:** CD-330
**Do:** Dashboard cards (recents, templates) + browse table from ProjectRepository (sort/paginate); row select → project inspector (meta, stats, devices); row menu (open/duplicate/delete w/ confirm+undo toast).
**AC:**
- [ ] table sorted/paged via repo; inspector renders the selected row (not hardcoded)

### CD-406 · Projects: wizard + open flow + recents
**BP:** IDE-E14-T02/T03 · **Hat:** FE · **P:** P0 · **Est:** S · **Deps:** CD-405, CD-304
**Do:** New-project wizard (template pick, name/device validation, Enter/Esc semantics, dirty-guard); open → ProjectService loads doc → `ProjectOpened` → Design workspace; recents update.
**AC:**
- [ ] create→author→reopen round-trip; invalid wizard input blocked with inline errors

### CD-407 · Runtime: log view
**BP:** IDE-E15-T01 · **Hat:** FE · **P:** P0 · **Est:** M · **Deps:** CD-330
**Do:** Virtualized log from the mock runtime stream (Runtime ring-buffer store); level/source filters; pause/step/clear; selectable text; entry count + events/min footer.
**AC:**
- [ ] stream sustained 50 events/s without jank; pause holds scroll position
- [ ] clear/pause/step all functional (no dead controls)

### CD-408 · Runtime: perf panel + rails ∥
**BP:** IDE-E15-T02/T03 · **Hat:** FE · **P:** P1 · **Est:** S · **Deps:** CD-407
**Do:** Performance panel (CPU/GPU/mem/exec heat bars from mock perf stream); Running Flows / Execution Queue / Timers rails from FlowRepository state.
**AC:**
- [ ] all panels live-update from streams; no fixture-frozen values

### CD-409 · Flows: model + tabs + armed
**BP:** IDE-E16-S01-T01/T06 · **Hat:** FE · **P:** P0 · **Est:** M · **Deps:** CD-330
**Do:** Flow store bound to CD-112 schema (multi-flow, per-flow nodes/edges/armed); flow tabs (switch/rename-inline/new); armed toggle with confirm; persistence via FlowRepository; mutations undoable.
**AC:**
- [ ] flows persist + restore; rename Esc-cancels; armed state round-trips

### CD-410 · Flows: node render + palette + drag-add
**BP:** IDE-E16-S01-T02 · **Hat:** FE · **P:** P0 · **Est:** M · **Deps:** CD-409, CD-301
**Do:** Graph surface on PanZoomSurface (zoom/pan/fit, first-open fit); kind-colored nodes (6 categories) rendered from the model; searchable node library palette; drag-to-add at cursor + double-click add.
**AC:**
- [ ] graph nav parity with canvas (same shortcuts); drop lands correct node type

### CD-411 · Flows: edge engine + branches
**BP:** IDE-E16-S01-T03 · **Hat:** FE · **P:** P0 · **Est:** M · **Deps:** CD-410
**Do:** Per-port anchoring from live node geometry; conditions expose T/F out-ports; drag-connect with ghost + drop-target highlight; edge select/delete (× hotspot, ⌫, inspector) and branch toggle; branch-colored arrowheads.
**AC:**
- [ ] edges track node drag live; T/F leave distinct ports; all edge ops undoable

### CD-412 · Flows: multi-select/duplicate + graph nav parity ∥
**BP:** IDE-E16-S01-T04 · **Hat:** FE · **P:** P1 · **Est:** S · **Deps:** CD-411, CD-305
**Do:** Marquee + ⇧-click multi-select (Selection store), multi-drag, ⌘D duplicate (nodes + internal edges), ⌫ delete selection.
**AC:**
- [ ] duplicate preserves internal wiring with fresh IDs (test)

### CD-413 · Flows: per-node param inspectors
**BP:** IDE-E16-S01-T05 · **Hat:** FE · **P:** P0 · **Est:** M · **Deps:** CD-410, CD-312
**Do:** Node inspector sections generated from CD-112 per-kind param schemas (trigger debounce/once; condition op/match/negate; action retry/delay/timeout/await; notify priority; structure group-mode…); edge inspector; empty-graph flow inspector.
**AC:**
- [ ] params persist on the node; every kind renders its schema-driven fields

### CD-414 · Flows: test-run simulator
**BP:** IDE-E16-S02 · **Hat:** FE · **P:** P0 · **Est:** M · **Deps:** CD-411, CD-413
**Do:** Graph-walk simulation (roots→DFS, cycle-safe): node pulse/done visuals, animated edges, dimmed unexecuted nodes, step log with timings in inspector; stop/replay; edit-lock during run; engine-trace adapter interface stubbed for CD-518.
**AC:**
- [ ] deterministic walk on fixture flows incl. branch selection; cycle terminates with warning

### CD-415 · Devices: cards + status (mock) ∥
**BP:** IDE-E17-T01 · **Hat:** FE · **P:** P1 · **Est:** S · **Deps:** CD-330
**Do:** Device cards from DeviceRepository (name/class/resolution/status/heartbeat/latency); revoke with confirm; pair-new entry point (full flow arrives with engine at M5 — honest stub with reason).
**AC:**
- [ ] heartbeat stream updates cards live; revoke round-trips the mock

### CD-416 · Publish/flatten v0 (shared TS lib)
**BP:** ENG-E02-T03 precursor / Q2 · **Hat:** FE · **P:** P0 · **Est:** M · **Deps:** CD-111, CD-304
**Do:** Flatten `cyberdeck.project` → per-device `cyberdeck.layout` (resolve variants/overrides/nesting, strip authoring data) as a pure shared TS lib with golden-fixture tests — the engine ports this at CD-506 and must match goldens.
**AC:**
- [ ] golden tests: fixture project → expected layout doc byte-stable
- [ ] flatten handles nested components + overrides + multi-page

### CD-417 · Devices: player preview frames
**BP:** IDE-E17-T02 · **Hat:** FE · **P:** P0 · **Est:** M · **Deps:** CD-416
**Do:** Full-screen player preview: 3 device frames (iPad/Pixel/Deck Mini) × portrait/landscape with animated rotate; renders the **published** doc (CD-416 output), letterboxed; footer readout (device/res/orientation/scale/layout name).
**AC:**
- [ ] all 3 × 2 combinations render the flattened doc correctly (snapshot tests)

### CD-418 · Devices: touch sim + layout assignment ∥
**BP:** IDE-E17-T03 · **Hat:** FE · **P:** P1 · **Est:** S · **Deps:** CD-417, CD-415
**Do:** Touch simulation (press scale, ripple, tap-vs-hold verbs, kind-specific actions, event readout); per-device layout assignment writing through DeviceRepository.
**AC:**
- [ ] assignment persists; preview renders the assigned layout per device

### CD-419 · Widget platform: manifest loader/validator
**BP:** IDE-E18-T01 · **Hat:** FE · **P:** P0 · **Est:** M · **Deps:** CD-110, CD-124
**Do:** Discovery via WidgetManifestRepo → schema + permission validation → registration; invalid manifest rejected with notification (never a crash); registry events (`WidgetLoaded`).
**AC:**
- [ ] bad-manifest fixtures rejected gracefully; valid set registers with deps resolved

### CD-420 · Widget platform: lazy chunks + error boundaries
**BP:** IDE-E18-T02 · **Hat:** FE · **P:** P0 · **Est:** M · **Deps:** CD-419
**Do:** Per-widget dynamic `import()` on first render; standard loading/empty/error/fallback card states; per-widget error boundary (fallback + retry + telemetry breadcrumb); dispose cleanup (subscriptions/timers).
**AC:**
- [ ] chunk-split proven (bundle analysis); throwing widget renders fallback, board survives
- [ ] dispose leak test (subscriptions released)

### CD-421 · Widget platform: registry→surfaces wiring
**BP:** IDE-E18-T03 · **Hat:** FE · **P:** P0 · **Est:** S · **Deps:** CD-419, CD-315, CD-404
**Do:** Insert panel, Library, palette "Insert …" rows, and canvas renderer all consume the platform registry (upgrade CD-315 from repo-direct to registry); plugin-badged sections.
**AC:**
- [ ] registering a new manifest surfaces it in all four places with zero wiring (test)

### CD-422 · Widget platform: permissions store + UI ∥
**BP:** IDE-E18-T04 · **Hat:** FE+SEC · **P:** P1 · **Est:** M · **Deps:** CD-419
**Do:** Grant/deny store (persisted; engine-enforced later); permission prompt on first use of a gated capability; per-widget permission list in inspector + Platform Inspector perms tab goes live; undeclared API access throws (dev-facing error).
**AC:**
- [ ] deny blocks the capability with visible reason; grant persists; undeclared-access test throws

### CD-423 · Canon widget set on platform loading
**BP:** IDE-E18-T05 · **Hat:** FE · **P:** P0 · **Est:** M · **Deps:** CD-420, CD-421
**Do:** Convert the M3 canon widgets (gauge/button/text/chart/stat/image/media/input/container + toggle/slider) to manifest-registered lazy modules; delete any hardcoded imports.
**AC:**
- [ ] zero statically-imported widgets remain (grep/lint gate)
- [ ] authoring journey still green end-to-end on platform-loaded widgets

### CD-424 · Density (Beginner/Power) + advanced stubs ∥
**BP:** IDE-E09-S03 / AUDIT M13 · **Hat:** FE · **P:** P2 · **Est:** S · **Deps:** CD-312
**Do:** Density toggle (persisted); Beginner hides pro sections but shows an "Advanced (n bindings)" stub row with switch-to-Power action; hints in Layers.
**AC:**
- [ ] hidden content is always signposted (no silent vanishing)

### CD-425 · **M4 gate review**
**BP:** Blueprint M4 gate · **Hat:** PM+QA · **P:** P0 · **Est:** S · **Deps:** CD-401…424
**Do:** All-workspace journey demo; dead-control sweep #2; record.
**AC:**
- [ ] E2E: create project → author deck → computed var → flow with test-run → assign to device → player preview interaction — green on mocks
- [ ] click-everything audit: zero silent controls across all workspaces
- [ ] widget platform proof: install a new manifest at runtime → insert → render → crash-isolate
