# CyberDeck — Project Execution Plan

Version 1.0 · June 2026 · Plugin ID `com.shishir.cyberdeck` · Backend Node.js 20 / TP API 12

This is the delivery roadmap an engineering team executes against. It splits the work along
the two shipped artifacts — the **`.tpp`** plugin (backend/admin) and the **`.tpz`** page
set (frontend) — and defines phases, tasks, effort, dependencies, risks and acceptance
criteria for each. It is grounded in and references the rest of the doc set:
[01 PRD](01-product-requirements.md), [02 Architecture](02-technical-architecture.md),
[03 Plugin API](03-plugin-api-spec.md), [04 UI & Design System](04-ui-and-design-system.md),
[05 Operations & Roadmap](05-operations-and-roadmap.md). It does **not** redefine IDs, NFRs
or design tokens fixed there — it cites them.

> **Estimates are independent of doc 05.** Doc 05 frames a 7-phase, 15-week calendar
> envelope. This plan re-derives effort bottom-up around the `.tpp`/`.tpz` split in
> **person-days (pd)**, then maps it to a calendar in §9. The two are reconciled in §9, not
> duplicated. Effort assumes the generic team in §8; 1 calendar week ≈ 5 pd per person.

---

## 1. Project Overview

### 1.1 Objectives

| # | Objective | Tied to |
| --- | --- | --- |
| O1 | Ship a production-quality Touch Portal plugin (`.tpp`) that exposes live system, media, gaming, smart-home and notification data as TP states/actions/events/connectors. | doc 03 |
| O2 | Ship a custom 7-page Touch Portal UI (`.tpz`) that renders the cyberpunk design system via plugin-drawn tiles, reachable in ≤ 2 taps. | doc 04 |
| O3 | Meet all non-functional targets (render < 1 s, nav < 300 ms, < 200 MB RSS, < 3 % idle CPU, WCAG AA). | doc 01 §8 |
| O4 | Deliver a maintainable, testable, packaged product with a repeatable upgrade/distribution path. | doc 05 |

### 1.2 Scope

**In scope.** The `.tpp` plugin (logic, integrations, auth/secrets, logging, error handling,
update mechanism) and the `.tpz` page set (7 pages, tiles, action/state bindings,
navigation, assets) per the MVP→Phase-2 feature set in doc 01 §6 and §12.

**Out of scope (this plan).** Phase-3 vision items from doc 01 §12 — voice/contextual
assistant, full OBS/Streamlabs suite, Discord rich presence, remote-PC telemetry, widget
designer, cloud profile sync / marketplace. These are noted as roadmap, not delivered here.

**Artifact split.**

| Artifact | Owner discipline | Responsibility |
| --- | --- | --- |
| `.tpp` (plugin) | Backend/plugin devs | All runtime logic, OS/third-party integration, state production, packaging as a `pkg` exe inside the `.tpp` zip. |
| `.tpz` (pages) | TP designer | All button/tile layout, action wiring, state binding, navigation, visual assets. Consumes the `.tpp` contract. |

### 1.3 Success criteria

Delivery is successful when **all** of the following hold on reference hardware (i7-13700K /
RTX 4070 Ti / 16 GB):

- Acceptance criteria **AC-001 … AC-010** (doc 01 §11) pass.
- Non-functional targets **NFR-001 … NFR-015** (doc 01 §8) are met or exceeded.
- All 7 pages (doc 04 §4–§10) render from live plugin tiles with no frozen/stale values.
- 8-hour soak passes within memory/CPU budget (doc 05 §7).
- A clean install from `.tpp` + `CyberDeck_Full.tpz` reaches live data via the first-run
  wizard with zero manual file edits.

### 1.4 Assumptions

| # | Assumption |
| --- | --- |
| A1 | Touch Portal 4.5+ (API 12) is the only client target; desktop + Android/iOS companions. |
| A2 | Target host is Windows 10 20H2+ / Windows 11; admin rights available for working-set trim and power-plan changes. |
| A3 | Design intent is fixed by doc 04 + the reference images; no major visual re-spec mid-build. |
| A4 | A Home Assistant 2024.x instance with a long-lived token is available for smart-home integration testing. |
| A5 | WinRT bridges build on at least one reference machine; the bundled `.exe` ships prebuilt bindings (doc 02 §4). |
| A6 | The `touchportal-api` SDK major version is pinned and its signatures verified before Phase 2 (doc 03 §9). |

### 1.5 Constraints

| # | Constraint | Source |
| --- | --- | --- |
| C1 | All TP I/O is a single newline-delimited JSON socket on `127.0.0.1:12136`; no second channel. | doc 02 §1, doc 03 §8 |
| C2 | Rich tiles must be delivered as base64 PNG state values; payloads kept small (≤ 256/400 px). | doc 02 §10, doc 04 §2 |
| C3 | State/action/connector IDs are immutable once shipped — renames break user buttons. | doc 03 §2 |
| C4 | WinRT (media/notifications) and Spotify/OBS are optional dependencies; product must degrade, not crash. | doc 02 §11 |
| C5 | CPU/GPU temperatures require LibreHardwareMonitor running; otherwise `--`. | doc 02 §4 |
| C6 | Node/V8 + canvas renderer sets memory floor higher than a native plugin (NFR-009 = 200 MB). | doc 01 §8 |

---

## 2. Architecture & Discovery Phase

A short, shared front-loaded phase that locks the contract before parallel TPP/TPZ build
starts. Much of the substance already exists in docs 02–04; this phase is the **acceptance
gate** that confirms it is complete, internally consistent, and signed off.

### 2.1 Activities (both artifacts)

| Activity | TPP focus | TPZ focus | Reference |
| --- | --- | --- | --- |
| Requirements gathering | Provider capabilities per OS source | Page/feature priorities (P0–P2) | doc 01 §6 |
| Functional requirements | FR-002…006 behaviours | FR-001 navigation, mini media bar | doc 01 §7 |
| Non-functional requirements | NFR-005/006/009/010/011 | NFR-001/002/007/008/015 | doc 01 §8 |
| Technical architecture | 4-layer model, module tree | Tile pipeline, grid system | doc 02 §1/§3, doc 04 §2/§3 |
| Integration requirements | SMTC/WinRT, HA REST+WS, OBS, Core Audio, SteamGridDB | Which tiles consume which integration | doc 02 §4 |
| API dependencies | `systeminformation`, `loudness`, `@nodert-*`, `axios`+HA-WS, `obs-websocket-js`, `keytar` | n/a (consumes states) | doc 02 §4 |
| State/action mapping | Author/verify `entry.tp` inventory | Bind tiles to those IDs | doc 03 §3–§7 |
| Event-flow diagrams | telemetry/media/notify pipelines | tap→action→feedback | doc 02 §5–§9, this doc §5 |
| User-journey analysis | data freshness per journey | nav/tap-count per journey | doc 01 §5 |

### 2.2 Deliverables & acceptance gate

| Deliverable | Exists in | Discovery exit criterion |
| --- | --- | --- |
| Architecture documentation | doc 02 | Reviewed; provider map has a chosen primary + fallback per metric. |
| Technical specifications | doc 03 | Every state/action/event/connector/setting has a final ID and type; schema-valid `entry.tp` skeleton. |
| Data-flow diagrams | doc 02 §5–§9, §5 here | Each pipeline traced end-to-end (source → state → tile). |
| TP action/state inventory | doc 03 §3–§5 | Inventory frozen and signed off; IDs declared immutable (C3). |

**Effort:** 8 pd (shared). **Dependencies:** docs 02–04 complete (done). **Risk:** late
inventory churn forces ID renames after pages are built → mitigate by freezing the inventory
at this gate. **Acceptance:** sign-off that the contract in §2.2 is locked; both workstreams
may now proceed in parallel (§9).

---

## 3. TPP (Plugin / Admin) Development Plan

Five phases. Each table below uses the schema **Tasks · Subtasks · Deliverables ·
Dependencies · Effort · Risks · Acceptance**. Module paths reference doc 02 §3
(`src/core`, `src/services`, `src/render`, `src/util`).

### Phase 1 — Core Framework Setup

| Field | Detail |
| --- | --- |
| **Tasks** | Repo + tooling; dev environment; CI/CD; plugin skeleton; logging; config management. |
| **Subtasks** | Repo (`pnpm`/`npm`, ESLint+Prettier, `vitest`, `.editorconfig`, `.gitignore`); `package.json` deps pinned per doc 02 (`touchportal-api`, `systeminformation`, `@napi-rs/canvas`, `loudness`, `axios`, `home-assistant-js-websocket`, `obs-websocket-js`, `keytar`, `ping`, `pino`+`pino-roll`, `chokidar`, `fastify`, `open`); CI (lint→test→build→`pkg` exe→artifact) on GitHub Actions; `src/main.js` bootstrap that loads config and `tp.connect()`-pairs (doc 03 §9); `entry.tp` skeleton with one category + one state to prove pairing; `util/logger.js` (`pino` rotating, secrets redacted, doc 05 §4); `config/config.json` loader + `chokidar` hot-reload (doc 05 §1) + `fastify` `/health` (doc 05 §5). |
| **Deliverables** | Buildable repo; green CI; a `cyberdeck.exe` that pairs with TP and answers `/health`; logging + hot-reloaded config working. |
| **Dependencies** | Discovery gate (§2); pinned SDK (A6). |
| **Effort** | 9 pd. |
| **Risks** | Native build of `@napi-rs/canvas`/WinRT on CI runner; pin Node 20 + prebuilt binaries, cache `pkg` base. |
| **Acceptance** | Plugin appears in TP, pairs, logs startup at INFO, `/health` returns `connected`; editing `config.json` reloads without TP restart. |

### Phase 2 — Core Plugin Logic

| Field | Detail |
| --- | --- |
| **Tasks** | Event handling; action-execution engine; state synchronization; internal services; validation layer. |
| **Subtasks** | `core/event-bus.js` (EventEmitter pub/sub); action **router** mapping `actionId`→handler (`tp.on('Action')`, doc 03 §9) with confirm-gating for destructive power actions (AC-004); `core/state-manager.js` **delta broadcasting** via `stateUpdateMany` (doc 02 §5); `core/tile-bus.js` redraw routing; `render/renderer.js` `worker_threads` pool + `gauge/sparkline/now-playing/chart` templates → base64 PNG with per-tile hash skip (doc 02 §10, doc 04 §2); first real service `services/telemetry.js` (CPU/GPU/RAM/storage/network/uptime pollers at doc-03 intervals, `util/formatters.js`, `util/ring-buffer.js`); input **validation layer** (clamp connector 0–100, whitelist choice values, never shell-inject — doc 02 §4). |
| **Deliverables** | Working telemetry → states → dashboard gauge tiles; action router executing power/performance actions; delta-gated state engine; renderer pool. |
| **Dependencies** | Phase 1; frozen inventory (§2.2). |
| **Effort** | 18 pd. |
| **Risks** | Renderer starves the socket event loop; enforce off-thread render + redraw budget (doc 02 §10). Temp readout needs LHM (C5) → fall back to `--`. |
| **Acceptance** | CPU/GPU/RAM gauges update at 1 Hz with no stutter (NFR-003); only changed states cross the socket; a power action shows a 2-tap confirm; AC-002 (CPU temp ±1 °C) holds with LHM present. |

### Phase 3 — External Integrations

| Field | Detail |
| --- | --- |
| **Tasks** | API integrations; authentication flows; WebSocket support; REST services; retry; rate limiting. |
| **Subtasks** | `services/media.js` — SMTC via `@nodert-win10-rs4/windows.media.control`, 8 `media.*` states, 500 ms position poller, transport actions, now-playing card; volume via `loudness`, optional Spotify (doc 02 §6). `services/smarthome.js` — HA REST seed `/api/states` + WebSocket `state_changed`, service calls with 3 s `AbortController` timeout, dynamic entity `choiceUpdate` (doc 02 §8). `services/gaming.js` — process scan, FPS source (PresentMon/RTSS/hook), launchers, RAM-clean, profiles via `powercfg` (doc 02 §7). `services/notifications.js` — WinRT `UserNotificationListener`, 50-item ring buffer, badge/priority (doc 02 §9). **Auth/secrets** — `util/credentials.js` (`keytar`) + first-run settings flow for HA token / Spotify / OBS / SteamGridDB (doc 05 §2). **Resilience plumbing** — shared retry-with-backoff, per-integration rate limiting, graceful no-op when a secret/binding is absent. |
| **Deliverables** | All five services live; first-run secret wizard; degraded-mode behaviour for every optional dependency. |
| **Dependencies** | Phase 2 (state/render/router); A4 (HA), A5 (WinRT). |
| **Effort** | 22 pd. |
| **Risks** | WinRT binding missing on a host (C4) → media/notifications disabled not crashed; HA API drift → version-tolerant client; SteamGridDB/Spotify rate limits → cache + backoff. |
| **Acceptance** | AC-003 (track + art < 500 ms), AC-006 (HA light < 500 ms), AC-008 (notification badge accurate), AC-009 (launch < 3 s); pulling a token/binding degrades the relevant tiles only, with the rest live. |

### Phase 4 — Reliability & Performance

| Field | Detail |
| --- | --- |
| **Tasks** | Error handling; monitoring; performance optimization; memory management; recovery. |
| **Subtasks** | Implement the full resilience table (doc 02 §11): per-metric `--` on read error, HA-timeout entity error + toast, album-art fallback icon, config-parse defaults, secret-absent prompt. Monitoring: enrich `/health` per-service + optional `/metrics` (RSS, event-loop lag, render rate — doc 05 §5). Perf: tune worker count, redraw budget, PNG sizes; profile the socket. Memory: bound ring buffers, art cache TTL/LRU (`%TEMP%\cyberdeck_art\`), leak hunt under soak. Recovery: auto-reconnect on socket loss (< 5 s), idempotent restart, pause rendering for hidden pages on TP `broadcast`. |
| **Deliverables** | Hardened plugin passing an 8-hour soak; health/metrics dashboards; documented degraded states. |
| **Dependencies** | Phase 3. |
| **Effort** | 12 pd. |
| **Risks** | Slow memory creep from canvas buffers; cap and reuse surfaces, assert RSS in soak CI. |
| **Acceptance** | NFR-005/006 (uptime > 99.5 %, reconnect < 5 s), NFR-009/010 (< 200 MB, < 3 % idle), AC-007 (< 200 MB after 8 h); killing the plugin shows red status then auto-recovers. |

### Phase 5 — Packaging & Deployment

| Field | Detail |
| --- | --- |
| **Tasks** | Plugin packaging; versioning; upgrade strategy; distribution. |
| **Subtasks** | `pkg`-bundle `cyberdeck.exe` with prebuilt native bindings; assemble the `.tpp` tree (entry.tp, exe, config, assets/fonts/icons/backgrounds, profiles) per doc 05 §8; `plugin_start_cmd_windows` wired (doc 03 §1); semantic plugin `version` + `config.json` schema version + startup migration (doc 05 §9); `CHANGELOG.md` with an **ID-migration** section (C3); distribution via GitHub Releases + community install guide; backup/restore (config + profiles ZIP, secrets excluded). |
| **Deliverables** | `CyberDeck.tpp`; versioned release artifact; install + upgrade + backup docs. |
| **Dependencies** | Phase 4; final `.tpz` for a bundled "full setup" smoke test (§5). |
| **Effort** | 8 pd. |
| **Risks** | First-run native-binding failure on an untested host; ship prebuilt + a diagnostics log; document optional-dep fallbacks. |
| **Acceptance** | Clean import of `.tpp` on a fresh TP install starts the plugin, reaches `connected`, and the first-run wizard yields live data with no manual file edits. |

**TPP subtotal: 77 pd.**

---

## 4. TPZ (Frontend / UI Package) Development Plan

Five phases. Schema **Tasks · Deliverables · Dependencies · Risks · Acceptance** (effort
shown per phase). All visuals derive from doc 04; all bindings reference doc 03 IDs.

### Phase 1 — UX & Navigation Design

| Field | Detail |
| --- | --- |
| **Tasks** | Information architecture; user workflows; page hierarchy; navigation structure. |
| **Deliverables** | IA map of the 8-item sidebar (Dashboard, Apps, Media, System, Gaming, Smart Home, Settings, Power) + per-page bottom tabs; workflow maps for the doc 01 §5 journeys (gaming start, morning routine, notification triage); page hierarchy + nav model (sidebar everywhere, mini media bar on non-dashboard pages) per doc 04 §3. |
| **Dependencies** | Discovery gate (§2). |
| **Effort** | 5 pd. |
| **Risks** | Tap-count creep > 2 (NFR-007); validate each journey against the nav model before visual work. |
| **Acceptance** | Every page reachable in ≤ 2 taps from any page (AC-005); each §5 journey traced on the IA with tap counts. |

### Phase 2 — Visual Design

| Field | Detail |
| --- | --- |
| **Tasks** | Layout system; component design; button states; icons; color standards; branding. |
| **Deliverables** | 24×18 grid layout kit (doc 04 §3); component library (cards, gauges, sparklines, toggles, sliders, badges) from the design tokens (doc 04 §11); button default/active/disabled states; icon set (24/48/96 px, 2 px outline); color + type tokens applied; logo/wordmark. |
| **Dependencies** | Phase 1; renderer tile templates exist (TPP Phase 2) for true-to-life previews. |
| **Effort** | 9 pd. |
| **Risks** | Native TP button styling can't express the design alone (C2) → confirm which elements are plugin-rendered tiles vs native buttons early. |
| **Acceptance** | Components match tokens (hex/type/spacing) and the reference images; contrast ≥ 4.5:1 (NFR-015/AC-010); touch targets ≥ 48 px (NFR-008). |

### Phase 3 — Dynamic Interaction Design

| Field | Detail |
| --- | --- |
| **Tasks** | Action bindings; state bindings; dynamic values; conditional visibility; feedback. |
| **Deliverables** | Binding spec mapping each control → action ID (doc 03 §4) and each display → state/tile ID (doc 03 §3); connectors wired to sliders (`con.volume_master/spotify/mic`, `con.light_brightness`, `con.fan_speed`, doc 03 §5); dynamic text/value rules; conditional visibility (e.g. confirm cards, degraded `--`); tap/press visual + toast feedback. |
| **Dependencies** | Phase 2; frozen inventory (§2.2); TPP states emitting (TPP Phase 2/3). |
| **Effort** | 9 pd. |
| **Risks** | Binding to a not-yet-emitted state → coordinate with TPP phase order; use placeholder states behind a mock. |
| **Acceptance** | Every interactive control maps to a real action/connector ID; every dynamic field maps to a real state/tile ID; no dangling bindings. |

### Phase 4 — Touch Portal Page Development

Build the seven pages from doc 04 §4–§10. Per page: **Purpose · Controls · Actions · States
· Interactions · TPP dependency.**

| Page | Purpose | Key controls | Actions (doc 03) | States/tiles (doc 03/04) | Interactions | TPP dependency |
| --- | --- | --- | --- | --- | --- | --- |
| 1 Dashboard | Landing command overview | Quick-launch, media card, 3 gauges, vol slider, status | `act.media.*`, `act.system.power` (Lock), launches, `con.volume_master` | `media.*`, `system.cpu/gpu/ram.*`, `tile.dash.*_gauge`, `tile.media.nowplaying` | transport, launch, vol drag | telemetry, media services |
| 2 System Control | Admin & power | Power grid, perf modes, shortcuts, fan sliders | `act.system.power/performance/open.*/cache.clear/diskcleanup/killprocess/fan.set` | `system.*`, `tile.system.net_*_spark` | 2-tap confirm (AC-004), mode activate | telemetry, fans, power-plan |
| 3 Media Center | Audio/streaming hub | Now-playing, vol mixer, quick access, tools | `act.media.*`, `con.volume_*` | `media.*`, `tile.media.nowplaying` | transport, mixer, launch | media service |
| 4 Gaming Hub | Launch & optimize | Game grid, launcher list, optimize toggles, profiles | `act.launch.*`, `act.gaming.optimize/ram.clean/mode/record/screenshot` | `gaming.*`, `tile.gaming.*` | launch, toggle, profile apply | gaming service, SteamGridDB |
| 5 Smart Home | IoT control | Room cards, device rows, scene cards, energy | `act.home.light.toggle/brightness/scene/device.toggle/climate.temp/camera.view`, `con.light_brightness` | `home.*`, `environment.*`, `tile.home.energy_chart` | toggle, scene, brightness | smarthome (HA) service |
| 6 System Overview | Deep telemetry | Metric bar, perf chart, health gauge, processes | (display-heavy) `act.system.killprocess` | `system.*`, `system.health.score`, `tile.overview.*` | tab switch, view-all | telemetry service |
| 7 Notifications | Triage slide-over | Filter tabs, feed, mark-all | `act.notify.filter/dismiss/markallread/open` | `notify.*` | tap-open, dismiss, mark-read | notifications service |

| Field | Detail |
| --- | --- |
| **Deliverables** | Seven skinned pages exported as `.tpz` (+ `CyberDeck_Full.tpz`) per doc 05 §8. |
| **Dependencies** | Phase 3 bindings; corresponding TPP services live (esp. media/HA/notify in TPP Phase 3). |
| **Effort** | 18 pd (≈ 2–3 pd/page). |
| **Risks** | A page's TPP dependency slips → build display-only shell first, wire dynamics when the service lands. |
| **Acceptance** | Each page renders from live tiles, all controls fire the correct action/connector, no frozen values; page set imports cleanly. |

### Phase 5 — Optimization & User Testing

| Field | Detail |
| --- | --- |
| **Tasks** | Usability testing; accessibility review; workflow optimization; performance tuning. |
| **Deliverables** | Usability findings vs the §5 journeys; accessibility audit (contrast, target size, color-not-sole-signal — doc 01 §9); workflow tweaks; render/nav timing report. |
| **Dependencies** | Phase 4; TPP Phase 4 (stable tiles). |
| **Effort** | 8 pd. |
| **Risks** | Tile payloads cause visible nav lag on tablets → shrink/re-hash (C2, doc 04 §2). |
| **Acceptance** | NFR-001 (< 1 s render), NFR-002 (< 300 ms nav), AC-005/010 hold on a real Android/iOS client. |

**TPZ subtotal: 49 pd.**

---

## 5. Integration Phase

Where `.tpp` and `.tpz` meet. The contract is the socket protocol (doc 03 §8) and the
frozen ID inventory (§2.2).

### 5.1 Interaction model

| Concern | Mechanism |
| --- | --- |
| State synchronization | Plugin pushes `stateUpdate`/`stateUpdateMany` (delta-gated); tiles bind state/image IDs. |
| Event communication | Plugin `triggerEvent` on threshold crossings; user flows + page logic react. |
| Action execution | Tap → `action` message → router → service → state delta → tile redraw. |
| Connector echo | Slider drag → `connectorChange` → set → `connectorUpdate` echo keeps the slider synced to external changes. |
| Error propagation | Failed read/timeout → affected state `--` + (where relevant) toast; never a frozen value (doc 02 §11). |
| Recovery handling | Socket loss → tiles `--` + red status → TP relaunch → re-pair → states repopulate (< 5 s). |

### 5.2 Sequence diagrams

**A. Action tap → tile redraw**
```
TPZ button     TP socket        Router/Service     StateMgr      Renderer       TPZ tile
   │  tap         │                  │                │             │              │
   ├──action─────►│                  │                │             │              │
   │              ├───action msg────►│                │             │              │
   │              │                  ├─do work───────►│             │              │
   │              │                  │           delta?├─redraw req─►│              │
   │              │                  │                │        PNG  │              │
   │              │◄───stateUpdate (text) ◄───────────┤             │              │
   │              │◄───stateUpdate (tile base64 PNG) ◄─────────────┤              │
   │◄─────────────┤  (button text + image update)                  ├──renders────►│
```

**B. Connector drag → volume set → echo**
```
TPZ slider     TP socket        ConnectorRouter    loudness      StateMgr
   │ drag=70      │                  │                │             │
   ├─connectorChange─►│             │                │             │
   │              ├──connectorChange►│ clamp/scale    │             │
   │              │                  ├─setVolume(70)─►│             │
   │              │                  │                │ media.volume.system=70
   │              │◄──connectorUpdate(70)◄────────────┤             │
   │◄─────────────┤  (slider tracks external change)               │
```

**C. Threshold cross → event → user flow**
```
Telemetry      EventBus          TP socket         User flow (TPZ/automation)
   │ cpu.temp=90  │                  │                     │
   ├─emit(cpu_high)►│               │                     │
   │              ├──triggerEvent(evt.cpu_high_temp,'critical')►│
   │              │                  ├────────────────────►│ runs user-defined actions
```

### 5.3 TPP → TPZ dependency matrix

| TPZ page / element | Requires TPP service | Requires states/tiles | Requires actions/connectors |
| --- | --- | --- | --- |
| Dashboard gauges + media | telemetry, media | `system.*`, `media.*`, `tile.dash.*`, `tile.media.nowplaying` | `act.media.*`, `con.volume_master` |
| System Control | telemetry, fans, power | `system.*`, `tile.system.net_*_spark` | `act.system.*`, `con.fan_speed` |
| Media Center | media | `media.*`, `tile.media.nowplaying` | `act.media.*`, `con.volume_*` |
| Gaming Hub | gaming | `gaming.*`, `tile.gaming.*` | `act.launch.*`, `act.gaming.*` |
| Smart Home | smarthome | `home.*`, `environment.*`, `tile.home.energy_chart` | `act.home.*`, `con.light_brightness` |
| System Overview | telemetry | `system.*`, `system.health.score`, `tile.overview.*` | `act.system.killprocess` |
| Notifications | notifications | `notify.*` | `act.notify.*` |

### 5.4 Integration testing & effort

Contract tests (every page's bound IDs exist in `entry.tp`), an end-to-end harness driving
tap → state → tile, and the three sequences above replayed against a live plugin.
**Effort:** 9 pd. **Acceptance:** all §5.3 dependencies resolve; the full page set on a real
client shows live data and round-trips actions/connectors with correct echo and error
behaviour.

---

## 6. Testing Strategy

Extends doc 05 §7. Split by artifact.

### 6.1 TPP

| Test type | Scope | Tool | Pass criteria |
| --- | --- | --- | --- |
| Unit | formatters, ring buffer, credentials, provider adapters, validation | `vitest` | 100 % pass; > 80 % branch coverage |
| Integration | pairing handshake + state broadcast | mock TP socket server | all states broadcast within 3 s of startup |
| API | HA REST+WS, SMTC, OBS, SteamGridDB clients (incl. timeout/retry/rate-limit) | mocked + one live HA | correct calls, 3 s timeout honoured, backoff on 429 |
| Performance | tile-render rate, socket throughput, 8-h soak | soak reporter | RSS growth < 5 MB/h; idle CPU < 3 % |
| Failure | binding-missing, secret-missing, config-parse, socket-loss | fault injection | degrades to `--`/disabled, never crashes; auto-reconnect < 5 s |

### 6.2 TPZ

| Test type | Scope | Tool | Pass criteria |
| --- | --- | --- | --- |
| UI | tile fidelity vs design tokens/reference images | canvas snapshot diff | < 2 % pixel diff |
| Workflow | the §5 journeys end-to-end | scripted client run | each journey ≤ 2 taps to primary action |
| User acceptance (UAT) | persona tasks (doc 01 §4) | guided sessions | tasks complete; satisfaction ≥ 4.5/5 (n ≥ 50 target) |
| Device compatibility | Android + iOS + desktop companion, varied resolutions | physical/emulated devices | renders + nav timing hold; targets ≥ 48 px |

---

## 7. Release Plan

| Gate | Audience | Entry criteria | Exit criteria |
| --- | --- | --- | --- |
| **Alpha** | Internal devs | TPP Ph 1–3 + TPZ Ph 1–4 feature-complete on dashboard+media+system | Core journeys demoable; known-issue list logged |
| **Internal QA** | QA + devs | Alpha + integration phase done | All §6 TPP/TPZ suites green; AC-001…010 pass on reference HW |
| **Beta** | Invited power users | QA pass + packaging (TPP Ph 5) + `CyberDeck_Full.tpz` | Real-host install works; crash-free across beta cohort; telemetry/feedback wired |
| **Feedback cycle** | Beta cohort | Beta live | Top issues triaged + fixed; no open P0/P1; docs updated |
| **Production** | Public | Feedback cycle closed | GitHub Release published; install guide live; CHANGELOG + migration notes done |
| **Post-release monitoring** | Team | Production live | `/health` + exception logs watched; crash-free ≥ 99 % first month (doc 01 §10); hotfix path ready |

---

## 8. Resource Planning

Generic role-based team; effort in person-days. No headcount commitment implied.

| Role | Count | Primary responsibilities | Heaviest phases |
| --- | --- | --- | --- |
| Backend / plugin developer | 2 | All `.tpp` phases: services, renderer, integrations, resilience, packaging | TPP Ph 2–4 |
| Touch Portal designer | 1 | All `.tpz` phases: IA, visual, bindings, page build, UX testing | TPZ Ph 2–4 |
| QA engineer | 1 | Test harnesses, §6 suites, soak/perf, device matrix, UAT facilitation | Integration, QA, Beta |
| Technical writer | 0.5 (fractional) | Keep docs 01–06 current; install/upgrade/CHANGELOG; release notes | Discovery, Release |
| Project manager | 0.5 (fractional) | Scope, schedule, dependency/risk tracking, gate sign-offs, stakeholder comms | All |

### 8.1 RACI (R responsible · A accountable · C consulted · I informed)

| Phase | Plugin devs | TP designer | QA | Tech writer | PM |
| --- | --- | --- | --- | --- | --- |
| Discovery (§2) | C | C | C | R | A |
| TPP Ph 1–5 (§3) | R | I | C | C | A |
| TPZ Ph 1–5 (§4) | C | R | C | I | A |
| Integration (§5) | R | R | C | I | A |
| Testing (§6) | C | C | R | I | A |
| Release (§7) | C | C | C | R | A |

---

## 9. Timeline & Milestones

Bottom-up effort (independent of doc 05). Calendar uses the §8 team with TPP and TPZ running
**in parallel** after the shared discovery gate; 1 week ≈ 5 pd/person.

### 9.1 Effort roll-up

| Workstream | Effort | Parallelizable |
| --- | --- | --- |
| Discovery (shared) | 8 pd | no (gate) |
| TPP (2 devs) | 77 pd | yes |
| TPZ (1 designer) | 49 pd | yes |
| Integration | 9 pd | partial overlap |
| Testing + Release hardening | ~14 pd | overlaps Beta |

### 9.2 Critical path

**Discovery gate → TPP Phase 2 (state/render/socket core) → TPP Phase 3 (services that TPZ
binds) → Integration → QA → Beta → Production.** TPZ is *not* on the critical path until
Integration, because pages can be built against placeholder/mock states until the matching
TPP service lands — provided the inventory was frozen at §2.2.

### 9.3 Milestones

| ID | Milestone | Gate | Target (cum. weeks) |
| --- | --- | --- | --- |
| M0 | Discovery sign-off; inventory frozen | §2 exit | 2 |
| M1 | Plugin pairs + telemetry tiles live | TPP Ph 1–2 | 5 |
| M2 | Visual system + dashboard page shell | TPZ Ph 1–2 | 5 |
| M3 | All TPP integrations live (media/HA/gaming/notify) | TPP Ph 3 | 9 |
| M4 | All 7 pages bound to live states | TPZ Ph 3–4 | 9 |
| M5 | Integration complete; e2e journeys pass | §5 | 11 |
| M6 | Hardened: soak + perf budgets met | TPP Ph 4 / TPZ Ph 5 | 12 |
| M7 | Packaged; Beta released | TPP Ph 5 / §7 | 13 |
| M8 | Feedback closed; Production release | §7 | 15 |

### 9.4 Parallel workstreams & buffers

```
Wk:  1  2 | 3  4  5 | 6  7  8  9 |10 11 |12 |13 14 |15
Disc [==]
TPP        [Ph1-2====][Ph3=======][Int ][Ph4]
TPZ        [Ph1-2====][Ph3-4=====][Int ][Ph5]
Test                  [unit/integ.....][QA ][soak][Beta..][Prod]
Buffer                                  [..2-day risk buffers at M5, M7..]
```

> **Reconciliation with doc 05.** This bottom-up plan converges on the **same ~15-week
> envelope** as doc 05's 7-phase roadmap, but re-expresses it as parallel TPP/TPZ
> workstreams on a critical path through the plugin core. The two are consistent; doc 05 is
> the phase/calendar narrative, this §9 is the dependency-and-effort view. Risk buffers
> (~2 days each at M5 and M7) absorb integration and packaging slippage.

---

## 10. Risk Management

Likelihood (L) / Impact (I): H/M/L. Owner is the §8 role accountable for mitigation.

### 10.1 Technical

| Risk | L | I | Mitigation | Owner |
| --- | --- | --- | --- | --- |
| Renderer starves the socket event loop → stutter | M | H | Off-thread `worker_threads`, delta-gated redraw, ≤ 100 ms/tile budget, PNG hash skip (doc 02 §10) | Plugin dev |
| Memory creep from canvas buffers → breach NFR-009 | M | H | Reuse surfaces, bounded buffers, art-cache LRU, RSS asserted in soak CI | Plugin dev |
| CPU/GPU temp unavailable without LHM | H | M | Document LHM dependency; fall back to `--`; don't block other metrics (C5) | Plugin dev |

### 10.2 Integration

| Risk | L | I | Mitigation | Owner |
| --- | --- | --- | --- | --- |
| Inventory churn after pages built → ID renames break buttons | M | H | Freeze inventory at §2.2; treat IDs as immutable (C3); changes only via CHANGELOG migration | PM |
| TPZ blocked waiting on a TPP service | M | M | Build display-only shells against mock states; wire dynamics when service lands | TP designer |
| State/connector echo loops (slider fights plugin) | L | M | Debounce `connectorUpdate`; suppress echo on user-originated change | Plugin dev |

### 10.3 Touch Portal limitations

| Risk | L | I | Mitigation | Owner |
| --- | --- | --- | --- | --- |
| Base64-PNG tile payloads bloat socket / lag tablets | M | H | Cap tile sizes (≤ 256/400 px), hash-skip identical frames, pause hidden pages (C2) | Plugin dev |
| Single newline-JSON socket is the only channel | L | M | Keep messages small, batch with `stateUpdateMany`, no oversized payloads (C1) | Plugin dev |
| Native button styling can't fully express the design | M | M | Decide tile-vs-native split in TPZ Ph 2; render rich elements as tiles | TP designer |
| API-12 quirks / SDK signature drift | M | M | Pin SDK, verify signatures pre-Phase-2 (A6), keep a thin TP-adapter layer | Plugin dev |

### 10.4 Third-party dependencies

| Risk | L | I | Mitigation | Owner |
| --- | --- | --- | --- | --- |
| WinRT bridge won't build/run on a host → no media/notifications | M | H | Ship prebuilt bindings in the exe; optionalDependencies; degrade not crash (C4) | Plugin dev |
| Home Assistant API version drift / LAN latency | M | M | Version-tolerant client, 3 s timeout + retry, REST fallback when WS down | Plugin dev |
| SteamGridDB / Spotify rate limits or outage | M | L | Cache art to disk, backoff, no-op without token | Plugin dev |
| OBS/Streamlabs not present | M | L | Feature-gate behind connection check; hide unavailable actions | Plugin dev |

---

## Appendix — Effort summary

| Workstream | Effort (pd) |
| --- | --- |
| Discovery (shared) | 8 |
| TPP Ph 1–5 | 77 |
| TPZ Ph 1–5 | 49 |
| Integration | 9 |
| **Total build** | **143 pd** |

Calendar (≈ 15 weeks) follows from running TPP (2 devs) and TPZ (1 designer) in parallel on
the §9.2 critical path, with QA/testing overlapping and ~2-day buffers at M5 and M7.
