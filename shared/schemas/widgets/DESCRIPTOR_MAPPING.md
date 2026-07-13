# Widget descriptor v1 → manifest v2 mapping (CD-110)

For ENG: how the engine's current widget descriptor (`shared/schemas/widget.schema.json`, enforced by PROJ-161) maps onto the v2 manifest (`shared/schemas/widget-manifest.schema.json`). v1 stays untouched — the live engine and Flutter client validate against it until the M5 engine swap; new IDE code consumes only v2.

## Field mapping

| v1 descriptor | v2 manifest | Note |
|---|---|---|
| `type` | `id` | same value, same uniqueness rule |
| `label` | `metadata.label` | |
| `source` | *(dropped)* | provenance now comes from the owning extension bundle; engine keeps `source` internally |
| `acceptsStateKinds` | `acceptsStateKinds` | identical vocabulary (`scalar, text, boolean, enum, series`) |
| `configSchema` (array of `{name, type, default}`) | `configSchema` (a real JSON Schema) + `defaults` | mechanical transform: each `{name, type, default}` → a property in the schema; defaults collected into `defaults` |
| `gestures` | `gestures` | identical |

## Engine descriptor gaps (fields v2 adds that the engine has no concept of)

1. `version` (semver) — engine descriptors are unversioned.
2. `metadata.icon/category/description/tags` — engine only knows `label`.
3. `permissions` — engine has plugin-level permissions (TRD 2E) but nothing per-widget; the PERMS() vocabulary must be enforced at registration when the engine adopts v2.
4. `dependencies` (platform range, widget deps) — no dependency resolution exists engine-side.
5. `dataProvider` — engine pushes state to widgets; the repo/subscribe indirection is IDE-side only until M5.
6. `refresh` (push/poll/manual) — engine is push-only today.
7. `caching` — no per-widget cache policy engine-side.
8. `lifecycle` (lazy, chunk) — meaningless to the engine; consumed by the IDE bundler/registry only.
9. `actions` — engine has flow-level actions; per-widget action declarations are new.
10. `events` (subscribes/emits) — engine event topics exist but are not declared per widget type.
11. `persistedState` — engine persists whole widget state blobs; the explicit key list is new.

Adoption order (M5): engine learns to *read* v2 manifests and ignore what it doesn't enforce (2, 5–8, 11 are safe to ignore), enforcing `permissions` (3) and `dependencies` (4) at registration.
