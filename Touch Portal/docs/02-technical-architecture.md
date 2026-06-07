# CyberDeck — Technical Architecture

Version 1.0 · June 2026 · Backend: Node.js 20 LTS

## 1. High-level architecture

CyberDeck is composed of four layers:

1. **Presentation layer** — Custom Touch Portal pages running on the Android/iOS/desktop
   Touch Portal client. Tiles display plugin-rendered graphics and plugin states.
2. **Communication layer** — The Touch Portal plugin socket (TCP, JSON-over-newline) on
   `127.0.0.1:12136`, wrapped by the `touchportal-api` Node SDK.
3. **Plugin layer** — A Node.js 20 process (`com.shishir.cyberdeck`) running an
   event-loop-driven core, a state manager, a tile renderer, and one service per domain.
4. **Integration layer** — OS and third-party data sources: Windows performance counters,
   SMTC, WinRT notifications, Core Audio, Home Assistant, OBS/Streamlabs.

```
┌─────────────────────────────────────────────────────────────┐
│  Touch Portal client  (Android / iOS / desktop)             │
│  Page 1..7  ──tiles & states──>  rendered by plugin         │
└───────────────▲───────────────────────────┬─────────────────┘
                │  state/connector updates   │  action / connector events
                │  (outgoing)                 ▼  (incoming)
┌───────────────┴───────────────────────────────────────────────┐
│  Touch Portal plugin socket  127.0.0.1:12136  (JSON + \n)      │
└───────────────▲───────────────────────────────────────────────┘
                │  touchportal-api (Node SDK)
┌───────────────┴───────────────────────────────────────────────┐
│  CyberDeck plugin  (Node.js 20)                                │
│  ┌──────────┐  ┌───────────────┐  ┌───────────────────────┐   │
│  │ Core /   │  │ Tile renderer │  │ Services              │   │
│  │ State mgr│◄─┤ (node-canvas) │◄─┤ telemetry  media      │   │
│  │ Event bus│  └───────────────┘  │ gaming     smarthome  │   │
│  └────┬─────┘                     │ notifications  fans   │   │
└───────┼──────────────────────────┴──────────┬────────────────┘
        │                                       │
   systeminformation / loudness / SMTC     Home Assistant / OBS /
   / WinRT / child_process / keytar        Streamlabs / SteamGridDB
```

## 2. Why Node.js, and what changes from a native plugin

The backend is Node.js 20 LTS. Touch Portal does not care what language a plugin is
written in — it only speaks the JSON socket protocol — so Node is a first-class choice
and is supported by the community `touchportal-api` SDK (see [doc 03](03-plugin-api-spec.md)).

Two architectural consequences follow from choosing Node:

- **Data access is via native-binding npm packages, not OS SDKs directly.** Where a
  Python build would use `psutil`/`GPUtil`/`pywin32`, the Node build uses
  `systeminformation`, `loudness`, NodeRT/WinRT bridges and targeted PowerShell
  shell-outs. Section 4 maps every data source.
- **Rich tiles are rendered in-process with `node-canvas`.** The Touch Portal States API
  accepts a base64 PNG as a state value for visual buttons. CyberDeck draws each gauge,
  sparkline, album-art card and chart to an off-screen canvas and pushes the PNG to the
  relevant tile state. This is how the reference UI is achieved on a button grid.

## 3. Plugin process model

| Concern | Decision |
| --- | --- |
| Runtime | Node.js 20 LTS (bundled as a standalone `.exe` via `pkg` so users need no Node install) |
| Concurrency | Single-threaded event loop; each service is a set of `setInterval`/async pollers; heavy work (canvas, image decode) offloaded to a `worker_threads` pool |
| Entry point | `src/main.js` |
| TP connection | `touchportal-api` `Plugin` instance; `connect()` pairs on startup |
| Configuration | `config/config.json` (non-secret) + Windows Credential Manager via `keytar` (secrets) |
| Logging | `pino` to a rotating file: `logs/cyberdeck.log` |
| Hot reload | `chokidar` watches `config.json`; config changes apply without a TP restart |
| Health | `fastify` health endpoint on `127.0.0.1:9124/health` |
| Process start | Touch Portal launches it via `plugin_start_cmd_windows` (see doc 03) |

### Module structure

```
src/
├── main.js                  Bootstrap: load config, connect TP, start services
├── core/
│   ├── state-manager.js     Central state registry; delta broadcasting to TP
│   ├── event-bus.js         Internal pub/sub (Node EventEmitter) between services
│   └── tile-bus.js          Routes "tile needs redraw" requests to the renderer
├── render/
│   ├── renderer.js          node-canvas worker pool; PNG → base64
│   ├── gauge.js             Circular gauge template
│   ├── sparkline.js         60-sample line template
│   ├── now-playing.js       Album-art + waveform card
│   └── chart.js             Rolling line / donut / bar templates
├── services/
│   ├── telemetry.js         CPU/GPU/RAM/storage/network/uptime
│   ├── media.js             SMTC metadata + transport control
│   ├── gaming.js            FPS, RAM clean, launchers, profiles
│   ├── smarthome.js         Home Assistant REST + WebSocket client
│   ├── notifications.js     WinRT UserNotificationListener aggregation
│   └── fans.js              Fan RPM read + control
└── util/
    ├── credentials.js       keytar wrapper (Credential Manager)
    ├── ring-buffer.js       Fixed-size history buffer for sparklines
    ├── formatters.js        Value → display-string with units
    └── logger.js            pino instance
```

## 4. Data-source provider map (Python → Node.js)

Every data source is abstracted behind a **provider interface** so an implementation can
be swapped (for example AMD vs NVIDIA GPU readout) without touching service logic. The
table below is the authoritative dependency decision for the implementation.

| Metric / capability | Reference (Python) | CyberDeck (Node.js) | Notes |
| --- | --- | --- | --- |
| CPU load / freq / cores | `psutil` | `systeminformation` `currentLoad()`, `cpu()` | Cross-platform, no native build on Win |
| CPU / GPU temperature | `psutil` / WMI | `systeminformation` `cpuTemperature()`, `graphics()` | On Windows, temps require LibreHardwareMonitor running; fall back to `--` |
| GPU load / VRAM | `GPUtil` | `systeminformation` `graphics()` | NVIDIA + AMD via SI controllers |
| RAM usage | `psutil` | `systeminformation` `mem()` | |
| Storage used/free | `psutil` | `systeminformation` `fsSize()` | Poll at 10 s |
| Network up/down | `psutil` | `systeminformation` `networkStats()` | Compute Mbps from byte deltas |
| Ping | `icmplib` | `ping` (npm) | ICMP echo to a configurable host |
| Uptime | `psutil` | `systeminformation` `time().uptime` | |
| Top processes | `psutil` | `systeminformation` `processes()` | Sort by CPU; cap to N rows |
| Fan RPM (read) | WMI | `node-wmi` / PowerShell → LibreHardwareMonitor WMI namespace | Optional; needs LHM |
| Fan / power-plan control | WMI | `child_process` → `powercfg` / vendor CLI | Validate input; never shell-inject |
| Media metadata + transport | SMTC via pywin32 | `@nodert-win10-rs4/windows.media.control` (WinRT) | Or a small bundled helper exe; see §6 |
| System master volume | `pycaw` | `loudness` (npm) | get/set/mute master volume |
| Per-app / Spotify volume | Spotify Web API | `spotify-web-api-node` (optional token) | Graceful no-op without token |
| Windows notifications | WinRT | `@nodert-win10-rs4/windows.ui.notifications.management` | Requires OS notification-access grant |
| Home Assistant | `requests` | `axios` + `home-assistant-js-websocket` | REST for actions, WS for live events |
| OBS / Streamlabs | obs-websocket | `obs-websocket-js` | Scene switch, recording, replay |
| Secrets storage | `keyring` | `keytar` | Windows Credential Manager |
| App / file launching | `os.startfile` | `child_process.exec` / `open` (npm) | Absolute paths; quoted args |
| RAM working-set trim | `EmptyWorkingSet` (psapi) | `child_process` → bundled `EmptyWorkingSet` helper, or `koffi` FFI to `psapi.dll` | Requires elevation for some PIDs |
| Game cover art | SteamGridDB | `axios` → SteamGridDB API | Cache to `assets/gameart/` |
| Tile rendering | (Pillow) | `node-canvas` (`@napi-rs/canvas`) | Off-thread; PNG → base64 |
| Logging | `logging` | `pino` + `pino-roll` | 5 × 10 MB rotation |
| Config watch | `watchdog` | `chokidar` | Hot reload |
| Health endpoint | (aiohttp) | `fastify` | `/health`, optional `/metrics` |

### Recommended `package.json` dependencies

```json
{
  "dependencies": {
    "touchportal-api": "^4",
    "systeminformation": "^5",
    "@napi-rs/canvas": "^0.1",
    "loudness": "^0.4",
    "axios": "^1",
    "home-assistant-js-websocket": "^9",
    "obs-websocket-js": "^5",
    "keytar": "^7",
    "ping": "^0.4",
    "pino": "^9",
    "pino-roll": "^2",
    "chokidar": "^3",
    "fastify": "^4",
    "open": "^10"
  },
  "optionalDependencies": {
    "@nodert-win10-rs4/windows.media.control": "*",
    "@nodert-win10-rs4/windows.ui.notifications.management": "*",
    "spotify-web-api-node": "^5",
    "koffi": "^2"
  }
}
```

> WinRT bridges (`@nodert-*`) are listed as optional so the plugin still installs and
> runs (with media/notifications degraded) on machines where the native bindings cannot
> build. The bundled `.exe` produced by `pkg` ships prebuilt bindings so end users never
> compile anything.

## 5. Telemetry pipeline

1. `TelemetryService.start()` registers one poller per metric at its configured interval
   (CPU/GPU/RAM/network 1 s, storage 10 s, uptime 60 s).
2. Each poller calls its provider (mostly `systeminformation` promises).
3. The raw value is passed to a `formatters` function (`formatTemp(42.0) → "42.0"`).
4. The formatted value is written to the metric's ring buffer and to the state manager.
5. `StateManager` performs **delta broadcasting**: it calls `tp.stateUpdate(id, value)`
   only for states whose value changed since the last cycle (≈80 % less socket traffic at
   idle).
6. If a value crosses a threshold, `eventBus.emit(eventId, payload)` fires the
   corresponding Touch Portal event (see doc 03 §events).
7. Any state bound to a visual tile additionally enqueues a redraw on `tile-bus`; the
   renderer produces a PNG and pushes it to that tile's image state.

## 6. Media pipeline

The media service subscribes to the Windows `GlobalSystemMediaTransportControlsSession`
via the WinRT bridge. On a session/track change it reads title, artist, album and the
thumbnail stream, writes the eight `media.*` states atomically, decodes the thumbnail,
and asks the renderer to composite the now-playing card (album art + waveform + progress).
A 500 ms poller updates `media.position`. Transport actions
(play/pause/next/previous/shuffle/repeat) call the session's control methods. System
master volume uses `loudness`; optional Spotify app volume uses the Spotify Web API when a
token is configured.

If the WinRT bridge is unavailable, the service degrades: metadata states show `--`, the
card falls back to a default music icon, and transport actions are disabled rather than
throwing.

## 7. Gaming pipeline

The gaming service scans running processes (`systeminformation processes()`) to detect the
current game, reads FPS from a configured source (PresentMon/FrameView CSV, RTSS shared
memory, or a custom hook), and exposes optimization actions. The RAM cleaner trims working
sets of non-critical processes. Game profiles apply a Windows power plan via `powercfg`
and adjust process priorities. Launcher actions shell out to the installed launcher
executable; a missing launcher surfaces a toast rather than an error.

## 8. Smart-home pipeline

On startup the smart-home service reads the Home Assistant base URL from config and the
long-lived token from Credential Manager, fetches `/api/states` to seed entity state, and
opens a WebSocket to the HA event bus for real-time `state_changed` events. Entity states
map to `home.*` / `environment.*` Touch Portal states. Actions (`light.toggle`,
`scene.activate`, `climate.set_temperature`, …) call `/api/services/{domain}/{service}`
with a 3 s timeout; on timeout the affected entity tile shows an error state. Environment
sensors poll every 30 s over REST when WebSocket events are unavailable.

## 9. Notification pipeline

The notification service registers a WinRT `UserNotificationListener` (requires the OS
notification-access grant). Its `OnNotificationAdded` callback parses each notification
into a `NotificationItem` and appends it to a 50-item ring buffer (oldest discarded). The
`notification.count` state is incremented and the `notification.latest.*` states updated.
Source-based priority is assigned (Discord DM = high, system info = low). The service
exposes `dismiss(id)` and `markAllRead()`. The Dashboard badge reads `notification.count`;
the slide-over reads the full buffer.

## 10. Rendering budget

The renderer is the most resource-sensitive part of a Node build, so it is bounded:

- All canvas work runs in a `worker_threads` pool (2 workers by default) to keep the main
  event loop free for the socket.
- A tile is redrawn only when its bound state actually changes (delta-gated), and at most
  once per animation frame budget (~100 ms) per tile.
- Rendered PNGs are kept small (square, ≤ 256×256 for gauges, ≤ 400×400 for cards) to keep
  base64 payloads light over the socket.
- A per-tile hash skips re-encoding when the drawn output is pixel-identical to the last
  push.

These rules keep the plugin within NFR-009 (< 200 MB) and NFR-010 (< 3 % CPU idle).

## 11. Error-handling and resilience

| Failure | Detection | User-visible response | Recovery |
| --- | --- | --- | --- |
| Plugin crash | TP detects socket loss | Tiles show `--`; sidebar status red | TP relaunches via plugin manager (< 5 s) |
| Telemetry read error | Rejected provider promise | Affected metric shows `--` | Log; continue other metrics; retry next cycle |
| HA API timeout (3 s) | `AbortController` timeout | Entity shows error state; toast | Retry next poll; show last value |
| Album-art fetch fail | Stream/HTTP error | Default music icon | Log; retry on next track change |
| Config parse error | JSON parse throw at start | Start with defaults; log warning | User corrects `config.json` (hot-reloaded) |
| Secret not found | `keytar` returns null | Prompt to configure in settings | Open settings; service stays degraded |
| WinRT binding missing | Require throws | Media/notifications disabled, not crashed | Document optional native deps |

State update failures always render the affected component as `--` rather than the last
known (stale) value, so the user never sees frozen data presented as live.
