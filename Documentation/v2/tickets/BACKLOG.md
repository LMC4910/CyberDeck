# BACKLOG — out-of-scope for v1.0 (do not pull into a milestone without a PM decision)

Rule (from `00_INDEX.md`): anything not covered by a CD ticket lands here, not in the current milestone. Reviewed at every gate ticket. Items graduate by getting real CD IDs in a post-GA milestone file.

## Post-GA roadmap seeds (deferred by decision — see Blueprint §0)

- **Marketplace UI** (D1) — extension browsing/one-click install; loading + SDK already ship in v1 (flag `marketplace` dark). Depends: CD-605 package signing hardening.
- **Cloud Sync** (D2) — workspace/project sync service + conflict model (flag `cloudSync` dark). Large: needs a hosted component, auth, CRDT/merge strategy (ProjectModel was kept CRDT-ready — `01` §3 ProjectService note).
- **Monetization/licensing** (D3) — none in v1; revisit after adoption data.
- **Bundled AI provider** (D7) — AIService interface + flag ship in v1; provider integration + key management + AI panel UX later.
- **Collaboration / presence** — design shows collaborator avatars; needs session channel + shared-document layer (pairs with Cloud Sync).
- **macOS/Linux Player builds** (D8 extension) — same Flutter codebase; packaging + input QA only.
- **Store listings** — CD-815 executes post-GA per D5; keep review-compliance notes current.
- **Remote (non-LAN) access** — relay/tunnel with end-to-end crypto; explicit non-goal for GA (`00` §6).
- **Hardware deck peripherals** — USB/BLE device-driver plugin family (DeviceDriver contribution point exists conceptually — Platform Note `plugin`).

## Deferred design-parity items (from the design project's own deferrals)

- Full `role=tree`/`role=tablist` semantic pass beyond CD-801 scope (design AUDIT H6 "pass 2" leftovers, e.g. `<s>`→`<span>` semantic rename equivalents in the rebuilt UI — moot where the new implementation used correct elements from day 1; verify at CD-801).
- Live document mirroring extras (AUDIT M11 tail): device mocks in the Devices workspace rendering the *live editing* board in addition to published layouts.
- Extension marketplace surface in the design file (never built in the prototype either).

## Known nice-to-haves parked during ticket authoring

- Palette command aliases / abbreviation matching (beyond CD-207 fuzzy+recents).
- Theme editor UI (themes are files/extensions in v1; CD-134 pipeline supports it).
- Flow subflow library / reusable flow templates (Structure nodes exist; a template gallery does not).
- Runtime log export/share (diagnostics ZIP covers the support case — CD-617).
- Per-widget data-provider polling configuration UI (manifest `refresh` honored; no per-instance override UI).
- Variables import/export (design FEATURES lists it; not GA-critical).

## Discovered during implementation

- **Contract suite: per-field response validation vs document schemas** (2026-07-15, CD-135). The contract suite currently asserts route resolution + Page structure + the error model, but does not validate each returned document against its strict response schema. Blocker: the MockApiGateway keys docs by a top-level `id` that the document schemas (`documents/*.schema.json`, `additionalProperties:false`, no top-level `id`) reject. Fix needs a seed/schema alignment (either an id-bearing "stored entity" wrapper schema, or the mock keying id out-of-band). Revisit alongside M5 EngineGateway parity (the engine returns real docs).

- **Command palette list virtualization** (2026-07-15, CD-206). The palette renders all context-filtered results in a scrollable list (max-height + overflow). With the current ~26-command registry this is fine; once extensions contribute many commands, add windowing/virtualization to the `palette-list`. Non-blocking — reachability/keyboard/axe all hold today.

<!-- Append new items below with date + source ticket/gate. -->

- **Publish flatten: instance-id registry entries unmapped (v0 gap)** (2026-07-17, CD-416). `flattenProject` maps bindings/states/events keyed on plain-widget or template-widget ids, but NOT entries keyed on a *component-instance's* page id (the instance node dissolves into multiple widgets, so there's no single expansion target). Goldens deliberately avoid instance-id registries. Reconcile before/at M5: either the Go port (CD-506) matches this exactly, or extend the contract to fan instance-keyed registries onto the expanded descendants. Also: `flatten` uses deterministic composed ids + preserves template-level registries, intentionally diverging from `component-ops.deepDetachInstance` (fresh ids, dropped linkage) — the two serve different purposes; agree only on variant/override/nesting order + bakeProps semantics. Full CD-506 port notes are inline in `ide/src/shared/publish/flatten.ts`.

- **Full-suite parallel-run flakiness (test infra)** (2026-07-18, during M4 CD-4xx). With the suite grown to ~130 files / ~1153 tests, a bare `pnpm vitest run` intermittently fails 1–4 async/lazy tests (observed: `workspace-shell` lazy-pane mount, `command-palette` execute-on-Enter, `states` delta edit). **Non-deterministic — a different test fails each run and every one passes in isolation / small groups**, so this is worker-contention timing (findBy/act under load), not a functional regression. Harden before it bites CI: raise testTimeout for async UI specs, or tune vitest `poolOptions`/isolate, or add `waitFor` around the lazy-pane assertions. Scoped per-feature suites are 100% green.
