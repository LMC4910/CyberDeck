# Generated contract types

**Do not edit these files by hand.** Everything in this directory is generated from the JSON Schema contract in `shared/schemas/` by `ide/scripts/gen-types.mjs`.

## Regenerate

```
task gen:types      # or, from ide/:  pnpm gen:types
```

This regenerates the per-schema `.ts` files, the `route-ids.ts` union, the `index.ts` barrel, and the OpenAPI export (`shared/schemas/control-plane/openapi.v1.json`).

## Drift gate

CI (the `ide` job) regenerates and runs `git diff --exit-code`. If the committed output differs from a fresh generation, the build fails — schema and types can never silently diverge. When you change a schema, run `task gen:types` and commit the regenerated files in the same change.

## Usage

Kernel and feature code import contract types **only** from the barrel:

```ts
import type { CyberDeckFeatureFlags, RouteId } from '@/shared/contract'
import { ROUTE_IDS } from '@/shared/contract'
```

Never import from a raw schema or hand-write a mirror of these shapes. The barrel re-exports each generated type once (shared `$ref`/`$defs` like `StableId` are declared in several files but exported from the first alphabetically).
