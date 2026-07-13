# CyberDeck v2 — Product Baseline

**Status:** Authoritative for the v2 direction · Documentation phase (2026-07-13)
**Supersedes:** the *scope* of `Documentation/CyberDeck_PRD.md` and the Phase-1..8 execution docs. Engine-internal TRDs (2A–2G) remain technically accurate for the engine tier.
**Design source of truth:** claude.ai/design project `f2bddb25-506c-4b40-80c8-59a8b722aec1` — file **`CyberDeck IDE (Phase 4).dc.html`** (local snapshot in `design/`), plus its companion docs (`FEATURES.md`, `ROADMAP.md`, `AUDIT.md`, `uploads/steps.md`) and the 21 embedded **Platform Notes** (`ARCH()` at `design/CyberDeck IDE (Phase 4).dc.html:2430-2452`), whose content is folded throughout `01_Architecture_Baseline.md`.

---

## 1. What CyberDeck is now

CyberDeck is a **desktop IDE for building, automating and running interactive control decks** — the product category of Stream Deck, Touch Portal and Macro Deck, rebuilt with an IDE-grade authoring experience and a Node-RED-grade automation engine.

CyberDeck is **not** a design tool. It looks like one (canvas, layers, inspector, components), but every component is *functional*: it owns bindings to live variables, interaction states, actions, runtime behavior, plugin integrations and flows. The deliverable of a CyberDeck project is a **running deck**, not a picture.

### The one-sentence pitch

> Design your deck on the desktop like you're in VS Code + Figma, run it from the desktop engine, and touch it on any phone or tablet.

## 2. Product topology (the evolved direction)

The product is **three cooperating tiers**. This is the key evolution from the v1 documentation: the desktop application is no longer a "designer window plus deck view" — it is a full IDE, and mobile devices are pure *players*.

```
┌────────────────────────── Desktop (Windows / macOS / Linux) ─────────────────────────┐
│                                                                                      │
│  CyberDeck IDE (authoring + observability)      CyberDeck Engine (runtime service)   │
│  ─ 7 workspaces: Projects · Design · Flows ·    ─ device sessions (pair/encrypt)     │
│    Library · Vars · Runtime · Devices           ─ plugin host (process-isolated)     │
│  ─ command palette, docking, undo/redo          ─ flow executor + expression lang    │
│  ─ components, bindings, states, variables      ─ variable/state store + event bus   │
│  ─ Player Preview (per-device simulation)       ─ layout documents + broadcast       │
│  ─ platform kernel (config-driven, mockable)    ─ SQLite persistence, audit, secrets │
│                    │                                        │                        │
│                    └────────── local control plane ─────────┘                        │
│                               (IDE ⇄ Engine API)                                     │
└────────────────────────────────────────┬─────────────────────────────────────────────┘
                                         │  LAN — encrypted, paired, self-healing
                     ┌───────────────────┼───────────────────┐
              ┌──────┴──────┐     ┌──────┴──────┐     ┌──────┴──────┐
              │ Android APK │     │  iOS app    │     │ spare screen│
              │  (Player)   │     │  (Player)   │     │  (Player)   │
              └─────────────┘     └─────────────┘     └─────────────┘
```

| Tier | Role | Ships as |
|---|---|---|
| **CyberDeck IDE** | The only authoring surface. Everything is edited here: layouts, components, bindings, variables, flows, devices, themes, extensions. Also the observability surface (Runtime workspace, Platform Inspector). | Desktop app for Windows, macOS, Linux |
| **CyberDeck Engine** | The always-on runtime. Owns truth: project documents, variables, flow execution, plugin processes, device sessions, security. Survives the IDE closing (OS service). | Bundled with the IDE install; runs as SCM / launchd / systemd service |
| **CyberDeck Player** | Renders the layout assigned to that device and streams live values. Interactions (tap, hold, slide, toggle) are captured on the device and **executed by the engine** — the player never runs actions locally. | Android APK, iOS app; same binary also serves tablets/secondary desktops |

### Interaction contract (the defining behavior)

- **Layouts are authored on desktop, rendered on players.** A player receives a serialized layout document (widgets, bindings, states, pages) and renders it natively. It does not edit, it does not compute.
- **Clicks travel to the engine.** A tap on a player is an interaction event → engine validates permissions → dispatches the bound action/flow (plugin call, script, navigation) → resulting state changes fan out to every subscribed device.
- **Live data travels to players.** Variables (CPU %, now-playing, OBS scene, MQTT topics…) update on the engine and are pushed to every widget bound to them, on every device, including the IDE's Live Mirror / Player Preview.

## 3. Deliverable applications

| Deliverable | Platform | Notes |
|---|---|---|
| CyberDeck IDE + Engine installer | Windows | Primary dev/host platform today |
| CyberDeck IDE + Engine installer | macOS | Engine cross-compiles today; IDE + packaging needed |
| CyberDeck IDE + Engine installer | Linux | Same |
| CyberDeck Player | Android (APK, later Play Store) | Exists today as the Flutter client; evolves per `02_Codebase_Assessment.md` |
| CyberDeck Player | iOS (App Store) | Flutter client is code-ready; requires a Mac build host |

## 4. The IDE, as specified by the design

The Phase 4 design file is the **behavioral spec** for the IDE. Its feature surface (full inventory in the design project's `FEATURES.md`, build history in `ROADMAP.md` phases 1–33):

- **Workspaces:** Projects (dashboard + browse), Design (canvas/layers/inspector), Flows (node graph automation), Library (components/styles/symbols), Vars (variable manager), Runtime (execution log + performance), Devices (paired devices + player preview).
- **IDE chrome:** command palette (⌘K) + central command registry, undo/redo with timeline, docking engine (float/pin/auto-hide/peek), per-workspace layout presets, session restore, themes, beginner/power density, notifications, preferences with rebindable keys.
- **Design system:** components → variants → per-instance overrides → nested components; shared styles; symbols; bindings (static/variable/expression); per-widget states; event → flow wiring.
- **Automation:** flow graphs with 6 node categories (Triggers, Logic, Data, Integrations, Actions, Structure), test-run simulation, armed flows.
- **Platform (Phase 33):** boot lifecycle overlay, Architecture Mode with 21 Platform Notes, Platform Inspector (services, repositories, state stores, event bus, feature flags, permissions, loading/perf) — the embedded architecture contract that `01_Architecture_Baseline.md` turns into implementable documentation.

**What the design intentionally does *not* cover:** the design is a single-file prototype (one ~2.5k-line class, DOM-as-model — see the design project's `AUDIT.md`). It specifies *behavior and architecture intent*, not implementation. We implement from the spec; we do not port the prototype's code.

## 5. Primary personas / use cases

1. **Streamer** — OBS scene switching, chat/alerts on a side tablet, media control, RGB lighting scenes.
2. **Gamer / sim rig** — telemetry gauges (CPU/GPU/FPS), game launchers, macro panels on a phone mounted in the rig.
3. **Smart-home operator** — MQTT/Hue rooms, scenes, sensors on a wall-mounted tablet.
4. **Power user / developer** — window layouts, scripts, CI status, meeting toggles; treats CyberDeck as programmable glass.

## 6. Product principles

1. **Configuration-driven everything.** The UI renders what configuration provides — workspaces, widgets, commands, themes, layouts, flags are all declarative. (instruction.md §1; Platform Note `config`.)
2. **Mock-first, swap-later.** The IDE is built against a Mock API Gateway with realistic latency/failure/caching behavior; the engine control plane replaces it behind a config flag with zero widget changes. (instruction.md §4; Platform Note `mockapi`.)
3. **Visible = operable.** Every control works or is visibly disabled with a reason. No decorative chrome (AUDIT C5 is the cautionary tale).
4. **Reversible by default.** Every mutation is a command with undo. (AUDIT C1.)
5. **The engine owns truth.** Documents, variables, execution, security live in the engine; the IDE and players are subscribed projections.
6. **Extensible without forking.** New widgets, nodes, integrations, themes arrive as extensions/plugins registering through manifests — core code does not change. (instruction.md §7.)
7. **Fail isolated.** A crashing widget, extension or plugin never takes down the shell or the engine. (instruction.md §12.)

## 7. Scope of the current phase

**This phase produces documentation only** (this directory). No production code is written or modified. The docs are the baseline for all subsequent implementation phases:

| Doc | Purpose |
|---|---|
| `00_Product_Baseline.md` | What the product is (this file) |
| `01_Architecture_Baseline.md` | The config-driven platform architecture across all three tiers |
| `02_Codebase_Assessment.md` | What existing code is kept, improved, or retired |
| `03_Execution_Plan.md` | Phased plan from here to shippable apps |
