# CyberDeck — TRD 2D: Flow Engine

**Subsystem TRD · Document 2D** · Version 0.1 (Draft) · June 2026
Inherits TRD Master §6. Governing ADRs: **0013, 0019** (state/var model 2B; actions 2B; security boundary 2E).

## Contents
1. Scope & responsibilities
2. Flow document model
3. Node catalog (V1)
4. The expression language
5. Variables & scope
6. Triggers
7. Execution runtime & semantics
8. Failure, cancellation, safety
9. Composition (subflows) & the registry seam
10. Normative requirements

---

## 1. Scope & responsibilities

Owns the **conditional flow / macro engine** (ADR-0013): the flow document model, the node-graph runtime, the **sandboxed expression language**, variable scoping, the trigger model, and execution semantics. Flows execute **host-side** (clients only trigger — ADR-0002). Consumes: the action registry (2B §3.1) to invoke actions, the state store (2B §2) and `var.*` for expressions, the event bus (2B §4) for triggers, and the permission/audit model (2E) for governance. This subsystem is what differentiates CyberDeck from the incumbents' weak logic and is the home of the "Builder" persona.

**V1 = data model + executor + core nodes + expressions + manual/event/stateChange triggers.** The **visual flow builder UI** and **schedule triggers** are Phase 3 over this same model (Doc 0 §12); plugin-provided nodes are Phase 6.

## 2. Flow document model

A flow is a directed graph of nodes. A **macro** is the degenerate linear case (first-class — ADR-0013). Stored in SQLite `workflows` (2B §6), versioned, referenced by widget interaction slots (2C §3), events, or schedules.

```jsonc
{
  "id":"flow_cooling_guard", "label":"Cooling Guard", "version":4,
  "trigger":{ "kind":"stateChange", "state":"system.cpu.temp", "when":">85" },
  "entry":"n1",
  "nodes":[
    { "id":"n1","kind":"action","ref":"system.performance.set","params":{"profile":"Silent"},"next":"n2" },
    { "id":"n2","kind":"if","cond":"{var.notify_enabled} == true","then":"n3","else":"n4" },
    { "id":"n3","kind":"action","ref":"notify.send","params":{"msg":"CPU hot — cooling profile on"},"next":"n4" },
    { "id":"n4","kind":"action","ref":"home.light.brightness","params":{"entity_id":"light.office","level":30},"next":"n5" },
    { "id":"n5","kind":"setVar","var":"var.last_guard_ts","value":"{now}","next":null }
  ]
}
```
- `entry` names the start node; each node names its `next` (or branch targets); `null` ends a path.
- Node `ref` for `action`/`subflow` resolves against the registries (2B); `params` values may contain expressions (§4).

## 3. Node catalog (V1)

| kind | Fields | Semantics |
|------|--------|-----------|
| `action` | `ref, params, next` | Invoke a registered action (params expression-resolved + schema-validated by 2B); await result; continue. |
| `if` | `cond, then, else` | Evaluate boolean expression; branch. (`else` optional → falls through.) |
| `setVar` | `var, value, next` | Evaluate expression; write a `var.*` (2B), which fans out/triggers like any state. |
| `wait` | `ms` (or expr), `next` | Suspend this run for a duration; non-blocking (other flows/sessions proceed). |
| `loop` | `mode(count|while), count|cond, body, next` | Repeat `body` subgraph; `while` re-evaluates each iteration. Bounded (max iterations cap) to prevent runaway. |
| `navigate` | `target(page|profile), ref, next` | Switch the **triggering device's** session page/profile (2B session). No-op if non-interactive trigger. |
| `random` | `branches:[…], next` | Pick one branch uniformly (Stream Deck "Random Action" parity). |
| `subflow` | `ref, next` | Invoke another flow synchronously; returns to `next` on completion (§9). |
| `stop` | — | Terminate this run immediately. |

Node kinds are themselves registry entries (2B §3.3); Phase 6 plugin nodes (HTTP request, parallel/fork) register the same way — the executor dispatches by `kind` (§9).

## 4. The expression language (the security boundary — ADR-0013)

Conditions (`if`, `loop while`), dynamic params, and `setVar` values use a small, **sandboxed** expression language. It is **not** a general scripting language and **cannot execute arbitrary code** — flows are shareable/importable content, so this is a trust boundary (2E TB-5).

### 4.1 Grammar (informal)
```
expr     := or
or       := and ('||' and)*
and      := cmp ('&&' cmp)*
cmp      := add (('=='|'!='|'>'|'<'|'>='|'<=') add)?
add      := mul (('+'|'-') mul)*
mul      := unary (('*'|'/'|'%') unary)*
unary    := '!'? primary
primary  := number | string | bool | token | '(' expr ')'
token    := '{' dotted '}'          // {state.id} | {var.name} | {now}
```
- **Token interpolation**: `{system.cpu.temp}` → current typed state value; `{var.x}` → variable; `{now}` → engine epoch-ms. Tokens resolve at evaluation time against the state store (2B). Typed values (ADR-0019) make `{system.cpu.temp} > 85` a numeric comparison, not string.
- **Operators**: boolean, comparison, arithmetic, string concat (via `+` on strings).
- **No** function calls into the host, no I/O, no loops *in the expression* (loops are nodes), no `eval`. Parsed to an AST and evaluated by a bounded interpreter.

### 4.2 Evaluation
- Unknown/`unavailable` token → typed zero/empty with an **availability flag**; a flow may test availability (e.g. an `if` whose `cond` references an unavailable state takes the safe/else path). This composes with the PAL "unavailable" contract (2G).
- Type mismatches resolve by documented coercion rules or fail the node (recorded, §8) — never crash the engine.

## 5. Variables & scope

- **Global `var.*`** — typed, persisted (SQLite `variables`, 2B), bindable by widgets (2B §2.4). The durable shared memory of automations.
- **Local scope per run** — a flow run has a transient scratch scope for intermediate values (Touch Portal's "local states," improved). Locals never persist and never fan out; they avoid the incumbent anti-pattern of creating a global for every temporary calculation.
- Resolution order in expressions: local scope → global `var.*` → states.

## 6. Triggers

A flow declares one trigger; the engine arms it.

| kind | Armed via | Fires when | Phase |
|------|-----------|-----------|-------|
| `manual` | widget interaction slot (2C) | user gesture targets the flow | 1 |
| `event` | event bus subscription (2B §4) | a named engine event occurs (e.g. `threshold.cpu_temp`) | 1 |
| `stateChange` | state-watch on the store (2B §2.2) | a watched state crosses a condition (`when` expr) | 1 |
| `schedule` | scheduler | cron/time match | 3 (field reserved in V1) |

`stateChange` triggers are edge-triggered (fire on the crossing, not every tick while true) with optional debounce, so "CPU > 85" doesn't re-fire 60×/min. The event architecture from the old design becomes a **consumer** of this trigger model.

## 7. Execution runtime & semantics

### 7.1 Host-side, async, isolated
- Flows run **on the engine** as supervised async tasks (Go goroutines with a context — ADR-0005); the client that triggered only sends the interaction event (2C) and receives resulting state changes back via the State channel (2A).
- Each run gets an isolated **run context**: run-id, local scope, the triggering device (for `navigate`), a cancellation handle, and a step cursor.

### 7.2 Step loop
```
run(flow):
  ctx = newRunContext(trigger, device)
  node = flow.nodes[flow.entry]
  while node != null and not ctx.cancelled:
     audit(flow.run step) [debug level]
     node = dispatch(node, ctx)        // returns next node id resolved
  audit(flow.run completed | stopped | failed)
```
`dispatch` evaluates the node by kind (§3); `action` nodes await the action result (via plugin IPC, 2F) before continuing; `wait` reschedules the cursor after the delay without holding a thread.

### 7.3 Concurrency
- Multiple flows (and multiple runs of the same flow) may run concurrently; each has its own context and local scope. Global `var.*` writes are serialized through the state store (2B), last-write-wins (Master/ADR-0014).
- A `stateChange`/`event` flow already running when it re-triggers: V1 policy = **allow concurrent runs** with a per-flow max-concurrency cap; (queue/debounce policies are a per-flow option to refine in the Phase 3 deep dive).

### 7.4 Permissions & audit
- An `action` node invokes through the engine's action path, so **device permissions still apply** when the flow was manually triggered by a device; **system/event/stateChange-triggered** flows run as actor `flow:<id>` and are bounded by the flow's own configuration (a flow cannot do what no action permits).
- Every run is audited (`flow.run`, `flow.failed`) and every action it invokes is audited (2E §6).

## 8. Failure, cancellation, safety

- **Per-node failure behavior**: a node may declare `onError: continue | stop | branch(target)` (default `stop`). Failures log the failing node id + reason (FR-10.7).
- **Cancellation**: a run is cancellable (ctx cancel) — e.g. user stops it, engine shutdown, or a supersede policy. `wait`/`loop` honor cancellation promptly.
- **Runaway protection**: `loop` has a max-iteration cap; total run has a wall-clock budget; exceeding either fails the run safely (audited).
- **No engine impact**: a failing/throwing node never crashes the engine — the run fails, is recorded, and other runs proceed (mirrors the plugin-isolation discipline of 2F).
- **Expression safety**: the sandbox (no eval/IO/host calls) means imported/shared flows cannot run arbitrary code; side effects are only via permission-gated registered actions (2E TB-5).

## 9. Composition (subflows) & the registry seam

- **`subflow`** invokes another flow synchronously and returns on completion, enabling reusable building blocks (e.g. a "notify me" subflow). Recursion is bounded by the run wall-clock + a depth cap.
- **Node extensibility**: the executor dispatches by `kind` against the **flow-node registry** (2B §3.3). Core nodes are registered at boot; **Phase 6 plugin nodes** (HTTP request, parallel/fork, vendor-specific) register identically and the executor dispatches them with no core change — the same one-model principle as capabilities (ADR-0006). The **visual flow builder UI** (Phase 3) reads node + action schemas to render its palette and param editors, exactly as the layout Designer does for widgets/actions (2C §8.2) — the unification of automation authoring and the registries.

## 10. Normative requirements

| ID | Requirement | Trace |
|----|-------------|-------|
| TD-1 | Flows SHALL be stored, versioned, and executed host-side; clients SHALL only trigger. | ADR-0013, FR-10.1 |
| TD-2 | The V1 node set SHALL include action, if/else, setVar, wait, loop, navigate, random, subflow, stop. | FR-10.2 |
| TD-3 | Conditions/values SHALL use a sandboxed expression language with token interpolation; arbitrary code execution SHALL NOT be possible. | ADR-0013, FR-10.3, 2E TB-5 |
| TD-4 | Token resolution SHALL use typed state/var values (numeric comparison, not string). | ADR-0019, FR-10.3 |
| TD-5 | An expression referencing an unavailable state SHALL resolve safely with an availability flag, never crash. | 2G, §4.2 |
| TD-6 | `var.*` SHALL be global/persistent and bindable; each run SHALL have a transient local scope. | FR-10.4/10.6 |
| TD-7 | Triggers SHALL include manual, event, stateChange in V1; schedule SHALL be a reserved field. | FR-10.5, Doc 0 §12 |
| TD-8 | `stateChange` triggers SHALL be edge-triggered with optional debounce. | §6 |
| TD-9 | Runs SHALL be cancellable; `wait`/`loop` SHALL honor cancellation; `loop` SHALL be iteration-capped. | FR-10.7, §8 |
| TD-10 | A failing node SHALL fail the run safely (logged with node id) and SHALL NOT crash the engine. | FR-10.7, §8 |
| TD-11 | Manually-triggered flows SHALL respect the triggering device's permissions; all runs and invoked actions SHALL be audited. | 2E §5/§6 |
| TD-12 | Node kinds SHALL be registry-dispatched so plugin nodes (Phase 6) add without core changes. | ADR-0006, §9 |

---
*End of TRD 2D (Draft v0.1). This completes the federated TRD set (2 + 2-ADR + 2A–2G). Next: per-phase deep dives, beginning with Phase 1.*
