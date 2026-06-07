# CyberDeck — Phase 3 (Gaming Integration + Automation Authoring) Deep Dive

**Document 5 of the CyberDeck Enterprise Documentation Set · Per-Phase Deep Dive**
Version 0.1 (Draft) · June 2026 · Codebase ID: `com.shishir.cyberdeck`

> Implementation-depth specification for **Phase 3**. Two thrusts: (a) the **gaming capability set** and deeper system telemetry/control; (b) the **automation-authoring leap** — the visual flow builder UI, schedule triggers, and extended flow nodes — all over the Phase-1 flow model. Authority chain unchanged. New decisions introduced: **ADR-0022 (flow-document op model)**, **ADR-0023 (privileged/elevated action gating)**, **ADR-0024 (HTTP/network flow node permission)**.

## Contents
1. Phase intent & definition of done
2. Scope: in / out
3. Seams consumed from Phases 1–2
4. Workstream map & dependency order
5. WS-3.1 FPS capability (provider chain implemented)
6. WS-3.2 Game detection & game-cover launcher
7. WS-3.3 Game profiles & optimization (privileged actions)
8. WS-3.4 Deep telemetry & system control
9. WS-3.5 Gaming widgets & charts
10. WS-3.6 Visual flow builder UI
11. WS-3.7 Schedule triggers & extended flow nodes
12. WS-3.8 Capture & achievements (opportunistic)
13. End-to-end realized journeys
14. Code structure (additions)
15. Test plan
16. Milestones & sequencing
17. Risks & mitigations
18. Acceptance criteria (traced)

---

## 1. Phase intent & definition of done

**Intent.** Make CyberDeck a first-class gaming control surface (live FPS, one-tap game launch from cover art, optimization profiles, deep telemetry) **and** make the flow engine *authorable by humans* — the Phase-1 model/executor exists, but until now flows had to be written as data. Phase 3 ships the **visual flow builder**, **schedule triggers**, and **extended nodes**, completing the "Builder" persona's experience.

**Definition of done.**
- Live FPS renders where a provider is available (PresentMon primary on Windows), and degrades to `unavailable` elsewhere with no breakage.
- Game launch from cover-art tiles works for the major launchers; covers fetch via the Phase-2 asset pipeline.
- Game profiles apply power plan + process priorities (+ best-effort RAM clean / network tweaks) atomically and reversibly; privileged operations are gated and audited.
- The visual flow builder lets a user assemble a non-trivial conditional flow (branch + variable + wait) and run it — the Morgan-persona "< 10 min" metric is now testable.
- Schedule triggers fire flows on time/cron; the HTTP-request and parallel nodes work under permission gating.
- All Phase-3 ACs verified; NFR budgets hold.

## 2. Scope: in / out

### In scope (Phase 3)
| Area | Included | PRD |
|------|----------|-----|
| FPS | provider chain implemented (native→PresentMon→FrameView→RTSS→vendor→unavailable) | D11-02 |
| Launch | game-cover grid launcher; current-game detection | D11-01/06 |
| Optimization | game profiles (Competitive/AAA/Streaming/Battery); RAM cleaner; network boost (best-effort) | D11-03/04/05 |
| Telemetry | system health score; top-processes table; fan speed read | D8-08/09/10 |
| Control | performance/power-plan selector; kill process; fan control write | D9-04/05/07 |
| Widgets | rolling line chart; donut/distribution chart; FPS/resource displays | D5-11/12 |
| **Automation UI** | **visual flow builder** | D7-09 |
| **Triggers** | **schedule/cron triggers** | D7-10 |
| **Nodes** | HTTP request, parallel/fork | D7-11 |
| Capture | screenshot/clip capture; achievements (P3, opportunistic) | D11-07/08 |

### Out of scope
Smart home (P4) · notifications/cameras (P5) · plugin-provided nodes/widgets & SDK (P6) · remote (P7). Capture/achievements are opportunistic.

## 3. Seams consumed from Phases 1–2

| Seam | Phase-3 use |
|------|-------------|
| PAL provider chains (2G) | FPS chain finally implemented; new `Processes`, `PowerPlan`, `Fans`, `GameDetect` capabilities |
| Privileged actions (2E permissions + `destructive`) | profile changes, kill process, fan write, RAM clean → elevated gating (ADR-0023) |
| Asset delivery (ADR-0021) | **game covers** (SteamGridDB) reuse the content-addressed fetch — no new mechanism |
| Flow model + executor + registries (2D/2B) | the **visual builder** reads node/action schemas and edits the flow document; extended nodes register the same way |
| `Flow.trigger.kind=schedule` reserved field (2D §6) | the scheduler consumer is built now |
| Op-log pattern (2C/ADR-0012) | adapted into a **flow-document op model** (ADR-0022) for builder undo/redo |
| Layout designer inspector (2C §8.2) | the flow builder's param editors reuse the same schema-form generator |

No foundation contract changes; three new ADRs refine existing seams rather than replace them.

## 4. Workstream map & dependency order

```
WS-3.1 FPS ─────────┐
WS-3.2 Launch/detect ┼─► WS-3.5 Gaming widgets & charts
WS-3.3 Profiles/opt ─┤        (FPS display, charts, resource bars)
WS-3.4 Deep telem/ctl┘
WS-3.6 Visual flow builder ───► WS-3.7 Schedule + extended nodes
WS-3.8 Capture/achievements (opportunistic)
```
Two parallel tracks: **gaming** (3.1–3.5) and **automation** (3.6–3.7). They share nothing but the registries/asset seam, so they can be built by separate sub-teams concurrently. Critical path on the gaming track: 3.1–3.4 → 3.5; on the automation track: 3.6 → 3.7.

---

## 5. WS-3.1 — FPS capability (provider chain implemented)

**Owning TRD:** 2G §4–§5. **PRD:** D11-02. **ADR:** 0007.

### 5.1 Functional flow
```
host start → FPS capability probe in priority order:
   native_app_telemetry (inert) → PresentMon (Windows) → FrameView → RTSS → vendor → unavailable
   → bind first available
during play → bound provider samples frame timing → FPS.Current() → (144, true)
   → stateUpdate(gaming.fps) → clients; if FPS<30 for 5s → gaming.fps_low event → (optional flow)
```

### 5.2 Capability detail
- Implements the FPS chain specified in 2G; **PresentMon is the Windows primary** (open-source, no overlay; bundling pending the licensing review tracked in 2G §7 — that review **must close before this ships bundled**).
- Vendor APIs remain ranked low for FPS (GPU telemetry reliable, per-app FPS not — 2G §4.4).
- macOS/Linux: chain resolves to `unavailable` in V1 unless a native/vendor path exists — a normal, non-breaking outcome.

### 5.3 Technical spec
- The FPS plugin spawns/attaches to the chosen provider; PresentMon integration runs it as a child capture process, parses its frame-time stream, derives FPS (`1/frametime` smoothed), publishes `gaming.fps` (number) at ~1 s cadence with optional series buffer for a sparkline.
- Re-probe on provider fault (2G §4.3) — e.g. PresentMon permission denied → fall to next or unavailable.

### 5.4 Code structure
```
plugins/fps/ main.go manifest.json
  providers/{presentmon_windows.go, frameview_windows.go, rtss_windows.go, vendor.go, native.go}
  parse.go smooth.go
engine/pal/fps.go   (interface from P1 2G now satisfied)
```

---

## 6. WS-3.2 — Game detection & game-cover launcher

**Owning TRD:** 2G (`GameDetect`), 2F, ADR-0021. **PRD:** D11-01/06.

### 6.1 Capability detail
- **Current-game detection**: scan running processes against a known-launcher/game heuristic; publish `gaming.currentgame`.
- **Game-cover launcher**: a grid of game tiles with cover art. Covers fetched from **SteamGridDB** (or launcher metadata), stored in the host asset store, exposed as **asset refs** (ADR-0021) — clients fetch covers exactly like album art. Tapping a tile launches the title via its native launcher.

### 6.2 Technical spec
- New PAL `GameDetect` (process-scan provider) and a `Launcher` extension for per-title launch (Steam URI `steam://rungameid/…`, Epic, etc.).
- Cover fetch: on first reference of a game, fetch cover → hash → asset store → set the tile's `cover.ref`; cached persistently in `assets/gameart/` (carried from old design, ≤500 MB, manual purge).
- Game library is a user-curated list (favourites) stored as part of a profile/config; the launcher widget binds to it.

### 6.3 Code structure
```
plugins/gamedetect/ main.go manifest.json scan_{windows,darwin,linux}.go
plugins/launchers/  (extended: per-title launch, cover fetch via SteamGridDB)
engine/pal/gamedetect.go
client/lib/render/widgets/game_grid.dart   // tiles consume cover asset refs
```

---

## 7. WS-3.3 — Game profiles & optimization (privileged actions)

**Owning TRD:** 2E (permissions), 2D (profiles can be applied via flows). **PRD:** D11-03/04/05, D9-04. **ADR:** **0023 (new — elevated action gating)**.

### 7.1 Functional flow
```
User taps "Competitive" profile
  → authorize (device perms; profile changes are privileged) → audit
  → game-profile action applies ATOMICALLY:
       set Windows power plan (e.g. Ultimate Performance)
       raise game process priority; lower background priorities
       (best-effort) RAM clean (EmptyWorkingSet on eligible processes)
       (best-effort) network tweak (QoS / disable background bandwidth)
  → on any step failure → roll back applied steps → report partial + audit
  → set gaming.mode = "Competitive"
```

### 7.2 Capability detail
- **Game profiles**: Competitive / AAA / Streaming / Battery Saver, each a named bundle of {power plan, process-priority policy, optional RAM clean, optional network tweak}. Reversible: switching profiles reverts the prior one's changes.
- **RAM cleaner**: `EmptyWorkingSet` on non-critical processes; reports a count; never touches protected/system processes.
- **Network boost**: **honestly best-effort** — applies a documented, bounded set (process QoS, deprioritize background transfers). Where the OS doesn't permit it, the step degrades to no-op and says so. (No magic; no kernel-level claims.)
- **Performance/power-plan selector** (D9-04): Silent/Balanced/Performance/Turbo mapped to OS power plans.

### 7.3 Elevated action gating (ADR-0023)
Several operations require **OS elevation** (admin/root) — process priority of others, `EmptyWorkingSet`, power-plan changes, fan writes. Decision:
- The engine **declares which actions are `elevated`** in their registry descriptor (extends the `destructive` flag with an `elevated` flag).
- The **engine service runs at the privilege level granted at install**; elevated actions execute within that. Where elevation is unavailable, the action degrades to the subset it can do and **reports partial success** (never silently fails, never crashes).
- Elevated actions are **always audited** with the elevation outcome.

### 7.4 Technical spec
- A game profile is applied as a **transactional bundle**: each step records an undo closure; failure triggers rollback of completed steps. (Implemented as a built-in macro/flow internally — dogfooding the flow engine.)
- Process-priority and power-plan changes are reverted on profile switch or engine shutdown (so the machine isn't left in "Turbo" forever).

### 7.5 Code structure
```
plugins/gameopt/ main.go manifest.json
  profiles.go powerplan_{windows,darwin,linux}.go priority.go ramclean_{windows,...}.go netboost.go rollback.go
engine/core/registry/actions.go   // + "elevated" flag
```

---

## 8. WS-3.4 — Deep telemetry & system control

**Owning TRD:** 2G, 2B. **PRD:** D8-08/09/10, D9-05/07.

### 8.1 Capability detail
- **System health score** (D8-08): computed state (0–100) — weighted average of thermal headroom, storage health, RAM pressure, driver/system signals. A pure function over existing telemetry states; published as `system.health.score` + a label (Excellent/Good/Fair/Poor).
- **Top-processes table** (D8-09): top N by CPU/memory; a `series`/table-shaped state; backs a processes widget.
- **Fan speed read** (D8-10) + **fan control write** (D9-07): `Fans` capability (WMI/vendor providers); read RPM; write where supported (elevated, ADR-0023); degrade to read-only or unavailable otherwise.
- **Kill process** (D9-05): `system.killprocess{pid}` — privileged, audited, with confirmation.

### 8.2 Technical spec
- Health score computed in a small first-party "health" plugin subscribing to telemetry states; recomputed on a 5 s cadence (carried).
- Top-processes is a bounded snapshot (no per-process state explosion); transmitted as one structured state, refreshed at a modest cadence to protect the budget.

### 8.3 Code structure
```
plugins/health/    main.go manifest.json score.go
plugins/processes/ main.go manifest.json top.go kill.go
plugins/fans/      main.go manifest.json read_{windows,...}.go write_{windows,...}.go
```

---

## 9. WS-3.5 — Gaming widgets & charts

**Owning TRD:** 2C §7. **PRD:** D5-11/12.

### 9.1 Capability detail
New client widget types: **`chart.line.rolling`** (60 s rolling line, tab-selectable CPU/GPU/RAM/FPS — binds to series states), **`chart.donut`** (storage/distribution), **FPS display** (large number + sparkline), **resource bars** (GPU/CPU/RAM/VRAM), **game grid** (WS-3.2), **profiles widget** (the 4 game profiles + create), **processes table widget**, **health gauge** (reuses circular gauge with the health score).

### 9.2 Technical spec
- The rolling line chart consumes a `series` state's ring buffer (2B) — already transmitted as part of state; the widget renders the buffer and appends on each delta (60 FPS budget; no extra traffic).
- Charts are native Flutter custom painters (no heavy chart lib needed for these shapes), keeping the bundle lean and the render fast.

### 9.3 Code structure
```
client/lib/render/widgets/{chart_line_rolling.dart, chart_donut.dart, fps_display.dart, resource_bars.dart, profiles.dart, processes_table.dart}
shared/schemas/widgets/ (new gaming/chart widget descriptors)
```

---

## 10. WS-3.6 — Visual flow builder UI (the automation leap)

**Owning TRD:** 2D (model/executor it authors), 2B (registries it reads). **ADR:** **0022 (new — flow-document op model)**, 0006.

### 10.1 Functional flow
```
User opens the flow builder (desktop, alongside the layout designer)
  → builder reads flow-node registry + action registry (2B) → renders palette
  → user drags nodes onto a graph canvas, connects next/branch edges
  → selecting a node opens a schema-generated param editor (reuses 2C §8.2 schema-form)
  → setting a trigger (manual/event/stateChange/schedule) configures arming
  → save → flow document persisted (versioned, 2B workflows) → engine arms triggers
  → "test run" executes host-side; the builder shows live node-by-node execution trace
```

### 10.2 Capability detail
- A **graph canvas** for flows: nodes (action/if/setVar/wait/loop/navigate/random/subflow/stop + Phase-3 HTTP/parallel) placed and wired; branches (`then`/`else`, loop body) drawn as labeled edges.
- **Schema-driven param editors** — identical machinery to the layout designer's inspector (ADR-0006): an action node's params, a `setVar` value, an `if` condition (with an expression editor + token autocomplete from available states/vars) all generated from schemas. **The Morgan persona's "< 10 min" target lives here.**
- **Trigger configuration** UI: manual (attach to a widget slot — cross-links to the layout designer), event (pick an engine event), stateChange (pick state + condition), schedule (cron/interval — WS-3.7).
- **Test run + live trace**: execute the flow on the engine and stream a per-node execution trace back (which node ran, branch taken, values) — invaluable for debugging, and a direct answer to the incumbents' opaque automation.
- **Validation**: the builder flags unreachable nodes, missing required params, type-mismatched expressions, and unbounded loops *before* save.

### 10.3 Flow-document op model (ADR-0022)
The layout designer uses an op-log with **device broadcast** (ADR-0012) because edits must reflect live on devices. **Flows execute host-side and are not rendered on devices**, so they need **no live device broadcast** — but they *do* benefit from undo/redo and versioning. Decision:
- The flow builder edits the flow document via a **local op model** (AddNode, RemoveNode, ConnectEdge, SetNodeParams, SetTrigger, …) with **inverses for undo/redo** and **monotonic document versioning** (like layouts), but **without** the Layout-channel broadcast — commits persist to `workflows` (2B) and re-arm triggers.
- This keeps undo/redo + versioning consistent across both authoring surfaces while honestly reflecting that flows aren't a live device surface. The op model is the same *shape*, a different *delivery* (persist-and-rearm vs persist-and-broadcast).

### 10.4 Technical spec
- The builder is desktop-only (same constraint as the layout designer, ADR-0018) and lives in the client codebase.
- The live trace rides a diagnostic message type over the loopback/session (debug-level; gated so it's only sent to the authoring desktop, not broadcast).
- Cross-link with layout: a `manual` trigger can be bound from either the layout designer (widget slot → flow) or the flow builder (flow → "attach to a widget") — both write the same interaction-slot reference.

### 10.5 Code structure
```
client/lib/flowbuilder/   // desktop-only
  canvas.dart palette.dart edges.dart
  node_inspector.dart expression_editor.dart trigger_config.dart
  op_model.dart undo.dart validation.dart test_run_trace.dart
engine/core/flow/trace.go     // emit per-node execution trace (debug) to the authoring session
```

---

## 11. WS-3.7 — Schedule triggers & extended flow nodes

**Owning TRD:** 2D §6 (schedule reserved → active), §3 (node catalog extension). **ADR:** **0024 (new — network flow node permission)**.

### 11.1 Schedule triggers
- The Phase-1-reserved `Flow.trigger.kind = "schedule"` becomes active: cron expression or fixed interval; a scheduler in the engine arms timers and fires the flow at match.
- Missed-fire policy on engine downtime: documented (default = skip missed, run next; optional "catch-up once").
- Time zone = host local; surfaced clearly in the builder.

### 11.2 Extended nodes
- **`httpRequest`** node: call an external HTTP(S) endpoint (method, URL, headers, body, timeout) and capture the response into a local/`var` value for downstream nodes. **Powerful and dangerous**, so gated (ADR-0024).
- **`parallel` / `fork`** node: run multiple branches concurrently; an optional `join` waits for all (or first) before continuing. Concurrency bounded; each branch shares the run's global `var.*` (last-write-wins) but has its own local scope.

### 11.3 Network flow node permission (ADR-0024)
A flow that can make arbitrary HTTP calls is an exfiltration/SSRF surface, and flows are shareable content. Decision:
- The `httpRequest` node requires an explicit **`flow.network` permission** that is **off by default**; enabling it is a deliberate user action surfaced in the builder with a clear warning.
- An **imported** flow (Phase-2 import, or future marketplace) containing an `httpRequest` node is **inert until the user reviews and grants** network permission for it — never silently network-capable.
- HTTP nodes are audited (URL host, not body; secrets redacted), and respect the no-exfiltration product stance by being **explicit, user-authored, opt-in** — consistent with 2E TB-4/TB-5.

### 11.4 Code structure
```
engine/core/flow/scheduler.go
engine/core/flow/nodes/{http.go, parallel.go, join.go}
engine/core/flow/netperm.go   // flow.network permission gating
client/lib/flowbuilder/trigger_config.dart  (schedule UI)
```

---

## 12. WS-3.8 — Capture & achievements (opportunistic)

**PRD:** D11-07 (achievements, P3), D11-08 (capture, P2). Included if capacity remains.
- **Screenshot/clip capture**: `gaming.screenshot`, `gaming.record.toggle` (via OBS WebSocket where present, else OS snip) — provider-chained, degrade to unavailable.
- **Achievements**: top in-progress achievements display where a launcher API exposes them; otherwise omitted. Lower priority; deferred without guilt.

---

## 13. End-to-end realized journeys (Phase 3)

**Gaming session, complete (PRD Journey 2, now full).** Alex's phone: gaming layout with live FPS + thermals; taps a cover tile → game launches; taps "Competitive" → power plan + priorities + RAM clean apply atomically (and revert on exit); rolling charts track CPU/GPU/FPS during play.

**Builder builds a real flow (PRD Journey 4, now visual — Morgan's headline).** Morgan opens the flow builder, drags `stateChange(cpu.temp>85)` trigger → `setVar` → `if` → `action(performance.set Silent)` → `httpRequest`(ping a webhook, after granting network permission) → wires the branches, runs a **test run**, watches the live node trace, fixes a condition, saves. Under 10 minutes. The success metric is now measurable.

**Scheduled automation.** A "nightly wind-down" flow fires at 11 pm (schedule trigger): sets Balanced power plan, lowers volume, switches the wall tablet to a clock profile.

---

## 14. Code structure (additions)

```
plugins/ fps/ gamedetect/ gameopt/ health/ processes/ fans/   (+launchers extended)
engine/
  pal/{fps.go, gamedetect.go, fans.go(+write)}
  core/registry/actions.go        (+elevated flag)
  core/flow/{scheduler.go, trace.go, netperm.go, nodes/{http.go,parallel.go,join.go}}
client/lib/
  render/widgets/{chart_line_rolling, chart_donut, fps_display, resource_bars, profiles, processes_table, game_grid}.dart
  flowbuilder/   (new desktop-only authoring surface)
shared/schemas/  (gaming/chart widgets; http/parallel node descriptors)
```

## 15. Test plan

| Layer | Scope | Pass criteria |
|-------|-------|---------------|
| Unit — FPS | provider probe order; smoothing; re-probe on fault | PresentMon bound on Win; unavailable elsewhere, no crash |
| Unit — gameopt | profile bundle apply/rollback; RAM-clean process exclusion; netboost no-op where unsupported | atomic apply; protected processes untouched |
| Unit — flow nodes | http (timeout/error capture); parallel/join; scheduler cron parse | deterministic; bounded concurrency |
| Unit — flow builder | op model inverses (undo/redo); validation (unreachable/missing param/type mismatch/unbounded loop) | all caught pre-save |
| Integration — elevated gating | elevated action with/without privilege → full vs partial + audit | partial success reported, never crash |
| Integration — covers | cover fetch → asset store → client render via ADR-0021 | covers reuse asset pipeline; cached |
| Integration — schedule | flow fires on cron; missed-fire policy on downtime | fires correctly; policy honored |
| Integration — network perm | imported flow with http node is inert until granted; audit logs host not body | gating + redaction correct |
| E2E | full gaming session; visual flow build + test run | journeys pass; <10 min flow build (usability) |
| Performance | charts/FPS at 60 FPS; engine budget with gaming plugins + scheduler | NFR-03/08/09 hold |
| Security | http node SSRF/exfil review; elevated actions audited | controls hold |

## 16. Milestones & sequencing

| Milestone | Content | Gate |
|-----------|---------|------|
| **M3.1 FPS live** | WS-3.1 | FPS on Windows via PresentMon; unavailable elsewhere clean |
| **M3.2 Launch & covers** | WS-3.2 | cover-tile launch; covers via asset pipeline |
| **M3.3 Profiles & control** | WS-3.3 + WS-3.4 | Competitive applies+reverts; elevated gating + audit; health/processes/fans |
| **M3.4 Gaming widgets** | WS-3.5 | rolling charts + FPS display + profiles widget |
| **M3.5 Flow builder** | WS-3.6 | build+test-run a branching flow with live trace; undo/redo |
| **M3.6 Schedule + nodes** | WS-3.7 (+WS-3.8 if time) | scheduled flow fires; http(gated)+parallel work |
| **M3.7 Harden** | ACs + budgets | Definition of Done met |

## 17. Risks & mitigations

| Risk | Prob | Impact | Mitigation |
|------|------|--------|-----------|
| PresentMon licensing review not cleared before ship | Med | High | Track to closure as a release gate (2G §7); fallback chain works without it |
| Per-app FPS only reliable on Windows | High | Med | Provider chain → unavailable elsewhere is acceptable & documented |
| Elevated ops blocked on locked-down/corp machines | Med | Med | Elevated-action gating: partial success + audit, never crash (ADR-0023) |
| "Network boost" overpromises | Med | Med | Specified as honest best-effort; no kernel claims; no-op where unsupported |
| HTTP flow node misused (SSRF/exfil) | Med | High | Off-by-default permission; imported flows inert until granted; audited (ADR-0024) |
| Flow builder complexity balloons | Med | Med | Reuse layout-designer schema-form + op model; validation early; scope nodes to V1 set + http/parallel |
| Charts hurt 60 FPS on low-end tablets | Low | Med | Native painters; series already in-state; measured at M3.4 |

## 18. Acceptance criteria (traced)

| AC | Criterion | Trace |
|----|-----------|-------|
| P3-AC-01 | Live FPS renders via the bound provider (PresentMon on Win); degrades to `unavailable` with no crash where no provider exists. | D11-02, 2G, M3.1 |
| P3-AC-02 | A game launches from a cover-art tile within 3 s; covers fetch via the asset pipeline and cache. | D11-01, ADR-0021, M3.2 |
| P3-AC-03 | Applying a game profile changes power plan + priorities atomically and reverts on switch/exit; failures roll back with partial-success report. | D11-03, M3.3 |
| P3-AC-04 | RAM cleaner empties working sets of non-critical processes only and reports a count. | D11-04, M3.3 |
| P3-AC-05 | Elevated actions execute within granted privilege; where elevation is unavailable they report partial success and are audited — never crash. | ADR-0023, M3.3 |
| P3-AC-06 | System health score, top-processes table, and fan read render; fan write works where supported. | D8-08/09/10, M3.3/3.4 |
| P3-AC-07 | Rolling line and donut charts render at 60 FPS from series states with no extra traffic. | D5-11/12, NFR-03, M3.4 |
| P3-AC-08 | A user assembles a branching flow (trigger + if + var + wait + action) in the visual builder, runs a test, sees a live per-node trace, and saves; undo/redo works. | D7-09, M3.5 |
| P3-AC-09 | A scheduled flow fires on its cron/interval; the missed-fire policy is honored across engine downtime. | D7-10, M3.6 |
| P3-AC-10 | The HTTP node is off by default; an imported flow containing it is inert until the user grants network permission; calls are audited (host, not body). | D7-11, ADR-0024, M3.6 |
| P3-AC-11 | The parallel node runs branches concurrently with bounded concurrency and correct join semantics. | D7-11, M3.6 |
| P3-AC-12 | NFR budgets hold with the gaming plugin set + scheduler active. | NFR-08/09, M3.7 |

---
*End of Phase 3 Deep Dive (Draft v0.1). New decisions ADR-0022/0023/0024 to be appended to the Decision Log. Next: Phase 4 (Smart Home).*
