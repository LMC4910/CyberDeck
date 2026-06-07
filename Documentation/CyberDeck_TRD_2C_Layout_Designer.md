# CyberDeck — TRD 2C: Layout & Designer

**Subsystem TRD · Document 2C** · Version 0.1 (Draft) · June 2026
Inherits TRD Master §6. Governing ADRs: **0003, 0011, 0012, 0017, 0018** (registries 2B; channels 2A).

## Contents
1. Scope & responsibilities
2. The layout document model
3. The widget model (appearance / interaction / config)
4. Operation log & versioning
5. Sync model (engine ↔ devices)
6. Undo / redo
7. Client rendering contract
8. The Designer (desktop-only)
9. Normative requirements

---

## 1. Scope & responsibilities

Owns: the **layout document tree** (profiles/pages/widgets), the **operation log** and versioning, the **sync model** that reflects edits to devices, the **client rendering contract**, and the **desktop-only Designer**. Consumes the registries (2B) to know what widgets/actions/states exist, the channels (2A) to move ops/previews, and the session model (2B) for targeting. Authoring is **desktop-only and permanent** (ADR-0018); layouts are **per-device-class** (ADR-0017).

## 2. The layout document model

```
Profile  (2B owns persistence; 2C owns shape)
  └─ Page
       ├─ GridConfig
       └─ Widget[]
```

### 2.1 GridConfig (no caps — ADR-0017)
```jsonc
{ "columns":24, "rows":18, "gutter":8, "marginX":16, "marginY":16,
  "cellAspect":"fill",            // square | fill
  "background":{ "type":"gradient", "from":"#141428", "to":"#0D0D1A" },
  "deviceClass":"tablet-landscape-10" }   // layout authored FOR this class (ADR-0017)
```
No column/row/widget caps (a deliberate rejection of the incumbents' 15×15/110-button limits).

### 2.2 DeviceClass
```jsonc
{ "id":"tablet-landscape-10", "label":"10\" Tablet (landscape)",
  "orientation":"landscape", "referenceResolution":[1280,800], "gridDefaults":{…} }
```
A device is assigned a class at pairing (2E `device_class`); the Designer authors against the class, and the matching layout is served to devices of that class. **No auto-reflow across classes in V1** (ADR-0017); adaptive layouts are a later candidate on this same model (Doc 0 §12).

## 3. The widget model (three independent concerns)

The separation of appearance / interaction / config is the source of the product's flexibility (Doc 0 §3.2).
```jsonc
{
  "id":"w_8f3a", "type":"gauge.circular",                 // type ∈ widget-type registry (2B §3.2)
  "placement":{ "col":3,"row":4,"colSpan":2,"rowSpan":2 },

  "appearance":{                                           // (a) looks; may follow state
    "style":{ "theme":"neon-cyan","label":"CPU","showValue":true },
    "stateBinding":"system.cpu.temp",
    "valueRules":[ {"when":">85","style":{"theme":"status-error","icon":"alert"}} ] // client-side, zero-latency
  },

  "interaction":{                                          // (b) each gesture independent
    "tap":{"target":"action","ref":"media.play"},
    "doubleTap":{"target":"action","ref":"media.next"},
    "longPress":{"target":"flow","ref":"flow_morning"},
    "dragValue":{"target":"action","ref":"media.volume.set","param":"level"},
    "swipeLeft":{"target":"navigate","ref":"page_2"}
  },

  "config":{ "min":0,"max":100,"unit":"°C","sparkline":true } // (c) per-type, validated vs registry schema
}
```
- **Appearance** binds to a state (filtered by the type's `acceptsStateKinds`); `valueRules` are evaluated **client-side** for instant visual feedback (the gauge turns red ≥85°C without a round-trip).
- **Interaction** slots (`tap, doubleTap, longPress, pressDown, pressUp, dragValue, swipe*`) each independently target `action | macro/flow | navigate | none`. The full slot set is defined in V1; designer UI for `tap/longPress/dragValue` is V1, the rest Phase 2 (Doc 0 §12).
- **Config** is validated against the widget type's `configSchema` (2B §3.2).
- **No overlap** (ADR-0017 placement rule): a placement colliding with an existing widget is rejected or pushed; z-index is avoided in V1.

## 4. Operation log & versioning (ADR-0012)

Every edit is a **versioned operation** applied to the authoritative document (held by the engine). The op log is the substrate for instant reflection, undo/redo, multi-device sync, and future collaboration — one mechanism, four payoffs.

### 4.1 Operation set (V1)
`AddWidget, RemoveWidget, MoveWidget, ResizeWidget, SetStyle, SetBinding, SetInteraction, SetConfig, AddPage, RemovePage, ChangeGrid, AddProfile, SetProfileActivation`.
```jsonc
{ "op":"MoveWidget", "docVersion":412, "pageId":"page_2",
  "widgetId":"w_8f3a", "from":{"col":3,"row":4}, "to":{"col":5,"row":4} }
```

### 4.2 Versioning
- Each document carries a **monotonic version**; an applied op increments it.
- Clients track **last-applied version**; a `seq`/version gap (2A) → **full document resync** (never replay gaps — the engine is the single source of truth, ADR-0002).
- The op log is persisted enough to support undo within a session; long-term it's the document `version` in SQLite (2B) that matters for resync.

### 4.3 Concurrency (V1)
**Single-writer edit lock** per document: one Designer edits a given profile at a time. This sidesteps CRDT/OT entirely in V1; the op log nonetheless *is* the collaboration substrate, so the Phase 8 multi-author feature layers conflict resolution on the same log (Doc 0 §12) without redesign.

## 5. Sync model (engine ↔ devices) (ADR-0011, ADR-0012)

### 5.1 Channels used
- **Layout channel** (durable, ordered): committed ops engine→device; interaction/action events device→engine.
- **Preview channel** (ephemeral, droppable, never persisted): live-drag ghosts during authoring.

### 5.2 Edit → device flow (TRD Master DF-C, expanded)
```
Designer drag begins
  → throttled ghost positions (30–60Hz) ⇒ Preview channel ⇒ target device
     (device shows the widget moving; nothing persisted)
Designer drops
  → Designer emits durable op (e.g. MoveWidget) → engine
  → engine applies to authoritative doc (vN→vN+1), persists (2B)
  → broadcasts op ⇒ Layout channel ⇒ all sessions subscribed to that profile in edit/preview mode
  → each client applies op → repaints ONLY the affected widget (diff, not full redraw)
```
Result: the headline demo — drag a gauge on the PC, watch it appear on the tablet in real time — with clean durable history (one op) and a premium live feel (ephemeral ghosts). Targets: op→reflection <200ms (NFR-02).

### 5.3 Runtime vs edit mode
A session is in **runtime** (State updates only) or **edit/preview** (State + Layout ops + Preview ghosts). A device flips to edit/preview when the Designer targets the profile it's showing, so authors can watch live; otherwise devices stay in runtime and never receive op/preview traffic.

## 6. Undo / redo (ADR-0012)

Every op has an **inverse** (e.g. `MoveWidget A→B` ⟷ `MoveWidget B→A`; `AddWidget` ⟷ `RemoveWidget`). Undo applies the inverse (a new op, version-incrementing) and broadcasts it like any edit, so devices reflect undo instantly too. Redo re-applies. The undo stack is per-document, per-edit-session.

## 7. Client rendering contract (ADR-0003)

The client is a **deterministic renderer** of the layout doc (host-authority — ADR-0002).

### 7.1 Renderer registry
`widgetType → native builder`. On receiving a layout doc, the client builds the widget tree once. V1 core vocabulary (button, toggle, slider, label, image, circular gauge, linear gauge/bar, sparkline, media card, page-nav) maps to native Flutter builders. Plugin-provided widget types (Phase 6) register additional builders (the registry contract exists in V1).

### 7.2 Repaint discipline
- A **state update** repaints only widgets subscribed to that state (2B subscription set ← the doc's bindings).
- A **layout op** diffs the tree and rebuilds only affected nodes.
- `valueRules` are applied client-side on each state update (no round-trip), keeping conditional styling within the 60 FPS budget (NFR-03).
- An unknown widget type (e.g. a plugin not present) renders a safe placeholder, never a crash.

### 7.3 Degradation
On disconnect (2A §7.3): bound widgets show last value dimmed + connection badge; `unavailable` capabilities show `--`. The renderer never fabricates live data.

## 8. The Designer (desktop-only — ADR-0018)

A reader of the registries (2B) and an emitter of ops (§4). Lives in the client codebase, enabled only for desktop targets.

### 8.1 Canvas
WYSIWYG grid rendering the page exactly as the target device class will (same renderer registry as the client, §7). Snap-to-grid; no overlap (§3).

### 8.2 Drag-drop & mapping (the deep model)
| Designer action | Emits |
|-----------------|-------|
| Drag widget type from palette onto a cell | `AddWidget` |
| Move/resize (with live preview ghosts) | `MoveWidget` / `ResizeWidget` on drop |
| Bind appearance (inspector lists states filtered by `acceptsStateKinds`) | `SetBinding` |
| Map a gesture slot to a target | `SetInteraction` |
| Edit style / `valueRules` | `SetStyle` |
| Edit type-specific config | `SetConfig` |
| Change grid / background | `ChangeGrid` |

**The keystone**: when mapping a gesture to an action, the inspector reads the action's **param schema** (2B §3.1) and **auto-generates the parameter editor** — `int 0–100` → slider, `choice` → dropdown, `entity` → smart-home entity picker. Therefore **every action, first-party or third-party plugin, is fully editable with zero designer code changes** (the unification of designer + ecosystem, ADR-0006).

### 8.3 Explicit device targeting (FR-8.8)
The Designer always shows its target: *"Editing: Living Room iPad · UUID a3f… · 10×6 landscape."* Ops route only to that device's assigned layout and its sessions. Authoring a class with multiple assigned devices updates all of them.

### 8.4 Profiles
Create/assign/activate profiles; set the activation rule (stored + hook in V1; auto-switch consumer Phase 2). Assign a profile to a device class.

## 9. Normative requirements

| ID | Requirement | Trace |
|----|-------------|-------|
| TC-DOC-1 | A layout SHALL be a Profile→Page→Widget tree with a GridConfig per page. | Doc 0 §3.1 |
| TC-DOC-2 | Grid config SHALL be fully customizable with no column/row/widget caps. | FR-8.2, ADR-0017 |
| TC-DOC-3 | A layout SHALL be authored against a specific device class; no auto-reflow in V1. | ADR-0017, FR-8.3 |
| TC-WID-1 | A widget SHALL separate appearance, interaction, and config. | Doc 0 §3.2 |
| TC-WID-2 | Each gesture slot SHALL independently target action/macro/flow/navigate/none. | FR-9.3/9.4 |
| TC-WID-3 | `valueRules` SHALL be evaluated client-side for zero-latency conditional styling. | FR-9.5 |
| TC-WID-4 | Widgets SHALL NOT overlap; conflicting placement SHALL be rejected or pushed. | FR-8.9, ADR-0017 |
| TC-OP-1 | Every edit SHALL be a versioned operation applied to the authoritative document. | ADR-0012, FR-8.4 |
| TC-OP-2 | Ops SHALL broadcast to subscribed sessions; clients SHALL repaint only affected widgets. | FR-8.5, NFR-02 |
| TC-OP-3 | Each op SHALL have an inverse enabling undo/redo. | FR-8.6, ADR-0012 |
| TC-OP-4 | Drag previews SHALL ride the Preview channel and SHALL NOT be persisted; a durable op commits on drop. | FR-8.7, ADR-0011 |
| TC-OP-5 | A version/seq gap SHALL trigger a full document resync, not gap replay. | FR-5.5, ADR-0012 |
| TC-OP-6 | V1 SHALL use a single-writer edit lock per document. | §4.3 |
| TC-REN-1 | The client SHALL render via a widgetType→native-builder registry; unknown types SHALL render a safe placeholder. | ADR-0003, FR-9.2 |
| TC-REN-2 | State updates SHALL repaint only subscribed widgets; layout ops only affected nodes. | NFR-03 |
| TC-DSGN-1 | Authoring SHALL be desktop-only; clients SHALL NOT edit layouts. | ADR-0018, FR-8.1 |
| TC-DSGN-2 | The inspector SHALL auto-generate parameter editors from action/config schemas with no per-action UI code. | FR-7.2, ADR-0006 |
| TC-DSGN-3 | The Designer SHALL always display its explicit target device. | FR-8.8 |

---
*End of TRD 2C (Draft v0.1). Flow targets referenced by interaction slots are defined in 2D; registry schemas the inspector reads are in 2B.*
