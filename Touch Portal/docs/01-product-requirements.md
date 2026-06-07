# CyberDeck — Product Requirements

Version 1.0 · June 2026 · Plugin ID `com.shishir.cyberdeck`

## 1. Executive summary

CyberDeck is a premium, cyberpunk-themed Touch Portal ecosystem that transforms a
standard macro-board tablet into a fully featured PC command center. It provides
real-time system telemetry, media management, gaming optimization, smart-home
control, and unified notifications through a single, cohesive dark-neon interface.

The product ships as a bundle: a custom Touch Portal page set and a Node.js plugin
(identifier `com.shishir.cyberdeck`). It targets Windows 10/11 power users who want
operational awareness and one-touch control without leaving their primary
keyboard-and-mouse workflow.

| Field | Value |
| --- | --- |
| Product name | CyberDeck |
| Plugin ID | `com.shishir.cyberdeck` |
| Platform | Touch Portal 4.5+ on Windows 10/11 |
| Backend runtime | Node.js 20 LTS |
| Target devices | Android / iOS tablet or phone as Touch Portal client |
| Initial release | Phase 1 MVP |
| Document version | 1.0 |

## 2. Vision

Transform Touch Portal from a simple macro board into a premium command center that
feels like a futuristic operating system. Every interaction — from launching a game
to monitoring CPU thermals — should feel instant, satisfying, and visually coherent.

The long-term vision is a self-updating, contextual control surface that learns usage
patterns, surfaces relevant actions, and proactively alerts the user to system
anomalies or opportunities.

## 3. Problem statement

Touch Portal out of the box offers generic buttons with no system awareness: no live
CPU/GPU data, no media metadata, no smart-home access. Power users who manage games,
streams, home automation and monitoring tools must context-switch across six to ten
separate applications to accomplish tasks that could be unified. Existing community
packs are visually inconsistent, only partially functional, and undocumented for
extension. No single Touch Portal solution combines telemetry, media, gaming, IoT and
notifications with a polished UI that rivals commercial products.

The opportunity is a premium, production-quality Touch Portal ecosystem for gamers and
streamers — users who already own tablets, already run Touch Portal, and will adopt a
polished, unified experience.

## 4. User personas

**Persona 1 — The Competitive Gamer.** Alex, 24. Gaming PC plus Android phone as a
Touch Portal client. Wants to monitor FPS and thermals without alt-tabbing, launch
games with one touch, and optimize the network. Frustrated by juggling MSI Afterburner,
Discord and Steam overlays at once. Success: every game-session task is two taps or
fewer from the Gaming Hub.

**Persona 2 — The Live Streamer.** Jordan, 28. High-end PC, iPad as a Touch Portal
client, Streamlabs. Wants scene switching, donation alerts, audio mixing and clip
recording from one panel. Frustrated that the current setup needs three boards and
frequent keyboard shortcuts. Success: a full stream session managed without keyboard
shortcuts.

**Persona 3 — The Developer / Power User.** Sam, 32. Workstation and Android tablet.
Wants system-health monitoring, quick tool launch, and notification triage. Frustrated
by the lack of a consolidated health view and notification overload. Success: health
anomalies spotted in under 30 seconds; triage in under 10.

**Persona 4 — The Home-Automation Enthusiast.** Riley, 35. A smart home with 20+ IoT
devices and an Android phone. Wants lighting, scenes and energy monitoring from one
interface. Frustrated that the Home Assistant app is functional but not touch-optimized
for quick actions. Success: any smart-home action in two taps or fewer.

## 5. User journeys

**Gaming session start.** The user opens Touch Portal — the Home Dashboard loads in
under a second. They tap Gaming Hub, pick a favourite from the visual grid (the
launcher opens the game), activate the Competitive profile (performance mode, RAM
cleaner and network optimizer engage together), and monitor live FPS and thermals
during play without alt-tabbing.

**Morning routine (smart home).** On waking, the user opens Touch Portal, taps Smart
Home, and taps the Good Morning scene — lights, coffee maker and AC move to morning
settings in one tap — then checks the energy monitor against yesterday.

**Notification triage.** A badge on the Dashboard nav shows six unread items. The user
taps the bell, the slide-over shows a categorised list, they filter to Alerts (security
and system first), dismiss the non-critical items, and tap a Discord message to open
Discord.

## 6. Feature breakdown

| Area | Feature | Priority | MVP |
| --- | --- | --- | --- |
| Home Dashboard | App launcher (5 pinned apps) | P0 | ✓ |
| Home Dashboard | Embedded media player | P0 | ✓ |
| Home Dashboard | Live CPU/GPU/RAM gauges | P0 | ✓ |
| Home Dashboard | Volume slider (connector) | P0 | ✓ |
| Home Dashboard | Date/time display | P0 | ✓ |
| Home Dashboard | System status panel | P1 | ✓ |
| System Control | Power actions (restart/shutdown/sleep/hibernate/lock) | P0 | ✓ |
| System Control | Performance mode selector | P1 | ✓ |
| System Control | Storage drive overview | P1 | ✓ |
| System Control | Fan control sliders | P1 | ✓ |
| System Control | Network speed display | P1 | ✓ |
| Media Center | Now-playing card with album art | P0 | ✓ |
| Media Center | Spotify/SMTC playback controls | P0 | ✓ |
| Media Center | Multi-channel volume mixer | P1 | ✓ |
| Media Center | Recently played carousel | P2 | |
| Gaming Hub | Favourite-game grid launcher | P0 | ✓ |
| Gaming Hub | Live FPS display | P1 | ✓ |
| Gaming Hub | Optimization toggles | P1 | ✓ |
| Gaming Hub | Achievement tracker | P2 | |
| Smart Home | Room overview cards | P1 | ✓ |
| Smart Home | Device control (lights, AC, plugs) | P1 | ✓ |
| Smart Home | Scene / automation launcher | P1 | ✓ |
| Smart Home | Security-camera previews | P2 | |
| Smart Home | Energy monitoring chart | P2 | |
| System Overview | 6-metric summary bar | P0 | ✓ |
| System Overview | Performance chart (60 s rolling) | P1 | ✓ |
| System Overview | Top-processes table | P1 | ✓ |
| System Overview | System health score | P1 | ✓ |
| Notifications | Aggregated feed | P1 | ✓ |
| Notifications | Source filtering | P1 | ✓ |
| Notifications | Priority badges | P2 | |
| Notifications | Dismiss / mark-read | P1 | ✓ |

## 7. Functional requirements

**FR-001 Navigation.** A sidebar is present on every page with Dashboard, Apps, Media,
System, Gaming, Smart Home, Settings and Power. The active page is highlighted with
neon purple (`#7B2FBE`). Navigation completes in under 300 ms. A persistent mini media
bar appears at the bottom of pages 2–6.

**FR-002 Telemetry.** CPU load, CPU temperature, GPU load, GPU temperature and RAM
usage update every 1000 ms. Network download/upload update every 1000 ms. Storage
updates every 10 000 ms. Every value is a formatted string with its unit (%, °C, GB,
Mbps). Threshold alerts fire at CPU > 85 °C, GPU > 88 °C, or RAM > 90 %.

**FR-003 Media.** The plugin detects and controls media via the Windows System Media
Transport Controls (SMTC). Album art is shown at 128×128 px minimum. Playback position
updates every 500 ms. Play/pause/next/previous/shuffle/repeat execute within 200 ms.
Volume controls affect system master and per-app volume independently.

**FR-004 Gaming.** Steam, Epic, Battle.net, Xbox and GOG each have a launch action.
Live FPS is read from a supported source (PresentMon/FrameView, RTSS, or a custom hook).
The RAM cleaner trims working sets of eligible processes. Game profiles
(Competitive/AAA/Streaming/Battery Saver) apply predefined Windows power plans and
process priorities.

**FR-005 Smart home.** Integration uses the Home Assistant REST and WebSocket API with a
configurable base URL and long-lived token. Light toggle and brightness reflect within
500 ms. Scene activation calls `scene.turn_on`. Environment sensors update every
30 000 ms.

**FR-006 Notifications.** The plugin reads Discord, Spotify, Windows Action Center and
Streamlabs events. A badge reflects unread count across sources. Each item shows source
icon, title, body, timestamp and priority. Mark-all-read clears the badge.

## 8. Non-functional requirements

| ID | Category | Requirement | Target |
| --- | --- | --- | --- |
| NFR-001 | Performance | Initial page render | < 1 s |
| NFR-002 | Performance | Page navigation transition | < 300 ms |
| NFR-003 | Performance | Telemetry tile refresh | smooth at 1 Hz, no visible stutter |
| NFR-004 | Performance | Media state update latency | < 500 ms |
| NFR-005 | Reliability | Plugin uptime per session | > 99.5 % |
| NFR-006 | Reliability | Auto-reconnect after crash | < 5 s |
| NFR-007 | Usability | Primary actions reachable | ≤ 2 taps from any page |
| NFR-008 | Usability | Minimum touch target | 48×48 px |
| NFR-009 | Scalability | Plugin memory (steady state) | < 200 MB RAM |
| NFR-010 | Scalability | Plugin CPU (idle monitoring) | < 3 % on 8-core CPU |
| NFR-011 | Security | Secrets at rest | Windows Credential Manager |
| NFR-012 | Maintainability | Config hot-reload without TP restart | Supported |
| NFR-013 | Compatibility | Windows | 10 20H2+ and all 11 releases |
| NFR-014 | Compatibility | Touch Portal minimum | 4.5 (API 12) |
| NFR-015 | Accessibility | Text contrast | ≥ 4.5:1 (WCAG AA) |

> The Node.js memory and CPU targets (NFR-009/010) are set slightly higher than a
> native plugin would need, to account for the V8 runtime and the canvas tile renderer.
> See [doc 02](02-technical-architecture.md) for the rendering budget.

## 9. Accessibility requirements

Every interactive element has a minimum touch target of 48×48 logical pixels. Color is
never the sole indicator of state — icons and text labels always accompany color cues.
Text contrast meets WCAG 2.1 AA (4.5:1 normal, 3:1 large). Minimum font size is 12 pt.
Critical alerts (overheat, low storage) change both color and icon.

## 10. Success metrics

| Metric | Target | Method |
| --- | --- | --- |
| Page load time | < 1 s | Touch Portal page-load timing |
| Navigation transition | < 300 ms | Screen-recording frame analysis |
| Telemetry accuracy (CPU %) | ± 1 % vs Task Manager | Automated comparison script |
| Media update latency | < 500 ms | Timestamp diff: SMTC event → TP state |
| Daily active use | ≥ 80 % of target users within 30 days | Opt-in usage analytics |
| User satisfaction | ≥ 4.5 / 5 | Post-release survey (n ≥ 50) |
| Crash-free sessions | ≥ 99 % in first month | Exception-log analysis |
| Smart-home response | < 500 ms device state change | Plugin timing log |

## 11. Acceptance criteria

- **AC-001** Dashboard renders within 1 s on a 2.4 GHz 8-core / 16 GB machine.
- **AC-002** Dashboard CPU temperature matches Task Manager within ± 1 °C.
- **AC-003** Track name, artist and album art update within 500 ms of a track change.
- **AC-004** Tapping Restart shows a confirmation card; a second tap initiates restart.
- **AC-005** All seven pages are reachable from any page within two taps via the sidebar.
- **AC-006** Toggling a living-room light changes the Home Assistant entity within 500 ms.
- **AC-007** The plugin process stays under 200 MB RSS after 8 hours of operation.
- **AC-008** The notification badge accurately reflects unread Windows notifications.
- **AC-009** Game launch from the Gaming Hub opens the correct launcher within 3 s.
- **AC-010** All text meets WCAG 2.1 AA contrast (4.5:1) on the dark theme.

## 12. Scope by phase

**MVP (Phase 1).** All seven pages built to the final design system; live CPU/GPU/RAM/
storage/network telemetry; SMTC playback control; system master volume; power actions
(shutdown/restart/sleep/hibernate/lock); launchers for Steam/Epic/Battle.net/Chrome/
Discord; basic notification count from Windows Action Center; Smart Home as static UI.

**Phase 2.** Full media pipeline (album art, progress, recently played, EQ presets);
multi-channel volume mixer; gaming optimization (profiles, RAM cleaner, FPS); fan
control; performance-mode selector; notification triage with source filtering; Home
Assistant integration.

**Phase 3.** Voice/contextual assistant; full OBS/Streamlabs integration; Discord rich
presence; security-camera preview tiles; remote-PC telemetry; a custom widget designer;
cloud profile sync and marketplace themes.

See the full phased plan in [doc 05](05-operations-and-roadmap.md).
