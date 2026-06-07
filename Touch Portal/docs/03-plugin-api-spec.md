# CyberDeck — Plugin API Specification

Version 1.0 · June 2026 · Touch Portal API 12 · `touchportal-api` (Node SDK)

This document is the contract between the CyberDeck plugin and Touch Portal. It defines
the `entry.tp` manifest, every state/action/event/connector/setting, the socket protocol,
and how the Node SDK wires it together. All identifiers use the reverse-DNS namespace
`com.shishir.cyberdeck.*`.

## 1. The `entry.tp` manifest

Touch Portal loads a plugin from a JSON description file named `entry.tp` at the root of
the plugin package. The root object for CyberDeck:

```jsonc
{
  "sdk": 6,                     // legacy key; kept for older-client tolerance
  "api": 12,                    // Touch Portal 4.5+
  "version": 1,                 // integer plugin version (sent back after pairing)
  "name": "CyberDeck",
  "id": "com.shishir.cyberdeck",
  "configuration": {
    "colorDark": "#0D0D1A",
    "colorLight": "#7B2FBE",
    "parentCategory": "system"  // CyberDeck actions group under the System category
  },
  "plugin_start_cmd_windows": "\"%TP_PLUGIN_FOLDER%CyberDeck\\cyberdeck.exe\"",
  "settings": [ /* §6 */ ],
  "settingsDescription": "CyberDeck setup: enter your Home Assistant URL and token...",
  "categories": [
    {
      "id": "com.shishir.cyberdeck.cat.system",
      "name": "CyberDeck · System",
      "imagepath": "%TP_PLUGIN_FOLDER%CyberDeck/assets/icons/cd_24.png",
      "actions":    [ /* §4 */ ],
      "connectors": [ /* §5 */ ],
      "states":     [ /* §3 */ ],
      "events":     [ /* §7 */ ]
    },
    { "id": "com.shishir.cyberdeck.cat.media",    "name": "CyberDeck · Media",    "...": "" },
    { "id": "com.shishir.cyberdeck.cat.gaming",   "name": "CyberDeck · Gaming",   "...": "" },
    { "id": "com.shishir.cyberdeck.cat.home",     "name": "CyberDeck · Smart Home","...": "" },
    { "id": "com.shishir.cyberdeck.cat.notify",   "name": "CyberDeck · Notifications","...": "" }
  ]
}
```

Manifest-key reference (from the Touch Portal API):

| Key | Req. | Purpose |
| --- | --- | --- |
| `api` | yes | Target API level. CyberDeck targets **12** (introduced in TP 4.5). |
| `version` | yes | Integer; CyberDeck's own version, echoed back on pair. |
| `name` / `id` | yes | Display name and globally unique ID. |
| `configuration.colorDark/Light` | no | Colors for rendered action/event blocks in TP. |
| `configuration.parentCategory` | no | Top-level grouping. CyberDeck uses `system`; valid values include `audio`, `streaming`, `homeautomation`, `games`, `system`, `tools`, `misc`. |
| `plugin_start_cmd_windows` | no | Command TP runs to start the plugin on Windows. `%TP_PLUGIN_FOLDER%` expands to the plugins base folder. |
| `settings` | no | Plugin settings array (§6). |
| `categories` | yes | Action/event/connector/state grouping; at least one item each. |

CyberDeck uses five categories (System, Media, Gaming, Smart Home, Notifications) so the
plugin's actions are organized for the user when they build their own flows.

## 2. State, action, event and connector ID conventions

| Element | Pattern | Example |
| --- | --- | --- |
| State | `com.shishir.cyberdeck.<domain>.<field>` | `com.shishir.cyberdeck.system.cpu.temp` |
| Image (tile) state | `com.shishir.cyberdeck.tile.<page>.<name>` | `com.shishir.cyberdeck.tile.dash.cpu_gauge` |
| Action | `com.shishir.cyberdeck.act.<domain>.<verb>` | `com.shishir.cyberdeck.act.system.shutdown` |
| Event | `com.shishir.cyberdeck.evt.<name>` | `com.shishir.cyberdeck.evt.cpu_high_temp` |
| Connector | `com.shishir.cyberdeck.con.<name>` | `com.shishir.cyberdeck.con.volume_master` |

IDs are immutable once shipped: Touch Portal stores a local copy of any state/action a
user references, so renaming an ID breaks existing user buttons. Changes go through the
versioned migration notes in [doc 05](05-operations-and-roadmap.md).

## 3. States

States are text or choice values the plugin pushes to Touch Portal; the UI binds them in
button text and image fields. CyberDeck uses two state kinds:

- **`text` states** for telemetry/media/notification values (the API supports smart
  conversion: a `#AARRGGBB` text state can be read as a color, and a **base64 PNG** text
  state can be rendered as a button image — this is the tile-rendering mechanism).
- **`choice` states** for enumerated modes (power plan, game profile).

Example state definitions in `entry.tp`:

```jsonc
{
  "id": "com.shishir.cyberdeck.system.cpu.temp",
  "type": "text",
  "desc": "CyberDeck · CPU temperature",
  "default": "--",
  "parentGroup": "CyberDeck System"
},
{
  "id": "com.shishir.cyberdeck.tile.dash.cpu_gauge",
  "type": "text",
  "desc": "CyberDeck · CPU gauge image (base64 PNG)",
  "default": "",
  "parentGroup": "CyberDeck Tiles"
},
{
  "id": "com.shishir.cyberdeck.system.powerplan",
  "type": "choice",
  "desc": "CyberDeck · Active power plan",
  "default": "Balanced",
  "valueChoices": ["Silent", "Balanced", "Performance", "Turbo"],
  "parentGroup": "CyberDeck System"
}
```

### System telemetry states

| State ID (suffix after `…cyberdeck.`) | Type | Update | Source | Example |
| --- | --- | --- | --- | --- |
| `system.cpu.load` | text | 1 s | systeminformation | `28.4` |
| `system.cpu.temp` | text | 1 s | SI / LHM | `42.0` |
| `system.cpu.frequency` | text | 1 s | systeminformation | `4.28 GHz` |
| `system.cpu.cores` / `.threads` | text | startup | systeminformation | `8` / `16` |
| `system.gpu.load` / `.temp` | text | 1 s | SI graphics | `67.0` / `55.0` |
| `system.gpu.vram.used` / `.total` | text | 1 s | SI graphics | `7.4 GB` / `12.0 GB` |
| `system.ram.used` / `.available` / `.percent` / `.total` | text | 1 s | SI mem | `10.2 GB` / `5.8 GB` / `64.0` / `16.0 GB` |
| `system.storage.used_tb` / `.free_tb` | text | 10 s | SI fsSize | `2.91` / `2.11` |
| `system.network.download` / `.upload` | text | 1 s | SI networkStats | `125.6` / `23.4` |
| `system.network.ping` | text | 5 s | ping | `8 ms` |
| `system.uptime` | text | 60 s | SI time | `2d 14h 36m` |
| `system.health.score` | text | 5 s | computed | `92` |
| `system.powerplan` | choice | 5 s | powercfg | `Balanced` |

### Media states

| Suffix | Type | Update | Example |
| --- | --- | --- | --- |
| `media.track` / `.artist` / `.album` | text | 0.5 s | `Blinding Lights` / `The Weeknd` / `After Hours` |
| `media.duration` / `.position` | text | 0.5 s | `3:20` / `1:24` |
| `media.playing` | text | 0.5 s | `true` |
| `media.albumart.b64` | text | on track change | base64 PNG of now-playing card |
| `media.volume.system` / `.spotify` | text | 1 s | `70` / `65` |
| `media.shuffle` / `.repeat` | text | 0.5 s | `true` / `false` |

### Gaming states

| Suffix | Type | Update | Example |
| --- | --- | --- | --- |
| `gaming.fps` | text | 1 s | `144` |
| `gaming.currentgame` | text | 5 s | `Cyberpunk 2077` |
| `gaming.mode` | choice | 1 s | `Competitive` |
| `gaming.recording` | text | 1 s | `false` |
| `gaming.network.ping` / `.download` | text | 1 s | `18 ms` / `125.6` |

### Notification states

| Suffix | Type | Update | Example |
| --- | --- | --- | --- |
| `notify.count` | text | 1 s | `6` |
| `notify.latest.title` / `.source` / `.time` | text | 1 s | `See you in stream!` / `Discord` / `10:28 PM` |
| `notify.priority` | text | 1 s | `high` |

### Tile (image) states

One `tile.*` state per visual component, each holding a base64 PNG: e.g.
`tile.dash.cpu_gauge`, `tile.dash.gpu_gauge`, `tile.dash.ram_gauge`,
`tile.media.nowplaying`, `tile.overview.perf_chart`, `tile.home.energy_chart`,
`tile.system.net_down_spark`, etc. See [doc 04](04-ui-and-design-system.md) for the full
tile inventory per page.

## 4. Actions

Actions are JSON objects the user adds to buttons. CyberDeck uses **dynamic
(`type: "communicate"`)** actions — taps are delivered to the plugin over the socket —
except for a few **static (`type: "execute"`)** launch actions that can run a command
directly without the plugin. Each action uses the API-12 `lines` structure (the old
`format` attribute is deprecated).

Example dynamic action (set master volume is a connector; here is a discrete action):

```jsonc
{
  "id": "com.shishir.cyberdeck.act.system.power",
  "name": "System Power Action",
  "type": "communicate",
  "lines": {
    "action": [
      { "language": "default",
        "data": [ { "lineFormat": "CyberDeck: power → {$mode$}" } ] }
    ]
  },
  "data": [
    { "id": "mode", "type": "choice", "default": "Lock",
      "valueChoices": ["Shutdown", "Restart", "Sleep", "Hibernate", "Lock", "Log Off"] }
  ]
}
```

Example static launch action (no plugin needed):

```jsonc
{
  "id": "com.shishir.cyberdeck.act.launch.steam",
  "name": "Launch Steam",
  "type": "execute",
  "execution_cmd": "cmd /c start steam://open/main",
  "lines": { "action": [ { "language": "default",
    "data": [ { "lineFormat": "CyberDeck: launch Steam" } ] } ] }
}
```

### Media actions

| Action ID suffix | Description | Data | Notes |
| --- | --- | --- | --- |
| `act.media.play` / `.pause` / `.next` / `.previous` | Transport control | — | SMTC session call |
| `act.media.shuffle` / `.repeat` | Toggle / cycle | — | Reflects real state back |
| `act.media.volume` | Set master volume | `level` number 0–100 | Also exposed as a connector (§5) |
| `act.media.volume.spotify` | Set Spotify app volume | `level` number 0–100 | No-op without token |

### System actions

| Action ID suffix | Description | Data | Confirm |
| --- | --- | --- | --- |
| `act.system.power` | Shutdown/Restart/Sleep/Hibernate/Lock/Log Off | `mode` choice | 2-tap for Shutdown/Restart/Hibernate/Log Off |
| `act.system.performance` | Apply power plan | `profile` choice (Silent/Balanced/Performance/Turbo) | No |
| `act.system.killprocess` | Kill process by PID | `pid` number | No |
| `act.system.open` | Open a Windows tool | `tool` choice (Task Manager, Control Panel, Device Manager, Services, …) | No |
| `act.system.cache.clear` | Clear file cache | — | No |
| `act.system.diskcleanup` | Launch Disk Cleanup | `drive` choice (default C:) | No |
| `act.system.fan.set` | Set a fan speed | `fan` choice, `level` number 0–100 | No (also a connector) |

### Gaming actions

| Action ID suffix | Description | Data |
| --- | --- | --- |
| `act.launch.steam` / `.epic` / `.battlenet` / `.xbox` / `.gog` | Launch a game launcher (static) | — |
| `act.gaming.ram.clean` | Trim non-critical working sets | — |
| `act.gaming.mode` | Apply game profile | `profile` choice (Competitive/AAA/Streaming/Battery Saver) |
| `act.gaming.screenshot` | Capture screenshot | `path` text (optional) |
| `act.gaming.record` | Toggle clip recording (OBS) | — |
| `act.gaming.optimize` | Toggle an optimization | `feature` choice (Performance/Network/RAM/Temp/FPS-limit), `on` switch |

### Smart-home actions

| Action ID suffix | Description | Data |
| --- | --- | --- |
| `act.home.light.toggle` | Toggle light entity | `entity_id` text |
| `act.home.light.brightness` | Set brightness | `entity_id` text, `level` number 0–100 |
| `act.home.scene` | Activate a scene | `scene_id` text |
| `act.home.device.toggle` | Toggle any switch/plug | `entity_id` text |
| `act.home.climate.temp` | Set thermostat target | `entity_id` text, `temp` number 10–35 |
| `act.home.camera.view` | Open a camera stream | `entity_id` text |

### Notification actions

| Action ID suffix | Description | Data |
| --- | --- | --- |
| `act.notify.dismiss` | Dismiss one item | `notif_id` text |
| `act.notify.markallread` | Clear the badge | — |
| `act.notify.filter` | Set source filter | `source` choice (All/System/Apps/Alerts/Messages) |
| `act.notify.open` | Open source app | `app` text |

## 5. Connectors (sliders & dials)

Connectors back the sliders in the UI (volume, brightness, fan speed). Sliders always
send an integer 0–100; dials may send a wider range, so the plugin clamps and scales.
`supportedTypes` (API 12) lets a connector serve both sliders and dials.

```jsonc
{
  "id": "com.shishir.cyberdeck.con.volume_master",
  "name": "Master Volume",
  "format": "CyberDeck: master volume",
  "supportedTypes": ["slider", "dial"]
}
```

| Connector ID suffix | Controls | Range |
| --- | --- | --- |
| `con.volume_master` | System master volume | 0–100 |
| `con.volume_spotify` | Spotify app volume | 0–100 |
| `con.volume_mic` | Microphone level | 0–100 |
| `con.light_brightness` | A light entity (entity in data) | 0–100 |
| `con.fan_speed` | A fan (fan id in data) | 0–100 |

The plugin can push a connector's current value back to the slider (so the slider tracks
external changes) via `connectorUpdate`. See §9.

## 6. Settings

```jsonc
"settings": [
  { "name": "Home Assistant URL", "type": "text",
    "default": "http://homeassistant.local:8123" },
  { "name": "Ping Host", "type": "text", "default": "1.1.1.1" },
  { "name": "FPS Source", "type": "text", "default": "auto" },
  { "name": "Tile Theme", "type": "text", "default": "cyberpunk" }
]
```

Secrets (Home Assistant long-lived token, Spotify client secret, OBS password) are **not**
stored in `entry.tp` settings or `config.json`; they live in Windows Credential Manager via
`keytar` and are entered through a first-run settings flow. `settingsDescription` renders a
short setup guide at the top of the plugin's settings page.

## 7. Events

Events let users trigger their own Touch Portal flows when a CyberDeck state crosses a
condition. Each event links to a `valueStateId`.

```jsonc
{
  "id": "com.shishir.cyberdeck.evt.cpu_high_temp",
  "name": "When CPU temperature is high",
  "format": "CyberDeck: CPU temp alert is $val",
  "type": "communicate",
  "valueType": "choice",
  "valueChoices": ["normal", "warning", "critical"],
  "valueStateId": "com.shishir.cyberdeck.system.cpu.thermal_state"
}
```

| Event ID suffix | Trigger | Linked state |
| --- | --- | --- |
| `evt.cpu_high_temp` | CPU thermal state changes | `system.cpu.thermal_state` |
| `evt.gpu_high_temp` | GPU thermal state changes | `system.gpu.thermal_state` |
| `evt.ram_high_usage` | RAM > 90 % | `system.ram.alert` |
| `evt.storage_low` | Any drive < 10 % free | `system.storage.alert` |
| `evt.network_down` | No traffic for 5 s | `system.network.status` |
| `evt.track_changed` | SMTC track change | `media.track` |
| `evt.notification` | New notification | `notify.latest.source` |
| `evt.device_offline` | HA entity unavailable | `home.device.status` |
| `evt.fps_low` | FPS < 30 for 5 s | `gaming.fps_state` |
| `evt.plugin_status` | Plugin connect/error | `plugin.status` |

To carry extra data into the user's flow, events declare `localstates` (API 10), e.g. the
`evt.notification` event exposes `localstate` values for source, title and body so the user
can use them in their triggered actions.

## 8. Socket protocol

Touch Portal and the plugin communicate over a TCP socket on `127.0.0.1:12136` using
UTF-8 JSON messages, each terminated by a newline (`\n`). Communication is asynchronous.

**Pairing.** On connect, the plugin sends:

```json
{"type":"pair","id":"com.shishir.cyberdeck"}
```

Touch Portal replies with an `info` message containing `sdkVersion`,
`tpVersionString`/`tpVersionCode`, the plugin's `pluginVersion`, current `settings`, and
(on a mid-session restart) the current page paths per device.

**Incoming messages** the plugin handles: `action` (button/flow execute),
`connectorChange` (slider/dial moved), `listChange`, `settings` (settings changed),
`closePlugin`, `broadcast` (e.g. page changed — used to pause rendering for hidden pages),
and `notificationOptionClicked`.

**Outgoing messages** the plugin sends: `stateUpdate` / `createState` / `removeState`,
`connectorUpdate`, `choiceUpdate` (populate dynamic dropdowns, e.g. live entity lists),
`triggerEvent`, `settingUpdate`, and `createNotification`.

Example outgoing state update:

```json
{"type":"stateUpdate","id":"com.shishir.cyberdeck.system.cpu.temp","value":"43.5"}
```

## 9. Node SDK usage (`touchportal-api`)

The plugin uses the community `touchportal-api` package, which wraps the socket protocol
above. Skeleton:

```js
import TP from 'touchportal-api';
import pluginEntry from '../entry.tp' assert { type: 'json' };

const tp = new TP.Client();

tp.on('connected', (info) => {
  logger.info({ tp: info.tpVersionString }, 'paired with Touch Portal');
  startServices(tp);                       // telemetry, media, gaming, ...
});

tp.on('Action', (msg) => {
  // msg.actionId === 'com.shishir.cyberdeck.act.system.power'
  // msg.data === [{ id: 'mode', value: 'Restart' }]
  router.handleAction(msg);
});

tp.on('ConnectorChange', (msg) => {
  // msg.connectorId, msg.value (0..100)
  router.handleConnector(msg);
});

tp.on('Settings', (s) => config.applySettings(s));
tp.on('Close',   () => shutdownGracefully());

tp.connect({ pluginId: 'com.shishir.cyberdeck' });
```

The state manager batches updates and pushes only changed values:

```js
// delta-broadcast: only changed states cross the socket
tp.stateUpdateMany(changedStates);                       // [{id, value}, ...]

// push a rendered tile (base64 PNG) to an image state
tp.stateUpdate('com.shishir.cyberdeck.tile.dash.cpu_gauge', pngBase64);

// keep a slider in sync with an external volume change
tp.connectorUpdate('com.shishir.cyberdeck.con.volume_master', currentVolume, {});

// fire an event the user can react to
tp.triggerEvent('com.shishir.cyberdeck.evt.cpu_high_temp', 'critical', {});

// populate a dynamic dropdown (e.g. live Home Assistant entities)
tp.choiceUpdate('entity_id', haEntityIds);
```

> Method names follow the `touchportal-api` surface (`stateUpdate`, `stateUpdateMany`,
> `connectorUpdate`, `choiceUpdate`, `triggerEvent`, `createState`, `removeState`,
> `sendNotification`). Pin the SDK major version and verify the exact signatures against
> the installed package before implementation, since community SDKs evolve.
