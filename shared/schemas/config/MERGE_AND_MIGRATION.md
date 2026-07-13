# Config layer merge & migration (CD-109)

Spec for how the six config areas (CD-108 schemas in this directory) merge across layers and how documents move between schema versions. Implemented by ConfigurationService (CD-117/118); this document is the contract it is tested against.

## 1. Layer precedence

```
defaults ← application ← user ← workspace ← runtime
```

Rightmost wins. `defaults` are the values baked into each schema (`default` keywords); `application` ships with the install; `user` and `workspace` are the persisted documents in the user config dir; `runtime` is in-memory only (dev overrides, failure injection) and never persisted.

Not every area exists at every layer — e.g. `application` config has no user/workspace layer (it isn't user-editable, see each schema's `x-editability`). A write goes to the **owning layer** (write-behind, debounced); reads always come from the merged view.

## 2. Merge algorithm

Merging happens **per area**, walking both documents key-by-key:

| Site | Rule |
|---|---|
| **Scalar** (string/number/boolean/null) | higher layer replaces lower — always, even `null` |
| **Object** | deep-merge key-wise; keys present only in the lower layer survive |
| **Array** | **replace atomically** — the higher layer's array is taken whole; never concatenated, never merged element-wise. If a higher layer needs to add one array element (e.g. one keymap binding), it must carry the full array. Element-wise merging (`byId`) is deliberately out of scope until a real use case forces it — it would need per-schema annotations and stable element ids |
| **Type conflict** (see §4) | higher layer replaces lower, whole subtree |

### Delete markers

A higher layer removes a key the lower layer sets by writing the sentinel:

```json
{ "theme": { "$unset": true } }
```

- `$unset` deletes the key from the merged view (falling through to *nothing*, not to the lower layer's value — to expose the lower value, delete the marker itself).
- `$unset` is only meaningful in a layer document; it never appears in the merged output and is stripped by validation-on-merge.
- Using `null` as a delete marker is forbidden: `null` is a legitimate value (`openProjectId: null` in the session schema).

### Validation

Layer documents are validated against the area schema **before** merge (with `$unset` markers stripped for the check); the **merged** document is validated again after merge. A layer that fails validation is skipped with a diagnostic — a broken user file must not take down boot (boot stage 2 falls back to the layers below).

## 3. `SettingsChanged` delta shape

Every merged-view change emits one event per changed path on the EventBus (CD-120):

```jsonc
{
  "type": "SettingsChanged",
  "area": "user-prefs",            // one of the six area ids
  "path": "theme.mode",            // dot-path into the merged document
  "value": "light",                // new merged value; absent if the path was removed
  "previous": "dark",              // old merged value; absent if the path was added
  "layer": "user",                 // which layer's write caused the change
  "revision": 42                   // monotonic per-area counter for ordering
}
```

- Deltas are computed on the **merged view**, not the layer document — a user write shadowed by a runtime override emits nothing.
- Array replacement emits a single delta at the array's path (not per element).
- Subscribers filter by `area` + `path` prefix.

## 4. Edge cases (enumerated)

| # | Lower layer | Higher layer | Merged result |
|---|---|---|---|
| 1 | scalar `"a"` | scalar `"b"` | `"b"` |
| 2 | scalar | object | the object (replace; no attempt to graft) |
| 3 | object | scalar | the scalar (whole subtree gone) |
| 4 | object `{a,b}` | object `{b,c}` | `{a, b:higher, c}` (deep merge) |
| 5 | array | array | higher array, atomically |
| 6 | array | object/scalar | higher value (type conflict → replace) |
| 7 | scalar/object | array | higher array |
| 8 | value | `null` | `null` (null is a value, not a delete) |
| 9 | value | `{"$unset": true}` | key absent from merged view |
| 10 | absent | `{"$unset": true}` | key absent (marker is a no-op) |
| 11 | `{"$unset": true}` in lower, value in higher | — | higher value (markers only mask lower layers) |
| 12 | key unknown to schema | anything | merged doc fails post-merge validation → layer skipped with diagnostic |
| 13 | different `version` stamps between layers | — | each layer is migrated to the current version **before** merge (§5); merging mixed versions is never attempted |

## 5. Migration convention

Each area has a **migration registry**: an ordered list of pure functions, one per version step. A document loads → its `version` is read → every step from that version to the current one runs in order → the result must validate against the current schema.

```ts
// shape (implemented in CD-118)
type Migration = {
  from: number            // migrates from `from` to `from + 1`
  migrate: (doc: unknown) => unknown  // pure; never mutates its input
}
const registry: Record<Area, Migration[]> = { /* one list per area */ }
```

Rules:

- `version` in every schema is `const <current>`; bumping it **requires** landing the migration step in the same change (the schema tests fail otherwise, since old fixtures stop validating).
- Steps are single-version hops (`1→2`, `2→3`), applied in sequence — no skip-level migrations.
- Migrations run per **layer document** before merge (§4 case 13).
- A document *newer* than the app understands is not migrated down; it is rejected with a "created by a newer version" diagnostic and the layer is skipped.
- Keep at least one fixture per superseded version under `fixtures/<area>/vN/` so the migration path stays covered by tests.

### Worked example: user-prefs v1 → v2

Say v2 replaces the free-string `keymap` with an object that also captures the platform it was authored for:

```jsonc
// v1 (today)                      // v2 (hypothetical)
{ "version": 1,                    { "version": 2,
  "keymap": "default" }              "keymap": { "id": "default", "platform": "win" } }
```

The registered step:

```ts
{
  from: 1,
  migrate: (doc) => {
    const d = structuredClone(doc) as Record<string, unknown>
    d.version = 2
    if (typeof d.keymap === 'string') {
      d.keymap = { id: d.keymap, platform: 'win' }  // sensible default for the new field
    }
    return d
  }
}
```

Landing this requires, in one change: schema `version` → `const 2`, new field definitions, the step above in the registry, existing v1 fixtures moved to `fixtures/user-prefs/v1/`, and fresh v2 fixtures — CI (ajv + Go twin tests) enforces the lockstep.
