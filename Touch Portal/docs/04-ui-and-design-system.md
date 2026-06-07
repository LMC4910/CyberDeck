# CyberDeck — UI & Design System

Version 1.0 · June 2026 · Cyberpunk theme · 7 pages

This document is the authoritative reference for the CyberDeck visual layer. It covers
the tile-rendering pipeline (how a Node.js plugin draws gauges, cards and charts onto a
Touch Portal button grid), the seven page specifications, and the cyberpunk design tokens
(color, type, spacing, components). The reference renders the design intent for each page
live in the [`Reference Images`](../../Reference%20Images) folder.

The implementation must satisfy this document together with [doc 02](02-technical-architecture.md)
(architecture) and [doc 03](03-plugin-api-spec.md) (the state/tile contract). Where a tile
is named here (e.g. `tile.dash.cpu_gauge`), it maps to an image state defined in doc 03 §3.

## 1. Design philosophy

CyberDeck looks like a futuristic operating-system control surface, not a default Touch
Portal grid. Three rules drive every screen:

1. **Dark-neon, glassmorphic.** A near-black blue-violet background (`#0D0D1A`) carries
   translucent cards with subtle borders and neon-purple glow. Color is used sparingly and
   always to signal meaning (purple = interact, cyan = data, green = healthy, amber = warn,
   red = critical).
2. **Data is always live or honestly absent.** Every gauge, sparkline and value is driven
   by a plugin state. When a source is unavailable the component renders `--` and the arc
   collapses to 0 % — never a frozen last-known value presented as live (see doc 02 §11).
3. **Two taps to anything.** A persistent left sidebar reaches all seven pages; per-page
   bottom tabs reach sub-views. Every interactive target is at least 48×48 px.

## 2. The tile-rendering pipeline

Touch Portal renders a button's image from a state value, and the States API performs
**smart conversion**: a text state whose value is a base64-encoded PNG is drawn as the
button's image (doc 03 §3). CyberDeck exploits this to render rich graphics that a stock
button grid cannot express.

```
state change (telemetry/media)                  worker_threads pool (2)
        │                                       ┌────────────────────────┐
        ▼  delta-gated, ≤1 redraw / ~100ms      │  render/renderer.js     │
   tile-bus ──"redraw tile X with payload"────► │  node-canvas (@napi-rs) │
        ▲                                       │  draw → PNG → base64    │
        │  base64 PNG                           └──────────┬─────────────┘
        │                                                  │ hash check (skip if identical)
        └──────────── tp.stateUpdate('…tile.dash.cpu_gauge', pngBase64) ◄┘
```

Stages:

1. A service writes a new value to the state manager; if that state is bound to a tile, a
   redraw is enqueued on `tile-bus`.
2. The renderer (a `worker_threads` pool, 2 workers) draws the tile to an off-screen
   `node-canvas` surface using the template for that tile kind (gauge / sparkline /
   now-playing card / chart).
3. The canvas is encoded to PNG and base64-encoded. A per-tile content hash skips
   re-encoding and re-pushing when the drawn output is pixel-identical to the last push.
4. The base64 PNG is pushed to the tile's image state via `tp.stateUpdate`.

### Rendering budget (binds NFR-009 / NFR-010)

| Rule | Value | Reason |
| --- | --- | --- |
| Canvas work off the main thread | 2 `worker_threads` | Keep the socket event loop free |
| Redraw only on real state change | delta-gated | Avoid drawing identical frames |
| Max redraw rate per tile | ~1 / 100 ms | Smooth at 1 Hz telemetry without churn |
| Gauge / sparkline size | ≤ 256×256 px | Small base64 over the socket |
| Now-playing / chart size | ≤ 400×400 px | Same |
| Identical-output skip | per-tile pixel hash | No redundant encode or push |
| Hidden-page pause | on TP `broadcast` page-change | Stop drawing tiles the user can't see |

These rules keep steady-state memory under 200 MB (NFR-009) and idle CPU under 3 %
(NFR-010). See doc 02 §10.

### Tile template catalogue

| Template | File | Used by |
| --- | --- | --- |
| Circular gauge | `render/gauge.js` | CPU/GPU/RAM/VRAM gauges, system-health score, energy dial |
| Sparkline (60 samples) | `render/sparkline.js` | Network up/down, per-metric mini trends, environment sensors |
| Now-playing card | `render/now-playing.js` | Album art + waveform + progress (Dashboard, Media, mini bar) |
| Rolling chart / donut / bar | `render/chart.js` | 60 s performance chart, storage donut, energy bar chart |

Each template reads design tokens from §10 so a theme change recolors every tile without
touching layout code.

## 3. Layout system

| Concern | Value |
| --- | --- |
| Logical canvas | 1280×800 |
| Grid | 24 columns × 18 rows (Dashboard/System); pages extend rows where noted |
| Sidebar | Columns 1–2, full height, present on every page |
| Header | Row 1: wordmark (left), page title, clock + settings (right) |
| Bottom tabs | Per-page sub-navigation on System, Media, Gaming, Smart Home, Overview |
| Persistent mini media bar | Bottom strip on all non-Dashboard pages |
| Minimum touch target | 48×48 px |

### Sidebar navigation (all pages)

Vertical icon rail: **Dashboard, Apps, Media, System, Gaming, Smart Home, Settings,
Power**. The active item gets a `rgba(123,47,190,0.25)` fill and a 3 px `#7B2FBE` left
border. Navigation completes in under 300 ms (NFR-002). A Dashboard nav badge shows the
unread `notify.count`.

## 4. Page 1 — Home Dashboard

Global command overview; the default landing page seen every session. Dark radial
gradient background (centre `#141428`, edge `#0D0D1A`).

| Component | Position (col / row) | Size | States | Action |
| --- | --- | --- | --- | --- |
| Logo + wordmark | 1–3 / 1 | header | static | navigate home |
| Date / time | 21–24 / 1 | header | static (JS) | — |
| Settings gear | 24 / 1 | header | static | open settings overlay |
| Sidebar nav | 1–2 / 1–18 | full height | active-page highlight | navigate |
| Quick Launch (5 apps) | 3–20 / 2–5 | top main | static labels | launch app |
| Media player card | 5–17 / 6–12 | center | `media.*`, `tile.media.nowplaying` | transport |
| Pause / Previous | 3–4 / 7–9 | left of media | `media.playing` | `act.media.pause` / `.previous` |
| Next / Mute | 18–20 / 7–9 | right of media | `media.playing`, `media.volume.system` | `act.media.next` / volume mute |
| Lock System / Terminal | 3–4 / 10–12 | left lower | static | `act.system.power` (Lock) / launch terminal |
| File Explorer / Control Panel | 18–20 / 10–12 | right lower | static | launch |
| Volume slider (vertical) | 21–22 / 2–14 | right panel | `media.volume.system` | `con.volume_master` |
| System Status panel | 21–24 / 15–18 | bottom right | `system.powerplan`, `.network.*`, `.storage.*`, `.uptime` | display |
| CPU gauge | 3–8 / 13–18 | bottom left | `system.cpu.temp`, `.cpu.load`, `tile.dash.cpu_gauge` | display |
| GPU gauge | 9–14 / 13–18 | bottom center | `system.gpu.temp`, `.gpu.load`, `tile.dash.gpu_gauge` | display |
| RAM gauge | 15–20 / 13–18 | bottom right | `system.ram.percent`, `.ram.used`, `tile.dash.ram_gauge` | display |

**Loading / error.** On plugin disconnect every gauge value shows `--`, arcs render at
0 %, and a red "Plugin Disconnected" banner appears in the header.

## 5. Page 2 — System Control

System administration and power management. Bottom tabs: **Overview · System Control ·
Monitoring · Tools**.

| Section | Components | Actions |
| --- | --- | --- |
| System Control | Restart, Shut Down, Sleep, Hibernate / Lock, Log Off, Kill Process, Task Manager / Clear Cache, Disk Cleanup, Empty Recycle Bin, System Info | `act.system.power` (per mode), `act.system.open.*`, `act.system.cache.clear`, `act.system.diskcleanup`, `act.system.killprocess` |
| Performance Modes | Silent, Balanced, Performance, Turbo — each ACTIVATE / ACTIVE badge | `act.system.performance` (`profile`) |
| Quick Shortcuts | Control Panel, Device Manager, Windows Update, Services, Startup Apps, Programs & Features, Registry Editor, Event Viewer | `act.system.open.*` |
| Storage Drives | 4 drive rows: label, used/total GB, % bar | display |
| System Information | OS, Processor, Motherboard, RAM, GPU, Driver, System Type, Windows Version | display |
| Fan Control | CPU Fan, GPU Fan, Case Fan 1, Case Fan 2 sliders + Auto toggle | `act.system.fan.set` / `con.fan_speed` |
| Network | Download Mbps sparkline, Upload Mbps sparkline, Ping | display (`tile.system.net_down_spark`, `.net_up_spark`) |
| System Uptime | HH:MM:SS counter | display |

Destructive power actions (Shutdown, Restart, Hibernate, Log Off) require a confirmation
card and a second tap (AC-004, doc 03 §4).

## 6. Page 3 — Media Center

Audio and streaming hub. Bottom tabs: **Media Center · Playlists · EQ Presets · Radio ·
Podcasts**. Grid extends to 20 rows.

| Section | Contents |
| --- | --- |
| Now Playing (top-left, ~50 %) | Album art 200×200, track / artist / album, waveform visualiser, progress bar, transport (shuffle / prev / pause / next / repeat), heart favourite. Rendered to `tile.media.nowplaying`. |
| Audio Control (top-right, ~30 %) | System Volume slider (+ % label), Spotify Volume slider, Mic Volume slider, Audio Output device selector. `con.volume_master` / `con.volume_spotify` / `con.volume_mic` |
| Quick Access | 2×5 grid: YouTube, Twitch, Netflix, Disney+, Amazon Prime, VLC, MPV, OBS Studio, Soundboard, Voice Changer — launch actions |
| Media Tools | 2×3: Screenshot, Screen Record, Clip Manager, Stream Deck, Video Editor, Audio Mixer |
| Recently Played | 6-card carousel (artwork / title / artist) with scroll arrows — *Phase 2* |
| Notifications | 4 most recent across sources, source icon + time |
| Upcoming Events | 3 calendar entries (date / title / time) |
| Weather | Current temp + condition + 4-day forecast |
| Persistent media bar | Mini art, track/artist, waveform, prev/pause/next — on all non-Dashboard pages |

## 7. Page 4 — Gaming Hub

Game launching, optimization and session monitoring. Bottom tabs: **Overview · Gaming Hub
· Monitoring · Macros · Profiles**.

| Section | Contents | States / Actions |
| --- | --- | --- |
| Favourite Games | 6 cover tiles 320×180, horizontal scroll, play overlay; cover art from SteamGridDB cached to `assets/gameart/` | `act.launch.*` |
| Game Launcher | Steam, Epic, Battle.net, Xbox, GOG — Online/Offline dot + open arrow | `act.launch.steam/.epic/.battlenet/.xbox/.gog` |
| Game Optimization | 5 toggles: Performance (Max FPS), Network Boost (Low Latency), RAM Cleaner, Temperature Control, FPS Limiter | `act.gaming.optimize` (`feature`,`on`), `act.gaming.ram.clean` |
| Quick Actions | 2×4: Screenshot, Record Clip, Instant Replay, Toggle HUD, Game Mode, Focus Assist, Do Not Disturb, Mic Mute | `act.gaming.screenshot` / `.record`, etc. |
| Live Game Stats | FPS (large number + sparkline), GPU/CPU/RAM/VRAM bars | `gaming.fps`, `tile.gaming.fps_spark` |
| Performance Overview | 4 circular gauges (CPU %, GPU %, RAM, VRAM) + uptime | `tile.gaming.*_gauge` |
| Game Profiles | Competitive, AAA, Streaming, Battery Saver + Create Profile | `act.gaming.mode` (`profile`) |
| Network Status | Ping, Download, Upload, each mini sparkline | `gaming.network.*` |
| Achievements | Top 3 in-progress with % bars — *Phase 3* | display |

## 8. Page 5 — Smart Home

IoT control and home monitoring. Bottom tabs: **Overview · Automations · Devices · Cameras
· Smart Home**. Backed by the Home Assistant integration (doc 02 §8).

| Section | Contents | Actions |
| --- | --- | --- |
| Rooms Overview | 5 room cards (Living Room, Bedroom, Kitchen, Office, Bathroom): name, device count, temp, ≤2 quick toggles | `act.home.device.toggle` |
| Device Control | Filter tabs (All / Lights / Plugs / Switches / Sensors / Cameras); rows: icon, name, room, toggle, brightness/volume slider | `act.home.light.toggle` / `.brightness`, `con.light_brightness` |
| Scenes & Automations | 6 scene cards (Good Morning, Good Night, Movie Time, Party Mode, Work Focus, Away Mode): action count + play | `act.home.scene` |
| Security Cameras | 4 live thumbnails (Front Door, Driveway, Backyard, Garage) + Live badge — *Phase 3* | `act.home.camera.view` |
| Environment | Temperature, Humidity, Air Quality, CO₂, Noise — value + sparkline | display (`environment.*`) |
| Energy Monitor | Total kWh dial, estimated cost, efficiency %, monthly bar chart | `tile.home.energy_chart` |
| Recent Activity | Last 4 automation/device events: icon, name, description, timestamp | display |

Dynamic entity lists (light/scene/camera IDs) populate action dropdowns via `choiceUpdate`
(doc 03 §8).

## 9. Page 6 — System Overview

Deep telemetry and diagnostics. Bottom tabs: **Overview · System · Performance · Network ·
Storage · Processes · Settings**.

| Section | Contents |
| --- | --- |
| Metric Summary Bar | 6 cards: CPU (load % + temp + spark), GPU (load % + temp + spark), RAM (used GB + % bar), VRAM (used GB + % bar), Storage (used TB + % bar), Uptime (HH:MM + health badge) |
| System Performance chart | Tab selector CPU/GPU/RAM/FPS; 60 s rolling line chart; below: Utilization %, Speed GHz, Cores, Threads, Temperature → `tile.overview.perf_chart` |
| Detailed System Info | OS, Processor, Motherboard, RAM spec, GPU model, Driver, System Type, Windows Version |
| System Health gauge | 0–100 % weighted score (thermal headroom, storage, drivers, system-file integrity); label Excellent/Good/Fair/Poor → `system.health.score` |
| System Health checklist | CPU Temp, GPU Temp, RAM Usage, Storage Health, System Files, Drivers — ✓ Good / ✗ Critical |
| Storage Overview | Per-drive donut + table (label, total, used, color chip) → `tile.overview.storage_donut` |
| Top Processes | Table: name, CPU %, Memory MB, Status; View All button — `system.processes` |
| System Alerts | 4 most recent: severity icon, description, timestamp; View All |

## 10. Page 7 — Notification Center

Unified aggregation and triage. Presented as a glassmorphic slide-over (overlay
`rgba(13,13,26,0.72)`) triggered by the bell icon from any page.

| Element | Contents |
| --- | --- |
| Header | "NOTIFICATIONS" title, unread count badge, "Mark all as read" (✓), close (✕) |
| Filter tabs | All / System / Apps / Alerts / Messages — `act.notify.filter` (`source`) |
| Feed | Scrollable cards: source icon 48×48, app name, timestamp, 2-line body, priority dot. Tap → open source (`act.notify.open`); swipe/long-press → dismiss (`act.notify.dismiss`) |
| Sources | Discord (purple), Spotify (green), System Update (info blue), Streamlabs (teal), Security Alert (shield orange), Hardware Monitor (chip purple) |
| Bottom action | "View Notification History" (clock icon) |

The badge reads `notify.count`; "Mark all as read" calls `act.notify.markallread` and
clears it (AC-008).

## 11. Design tokens

### Color palette

| Token | Hex | Role |
| --- | --- | --- |
| `--color-bg-primary` | `#0D0D1A` | Page background |
| `--color-bg-card` | `#141428` | Card / panel / modal / dropdown |
| `--color-bg-elevated` | `#1A1A38` | Header, sidebar, active states |
| `--color-border` | `#2D2D5E` | Card borders, dividers |
| `--color-accent-primary` | `#7B2FBE` | Neon purple — primary buttons, active nav, headings |
| `--color-accent-secondary` | `#00B4D8` | Neon cyan — data, charts, sparklines, links |
| `--color-text-primary` | `#FFFFFF` | Headings, values, button labels |
| `--color-text-secondary` | `#B0B0CC` | Subtitles, labels, timestamps |
| `--color-text-muted` | `#8888AA` | Hints, placeholder |
| `--color-status-success` | `#00E676` | Healthy / online / connected |
| `--color-status-warning` | `#FFAB40` | Thermal warning, low storage |
| `--color-status-error` | `#FF5252` | Plugin error, critical alert |
| `--color-status-info` | `#448AFF` | System / informational notifications |
| `--color-overlay` | `rgba(13,13,26,0.72)` | Glassmorphism slide-over / modal backdrop |

Color is never the sole signal: every status color is paired with an icon and text label
(doc 01 §9). Text contrast meets WCAG 2.1 AA (≥ 4.5:1) on the dark background (NFR-015,
AC-010).

### Typography

| Token | Family | Weight | Size | Line height | Usage |
| --- | --- | --- | --- | --- | --- |
| `--font-display` | Rajdhani, Orbitron, sans-serif | 700 | 32–72 px | 1.1 | Page titles, metric values |
| `--font-heading` | Exo 2, Inter, sans-serif | 600 | 18–28 px | 1.2 | Section / card headings |
| `--font-body` | Inter, system-ui, sans-serif | 400 | 13–16 px | 1.5 | Labels, descriptions, timestamps |
| `--font-mono` | JetBrains Mono, Consolas, monospace | 400 | 12–14 px | 1.4 | Telemetry values, process names |
| `--font-label` | Inter, system-ui, sans-serif | 500 | 11–13 px | 1.3 | Button labels, filter tabs, badges |

Minimum on-screen font size is 12 pt (doc 01 §9). Fonts are bundled in `assets/fonts/` and
registered with `node-canvas` so rendered tiles use the same families as native button text.

### Spacing scale (8 px base)

| Token | Value | Usage |
| --- | --- | --- |
| `--space-1` | 4 px | Icon internal padding |
| `--space-2` | 8 px | Dense component padding |
| `--space-3` | 12 px | Button horizontal padding |
| `--space-4` | 16 px | Card padding |
| `--space-5` | 20 px | Section gap |
| `--space-6` | 24 px | Panel padding |
| `--space-8` | 32 px | Page-section gap |
| `--space-12` | 48 px | Large section separation |

### Component tokens

| Component | Property | Value |
| --- | --- | --- |
| Card | border-radius | 12 px |
| Card | border | 1 px solid `#2D2D5E` |
| Card | background | `#141428` |
| Card | box-shadow | `0 4px 24px rgba(123,47,190,0.12)` |
| Button (primary) | background | `linear-gradient(135deg, #7B2FBE, #9B4FDE)` |
| Button (primary) | border-radius | 8 px |
| Button (primary) | min-size | 48×48 px |
| Button (primary) | box-shadow (active) | `0 0 16px rgba(123,47,190,0.6)` (neon glow) |
| Circular gauge | stroke | `#00B4D8` (fill arc) / `#2D2D5E` (track) |
| Circular gauge | glow | `0 0 12px rgba(0,180,216,0.4)` |
| Sparkline | stroke | `#7B2FBE` or `#00B4D8` (by data type) |
| Progress bar | fill | `linear-gradient(90deg, #7B2FBE, #00B4D8)` |
| Toggle (on / off) | background | `#7B2FBE` / `#2D2D5E` |
| Badge (unread) | background | `#FF5252` (critical) / `#7B2FBE` (normal) |
| Sidebar (active icon) | background | `rgba(123,47,190,0.25)`; left border 3 px `#7B2FBE` |

### Iconography & assets

| Asset | Spec |
| --- | --- |
| Icons | Outline, 2 px stroke, white or neon accent on dark bg |
| Icon sizes | 24×24 (sidebar), 48×48 (dashboard), 96×96 (game/app launcher) |
| Backgrounds | Per-page solid `#0D0D1A` with gradient-overlay PNG |
| Sparkline source PNGs | Pre-rendered gradient PNGs (≈60×40 px), recolored by the plugin |
| Game art | Fetched from SteamGridDB at first launch; cached to `assets/gameart/` |

These tokens are the single source of truth for the `node-canvas` templates in §2 and for
the native Touch Portal button styling. Theme variants (doc 03 §6 "Tile Theme" setting)
swap this token set without changing any page layout.
