# CyberDeck v2 — Architecture Baseline

**Status:** Authoritative for the v2 direction · Documentation phase (2026-07-13)
**Inputs:** `instruction.md` (architecture requirements §1–§14), the design's 21 embedded Platform Notes (`ARCH()` in `design/CyberDeck IDE (Phase 4).dc.html:2430-2452`), the boot sequence (`BOOTSEQ()` at `:2528`), design-project `steps.md` (Phase 5 spec), and the existing engine TRDs (2A–2G).
**Scope:** All three tiers — IDE, Engine, Player — with the IDE described mock-first (per instruction.md) and the engine as the eventual real backend.

---

## 0. Technology stack (decision record)

> **Accepted** by the maintainer 2026-07-13 (CD-101 kickoff confirmation).

| Tier | Stack | Rationale |
|---|---|---|
| **IDE** | **TypeScript + React + Vite**, shipped in a **Tauri** desktop shell | The design prototype is web-native (HTML/CSS/JS) and translates 1:1; instruction.md's architecture vocabulary (code splitting, dynamic imports, workers, error boundaries, localStorage) is web vocabulary; Tauri gives small binaries, native menus/tray, and manages the engine as a **sidecar process**. |
| **Engine** | **Go** (existing `engine/` module, kept) | 29k LOC of working, tested runtime: transport, security, plugins, flows, persistence. See `02_Codebase_Assessment.md`. |
| **Player** | **Flutter** (existing `client/` module, refocused) | The render interpreter + widget set + encrypted networking already work on Android/Windows and are iOS-code-ready. One codebase → APK + iOS + tablet builds. |
| **Contract** | JSON Schemas in `shared/schemas/` (extended), one protocol envelope | Already the engine↔client contract; becomes the three-way contract (IDE ⇄ engine ⇄ players). |

**Alternative considered and rejected:** building the IDE in Flutter desktop on top of the existing `client/designer/`. Rejected because the existing designer is a grid editor ~5% of the Phase-4 scope, Flutter has no ecosystem equivalent of the required IDE furniture (docking, virtualized trees, command palette patterns), and the design's interaction spec is already expressed in web idioms. The Flutter investment is preserved where it wins: the player.

**Mock-first rule (instruction.md):** the IDE must run fully featured with **zero engine present** — every repository resolves through the Mock API Gateway. The engine is a *deployment-time swap*, not a code dependency. This keeps UI development unblocked and forces honest loading/error/empty states.

---

## 1. Layered architecture

```
Configuration  →  Platform  →  Services  →  Repositories  →  Gateway  →  State  →  Widgets  →  UI
                                                          (Mock | Engine)
```

- **Configuration** — declarative JSON documents (with schemas) for app, user, workspace, widgets, commands, themes, flags, permissions.
- **Platform** — the kernel: Boot Manager, Service Container, Event Bus, Command Registry, registries.
- **Services** — single-responsibility platform services resolved by interface from the container (§3).
- **Repositories** — per-domain data access (`VariablesRepository.query(scope, filter, sort, page)`); the only layer that talks to the gateway.
- **Gateway** — `MockApiGateway` (latency/failure simulation, mock DB seeded from configuration) or `EngineGateway` (the Go engine's control-plane API). Selected by configuration.
- **State** — domain stores (§8); subscribed projections, never direct mutation from UI.
- **Widgets** — self-contained modules loaded from manifests (§5).
- **UI** — React components that render store state and execute commands. UI never fetches, never mutates directly.

Two hard rules the prototype violated and production must not (AUDIT C2/C3): **the DOM/UI is never the data model**, and **cross-feature communication goes through stores/events, never direct calls**.

## 2. Boot lifecycle (instruction.md §2)

The IDE boots through ordered stages; only shell-critical stages block first paint. Target: **interactive ≤ 150 ms** (design's canonical sequence, `BOOTSEQ()`):

| # | Stage | @ms | Blocking? | Loads |
|---|---|---|---|---|
| 1 | Boot Manager | 8 | ✔ | boot manifest, phase ordering |
| 2 | Configuration Loader | 24 | ✔ | defaults ← app ← user ← workspace (merged) |
| 3 | Authentication / Session | 41 | ✔ | session token restore, offline-first |
| 4 | Workspace Restore | 67 | ✔ | last workspace, layout, density from session store |
| 5 | Theme Engine | 82 | ✔ | active theme tokens → CSS custom properties (no flash) |
| 6 | Service Container | 96 | ✔ | services registered as **lazy proxies** |
| 7 | Command Registry | 118 | ✔ | commands, keymap, palette index |
| 8 | Extension Host | 142 | shell interactive | extensions activate isolated, lazily |
| 9 | Widget Registry | 210 | ✖ | manifests discovered, deps resolved, **nothing rendered** |
| 10 | Background Services | 380+ | ✖ | telemetry, watchers, cache refresh, health checks |

Implementation notes (Platform Note `boot`): `BootManager.run(phases[])` with phase barriers; `performance.mark` per stage reported to Telemetry; the boot sequence is replayable and inspectable in dev builds (the design's boot overlay).

**Engine boot is independent** — the engine is an OS service that is usually already running (existing `engine/internal/lifecycle`). The IDE's stage 3–4 includes discovering/attaching to the local engine *without blocking*: if absent, the IDE runs on mocks and surfaces an "engine offline" status.

Deferred / on-demand loading (instruction.md §2 list): widget data (on visibility), extension metadata (on marketplace open), logs (on Runtime open), terminal sessions, AI history (on panel open), project indexes, diagnostics, analytics, docs, file previews.

## 3. Service container (instruction.md §14; Platform Note `svc`)

DI container; services registered at boot as lazy proxies, resolved by interface (`container.get(IThemeService)`), never imported directly. Cross-service communication via event bus or explicit interfaces. Circular dependency = boot error.

The canonical 13 services (from the design's Platform Inspector):

| Service | Owns | Key notes |
|---|---|---|
| `ConfigurationService` | layered config merge, `SettingsChanged` deltas, write-behind persistence | §4 |
| `WorkspaceService` | workspace routing, per-workspace layout state | contribution point `workspaces[]` — adding a workspace is config, not shell code |
| `ProjectService` | project open/save/recents; hydrates ProjectModel, emits `ProjectOpened` | document format `cyberdeck.project` (exists — `cyberdeck-model.js` in design, `layout` docs in engine) |
| `WidgetService` | widget registry, discovery, dependency resolution, lazy chunks | §5 |
| `CommandService` | command registry, keymap, palette index, undo stack | §7 |
| `ThemeService` | token resolution → CSS vars before first paint; `ThemeChanged` | themes are extension-contributable |
| `NotificationService` | toasts/drawer/badges; queued, deduped, rate-limited; priorities, per-source muting | producers never own UI |
| `ExtensionService` | extension host lifecycle, contribution points, sandboxing | §10 |
| `AuthenticationService` | local session, device identity trust (delegates to engine `core/security`) | offline-first |
| `TelemetryService` | batched, non-blocking usage/perf/crash events; flush on idle | respects `telemetry.enabled` flag |
| `RepositoryRegistry` | per-domain repositories + middleware stack | §6 |
| `CacheManager` | LRU memory + persisted cache, **event-driven invalidation** (evict exactly what changed, never blanket flush) | hit/miss counters → telemetry |
| `MockApiGateway` / `EngineGateway` | request resolution, latency/failure injection (mock) or engine RPC (real) | §6 |

Additional platform managers (not user-facing services): `BootManager`, `DockManager`/`LayoutManager` (tool-window state machine: float/pin/auto-hide/peek; per-workspace presets), `JobScheduler` (background jobs with budgets/backoff on idle callbacks + workers), `AIService` (pluggable providers behind one interface; flows call it like any action node).

## 4. Configuration model (instruction.md §1, §8; Platform Note `config`)

**Layering:** `defaults ← application ← user ← workspace ← runtime overrides`. Each layer is a document; the merge emits `SettingsChanged` deltas; writes debounce into the owning layer (write-behind).

**Configuration areas and their contract:**

| Area | User-editable | Extension-editable | Persisted | Owner / location |
|---|---|---|---|---|
| Application config (product identity, boot manifest, API routes) | ✖ | ✖ | ✔ (ships with app) | system — install dir |
| User preferences (theme, density, keymap overrides, telemetry opt) | ✔ | ✖ | ✔ | IDE — user config dir |
| Workspace config (per-workspace layout, presets, panel state) | ✔ (implicitly, via UI) | ✖ | ✔ | IDE — user config dir |
| Layout / navigation config (workspaces list, rail order) | ✖ (v1) | ✔ | ✔ | app + extension manifests |
| Widget configs (per-instance settings) | ✔ | ✖ | ✔ | **project document** (engine) |
| Widget manifests / schemas | ✖ | ✔ (they ARE the extension) | ✔ | extension bundles |
| Command config (keybindings) | ✔ (rebind) | ✔ (contribute) | ✔ | user config + manifests |
| Themes | ✔ (select) | ✔ (contribute) | ✔ | app + extension bundles |
| Feature flags | ✔ (dev/experimental only) | ✖ | ✔ | user config; system flags app-managed |
| Permissions grants | ✔ (grant/revoke) | ✖ (they *request*) | ✔ | **engine** (`core/security`) — security state never lives client-side |
| Session config (open workspace, selection, zoom) | implicit | ✖ | ✔ | IDE session store |
| Runtime config (gateway mode, latency injection, log levels) | dev only | ✖ | ✖ (runtime) | in-memory |
| Project/workspace documents (layouts, flows, variables, components) | ✔ (that's the product) | ✖ | ✔ | **engine** SQLite via ProjectService |

Every config document has a JSON Schema in `shared/schemas/` (extending the six that exist), is validated on load, and carries a version stamp with explicit migration on upgrade.

## 5. Widget platform (instruction.md §3; Platform Notes `widgetreg`)

Widgets are **self-contained modules discovered from manifests — never manually imported**. Pipeline: *discovery → dependency resolution → registration → lazy initialization → render*.

`widget.manifest.json` (the production extension of the existing `shared/schemas/widget.schema.json`):

```jsonc
{
  "id": "gauge.circular",             // unique id (exists today as "type")
  "version": "1.2.0",
  "metadata": { "label": "Circular Gauge", "icon": "gauge", "category": "Live Data",
                "description": "…", "tags": ["metric", "ring"] },
  "configSchema": { /* JSON Schema for instance settings */ },
  "defaults": { "min": 0, "max": 100, "warn": 80 },
  "acceptsStateKinds": ["scalar"],     // exists today
  "gestures": ["tap", "hold"],         // exists today
  "permissions": ["variables:read"],   // NEW — declared capabilities (§12)
  "dependencies": { "platform": ">=2.0", "widgets": [] },
  "dataProvider": { "repo": "variables", "subscribe": true },   // NEW
  "refresh": { "strategy": "push" },   // push | poll(interval) | manual
  "caching": { "policy": "swr", "ttl": 30 },
  "lifecycle": { "lazy": true, "chunk": "gauges" },  // code-split chunk
  "actions": [ { "id": "reset", "label": "Reset peak" } ],
  "events": { "subscribes": ["VariableChanged"], "emits": [] },
  "persistedState": ["peakValue"]
}
```

- The registry validates schema + permissions at registration and code-splits each widget into its own chunk.
- The IDE's Insert browser, Library, canvas renderer and **the player's render interpreter** all consume the *same registry* — the player receives the subset needed to render (metadata + defaults + state contract).
- Widget instances hold config + persisted state in the **project document**, keyed by stable ID (AUDIT C3: never by display name).
- First-party widgets are just pre-installed extensions — the ~30 existing Flutter render widgets and the design's 61 catalog entries converge on one manifest catalog.

## 6. Repository + gateway layer (instruction.md §4; Platform Notes `repo`, `mockapi`)

The UI never touches data directly: `Widget → Repository → Service → Gateway → (Mock DB | Engine)`.

- **Repositories** are per-domain (`variables`, `projects`, `widgets`, `flows`, `devices`, `extensions`, `runtime`, `assets`, `ai-threads`…), registered in `RepositoryRegistry`, exposing typed `query/get/mutate/subscribe` with pagination, filtering, sorting.
- **Middleware stack** applied to every request: latency simulation, retries with backoff, failure injection, response caching (via CacheManager), optimistic updates with rollback, cancellation (AbortController), auth headers.
- **MockApiGateway**: route table **mirroring the future real API** (`/v1/projects`, `/v1/variables`, `/v1/flows/:id/deploy`…), mock DB seeded from configuration fixtures, injected 15–200 ms latency + ~2 % failure rate (dev-flag-controlled). Contract tests are generated from the same route table so the engine implementation cannot drift.
- **EngineGateway** (Phase E in the execution plan): same route contract spoken to the local engine control plane (WebSocket + JSON envelope on localhost, reusing `shared/schemas/protocol-envelope.schema.json`); subscriptions map to engine event-bus topics.
- **Why:** when the real backend arrives, *only the gateway swaps* — every widget, store and inspector keeps working unchanged (Platform Note `mockapi`), and the UI has been forced to handle loading/empty/error/retry states from day one.

## 7. Command architecture (instruction.md §10; Platform Note `cmdreg`)

Every action is a command: palette, shortcuts, toolbar, context menus, buttons all resolve through **one registry** (the prototype's `CMDS()` proved the pattern; AUDIT M14 documents why three sources of shortcut truth is a bug factory).

Command shape: `{ id, category, label, icon, keybinding, context (when-clause), permissions, args schema, undo support, telemetry tag, visibility }`.

- One dispatch path → permissions, telemetry, undo and rebinding come for free.
- **Undo/redo:** mutations execute as command objects with `do/undo` against the document model (not DOM snapshots like the prototype); the history stack feeds the Timeline panel; destructive actions get an inline "⌘Z to undo" toast affordance.
- Extensions contribute commands via manifest; keybinding conflicts resolve by context specificity; the Keyboard preferences pane renders from the registry (single source of truth).

## 8. State management (instruction.md §5; Platform Note `stores`)

No single god-store. Domain stores are subscribed projections with a declared persistence contract:

| Store | Kind | Persisted | Restore timing | Notes |
|---|---|---|---|---|
| UI Store (density, panel visibility, popovers) | temp + persisted subset | partial | boot 4 | |
| Workspace Store (active ws, per-ws layout, dock state, presets) | persisted | ✔ | boot 4 | per-workspace keys |
| Session Store (selection, zoom/pan, scroll, nav history) | persisted | ✔ | boot 4 | one blob, written on change |
| Preferences Store | persisted | ✔ | boot 2 | user config layer |
| Project Store (open project doc, dirty state) | server-backed (engine) | ✔ (engine) | on `ProjectOpened` | CRDT-ready later |
| Widget Store (instance state, persisted widget state) | server-backed + cached | ✔ (project doc) | lazy, on visibility | |
| Editor Store (canvas tool, guides, marquee) | temp | ✖ | — | |
| Flows Store (graphs, armed state, test-run) | server-backed | ✔ (engine) | on workspace open | |
| Variables Store (live values) | derived (subscription) | ✖ (engine owns) | on subscribe | push-updated |
| Runtime Store (exec log, perf counters) | derived, ring-buffer | ✖ | lazy | bounded memory |
| Notification Store | temp + persisted history | partial | lazy | |
| Auth Store (session, device identity) | persisted (engine-owned secrets) | ✔ | boot 3 | secrets never in localStorage |
| Repository Cache | cached | ✔ (partial) | lazy | event-driven invalidation |
| AI Store (threads, streaming state) | server-backed | ✔ (engine) | on panel open | |

Persisted stores own their key, restore at a declared boot stage, and migrate by version stamp.

## 9. Data loading strategy (instruction.md §6; Platform Note `jobs`)

| Trigger | Loads | Strategy & why |
|---|---|---|
| Startup (blocking) | config, prefs, session, theme, auth, workspace layout | eager — required to paint the correct shell once, no re-layout flicker |
| Startup (post-interactive) | widget manifests, extension activation | background — registry ready before first insert, never blocks paint |
| Panel/workspace opens | that workspace's data (vars table, runtime log, library catalog) | lazy + cache — stale-while-revalidate on re-entry |
| Widget becomes visible | its data provider subscription | lazy — virtualized surfaces subscribe only what's on screen |
| Project opened | project document, then indexes/thumbnails | eager doc, background indexes; prefetch recent projects' metadata |
| Command executes | command's lazy chunk if not loaded | dynamic import on demand |
| Always, in background | telemetry flush, health checks, project indexing, file watchers, plugin update checks, cache refresh, extension discovery | JobScheduler on idle callbacks/workers with budgets + backoff — periodic work never runs on the interaction path |

## 10. Extension platform (instruction.md §7; Platform Notes `exthost`, `plugin`)

Two extension surfaces, one conceptual model:

1. **IDE extensions** (TypeScript, sandboxed workers + RPC bridge): contribute **widgets, commands, menus, context menus, toolbar items, settings, routes/panels, themes, keyboard shortcuts, automation nodes, data providers, services**. Contribution points mirror the registries; activation is lazy (on first use); a crashing extension cannot take down the shell; all core access is mediated by permissioned APIs.
2. **Engine plugins** (Go, process-isolated — exists today in `engine/pluginhost` + `plugins/`): contribute **integrations, device drivers, telemetry providers, action executors, variable sources**. Already manifest-declared (`shared/schemas/plugin_manifest.schema.json`), supervised, and IPC-bridged.

An "integration" (OBS, Spotify, Discord, GitHub, Hue/MQTT) typically ships both halves: an engine plugin (the connection + actions + variables) and an IDE extension (its widgets, nodes, inspector panels) under one package ID. Device connectivity itself is a plugin family (Platform Note `plugin`): drivers declare `{network, devices}` permissions, heartbeats arrive as events, simulated and real devices share one code path behind the gateway.

## 11. Event system (instruction.md §9; Platform Note `eventbus`)

Application-wide typed pub/sub with payload schemas; subscribers declare interest (in code or manifest); delivery is async; **wildcard topics + replay-on-subscribe** so late-loading lazy widgets receive current state.

Canonical IDE catalog: `ProjectOpened, FileOpened/Saved, WorkspaceChanged, WidgetLoaded/Closed, ThemeChanged, SettingsChanged, VariableChanged, FlowExecuted, AIStarted/AICompleted, NotificationReceived, ExtensionInstalled, DeviceConnected/Dropped, StyleChanged` — the engine's existing taxonomy (`engine/core/eventbus/topics.go`: `state.changed, threshold.crossed, device.paired/revoked, plugin.started/stopped/crashed, session.opened/closed, flow.run/failed`) bridges onto the same bus through the gateway subscription.

Why: full decoupling — a gauge re-renders on `VariableChanged` without knowing the producer; caches invalidate on precise events instead of timers; widgets never reference one another.

## 12. Permissions (instruction.md; steps.md §16)

Widgets and extensions **declare** capabilities in their manifests; users **grant** them; the **engine enforces** them (the IDE's checks are UX, the engine's are security — enforcement lives where the actions execute, in `engine/core/security/permissions.go`, which already implements per-device/per-action policy + audit).

Capability vocabulary: `filesystem, clipboard, network, notifications, git, devices, plugins, automation, environment, variables:read/write, secrets`. The Platform Inspector renders the declared-capability matrix; grants persist in the engine; players carry per-device permission profiles (existing pairing/permission model).

## 13. Error handling & resilience (instruction.md §12; Platform Note `mockapi`, steps.md §14)

- **Global error boundary** (shell survives, offers reload + crash report) and **per-widget error boundaries** (a failing widget renders fallback UI with retry — never blanks a panel).
- **API failures:** retry with backoff at the repository middleware; offline state is a first-class store flag (engine gone → banner + mocks/cache, not a broken app).
- **Crash/session recovery:** session store + write-behind means relaunch restores the exact IDE state; the engine already self-heals device sessions (heartbeat + watchdog + tokenless reconnect).
- **Isolation:** extension workers and engine plugin processes crash alone; supervisors restart with backoff (`pluginhost` exists).
- **Telemetry + logging hooks** on every boundary; user-visible errors are actionable ("Retry", "Open log"), never raw internals (AUDIT M8).

## 14. Performance (instruction.md §11; steps.md §13)

Code-splitting per widget/workspace chunk; dynamic imports on command/panel demand; virtualized lists everywhere data scales (vars table, runtime log, layer tree, library grid); memoized selectors on stores; background workers for indexing/telemetry/expression evaluation; explicit resource cleanup on widget dispose (subscriptions, timers, canvases); LRU + event-invalidated caching; bundle budgets in CI. Expression evaluation runs in a **sandboxed parser** (never live `eval` — AUDIT M8) shared with the engine's expression language semantics (`engine/core/flow/expr`) so IDE previews match runtime results.

## 15. Persistence map (instruction.md §13; Platform Note `stores`)

| Data | Location | Restore | Migration |
|---|---|---|---|
| Projects, layouts, components, flows, variables defs | Engine SQLite (`core/persistence`, versioned migrations exist) | on open | SQL migrations (exists) |
| Widget instance state (persisted subset) | project document | with project | doc version stamp |
| Device pairings, identity, permissions, audit | Engine SQLite + OS secret store (exists) | engine boot | exists |
| User preferences, keymaps, themes choice | IDE user config dir (JSON) | boot 2 | version stamp |
| Workspace layouts, dock state, presets, session | IDE config (per-workspace keys) | boot 4 | version stamp |
| Command history / undo timeline | in-memory (session-scoped) | — | — |
| AI conversations | engine (`/v1/ai/threads`) | on panel open | doc version |
| Repository cache (thumbnails, catalogs) | IDE cache dir, LRU-bounded | lazy | disposable |
| Player: last layout + assets | device-local cache | app launch (offline-capable) | layout doc version |

## 16. Feature flags (steps.md §15)

Flag registry in configuration (`experimental widgets, developer tools, AI providers, marketplace, cloud sync, automation engine, plugin sandbox, failure injection…`); flags gate lazy chunks (an off flag costs zero bytes), emit `SettingsChanged` on toggle, and surface in the Platform Inspector. System flags are app-managed; experimental flags are user-editable.

## 17. Developer experience (instruction.md §14)

- **Feature-based folder structure** in the IDE app (`platform/` kernel, `services/`, `repositories/`, `stores/`, `workspaces/<name>/`, `widgets/<id>/`, `extensions/`), module boundaries enforced by lint rules (no cross-feature imports except via platform).
- **Typed configuration schemas** generated from `shared/schemas/` (one contract → Go types + TS types + Dart types).
- **Testing strategy:** unit (services, stores, expression parser), contract tests generated from the gateway route table (mock vs engine parity), component tests per widget, E2E on the boot + core journeys, plus the existing engine `go test` suites and `task interop` live-wire proof.
- **Dev tooling in-product:** Architecture Mode, Platform Inspector, boot replay, failure-injection flags — the design specifies these as dev-only surfaces; they ship behind the developer-tools flag.

## 18. Tier contract summary

| Concern | IDE | Engine | Player |
|---|---|---|---|
| Authoring | ✔ (only here) | — | ✖ |
| Truth (documents, variables, security) | projection | **owner** | projection |
| Action execution | via engine | **owner** | ✖ (capture only) |
| Rendering | full IDE + preview | — | layout renderer |
| Extensions | TS sandboxed extensions | Go process plugins | ✖ (renders extension widgets via manifests) |
| Offline behavior | mocks + cache | n/a (is the backend) | cached layout, queued interactions marked unavailable |
