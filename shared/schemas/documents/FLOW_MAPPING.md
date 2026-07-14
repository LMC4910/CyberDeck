# Flow document ↔ `core/flow` model mapping (CD-112)

`cyberdeck.flow` (`flow.schema.json`) serializes 1:1 onto the engine's Go model (`engine/core/flow/model.go`) so an IDE-authored flow deploys without translation ambiguity. ENG sign-off target.

## Field mapping

| Schema (`cyberdeck.flow`) | Go (`core/flow`) | Note |
|---|---|---|
| `id` | `Flow.ID` (`json:"id"`) | schema adds the stable-id pattern; engine accepts any string |
| `label` | `Flow.Label` (`json:"label"`) | |
| `version` | `Flow.Version` (`json:"version"`) | monotonic; whole-doc persistence (2D §3, ADR-0022) |
| `armed` | *(no field)* | arm state lives in `TriggerManager.armed` at runtime, not in the persisted doc — schema carries it for round-trip so the IDE can show armed state; engine ignores unknown JSON keys |
| `trigger.kind` | `Trigger.Kind` (`json:"kind"`) | enum = `manual/event/stateChange/schedule` (triggers.go constants) |
| `trigger.config` | `Trigger.Config` (`json:"config,omitempty"`) | free `map[string]any` engine-side; schema constrains it per-kind (below) |
| `nodes[].id` | `Node.ID` (`json:"id"`) | |
| `nodes[].kind` | `Node.Kind` (`json:"kind"`) | validated against the flow-node registry (PROJ-161) |
| `nodes[].params` | `Node.Params` (`json:"params,omitempty"`) | per-kind param schemas registered by the node catalog (CD-114) |
| `edges[].from` | `Edge.From` (`json:"from"`) | |
| `edges[].to` | `Edge.To` (`json:"to"`) | |
| `edges[].label` | `Edge.Label` (`json:"label,omitempty"`) | same field name. Schema constrains it to the `true/false/always` branch catalog; the engine's free-string `Label` accepts a superset (e.g. `next`) so any authored flow round-trips |

## Trigger config by kind (triggers.go)

| kind | required config | consumed by | V1 status |
|---|---|---|---|
| `manual` | — | `FireManual(flowID)` (interaction slot) | live |
| `event` | `event` (topic string) | `consume(topic…)` on the bus | live |
| `stateChange` | `expr` (+ optional `stateId`, `debounce` ms) | `evalStateChange` — edge-triggered (false→true), debounced (default 250 ms) | live |
| `schedule` | `cron` \| `interval` | *(none)* — accepted + stored, never fires | reserved (V1) |

## Known deviations

1. **`armed` is presentation-only** in the document; the engine's authoritative arm state is runtime (`TriggerManager`). The schema field exists so IDE save/load round-trips it; the engine neither reads nor persists it (unknown JSON key, ignored by `ParseFlow`).
2. **Per-node param schemas** are declared by the node catalog (CD-114), not inline here — this schema validates the graph shape and node-kind vocabulary; params are `object` until the catalog registers each kind's schema.
3. **`edges[].label` is constrained** to `true/false/always` in the schema while the engine allows any string — the schema is the stricter authoring contract; every schema-valid flow is engine-valid, not vice-versa.
