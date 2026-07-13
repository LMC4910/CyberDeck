# CyberDeck v2 — Existing Codebase Assessment

**Status:** Documentation phase (2026-07-13)
**Question answered:** *build on top of the current codebase, improve it, or scrap and start fresh?*

## Verdict

**Do not scrap.** The repository divides cleanly:

- **Keep and build on (unchanged role):** the entire Go engine (~29 k LOC, 62 test files) and its plugins (~6.3 k LOC). It *is* the "real backend" the design's mocked platform assumes will eventually exist — often implementing the design's Platform Notes almost verbatim.
- **Keep and refocus:** the Flutter client's networking + rendering + gestures stacks (~⅔ of 20 k LOC) become the **Player** product.
- **Retire:** the Flutter `designer/` (grid editor, ~5 % of the Phase-4 IDE scope) as an authoring surface — superseded by the new IDE. Keep it compiling until the IDE reaches interop parity, then delete.
- **Build fresh:** the **CyberDeck IDE** (TypeScript/React/Tauri) and the **engine control-plane API** it talks to. Nothing in the repo fills either role today.
- **Reference only:** `prototype.html`, `client/lib/data/pages/` seed decks, v1 phase docs — demo/reference material, not build targets.

The v1 documentation's engine TRDs (2A–2G) remain accurate; the v1 PRD/phase plans are superseded in *scope* by the v2 docs (product topology changed: IDE-on-desktop + players-on-mobile).

---

## 1. Engine (`engine/`, Go — KEEP, extend)

What exists maps directly onto the design's platform architecture:

| Design Platform Note | Existing engine code | State | Work needed for v2 |
|---|---|---|---|
| Event Bus | `core/eventbus` (316 LOC) — ordered per-topic pub/sub, bounded queues, topic taxonomy | ✅ solid | add IDE-facing topics; bridge onto control plane |
| Widget Registry | `core/registry` (627) — widget/action/flownode descriptors with config schemas, validation, merge/query | ✅ solid | extend descriptor → full manifest (permissions, data provider, refresh, caching, lifecycle) per Architecture §5 |
| Repository Layer | `core/persistence` (1 892) — SQLite, versioned migrations, repos for accounts/devices/documents/variables/workflows/audit, secret-guard tests | ✅ solid | add project-document repo variants for v2 doc format |
| State Stores / Variables | `core/state` (771) + `core/vars` (257) | ✅ working | richer variable types (design's 13 types), computed/expression vars |
| Flow engine | `core/flow` (2 963) — executor, run context, triggers, validation, store, expression lexer/parser/eval, 10 node kinds | ✅ strong | extend node catalog to the design's 6 categories (Integrations/Data nodes); align expression semantics with IDE sandbox parser |
| Layout / documents | `core/layout` (1 537) — op-log, undo, broadcast, default profile | ✅ working | v2 layout document schema (components, bindings, states, pages, per-device assignment) |
| Security & permissions | `core/security` (3 108) — device identity, ECDH pairing, AEAD, tokens, permission policy, audit, OS secret stores (win/mac/linux) | ✅ ahead of design | map the design's capability vocabulary onto the existing policy model |
| Device sessions / gateway | `core/session` (1 924) + `core/transport` (3 659) — mDNS discovery, framing, encrypted channels, fan-out, heartbeat/watchdog, tokenless reconnect | ✅ proven (`task interop`) | becomes the player data plane; add layout-push for v2 docs |
| Extension Host (engine side) | `pluginhost` (1 551) + `pal` (251) — process supervision, IPC, capability provider chains | ✅ working | manifest v2, richer contribution points |
| Background services | `internal/` (1 723) — wire, serializer, config, lifecycle, secrets; OS service install (SCM/launchd/systemd) | ✅ working | — |
| **Control plane for the IDE** | **does not exist** | ❌ gap | the single biggest engine work item: a localhost API (project CRUD, registry queries, flow deploy, variable subscribe, runtime log stream, device management) matching the IDE gateway contract |

Also keep: `plugins/` (telemetry 2 159, volume 823, notifications 917, smarthome 656, system 553, media 466, power 469, launchers 237; `fps/` is an empty stub), `shared/schemas/` (6 JSON Schemas — grow into the three-way contract), `Taskfile.yml`, `ci/`, `installers/`, `go.work`.

**Why this matters:** instruction.md's mock-first architecture only pays off if a real backend eventually honors the same contract. That backend is ~80 % built and tested.

## 2. Flutter client (`client/`, Dart — SPLIT)

### Keep → becomes the Player (~13 k LOC)

| Module | Contents | v2 role |
|---|---|---|
| `lib/net/` | discovery, manual/QR pairing, encrypted session, framing, envelope, connection manager w/ auto-reconnect, layout apply | Player data plane — already speaks the engine protocol end-to-end |
| `lib/render/` | layout interpreter, widget registry, state store, degradation, ~28 deck widgets (gauges, sliders, media, toggles…) | the layout renderer — exactly the "mobile renders, engine executes" contract |
| `lib/gestures/` | capture, slots, destructive-action confirm | interaction verbs (tap/hold/slide/confirm) |
| `lib/app/`, `lib/crypto/`, `lib/tray/`, `lib/theme/` | shell, pairing UX, connection badge | Player shell (simplify: remove editing entry points) |
| `test/` (34 files) incl. demo journey + interop harness | | keep; guards the protocol during evolution |

Work needed: consume the v2 layout document (components/variants, bindings, states, multi-page, per-device assignment), align the widget catalog with manifests, offline layout cache, player-only navigation. The renderer architecture (interpreter over a widget registry) is the right shape already.

### Retire → superseded by the IDE (~4–5 k LOC)

`lib/designer/` (canvas, grid editor, inspector + param/widget schemas, placement, profiles, undo, op model) and `lib/data/` seed decks/mock source. The new IDE covers this scope many times over (design ROADMAP phases 5–33: components, variants, overrides, bindings, flows graph, docking, palette, undo timeline…). Rebuilding that in Flutter would forfeit the design's 1:1 web mapping and cost the most for the least reuse.

**Transition rule:** `designer/` stays in-tree (still useful for the live interop demo) until IDE milestone D3 (execution plan) proves author→publish→render on device; then it is deleted in one commit.

## 3. What does not exist anywhere (BUILD)

1. **CyberDeck IDE** — the entire desktop authoring app (React/TS/Tauri): platform kernel, 7 workspaces, docking, palette, component system, flows graph editor, Platform Inspector. The design file is the spec; **implement from spec, never port prototype code** (the prototype is a single ~2.5 k-line class with DOM-as-model — its own AUDIT.md §3 disqualifies it as a code base).
2. **Engine control plane** — localhost API + event bridge for the IDE (Architecture §6).
3. **Mock API Gateway + fixtures** — the IDE-side simulated backend (latency/failures/caching) mirroring the control-plane routes.
4. **Shared contract v2** — extended JSON Schemas (widget manifest, layout document, flow document, config areas, control-plane envelope) generating Go + TS + Dart types.
5. **Tauri desktop packaging** — IDE shell bundling the engine sidecar; per-OS installers exist only for the bare engine today.

## 4. Risk notes

- **Two designer codebases during transition** — time-box the overlap (see transition rule above); no new features land in `client/designer/`.
- **Schema drift across three languages** — single source in `shared/schemas/` with generated types + contract tests, from the first IDE phase, not later.
- **Design file is truncated locally** (`design/*.dc.html` is a 256 KiB capped snapshot; full file lives in the design project). The extracted Platform Notes + companion docs cover the architectural content; re-export the full HTML before implementing UI phases that need the tail sections (Platform Inspector tab markup).
- **Engine protocol was built for decks, not IDE traffic** — the control plane is new surface area; keep it a separate listener/channel from the device data plane so player QoS is never contended by IDE bulk queries.
