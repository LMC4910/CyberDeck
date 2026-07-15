# M3 — Authoring Core (CD-301…330)

**Gate (on mocks):** full authoring journey — insert manifest widgets → arrange (drag/resize/snap) → group → create component → variants/overrides → bind variables (static/var/expression) → define states → wire an event → undo/redo everything → save → reload identical. Canvas ≥ 55 fps @ 200 widgets.
**Entry:** CD-219 passed. **Exit:** CD-330 recorded.

## Board

- [x] CD-301 PanZoomSurface
- [x] CD-302 ProjectModel document core
- [ ] CD-303 Model→React reconciliation + board render
- [ ] CD-304 Serialize/restore + autosave + property tests
- [ ] CD-305 Selection engine + store
- [ ] CD-306 Drag/resize/rotate controllers
- [ ] CD-307 Snapping + smart guides
- [ ] CD-308 Nudge, canvas shortcuts, selection minibar
- [ ] CD-309 Canvas perf harness (200 widgets)
- [ ] CD-310 Layers tree + command mutations
- [ ] CD-311 Layers filters/search + tree a11y
- [ ] CD-312 Contextual inspector registry + page/multi states
- [ ] CD-313 Per-type inspector sections (10 canon kinds)
- [ ] CD-314 Board model + minimap + Live Mirror
- [ ] CD-315 Insert panel v1 (mock manifests)
- [ ] CD-316 Component registry + create/instantiate/detach
- [ ] CD-317 Variants
- [ ] CD-318 Overrides
- [ ] CD-319 Nested components
- [ ] CD-320 Component inspector section
- [ ] CD-321 Shared styles
- [ ] CD-322 Symbols
- [ ] CD-323 Expression sandbox parser + conformance corpus
- [ ] CD-324 Binding model + popover (static/variable)
- [ ] CD-325 Expression editor + live preview
- [ ] CD-326 Binding runtime apply path
- [ ] CD-327 States
- [ ] CD-328 Events + flow drawer
- [ ] CD-329 Undo integration sweep
- [ ] CD-330 **M3 gate review**

---

### CD-301 · PanZoomSurface
**BP:** IDE-E09-S01-T01 · **Hat:** FE · **P:** P0 · **Est:** M · **Deps:** CD-219
**Do:** Shared pan/zoom module (world transform, zoom-to-cursor, fit, ⌘0/⌘±, wheel pan, Space/Hand drag) consumed by canvas now, Flows graph at CD-410. Screen↔world coordinate helpers.
**AC:**
- [ ] unit tests on transform math (zoom-at-point invariants)
- [ ] no consumer-specific code inside the module

### CD-302 · ProjectModel document core
**BP:** IDE-E10-S01-T01 · **Hat:** FE · **P:** P0 · **Est:** L · **Deps:** CD-219
**Do:** Model classes for `cyberdeck.project` (CD-111 schema): pages, widget nodes (stable IDs), groups, component defs/instances/overrides, bindings, states. Invariant checks (ID uniqueness, no circular nesting, no name-keyed lookups — AUDIT C3). All mutations via model methods that return undo inverses.
**AC:**
- [ ] invariants unit-tested incl. violation cases
- [ ] every mutation method returns its inverse (spot-check tests)

### CD-303 · Model→React reconciliation + board render
**BP:** IDE-E10-S01-T02 · **Hat:** FE · **P:** P0 · **Est:** M · **Deps:** CD-302, CD-301
**Do:** Board component renders widgets from the model via subscribed selectors (`render(dirtyIds)` granularity); widget chrome (frame, selection ring, lock badge). The DOM is never the source of truth.
**AC:**
- [ ] model change re-renders only affected widgets (render-count test)
- [ ] board renders a CD-111 fixture document 1:1

### CD-304 · Serialize/restore + autosave + property tests
**BP:** IDE-E10-S01-T03/T04 · **Hat:** FE+QA · **P:** P0 · **Est:** M · **Deps:** CD-302, CD-124
**Do:** `serialize()`/`restore()` against the schema; autosave (debounced) through ProjectService → ProjectRepository; round-trip property/fuzz tests.
**AC:**
- [ ] fuzzed round-trip = deep-equal (property test in CI)
- [ ] autosave visible in saved-state indicator

### CD-305 · Selection engine + store
**BP:** IDE-E09-S01-T02 · **Hat:** FE · **P:** P0 · **Est:** M · **Deps:** CD-303
**Do:** Selection store (`{kind, ids}`) all panels subscribe to (AUDIT C2); click/⇧/⌘ selection, marquee (empty-canvas drag), lasso (⌥), Tab/⇧Tab cycle, Esc clear, selection history `[`/`]`.
**AC:**
- [ ] one store drives canvas ring + (later) layers/inspector/breadcrumb — no manual fan-out
- [ ] interaction tests for each selection mode

### CD-306 · Drag/resize/rotate controllers
**BP:** IDE-E09-S01-T03 · **Hat:** FE · **P:** P0 · **Est:** M · **Deps:** CD-305
**Do:** Pointer controllers: multi-drag, 8-handle resize, rotation (15° snap, ⇧ free) — all zoom-corrected (screen deltas ÷ zoom), rAF-batched, cached rects per gesture; one undo entry per gesture; X/Y/W/H/R/O live in inspector fields.
**AC:**
- [ ] math correct at 50 %/100 %/200 % zoom (tests)
- [ ] gesture = single history entry (test)

### CD-307 · Snapping + smart guides
**BP:** IDE-E09-S01-T04 · **Hat:** FE · **P:** P0 · **Est:** M · **Deps:** CD-306
**Do:** Edge/center snapping vs siblings + grid; V/H smart guides; ⇧ bypass; snap toggle in status bar segment.
**AC:**
- [ ] snap accuracy tests; guides render only during gesture

### CD-308 · Nudge, canvas shortcuts, selection minibar ∥
**BP:** IDE-E09-S01-T05 · **Hat:** FE · **P:** P1 · **Est:** S · **Deps:** CD-306, CD-123
**Do:** Arrow nudge (⇧=10 px, coalesced undo), tool shortcuts (V/H/I), floating minibar (duplicate/lock/group/delete) tracking selection at constant screen size.
**AC:**
- [ ] nudge coalescing test; minibar actions are registry commands

### CD-309 · Canvas perf harness (200 widgets)
**BP:** IDE-E09-S01-T06 / QA-E04 · **Hat:** QA · **P:** P0 · **Est:** S · **Deps:** CD-306
**Do:** Fixture board with 200 widgets; automated fps probe during pan/zoom/drag; CI perf job (report now, gate at CD-330).
**AC:**
- [ ] ≥ 55 fps sustained on reference hardware (record number)

### CD-310 · Layers tree + command mutations
**BP:** IDE-E09-S02-T01/T02 · **Hat:** FE · **P:** P0 · **Est:** M · **Deps:** CD-303, CD-123, CD-305
**Do:** Virtualized tree from the model; drag reorder/nest with drop indicators; ⌘G/⇧⌘G group/ungroup; lock/hide/color label; double-click rename (Esc cancels); all mutations undoable commands; selection syncs via the store.
**AC:**
- [ ] reorder/nest/group round-trip through model + undo
- [ ] virtualization proven at 1 000 layers

### CD-311 · Layers filters/search + tree a11y ∥
**BP:** IDE-E09-S02-T03/T04 · **Hat:** FE · **P:** P1 · **Est:** S · **Deps:** CD-310
**Do:** Filter chips (All/Containers/Visible/Locked), search, collapse/expand all, breadcrumb of nesting (clickable); `role=tree` + roving tabindex + type-ahead.
**AC:**
- [ ] axe + keyboard tree navigation tests

### CD-312 · Contextual inspector registry + page/multi states
**BP:** IDE-E09-S03-T01/T03 · **Hat:** FE · **P:** P0 · **Est:** M · **Deps:** CD-305, CD-110
**Do:** `sectionsFor(selection)` registry keyed by widget type from manifests; empty selection → Page Properties (grid/background/snap); multi → align/distribute/group; reusable field-row primitives (segmented/num/text/toggle/select).
**AC:**
- [ ] selection kind swaps sections (tests for widget/none/multi)
- [ ] all fields write through model commands (undoable)

### CD-313 · Per-type inspector sections (10 canon kinds)
**BP:** IDE-E09-S03-T02 · **Hat:** FE · **P:** P0 · **Est:** M · **Deps:** CD-312
**Do:** Gauge (value/min/max/warn/arc/ticks), Button (label/icon/action/style/haptic), Text, Chart, Stat, Image, Media, Input, Container, Generic — sections generated from each manifest's configSchema where possible, custom rows where not.
**AC:**
- [ ] each kind renders its distinct section set (snapshot tests)
- [ ] config edits persist into the document + undo

### CD-314 · Board model + minimap + Live Mirror ∥
**BP:** IDE-E09-S04 · **Hat:** FE · **P:** P1 · **Est:** S · **Deps:** CD-303, CD-216
**Do:** Single memoized board-model selector; minimap (click/drag viewport) + Live Mirror (device-frame thumbnail, device cycle) as registered dock tool windows rendering from that one selector.
**AC:**
- [ ] both surfaces update live on any board change from the same selector

### CD-315 · Insert panel v1 (mock manifests)
**BP:** IDE-E18-T03 subset · **Hat:** FE · **P:** P0 · **Est:** S · **Deps:** CD-124, CD-303
**Do:** Insert tab reading WidgetManifestRepo (mock): search, category sections, drag-to-canvas + double-click insert; inserted widgets get model nodes + layer rows + selection.
**AC:**
- [ ] insert via drag AND double-click lands a correctly-configured node (undoable)

### CD-316 · Component registry + create/instantiate/detach
**BP:** IDE-E10-S02-T01/T02 · **Hat:** FE · **P:** P0 · **Est:** M · **Deps:** CD-302, CD-123, CD-310
**Do:** Component defs in the model; Create Component (⌘⌥K/context menu) converts group; instantiate (deep copy w/ fresh IDs, master link); detach; find-all-instances; go-to-master; instance badges in layers.
**AC:**
- [ ] master↔instance links survive rename/duplicate (ID-keyed tests)
- [ ] create/instantiate/detach all undoable

### CD-317 · Variants
**BP:** IDE-E10-S02-T03 · **Hat:** FE · **P:** P0 · **Est:** M · **Deps:** CD-316
**Do:** Per-component variant registry `{name, color, icon, label, state}`; master inspector variant editor (add/rename/delete/set-default, per-variant property table); instance swap control + `,`/`.` cycling; delete-remap; variant dot in layers.
**AC:**
- [ ] swap is per-instance; delete remaps affected instances (tests)

### CD-318 · Overrides
**BP:** IDE-E10-S02-T04 · **Hat:** FE · **P:** P0 · **Est:** M · **Deps:** CD-317
**Do:** Per-instance overrides (text/icon/color/state/variable/action/visibility/padding) keyed by instance ID; purple dot + revert per field; reset-all with live count; never mutates master or siblings.
**AC:**
- [ ] override isolation property test (mutate instance → master+siblings unchanged)
- [ ] revert restores master value; all undoable

### CD-319 · Nested components
**BP:** IDE-E10-S02-T05 · **Hat:** FE · **P:** P1 · **Est:** M · **Deps:** CD-316
**Do:** Components inside components; outer instantiation deep-instantiates (nested masters → instances with fresh IDs, registry counts bump); circular-nesting guard; "Nested in A › B" breadcrumb.
**AC:**
- [ ] deep-instantiate ID-freshness fuzz test; circularity rejected with message

### CD-320 · Component inspector section
**BP:** IDE-E10-S02-T06 · **Hat:** FE · **P:** P0 · **Est:** S · **Deps:** CD-316, CD-317, CD-318, CD-312
**Do:** Master: name/description/category, exposed properties/variables toggles, find-instances count. Instance: variant swap, override list, go-to-master, detach.
**AC:**
- [ ] section adapts master vs instance vs nested (tests)

### CD-321 · Shared styles ∥
**BP:** IDE-E10-S03-T01/T02 · **Hat:** FE · **P:** P1 · **Est:** M · **Deps:** CD-302, CD-312
**Do:** Fill/Stroke/Typography/Effect/Radius style registry; link chips in inspector → picker popover (swatches, ref counts, detach, new-from-selection); editing a style propagates to every linked widget.
**AC:**
- [ ] propagation test across ≥3 linked widgets; ref counts live

### CD-322 · Symbols ∥
**BP:** IDE-E10-S03-T03 · **Hat:** FE · **P:** P2 · **Est:** S · **Deps:** CD-315
**Do:** Symbol asset registry (icon/SVG/Lottie/animation) with type groups, favorites, use-counts; double-click drops a symbol tile.
**AC:**
- [ ] drop increments use-count; renders in board + layers

### CD-323 · Expression sandbox parser + conformance corpus
**BP:** SEC-E03 / IDE-E11 · **Hat:** FE+SEC · **P:** P0 · **Est:** M · **Deps:** CD-219
**Do:** Sandboxed expression parser/evaluator (tokenizer→AST→interpreter, **no `eval`**): arithmetic/comparison/logical/ternary, variable refs, whitelisted functions; op-count + time limits; friendly errors ("Unknown variable 'fps.max'"). Seed a conformance corpus from `engine/core/flow/expr` tests — IDE and engine must agree.
**AC:**
- [ ] injection corpus (globals, prototype, constructor escapes) all rejected
- [ ] conformance corpus green; runaway expression terminated by limits

### CD-324 · Binding model + popover (static/variable)
**BP:** IDE-E11-S01-T01/T02 · **Hat:** FE · **P:** P0 · **Est:** M · **Deps:** CD-302, CD-124, CD-312
**Do:** Binding entries in the document (property ↔ {mode, source}); hover link icon on bindable fields → popover; Variable mode: searchable catalog with live values from VariablesRepository; Bindings section listing active binds; bound fields lock to chips; bind-dot on canvas widget.
**AC:**
- [ ] bindings persist + restore with the document
- [ ] popover keyboard-complete; Esc/outside-click closes

### CD-325 · Expression editor + live preview
**BP:** IDE-E11-S01-T03 · **Hat:** FE · **P:** P0 · **Est:** S · **Deps:** CD-324, CD-323
**Do:** Expression mode: editor with variable-insert chips, live evaluated preview via the sandbox, inline error state.
**AC:**
- [ ] preview matches sandbox result; errors render friendly, not raw

### CD-326 · Binding runtime apply path
**BP:** IDE-E11-S01-T04 · **Hat:** FE · **P:** P0 · **Est:** S · **Deps:** CD-324, CD-128
**Do:** Variable ticks (mock stream) → bound widget re-render through the store path (no polling); expression re-eval on dependency change only.
**AC:**
- [ ] tick updates exactly the bound widgets (render-count test)

### CD-327 · States
**BP:** IDE-E11-S02-T01 · **Hat:** FE · **P:** P0 · **Est:** M · **Deps:** CD-302, CD-312
**Do:** Per-widget state set (Default/Hover/Pressed/Focus/Disabled + custom); state chips; override editor (opacity/scale/glow…) storing per-state deltas; chip selection previews the state live on canvas.
**AC:**
- [ ] state overrides persist; preview toggles cleanly; undoable

### CD-328 · Events + flow drawer
**BP:** IDE-E11-S02-T02/T03 · **Hat:** FE · **P:** P1 · **Est:** S · **Deps:** CD-327
**Do:** Event rows (tap/hold/value-change/double-tap); flow drawer with mini trigger→action preview + flow picker (assign/disconnect stub flows from FlowRepository); "open in Flows" deep link (workspace exists at M4).
**AC:**
- [ ] event→flow wiring persists in the document

### CD-329 · Undo integration sweep
**BP:** IDE-E02-F03 AC · **Hat:** QA+FE · **P:** P0 · **Est:** S · **Deps:** CD-301…328
**Do:** Audit every authoring mutation path routes through `execUndoable`; property test: random 50-op sequence → 50 undos → document deep-equals baseline.
**AC:**
- [ ] property test in CI; no direct-mutation escapes (review checklist)

### CD-330 · **M3 gate review**
**BP:** Blueprint M3 gate · **Hat:** PM+QA · **P:** P0 · **Est:** S · **Deps:** CD-301…329
**Do:** Scripted authoring journey E2E + perf gate flip; record results.
**AC:**
- [ ] Playwright: insert → arrange → component → variant → override → bind → state → event → undo-all → save → reload identical — green
- [ ] perf harness ≥ 55 fps enforced in CI
- [ ] expression security corpus green in CI
