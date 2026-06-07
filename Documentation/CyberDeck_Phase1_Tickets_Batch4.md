# CyberDeck — Phase 1 · Ticket Breakdown (Batch 4 — final)

**Execution-system Document 5 of N** · Version 0.1 (Draft) · June 2026 · `com.shishir.cyberdeck`
Default assignee: **Claude**

> Full implementation-ready tickets for the final three epics: **EPIC-7 (Flow Engine Core / WS-7)**, **EPIC-9 (Designer / WS-9)**, and **EPIC-10 (Phase-1 Hardening & Acceptance / cross-cutting)**. The Designer is what makes the system authorable (M6); EPIC-10 is the cross-cutting verification that closes Phase 1 (M7). Conventions inherited from Batch 1 Part B.
>
> Grounded in TRD 2D (flow), 2C §8 (designer), and the full P1-AC list / Definition of Done in the Phase-1 Deep Dive §1.
>
> **With this batch, all 45 Phase-1 tickets are fully specified.**

---

# EPIC-7 — Flow Engine Core (WS-7)

> The host-side automation engine. Model + sandboxed expression language + executor + core nodes + triggers. Schedule triggers are *reserved* in V1 (the field exists; the scheduler consumer is Phase 3). The visual flow *builder* UI is Phase 3 — V1 flows are authored as data / via the designer's basic binding.

---

## PROJ-200 — Flow model + document persistence

**Summary:** The flow graph data model and its versioned persistence in the `workflows` table.

**Objective:** Implement 2D §2/§3: a flow document (trigger + node graph) that is typed, versioned, and stored via `repo_workflows` (PROJ-112).

**Context:** TRD 2D §2/§3 / ADR-0022 (the flow op-model is Phase 3; V1 persists whole documents with a version). A flow = `{id, trigger, nodes[], edges}`.

**Technical Requirements:**
- Flow document schema: `trigger{kind, config}`, `nodes[]{id, kind, params}`, `edges` (next / branch labels).
- Monotonic `version` per flow; CRUD via `repo_workflows`.
- Validate node `kind` against the flow-node registry (PROJ-161) and params against node schemas.

**Acceptance Criteria:**
- A flow document round-trips (save/load) with version bookkeeping.
- A node of unknown kind / invalid params is rejected at save.
- Unit tests: round-trip, versioning, invalid-node reject.

**Implementation Notes:** Keep the model independent of execution (executor is PROJ-202). The op-model (granular edits + undo) is deliberately deferred to Phase 3 — V1 saves whole documents.

**Testing Requirements:** Unit: round-trip; version increment; validation.

**Deliverables:** `engine/core/flow/{model.go,store.go,validate.go}`, tests.

**Dependencies:** PROJ-112, PROJ-161. **Effort:** 2 pts (~3h), low-medium.

**Agent Instructions:** Implement the flow model + persistence + validation against the registry; test round-trip/version/validation.

**Expected Files:** `engine/core/flow/{model,store,validate}.go`, tests.

**Validation Commands:**
```bash
cd engine && go vet ./... && golangci-lint run && go test ./core/flow/... && go build ./...
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## PROJ-201 — Expression language (lexer / parser / AST / eval)

**Summary:** A sandboxed expression language for flow conditions and computed values — no `eval`, no I/O.

**Objective:** Implement 2D §5 / ADR-0013: a small typed expression language over states/vars with safe evaluation (arithmetic, comparison, boolean, member access), resolving state tokens to typed values.

**Context:** TRD 2D §5. Used by `if` conditions and `setVar` values. Must be sandboxed (no arbitrary code execution — this is a security boundary). An unavailable token evaluates to a safe default, never a crash.

**Technical Requirements:**
- Lexer + parser → AST; evaluator over a context of states (PROJ-160) + vars (PROJ-164).
- Operators: arithmetic (`+ - * / %`), comparison (`== != < <= > >=`), boolean (`&& || !`), member access for state tokens.
- Typed resolution; type-mismatch → evaluation error surfaced to the flow (not a panic).
- Unavailable state token → documented safe default (e.g. evaluation short-circuits to false / a sentinel), logged.
- **No** function calls into the host, file/network access, or reflection.

**Acceptance Criteria:**
- Expressions parse + evaluate correctly over a test context.
- Unavailable token → safe default, no crash.
- Malicious/malformed input is rejected at parse (no code execution path exists — verified).
- Unit tests: operator matrix, type-mismatch, unavailable token, malformed/injection attempts.

**Implementation Notes:** Hand-written recursive-descent parser or a vetted expression lib configured to a safe subset. This is a **security-sensitive** ticket — review the eval surface carefully; no host callbacks.

**Testing Requirements:** Unit: operators, types, unavailable, malformed/injection.

**Deliverables:** `engine/core/flow/expr/{lexer.go,parser.go,ast.go,eval.go}`, tests.

**Dependencies:** PROJ-160. **Effort:** 3 pts (~4h), medium-high.

**Agent Instructions:** Implement lexer/parser/AST/eval as a sandboxed subset; test the operator matrix + safety cases; confirm no host/IO surface.

**Expected Files:** `engine/core/flow/expr/*`, tests.

**Validation Commands:**
```bash
cd engine && go vet ./... && golangci-lint run && go test ./core/flow/expr/... && go build ./...
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## PROJ-202 — Flow executor + run context

**Summary:** The async, cancellable flow executor that walks the node graph with a per-run context.

**Objective:** Implement 2D §7/§8: execute a flow from its entry node, step by step, with a run context (local scope + global `var.*`), cancellation, and safe node-failure handling. **AC P1-AC-08.**

**Context:** TRD 2D §7/§8. A run is triggered (PROJ-204), walks nodes (PROJ-203), evaluates expressions (PROJ-201), and dispatches action nodes through the permission gate (PROJ-125) + audit (PROJ-127).

**Technical Requirements:**
- `Run(flow, trigytkcontext)`: entry → step loop following `next`/branch edges; per-run context with local scope + access to `var.*`.
- Async (asyncio-equivalent goroutine per run); cancellable via context; bounded concurrent runs.
- Node failure → fail the run safely (log + audit `flow.failed`), never crash the engine.
- Loop iteration cap enforced (anti-runaway) — coordinated with the loop node (PROJ-203).

**Acceptance Criteria:**
- A flow runs to completion following branches; a deliberate node failure fails the run cleanly (engine survives).
- Cancellation stops a run promptly.
- A runaway loop is capped.
- **AC P1-AC-08** (a flow with a branch executes correctly) supported.
- Unit/integration: happy run, branch, node-failure, cancellation, loop cap.

**Implementation Notes:** Depends on expr (PROJ-201), event bus (PROJ-162, for emitting run/failed). Action-node dispatch defers to PROJ-203 + the permission gate.

**Testing Requirements:** Unit/integration: run, branch, failure, cancel, loop cap.

**Deliverables:** `engine/core/flow/{executor.go,runcontext.go}`, tests.

**Dependencies:** PROJ-200, PROJ-201, PROJ-162. **Effort:** 3 pts (~4h), medium-high.

**Agent Instructions:** Implement the executor + run context + cancellation + failure handling + loop cap; test all paths incl. engine-survives-failure.

**Expected Files:** `engine/core/flow/{executor,runcontext}.go`, tests.

**Validation Commands:**
```bash
cd engine && go vet ./... && golangci-lint run && go test -race ./core/flow/... && go build ./...
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## PROJ-203 — Core nodes (action / if / setVar / wait / loop / navigate / random / subflow / stop)

**Summary:** The nine built-in flow node types.

**Objective:** Implement 2D §3 node catalog: each node's execution semantics, dispatched by the executor (PROJ-202).

**Context:** TRD 2D §3. The `action` node dispatches a registered action through the permission gate (PROJ-125) + audit (PROJ-127). `if` uses expr (PROJ-201). `setVar` writes `var.*` (PROJ-164). `loop` honors the iteration cap.

**Technical Requirements:**
- `action{actionId, params}` → authorize → dispatch (to plugin via host, or built-in) → audit; failure handled per executor.
- `if{expr}` → branch then/else.
- `setVar{name, expr}` → write `var.*`.
- `wait{ms}` → async delay (cancellable).
- `loop{count|whileExpr, body}` → iterate, capped.
- `navigate{page|profile}` → emit a navigation directive to the triggering session.
- `random{branches}` → pick a branch.
- `subflow{flowId}` → invoke another flow (depth-capped).
- `stop` → end the run.

**Acceptance Criteria:**
- Each node executes its semantics correctly (per-node unit tests).
- `action` respects permissions + audits; `loop` respects the cap; `subflow` respects depth cap.
- Unit tests for all nine nodes incl. the gated `action` and capped `loop`/`subflow`.

**Implementation Notes:** Action-node permission gating is the critical security path — reuse `authorize()` (PROJ-125), never bypass. Navigate targets the session (PROJ-163).

**Testing Requirements:** Unit: each node; gated action (allow/deny); loop/subflow caps.

**Deliverables:** `engine/core/flow/nodes/{action,if,setvar,wait,loop,navigate,random,subflow,stop}.go`, tests.

**Dependencies:** PROJ-202, PROJ-125. **Effort:** 3 pts (~4h), medium.

**Agent Instructions:** Implement all nine nodes + per-node tests; ensure action gating + caps; wire into the executor dispatch.

**Expected Files:** `engine/core/flow/nodes/*`, tests.

**Validation Commands:**
```bash
cd engine && go vet ./... && golangci-lint run && go test ./core/flow/... && go build ./...
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## PROJ-204 — Triggers (manual / event / stateChange; schedule reserved)

**Summary:** Arm and fire flows on manual, event, and stateChange triggers; reserve the schedule field.

**Objective:** Implement 2D §6: trigger registration + arming + firing, with edge-trigger + debounce for stateChange. Schedule kind is a reserved field with no consumer in V1.

**Context:** TRD 2D §6 / Doc 0 §12 seam. stateChange subscribes to the event bus (PROJ-162); manual binds to a widget interaction slot; event binds to an engine event. Schedule is reserved (consumer is Phase 3).

**Technical Requirements:**
- `manual` → fired by an interaction slot (the action target is a flow run).
- `event` → fired by a named engine event (event bus).
- `stateChange{stateId, expr}` → fires on transition where expr becomes true (edge-trigger, not level); debounce to avoid storms.
- `schedule{cron|interval}` → **field parsed + stored, no scheduler** (reserved; documented).

**Acceptance Criteria:**
- manual/event/stateChange triggers arm and fire correctly; stateChange is edge-triggered + debounced (no repeated fire while condition stays true).
- schedule field is accepted + stored but does not fire in V1 (documented).
- Unit/integration: each trigger arms+fires; edge/debounce; schedule reserved (no fire).

**Implementation Notes:** Edge-triggering is important — a `cpu>85` stateChange must fire once on crossing, not every tick while hot. Coordinate with the event bus + executor.

**Testing Requirements:** Unit/integration: manual/event/stateChange fire; edge+debounce; schedule no-op.

**Deliverables:** `engine/core/flow/triggers.go`, tests.

**Dependencies:** PROJ-202, PROJ-162. **Effort:** 2 pts (~3h), medium.

**Agent Instructions:** Implement the three live trigger kinds + edge/debounce + reserved schedule field; test arming/firing/edge/debounce + schedule no-op.

**Expected Files:** `engine/core/flow/triggers.go`, tests.

**Validation Commands:**
```bash
cd engine && go vet ./... && golangci-lint run && go test ./core/flow/... && go build ./...
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

# EPIC-9 — Designer (Desktop) (WS-9)

> Desktop-only (ADR-0018). The op-log + live broadcast (ADR-0012) and the schema-driven inspector (ADR-0006) are the headline tickets. The Designer reuses the client renderer (PROJ-181) so it renders exactly as the target device will.

---

## PROJ-210 — Designer canvas (renders as target device class)

**Summary:** The WYSIWYG canvas that renders a layout via the same client renderer, sized to the target device class.

**Objective:** Implement 2C §8.1: a desktop canvas presenting the grid for a selected DeviceClass, rendering widgets through the shared renderer (PROJ-181), with snap-to-grid and no-overlap placement.

**Context:** TRD 2C §8.1 / ADR-0017. The canvas renders **as the target device** (per-device-class authoring) — what you design is what that device shows.

**Technical Requirements:**
- Canvas hosting the renderer (PROJ-181) at the target DeviceClass grid (cols/rows/aspect from PROJ-163/217).
- Grid overlay; snap-to-grid; collision prevention (no overlap).
- Device-class selector (which device this layout targets).

**Acceptance Criteria:**
- Canvas renders a layout via the shared renderer at the target grid.
- Placement snaps to grid; overlaps prevented.
- Switching device class re-renders at that grid.
- Widget tests: render-at-grid; snap; overlap-prevention.

**Implementation Notes:** Desktop-only build (ADR-0018). Reuses PROJ-181 (don't fork the renderer). Grid config from PROJ-217.

**Testing Requirements:** Widget: render/snap/overlap.

**Deliverables:** `client/lib/designer/canvas.dart`, tests.

**Dependencies:** PROJ-181, PROJ-163. **Effort:** 3 pts (~4h), medium.

**Agent Instructions:** Implement the canvas hosting the shared renderer + grid/snap/overlap + device-class selector; test.

**Expected Files:** `client/lib/designer/canvas.dart`, tests.

**Validation Commands:**
```bash
cd client && dart analyze && flutter test && flutter build <host-os-desktop>
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## PROJ-211 — Op model + op-log apply / version

**Summary:** The layout operation model (AddWidget/Move/Resize/ChangeGrid/…) applied to an authoritative, versioned document.

**Objective:** Implement 2C §4 / ADR-0012: discrete, invertible ops applied to the layout document with monotonic versioning, persisted via `repo_documents` (PROJ-112).

**Context:** TRD 2C §4. The op-log is the substrate for live broadcast (PROJ-212), undo/redo (PROJ-215), and (Phase 8) collaboration. Single-writer lock in V1.

**Technical Requirements:**
- Op types: `AddWidget, RemoveWidget, MoveWidget, ResizeWidget, SetWidgetParams, ChangeGrid, AddPage, RemovePage` (+ others per 2C §4).
- `Apply(op)` mutates the authoritative document + increments version; each op carries enough to compute its inverse (PROJ-215).
- Persist document + version; single-writer edit lock (V1 simplification).

**Acceptance Criteria:**
- Each op applies + increments version; document persists.
- Ops are invertible (inverse computable — verified, used by PROJ-215).
- Single-writer lock prevents concurrent edit in V1.
- Unit tests: each op apply; version monotonic; inverse computability; lock.

**Implementation Notes:** Keep ops pure data; `Apply` deterministic. The broadcast (PROJ-212) consumes applied ops; don't couple apply to transport.

**Testing Requirements:** Unit: op apply matrix; versioning; inverse; lock.

**Deliverables:** `client/lib/designer/op_model.dart` + engine-side op apply if authoritative doc lives engine-side (`engine/core/layout/oplog.go`), tests.

> **Architecture note:** the authoritative layout document lives **engine-side** (host authority, ADR-0003). The Designer sends ops over the Layout channel; the engine applies + versions + persists + rebroadcasts. So op *apply/version/persist* is engine-side (`engine/core/layout/oplog.go`); the Designer holds an op *builder* + optimistic view. Implement both halves in this ticket.

**Dependencies:** PROJ-210, PROJ-112. **Effort:** 3 pts (~4h), medium-high.

**Agent Instructions:** Implement engine-side op apply/version/persist + designer-side op builder; test apply/version/inverse/lock.

**Expected Files:** `engine/core/layout/oplog.go`, `client/lib/designer/op_model.dart`, tests.

**Validation Commands:**
```bash
cd engine && go vet ./... && go test ./core/layout/... && go build ./...
cd ../client && dart analyze && flutter test
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## PROJ-212 — Op-log broadcast + live device reflection

**Summary:** Applied layout ops broadcast over the Layout channel to subscribed sessions, repainting the affected widget within 200ms.

**Objective:** Implement 2C §4.2 / ADR-0012: edit-on-desktop → live-on-device. **AC P1-AC-09.**

**Context:** TRD 2C §4.2. The headline "no save/sync/reload" feature. Ops fan out (PROJ-150) only to sessions on the edited profile in edit/preview mode; the client interpreter (PROJ-181) targeted-repaints.

**Technical Requirements:**
- After engine applies an op (PROJ-211), broadcast it on the Layout channel via fan-out (PROJ-150) to subscribed sessions.
- Client applies the op via the interpreter (PROJ-181) → targeted repaint <200ms.
- Ordered/lossless (Layout channel guarantees; gap → resync PROJ-149).

**Acceptance Criteria:**
- Placing/moving a widget in the Designer reflects on a connected device <200ms, no reload (**AC P1-AC-09**).
- Out-of-order/gap handled via resync.
- Integration test: op → device repaint timing.

**Implementation Notes:** Depends on fan-out (PROJ-150) + client interpreter (PROJ-181) + resync (PROJ-149). This is where M6 ("design on desktop, watch it on the phone") is proven.

**Testing Requirements:** Integration: op broadcast → device repaint <200ms; gap→resync.

**Deliverables:** `engine/core/layout/broadcast.go`, client apply path, tests.

**Dependencies:** PROJ-211, PROJ-150. **Effort:** 3 pts (~4h), medium-high.

**Agent Instructions:** Wire op-apply → Layout-channel broadcast → client targeted repaint; measure <200ms; test reflection + gap/resync.

**Expected Files:** `engine/core/layout/broadcast.go`, `client/lib/net/layout_apply.dart`, tests.

**Validation Commands:**
```bash
cd engine && go vet ./... && go test ./core/layout/... && go build ./...
cd ../client && dart analyze && flutter test
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## PROJ-213 — Drag-drop placement + move/resize with preview ghosts

**Summary:** Designer interactions — drag a widget from a palette to place; move/resize existing widgets; throttled preview ghosts over the Preview channel.

**Objective:** Implement 2C §8 placement UX: AddWidget/MoveWidget/ResizeWidget ops on drop; live preview ghosts during drag (Preview channel, drop-on-overflow).

**Context:** TRD 2C §8 / 2A §6 (Preview channel). During a drag, ghosts stream on Preview (droppable); on drop, a committed op goes on Layout (lossless).

**Technical Requirements:**
- Palette of available widget types (from the widget registry, PROJ-161).
- Drag-to-place → `AddWidget` op on drop; move/resize → `MoveWidget`/`ResizeWidget` on drop.
- During drag: throttled preview ghost frames on the Preview channel (PROJ-143) → optional device preview.

**Acceptance Criteria:**
- Drag-drop places a widget (AddWidget op committed on drop).
- Move/resize commit on drop; preview ghosts stream during drag (droppable, never block).
- Widget/integration tests: place/move/resize commit; ghost throttling.

**Implementation Notes:** Preview ghosts are UX nicety — never let them block or be required for correctness (Layout commit is the source of truth). Palette reads the registry.

**Testing Requirements:** Widget/integration: place/move/resize; ghost throttling.

**Deliverables:** `client/lib/designer/{palette,drag_place,move_resize,preview_ghost}.dart`, tests.

**Dependencies:** PROJ-211, PROJ-143. **Effort:** 3 pts (~4h), medium.

**Agent Instructions:** Implement palette + drag-place + move/resize commits + throttled preview ghosts; test commits + throttling.

**Expected Files:** `client/lib/designer/{palette,drag_place,move_resize,preview_ghost}.dart`, tests.

**Validation Commands:**
```bash
cd client && dart analyze && flutter test
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## PROJ-214 — Schema-driven inspector (auto-generated param editors)

**Summary:** The inspector panel that auto-generates a widget's binding + action param editors from registry schemas — zero per-action UI code.

**Objective:** Implement 2C §8.2 / ADR-0006: read the action/widget schemas (PROJ-161) and render the right editor per param type (int→slider, choice→dropdown, entity→picker, bool→toggle…). **AC P1-AC-10.**

**Context:** TRD 2C §8.2. The keystone payoff: a new plugin action with a `choice` param gets a working dropdown in the inspector with **no designer code change**. This is what makes the ecosystem (Phase 6) free.

**Technical Requirements:**
- Inspector reads the selected widget's config schema + the bound action's param schema (registry).
- Editor generator: map param `type` → editor widget (int/number→slider or numeric field w/ min/max; choice→dropdown from valueChoices; bool→toggle; text→field; entity→picker [stub in P1, realized P4]; color→color picker).
- Edits emit `SetWidgetParams` ops (PROJ-211).

**Acceptance Criteria:**
- Selecting a widget shows auto-generated editors matching its + its action's schema.
- A brand-new (test) action with a `choice` param renders a working dropdown with **no inspector code change** (**AC P1-AC-10**).
- Edits commit via `SetWidgetParams` and reflect live (PROJ-212).
- Widget/integration tests: editor generation per type; new-action-no-code; edit→op.

**Implementation Notes:** This is the single most important leverage ticket in the Designer — invest in the generator's generality. `entity` picker is a stub here (real in Phase 4 / PROJ-4xx).

**Testing Requirements:** Widget/integration: per-type editor; schema-driven new action; edit→op commit.

**Deliverables:** `client/lib/designer/inspector/{inspector,editor_factory,editors/*}.dart`, tests.

**Dependencies:** PROJ-211, PROJ-161. **Effort:** 3 pts (~4h), medium-high.

**Agent Instructions:** Implement the inspector + schema-driven editor factory + per-type editors + op commit; test the new-action-no-code path explicitly.

**Expected Files:** `client/lib/designer/inspector/*`, tests.

**Validation Commands:**
```bash
cd client && dart analyze && flutter test
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## PROJ-215 — Undo / redo (op inverses)

**Summary:** Undo/redo over the op-log using op inverses, reflecting live on devices.

**Objective:** Implement 2C §4.4: maintain undo/redo stacks of op inverses; undo/redo apply like any op (broadcast + reflect). **AC P1-AC-09** (undo/redo path).

**Context:** TRD 2C §4.4 / ADR-0012. Every op is invertible (PROJ-211); undo pushes the inverse, redo re-applies.

**Technical Requirements:**
- Compute + store inverse per applied op; undo applies the inverse, redo re-applies the op.
- Undo/redo go through the same apply+broadcast path (PROJ-211/212) → reflect live.
- Stack bounds + clears on certain ops (per 2C §4.4).

**Acceptance Criteria:**
- Undo reverts the last op (live on device); redo re-applies.
- Multi-step undo/redo consistent.
- Unit/integration: inverse correctness; undo/redo reflect live.

**Implementation Notes:** Correctness of inverses was guaranteed in PROJ-211; this ticket builds the stacks + wiring.

**Testing Requirements:** Unit/integration: inverse; multi-step undo/redo; live reflect.

**Deliverables:** `engine/core/layout/undo.go` (or designer-side stacks calling engine ops), tests.

**Dependencies:** PROJ-211. **Effort:** 2 pts (~3h), medium.

**Agent Instructions:** Implement undo/redo stacks + inverse application through the standard apply/broadcast path; test correctness + live reflect.

**Expected Files:** `engine/core/layout/undo.go`, `client/lib/designer/undo.dart`, tests.

**Validation Commands:**
```bash
cd engine && go vet ./... && go test ./core/layout/... && go build ./...
cd ../client && dart analyze && flutter test
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## PROJ-216 — Profile management + explicit device targeting

**Summary:** Create/assign/activate profiles, with the designer always naming the target device explicitly.

**Objective:** Implement 2C §8 + 2B §5 profile management: a profile (set of pages) created for a device class, assigned to device(s), activatable; the designer header always shows which device it targets (the "no confusion" guarantee).

**Context:** TRD 2C §8 / Doc 0 product thesis. Explicit device targeting is core to the product's reason for existing.

**Technical Requirements:**
- Create profile (for a device class); assign to device(s) (PROJ-163); activate.
- Designer always displays the current target device/class (never ambiguous).
- Persist via `repo_documents`/session.

**Acceptance Criteria:**
- Create/assign/activate profile works; the active profile reflects on the assigned device.
- The designer always names the target device (UI invariant — tested).
- Unit/integration: profile lifecycle; targeting visible.

**Implementation Notes:** Ties session (PROJ-163) ↔ designer. No auto device-class reflow (ADR-0017) — per-class authoring.

**Testing Requirements:** Integration: profile create/assign/activate; targeting label invariant.

**Deliverables:** `client/lib/designer/profiles.dart`, tests.

**Dependencies:** PROJ-211, PROJ-163. **Effort:** 2 pts (~3h), low-medium.

**Agent Instructions:** Implement profile lifecycle + explicit targeting label; test lifecycle + invariant.

**Expected Files:** `client/lib/designer/profiles.dart`, tests.

**Validation Commands:**
```bash
cd client && dart analyze && flutter test
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## PROJ-217 — Grid config editor (no caps)

**Summary:** Edit a layout's grid — columns/rows/gutter/margins/aspect/background — with no artificial caps.

**Objective:** Implement 2C §2 GridConfig editing via a `ChangeGrid` op; explicitly no column/row caps (a deliberate differentiator vs incumbents).

**Context:** TRD 2C §2 / ADR-0017. Incumbents cap grids; CyberDeck does not (within sane performance limits).

**Technical Requirements:**
- Editors for cols/rows/gutter/margins/aspect-ratio/background; emit `ChangeGrid` op.
- No hard caps on cols/rows (validate only against performance sanity, documented).
- Re-render canvas (PROJ-210) on grid change.

**Acceptance Criteria:**
- Grid params editable; `ChangeGrid` op commits + reflects.
- No artificial cap (large grids allowed; only a documented sanity bound).
- Widget tests: grid edit→op; large-grid allowed.

**Implementation Notes:** Coordinate with canvas (PROJ-210) re-render. Keep the sanity bound generous + documented.

**Testing Requirements:** Widget: grid edit→op; large-grid.

**Deliverables:** `client/lib/designer/grid_editor.dart`, tests.

**Dependencies:** PROJ-210. **Effort:** 2 pts (~3h), low-medium.

**Agent Instructions:** Implement grid editor + ChangeGrid op + canvas re-render; test edit + large-grid.

**Expected Files:** `client/lib/designer/grid_editor.dart`, tests.

**Validation Commands:**
```bash
cd client && dart analyze && flutter test
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

# EPIC-10 — Phase-1 Hardening & Acceptance (cross-cutting)

> The verification epic. Each ticket is a cross-cutting suite that ties multiple workstreams' ACs together. These run last (M7) and gate the Phase-1 Definition of Done.

---

## PROJ-300 — Security test suite (sniff / MITM / rogue / secret-leak)

**Summary:** An automated security suite proving the encryption, anti-MITM, rogue-rejection, and no-secret-leak guarantees end to end.

**Objective:** Verify 2E across the integrated system. **AC P1-AC-03** (encrypted; MITM/rogue rejected) + secret-handling.

**Context:** 2E §8 V1 threat model (LAN). Aggregates guarantees built in EPIC-3/4/8.

**Technical Requirements:**
- **Sniff test**: capture session traffic on the wire → assert ciphertext only (no plaintext states/actions).
- **MITM test**: a proxy attempting to intercept the handshake → rejected (fingerprint/signature).
- **Rogue-device test**: a device without a valid trust record / token → handshake rejected.
- **Secret-leak test**: scan SQLite + config + logs for any secret/token → none present (extends PROJ-115).

**Acceptance Criteria:**
- Wire capture is ciphertext-only (**AC P1-AC-03**).
- MITM + rogue handshakes rejected (distinct, tested).
- No secret/token anywhere in SQLite/config/logs.
- Suite runs in CI (integration job).

**Implementation Notes:** Build as an integration test harness spinning a real engine + mock client. This is a **gating** ticket for Phase 1.

**Testing Requirements:** Integration: sniff, MITM, rogue, secret-leak.

**Deliverables:** `engine/test/security/{sniff,mitm,rogue,secretleak}_test.go`, CI job.

**Dependencies:** PROJ-127, PROJ-180. **Effort:** 3 pts (~4h), medium-high.

**Agent Instructions:** Build the four security integration tests against a running engine + mock client; wire into CI; confirm all pass.

**Expected Files:** `engine/test/security/*`, CI additions.

**Validation Commands:**
```bash
cd engine && go test ./test/security/... && go build ./...
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## PROJ-301 — Performance soak (8h, ≥8 sessions)

**Summary:** An 8-hour soak proving memory stability, idle CPU, and 60 FPS under load with ≥8 sessions.

**Objective:** Verify the NFR budgets. **AC P1-AC-14** (RSS growth <5MB/h; idle CPU <2%; 60 FPS).

**Context:** NFR-03/08/09 / Phase-1 Deep Dive M7. Aggregates telemetry (PROJ-171), fan-out (PROJ-150), gauges (PROJ-184).

**Technical Requirements:**
- Soak harness: engine + telemetry plugin + ≥8 simulated sessions for 8h; sample RSS, CPU, frame timing.
- Assertions: RSS growth <5MB/h (no leak); idle engine CPU <2% on the reference; client render 60 FPS under telemetry updates.
- A short CI variant (e.g. 20–30 min) for routine runs; the full 8h on a schedule/manual gate.

**Acceptance Criteria:**
- RSS growth <5MB/h over the soak (**AC P1-AC-14**).
- Idle CPU <2%; 60 FPS sustained under telemetry load.
- Report artifact (graphs/numbers) produced.

**Implementation Notes:** Use the health endpoint / metrics (carried from old monitoring strategy) for sampling. The full 8h needn't block every PR — gate it as a scheduled/manual M7 check; the short variant runs in CI.

**Testing Requirements:** Soak (long) + short CI variant; performance assertions.

**Deliverables:** `engine/test/soak/*`, soak report tooling, CI schedule entry.

**Dependencies:** PROJ-171, PROJ-150, PROJ-184. **Effort:** 3 pts (~4h to build the harness), medium.

**Agent Instructions:** Build the soak harness + sampling + assertions + report; add short CI variant; run + record results.

**Expected Files:** `engine/test/soak/*`, CI additions.

**Validation Commands:**
```bash
cd engine && go test ./test/soak/... -run Short && go build ./...
# full 8h soak via scheduled/manual job
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## PROJ-302 — E2E journeys (J0 / J1 / J2 / J6)

**Summary:** End-to-end tests for the four Phase-1 journeys: pairing, author-live, gaming-session-start, permissioned 2nd device.

**Objective:** Verify the realized journeys from the Phase-1 Deep Dive §13 work end to end across engine + client.

**Context:** Phase-1 Deep Dive realized journeys. Aggregates pairing (PROJ-123/180), designer broadcast (PROJ-212), inspector (PROJ-214), power/launchers (PROJ-173/175), permissions (PROJ-125), telemetry (PROJ-171).

**Technical Requirements:**
- **J0 Pairing**: discover → QR pair → fingerprint verify → session live.
- **J1 Author-live**: designer places a gauge → reflects on device <200ms.
- **J2 Gaming-start**: tap a launcher → app launches; telemetry gauges live.
- **J6 Permissioned 2nd device**: pair a 2nd device with restricted permissions → it cannot perform a denied power action; audit records the rejection.
- Driver: an automated harness (engine + client integration; where full UI E2E isn't feasible in CI, a scripted integration through the client's net/render layers with documented manual UI confirmation).

**Acceptance Criteria:**
- All four journeys pass end to end.
- J6 proves permission enforcement + audit (ties **AC P1-AC-07**).
- E2E job in CI (or documented manual run where UI-driving is impractical).

**Implementation Notes:** Prefer integration-level E2E (drive the client's connection/render/gesture layers programmatically) over brittle full-UI automation; document any manual confirmation steps.

**Testing Requirements:** E2E/integration: J0/J1/J2/J6.

**Deliverables:** `test/e2e/{j0,j1,j2,j6}_test.*`, harness, run notes.

**Dependencies:** PROJ-212, PROJ-214, PROJ-173, PROJ-175. **Effort:** 3 pts (~4h), medium-high.

**Agent Instructions:** Build the four journey harnesses (integration-level); run; record pass + any manual steps.

**Expected Files:** `test/e2e/*`, harness.

**Validation Commands:**
```bash
cd engine && go test ./test/e2e/... && go build ./...
cd ../client && flutter test integration_test/ || echo "document manual UI steps where automation impractical"
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## PROJ-303 — Phase-1 acceptance verification (P1-AC-01…16)

**Summary:** The final acceptance pass — verify all sixteen Phase-1 acceptance criteria and the Definition of Done are met.

**Objective:** A traceability checklist mapping each P1-AC to the ticket(s) + test(s) that satisfy it, with every box green. Closes Phase 1.

**Context:** Phase-1 Deep Dive §1 (Definition of Done) + §18 (P1-AC-01…16). This is the phase exit gate (M7).

**Technical Requirements:**
- A traceability matrix: P1-AC-01…16 → satisfying ticket(s) → satisfying test(s) → status.
- Confirm each AC's tests are green (re-run the relevant suites).
- Confirm Definition-of-Done items (all ACs verified; budgets within NFR; code review; CHANGELOG updated).

**Acceptance Criteria:**
- Every P1-AC-01…16 maps to passing test(s) and is checked.
- Definition of Done satisfied; a signed-off acceptance report committed.
- No P0/P1 ticket left un-Done.

**Implementation Notes:** This ticket *verifies*, it doesn't *build* — if an AC fails, file/return to the owning ticket rather than patching here. Produces `docs/phase1_acceptance.md`.

**Testing Requirements:** Re-run all AC-linked suites; assemble the matrix.

**Deliverables:** `docs/phase1_acceptance.md` (traceability matrix + sign-off), CHANGELOG update.

**Dependencies:** PROJ-300, PROJ-301, PROJ-302. **Effort:** 2 pts (~3h), low-medium (verification).

**Agent Instructions:** Build the traceability matrix; re-run AC suites; confirm DoD; commit the acceptance report; only mark Done when all 16 ACs are green.

**Expected Files:** `docs/phase1_acceptance.md`, `CHANGELOG.md`.

**Validation Commands:**
```bash
cd engine && go test ./... && go build ./...
cd ../client && dart analyze && flutter test
# assemble + verify the P1-AC traceability matrix
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## Batch 4 — dependency-correct execution order

```
EPIC-7 (flow):
PROJ-200 (model) ─► PROJ-202 (executor) ; PROJ-201 (expr) ─► PROJ-202
PROJ-202 ─► PROJ-203 (nodes) [needs PROJ-125], PROJ-204 (triggers) [needs PROJ-162]

EPIC-9 (designer):
PROJ-210 (canvas) ─► PROJ-211 (op-log) ─► PROJ-212 (broadcast) [needs PROJ-150]
PROJ-211 ─► PROJ-213 (drag/drop) [needs PROJ-143], PROJ-214 (inspector) [needs PROJ-161],
            PROJ-215 (undo/redo), PROJ-216 (profiles) [needs PROJ-163]
PROJ-210 ─► PROJ-217 (grid editor)

EPIC-10 (hardening — last, gate M7):
PROJ-300 (security) [needs PROJ-127, PROJ-180]
PROJ-301 (soak)     [needs PROJ-171, PROJ-150, PROJ-184]
PROJ-302 (E2E)      [needs PROJ-212, PROJ-214, PROJ-173, PROJ-175]
PROJ-300+301+302 ─► PROJ-303 (acceptance — phase exit)
```

**Phase exit:** PROJ-303 is the terminal ticket — Phase 1 is Done when all 16 P1-ACs are verified green and no P0/P1 ticket remains open.

---

## All four batches — completion status

| Batch | Epics | Tickets | Points |
|-------|-------|---------|--------|
| 1 | EPIC-1/2/3 (Lifecycle, Persistence, Security) | 26 | 61 |
| 2 | EPIC-4/6 (Transport, State/Registries) | 16 | 39 |
| 3 | EPIC-5/8 (Plugins, Client) | 21 | 51 |
| 4 | EPIC-7/9/10 (Flow, Designer, Hardening) | 17 | 45 |
| **Total** | **10 epics** | **45 unique tickets** | **113** |

> (Batch ticket-row counts include the per-OS triplets expanded; the board's 45 figure counts each PROJ-ID once. Points reconcile to the board's 113.)

**All Phase-1 tickets are now fully specified.** Remaining execution-system deliverables (computed from this ticket set): **Dependency Graph → Execution Plan → Progress Dashboard → Claude Agent Instructions.**

---

*End of Batch 4 (final ticket batch). Next: the four synthesis documents.*
