# CyberDeck — Operations & Roadmap

Version 1.0 · June 2026 · Backend: Node.js 20 LTS

This document covers how CyberDeck is configured, secured, logged, tested, packaged,
deployed and evolved — and the phased plan that takes it from MVP to production. It is the
operational complement to [doc 02](02-technical-architecture.md) (architecture) and the
delivery reference for the scope-by-phase summary in [doc 01 §12](01-product-requirements.md).

## 1. Configuration

Non-secret configuration lives in `config/config.json`. It is hot-reloaded: `chokidar`
watches the file and changes apply without restarting Touch Portal (NFR-012).

```jsonc
{
  "version": "1.0",
  "telemetry": {
    "cpu_interval_ms": 1000,
    "gpu_interval_ms": 1000,
    "storage_interval_ms": 10000,
    "network_interval_ms": 1000,
    "uptime_interval_ms": 60000
  },
  "media": {
    "progress_interval_ms": 500,
    "albumart_cache_ttl_hours": 24
  },
  "smarthome": {
    "ha_base_url": "http://homeassistant.local:8123",
    "poll_interval_ms": 30000
  },
  "gaming": {
    "fps_source": "auto"            // auto | presentmon | rtss | hook
  },
  "thresholds": {
    "cpu_temp_warn": 85,            // °C  → evt.cpu_high_temp
    "gpu_temp_warn": 88,            // °C  → evt.gpu_high_temp
    "ram_warn_percent": 90,         // %   → evt.ram_high_usage
    "storage_warn_percent": 90      // %   → evt.storage_low
  },
  "render": { "worker_threads": 2, "tile_theme": "cyberpunk" },
  "log_level": "INFO"              // INFO | DEBUG
}
```

A subset of these is also surfaced as Touch Portal **settings** (doc 03 §6): Home Assistant
URL, Ping Host, FPS Source, Tile Theme. Settings changed in the TP UI are merged into the
live config via the `Settings` event. The `version` field is checked at startup; a mismatch
triggers the migration step in §8.

### Configuration precedence

1. Windows Credential Manager (secrets only — never overridden by config).
2. Touch Portal settings (user-editable in the TP UI).
3. `config/config.json` (file).
4. Built-in defaults (used if the file is missing or fails to parse).

## 2. Secrets management

Secrets are **never** stored in `entry.tp`, `config.json`, logs or backups. They live in
Windows Credential Manager, accessed through `keytar` (doc 02 §4).

| Secret | Service name (keytar) | Entered via |
| --- | --- | --- |
| Home Assistant long-lived token | `cyberdeck/ha_token` | First-run settings flow |
| Spotify client secret | `cyberdeck/spotify_secret` | Settings flow (optional) |
| OBS WebSocket password | `cyberdeck/obs_password` | Settings flow (optional) |
| SteamGridDB API key | `cyberdeck/steamgriddb_key` | Settings flow (optional) |

When a required secret is absent, `keytar` returns `null`; the dependent service runs
**degraded** (smart-home tiles prompt "configure token", Spotify volume is a no-op) rather
than crashing (doc 02 §11). Tokens and credentials are redacted as `[REDACTED]` anywhere
they might otherwise be logged.

## 3. Storage & caches

| Data | Location | Policy |
| --- | --- | --- |
| Non-secret config | `config/config.json` | Hot-reloaded; backed up |
| Secrets | Windows Credential Manager | Not persisted to disk; not backed up |
| Notification buffer | in-memory ring buffer (50 items) | Not persisted |
| Sparkline history | in-memory ring buffers (60 samples / metric) | Not persisted |
| Album-art cache | `%TEMP%\cyberdeck_art\` | TTL 24 h; max 100 MB; LRU eviction |
| Game-art cache | `assets/gameart/` | Persistent; max 500 MB; manual purge in settings |
| Log files | `logs/cyberdeck.log` | Rotating, 5 × 10 MB |
| Game profiles | `profiles/*.json` | User-created; backed up |

## 4. Logging

Logging uses `pino` with `pino-roll` (doc 02 §4).

| Concern | Decision |
| --- | --- |
| File | `logs/cyberdeck.log` |
| Rotation | 5 files × 10 MB (50 MB max) |
| Default level | `INFO`; startup/shutdown always at INFO |
| Debug mode | `log_level: "DEBUG"` in config (or TP setting) |
| Telemetry values | DEBUG only (would flood INFO) |
| Sensitive data | API tokens/credentials never logged — `[REDACTED]` |
| Structure | JSON lines: `{time, level, service, msg, ...}` |

## 5. Health & monitoring

`fastify` exposes a lightweight health endpoint on `127.0.0.1:9124`.

| Endpoint | Returns |
| --- | --- |
| `GET /health` | JSON: overall status + per-service status (telemetry, media, gaming, smarthome, notifications) |
| `GET /metrics` | Optional Prometheus exposition (RSS, CPU, event-loop lag, tile-render rate) for users running local Grafana |

The TP sidebar status badge maps to health: **connected** (green), **degraded** (amber, a
service is running without its secret/binding), **error** (red). A CI soak job (§6) watches
RSS growth and CPU over an 8-hour run.

## 6. Error handling

The plugin degrades gracefully — a failed source renders `--`, never a crash or a frozen
value (doc 02 §11). Summary:

| Failure | Detection | User-visible | Recovery |
| --- | --- | --- | --- |
| Plugin crash | TP socket loss | Tiles `--`; sidebar red banner | TP relaunches plugin (< 5 s, NFR-006) |
| Telemetry read error | rejected provider promise | metric shows `--` | log; retry next cycle |
| HA API timeout (3 s) | `AbortController` | entity error state + toast | retry next poll; show last value |
| Album-art fetch fail | stream/HTTP error | default music icon | log; retry next track |
| Config parse error | JSON throw at start | start with defaults + warning | user fixes file (hot-reload) |
| Secret not found | `keytar` null | prompt to configure in settings | service stays degraded |
| WinRT binding missing | `require` throws | media/notifications disabled | documented optional native deps |

## 7. Testing strategy

| Type | Scope | Tool | Pass criteria |
| --- | --- | --- | --- |
| Unit | formatters, ring buffer, credentials wrapper, provider adapters | `vitest` / `node:test` | 100 % pass; > 80 % branch coverage |
| Integration | plugin ↔ TP socket handshake + state broadcast | mock TP socket server | all states broadcast within 3 s of startup |
| Contract | `entry.tp` validates against the API-12 schema; every state/action/connector ID referenced in docs exists | schema validator | no missing/duplicate IDs |
| E2E | full journeys: launch game, read telemetry, change track | TP client + Android emulator | journeys complete without error |
| Performance soak | 8-hour run, RSS + CPU sampled | `systeminformation` reporter | RSS growth < 5 MB/h; idle CPU < 3 % (NFR-010) |
| Visual regression | rendered tiles vs design spec | canvas snapshot diff | < 2 % pixel diff |
| Accessibility | contrast + touch-target audit | automated contrast checker | ≥ 4.5:1; targets ≥ 48 px (NFR-008/015) |

## 8. Packaging

CyberDeck ships as a Touch Portal plugin package plus the page set. The Node.js runtime is
bundled to a standalone `.exe` via `pkg`, so end users install **no** Node.js and compile
nothing (doc 02 §3); prebuilt native bindings (`@napi-rs/canvas`, optional WinRT bridges)
travel inside the package.

### Plugin package (`.tpp`)

```
CyberDeck/
├── entry.tp                 # manifest (doc 03)
├── cyberdeck.exe            # pkg-bundled Node 20 plugin
├── config/config.json
├── README.md
├── LICENSE
├── assets/
│   ├── icons/               # 24/48/96 px PNG
│   ├── backgrounds/         # per-page gradient overlays
│   ├── fonts/               # Rajdhani, Exo 2, Inter, JetBrains Mono
│   └── gameart/             # SteamGridDB cache (runtime)
├── profiles/competitive.json
└── logs/                    # runtime, gitignored
```

> The source tree (`src/core`, `src/services`, `src/render`, `src/util`) is compiled into
> `cyberdeck.exe`; it is not shipped as loose `.js`. See the module structure in doc 02 §3.

### Page packages (`.tpz`)

Each `.tpz` is a ZIP holding one page JSON:

| File | Page |
| --- | --- |
| `CyberDeck_Dashboard.tpz` | 1 — Home Dashboard |
| `CyberDeck_System.tpz` | 2 — System Control |
| `CyberDeck_Media.tpz` | 3 — Media Center |
| `CyberDeck_Gaming.tpz` | 4 — Gaming Hub |
| `CyberDeck_SmartHome.tpz` | 5 — Smart Home |
| `CyberDeck_Overview.tpz` | 6 — System Overview |
| `CyberDeck_Notifications.tpz` | 7 — Notification Center |
| `CyberDeck_Full.tpz` | All pages bundled — import once for a full setup |

## 9. Deployment, upgrade & backup

**Deploy.** (1) Build `CyberDeck.tpp`. (2) Touch Portal → Settings → Plug-ins → Import →
select `CyberDeck.tpp`. (3) Import `CyberDeck_Full.tpz` (or individual pages). (4) Run the
first-run wizard to enter Home Assistant credentials. (5) Verify states show live values
and the notification badge counts.

**Upgrade.** Plugin updates ship as a new `.tpp`; the TP plugin manager reinstalls and
preserves `config.json`. Page updates ship as new `.tpz` (import overwrites). The
`config.json` schema is versioned; a startup migration runs on a version mismatch (§1).
Breaking changes — especially state/action **ID renames** — are documented in `CHANGELOG.md`
with a migration guide, because Touch Portal stores a local copy of any referenced ID and a
rename breaks existing user buttons (doc 03 §2).

**Backup & restore.** TP pages back up via TP's built-in Settings → Backup. `config.json`
and `profiles/*.json` export as a "CyberDeck Backup" ZIP from the settings overlay.
Credentials are **not** included — the user re-enters them after restore. Full restore:
install plugin → import pages → restore config → re-enter credentials.

## 10. Phased roadmap

The roadmap maps the three scope buckets in doc 01 §12 (MVP / Phase 2 / Phase 3) onto a
seven-phase delivery plan. All durations are indicative; the reference hardware for sign-off
is an Intel i7-13700K + RTX 4070 Ti, 16 GB RAM.

| Phase | Name | Duration | Deliverables | Key dependency | Key risk |
| --- | --- | --- | --- | --- | --- |
| 1 | Static UI + Core Telemetry | 3 wk | All 7 pages to design spec; live CPU/GPU/RAM/storage/network telemetry; power actions; master volume; Steam/Epic/Chrome/Discord launchers | Design assets final; TP API-12 confirmed | Design iteration; TP API quirks |
| 2 | Media Integration | 2 wk | Full media pipeline (album art, progress, recently played); SMTC transport; multi-channel mixer; EQ presets | Phase 1; WinRT SMTC bridge builds on target OS | SMTC coverage for non-Spotify apps |
| 3 | Gaming Integration | 2 wk | Live FPS; 4 game profiles; RAM cleaner; network boost; achievements; all launchers verified | Phase 1; PresentMon/RTSS present | FPS-tool availability; elevation for working-set trim |
| 4 | Smart Home Integration | 3 wk | Home Assistant full integration; room cards live; device toggles; scenes; energy monitor; environment sensors | Phase 1; HA 2024.x on LAN + token | HA API version drift; LAN latency |
| 5 | Notifications & Cameras | 2 wk | Notification pipeline (Discord/Spotify/Windows/Streamlabs); filter tabs; dismiss; badge; camera previews | Phase 1; OS notification-access grant | Windows privacy settings; WinRT versioning |
| 6 | Polish + Hardening | 2 wk | 8-hour soak passed; all acceptance criteria verified; error states polished; first-run wizard; docs finalized | All phases | Regressions found in hardening |
| 7 | Production Release | 1 wk | `CyberDeck.tpp` + 7 × `.tpz` packaged; README; CHANGELOG; community install guide; optional GitHub Releases CI/CD | Phase 6; moderation plan | Release-day support surge |

**Timeline:** Phase 1 (wk 1–3) · Phase 2 (4–5) · Phase 3 (6–7) · Phase 4 (8–10) · Phase 5
(11–12) · Phase 6 (13–14) · Phase 7 (15). **Total ≈ 15 weeks** from kickoff to release.

### Beyond v1 (Phase 3 scope in doc 01)

Voice/contextual assistant, full OBS/Streamlabs control, Discord rich presence, remote-PC
telemetry, a custom widget designer, and cloud profile sync with marketplace themes.

## 11. Definition of Done (per phase)

- All functional requirements for the phase are implemented and pass automated tests.
- Plugin steady-state memory is within NFR-009 (< 200 MB RSS) and idle CPU within NFR-010
  (< 3 % on an 8-core CPU).
- Rendered UI is smooth at the 1 Hz telemetry cadence with no visible stutter (NFR-003) on
  reference hardware.
- All acceptance criteria for the phase (doc 01 §11) are verified.
- Code review approved by at least one other engineer.
- `CHANGELOG.md` updated, including any state/action ID migrations.
