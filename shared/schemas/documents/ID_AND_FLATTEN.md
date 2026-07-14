# Document ID rules & publish flattening (CD-111)

Invariants for `cyberdeck.project` (authoring truth) and `cyberdeck.layout` (published, player-facing). Both schemas live in this directory; fixtures under `fixtures/`.

## 1. ID stability rules (AUDIT C3)

1. **Every entity is keyed by an opaque stable id** matching `^[a-z][a-z0-9]*_[a-z0-9][a-z0-9-]{5,}$` (`w_9f3ka01`, `page_home01`, `cmp_statcard1`). The prefix is a readability hint only — it carries no semantics.
2. **IDs are never derived from display names.** `name` is presentation-only; renaming a widget must not touch any key. *Violation example:* keying `bindings` by `"CPU Load"` — renaming the widget orphans its bindings (this is exactly the pre-Phase-30 prototype bug `rekey()` existed to fix).
3. **IDs are allocated once** (UUID-derived, per the design's `uid()`), **never reused** after deletion, and **never regenerated** on load/save round-trips. *Violation example:* re-issuing ids at import — every device assignment and flow event reference breaks.
4. **Referential closure:** every key of `bindings`/`states`/`events`, every member of `locks`, every `devices[].pageId`, every instance `component`/`variant` ref must resolve to an entity in the same document. The schema cannot express this (JSON Schema has no cross-tree joins); ProjectService validates it on save and the contract suite covers it (CD-135).
5. **Cross-document references** (events → flow ids) use the flow document's stable id; deleting a flow leaves a *dangling-ref diagnostic*, never a silent rewrite.
6. **Migration:** the design prototype's localStorage serialization (`version: 1` with flat `widgets[]` + `registries{}`) is treated as **pre-v1**; its importer maps `registries.bindings/states/events/locks` onto the top-level fields, wraps the flat widget list in a single default page, and runs `rekey()` for any name-keyed registry entries. From schema v1 onward, migrations follow the CD-109 registry convention (single-hop, per-document, newer-than-app rejected).

## 2. Publish flattening (`cyberdeck.project` → `cyberdeck.layout`)

Per **Q2 default: the engine flattens at publish** — players stay thin interpreters. One layout document is produced **per device**, containing the page(s) assigned to it.

| Authoring concept | Flattened result |
|---|---|
| Component instance (`component`/`variant`/`overrides`) | Expanded to plain widgets. Expanded ids are deterministic: `<instanceId>-<templateWidgetId>` — republish never changes them, so player-side state survives |
| Props resolution | base props ← variant overrides ← instance overrides (left→right, CD-109 merge rules) |
| `frame` (px on the authoring canvas) | `placement` (grid cells): the page canvas maps onto the device grid; spans rounded to ≥ 1 cell |
| `bindings` mode `variable` | `appearance.stateBinding` = the variable's state id |
| `bindings` mode `expression` | engine-registered derived state + `stateBinding` to it; presentation-only expressions become `appearance.valueRules` |
| `bindings` mode `static` | folded into `config` / `appearance.style` |
| `states` (`active`, `ov`) | active-state overrides applied; remaining state machine ships as `valueRules` where the player can evaluate it |
| `events` (gesture → flowId) | `interaction` map (gesture → engine action ref) |
| `locks` | dropped (authoring-only concern) |
| `assets` | URIs rewritten to engine-served asset routes |
| `devices` | selects which pages land in which device's layout doc |

The layout `version` is a monotonic per-device publish revision; players use it for staleness detection and delta acceptance (existing `LayoutPage.version` semantics).

## 3. Desk check vs the existing player render model (MOB)

`layout.schema.json` **pages mirror `client/lib/render/model.dart` field-for-field** (2026-07-14):

| Schema | client model | Match |
|---|---|---|
| `pages[].id/grid/version/widgets` | `LayoutPage.fromJson` | ✔ same names, same defaults (version 0) |
| `grid.columns/rows/gutter/marginX/marginY/background/deviceClass` | `GridConfig.fromJson` | ✔ same names + defaults (24/18/8/16/16) |
| `widgets[].id/type/placement/appearance/interaction/config` | `WidgetNode.fromJson` | ✔ |
| `placement.col/row/colSpan/rowSpan` | `Placement.fromJson` | ✔ defaults 1 for spans |
| `appearance.style/stateBinding/valueRules` | `Appearance.fromJson` | ✔ |

Deltas the player does **not** yet read (safe — `fromJson` ignores unknown keys): the top-level envelope (`format`, `version`, `projectId`, `publishedAt`, `device`), and `pages[].name`. The engine's deck source currently hands the client one page at a time; adopting the envelope is an M5/M7 change, not a render-model change.
