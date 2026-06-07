# CyberDeck — Product Requirements Document (PRD)

**Document 1 of the CyberDeck Enterprise Documentation Set**
Version 0.3 (Draft) · June 2026 · Product Owner: Shishir · Codebase ID: `com.shishir.cyberdeck`

> Read after Document 0 (Foundation & Architecture). This document defines **what** CyberDeck is and what it must do; the TRD (Document 2) defines **how**, and the per-phase deep dives detail each phase's build. Where this document references architecture (the engine/UI split, the registries, the flow engine, the security model, the LAN-now/remote-later seam), the authority is Document 0.

---

## 1. Vision

CyberDeck turns any computer into a programmable command center that you control from any screen you own. A background **engine** on the host exposes that machine's capabilities — telemetry, media, power, gaming, smart home, notifications, and arbitrary user-built automations — as live **states** and executable **actions**. From a desktop **Designer**, a user composes **layouts** of widgets and **flows** of logic, and pushes them live to **client devices** (phones, tablets, other desktops) that render them with native performance.

The product's promise in one line: **the flexibility of a real automation platform, the polish of a commercial control surface, and the freedom of a local-first tool you own.**

### 1.1 The three pillars (what makes it worth building)

1. **Live data as first-class widgets** — gauges, sparklines, charts, and media cards bound to real-time engine state, not static images.
2. **A real automation engine** — full conditional flows with branching, variables, loops, waits, and triggers, authored visually.
3. **A live visual designer** — desktop drag-and-drop authoring that reflects to bound devices instantly, authored per device class.

All three on a **security-first, multi-device, local-first** foundation that is built for remote access later without re-architecting.

### 1.2 Why now / why this over the incumbents

The scrapped Touch Portal approach proved the ceiling: skinning someone else's host caps customization and reliability. The incumbents (Stream Deck, Touch Portal) share structural gaps CyberDeck is designed to close:

| Incumbent gap | CyberDeck answer |
|---------------|------------------|
| Button-centric; no native live-data widgets | First-class gauge/sparkline/chart/media widgets bound to typed live state |
| Artificial grid/page caps; paywalled multi-device | No grid caps; multi-device is a core primitive, not an upsell |
| Platform-locked, device-count licensing | Local use is free and account-free; licensing gates cloud services only; device-count limits are a non-goal |
| Flaky LAN connections (the #1 real complaint) | Resilient transport: heartbeat, auto-reconnect, graceful degradation, versioned resync |
| Clunky logic (nested IFs for a 3-state toggle) | A real flow engine with branching, variables, loops |
| No live-edit reflection to devices | Operation-log sync: edits appear on devices instantly |
| Fragile plugins that can crash the host | Out-of-process plugins; engine survives any plugin crash |

### 1.3 Non-goals (V1 and as stated permanent decisions)

- **No cloud/remote access in V1** (defined future phase; seam reserved).
- **No on-device editing — ever.** Clients render and interact; authoring is desktop-only. (Permanent product decision.)
- **No automatic cross-form-factor reflow in V1.** Layouts are authored per device class. (Adaptive layouts are a later candidate.)
- **No device-count licensing, no platform-locked purchases.** (Permanent.)
- **No telemetry exfiltration.** All data stays on the local network; nothing leaves the host without an explicit, account-gated cloud feature the user opts into.

---

## 2. Personas

Four archetypes are carried from the prior research (they remain valid — they're usage profiles, not product-specific). A fifth is added because the V1 flow engine creates a genuinely new user the old design didn't serve.

### Persona 1 — Alex, 24 · The Competitive Gamer
- **Devices:** Gaming PC (engine host), Android phone (client).
- **Goals:** Monitor FPS/thermals without alt-tabbing; one-touch game launch; apply a "competitive" profile (perf mode + RAM clean + low-latency network) in one tap.
- **Frustrations:** Juggling MSI Afterburner, Discord, Steam overlays at once.
- **Success metric:** All game-session tasks ≤ 2 taps from the gaming layout.

### Persona 2 — Jordan, 28 · The Live Streamer
- **Devices:** High-end PC (host), iPad (client).
- **Goals:** Scene switching, audio mixing, clip capture, donation alerts — from one panel, no keyboard shortcuts.
- **Frustrations:** Current setup spans multiple boards and shortcuts.
- **Success metric:** A full stream session run without touching keyboard shortcuts.

### Persona 3 — Sam, 32 · The Developer / Power User
- **Devices:** Workstation (host), Android tablet (client).
- **Goals:** Consolidated system-health view; quick tool/terminal launch; notification triage.
- **Frustrations:** No single health view; notification overload.
- **Success metric:** Health anomalies spotted in < 30s; triage in < 10s.

### Persona 4 — Riley, 35 · The Home-Automation Enthusiast
- **Devices:** PC (host), 20+ IoT devices, wall-mounted tablet (client).
- **Goals:** Control lights/scenes/energy from a single touch surface; wall-tablet "home panel."
- **Frustrations:** Home Assistant's mobile app isn't touch-optimized for quick actions.
- **Success metric:** Any smart-home action in ≤ 2 taps.

### Persona 5 — Morgan, 30 · The Builder / Automation Tinkerer *(new)*
- **Devices:** PC (host), phone + tablet (clients), tinkers across all domains.
- **Goals:** Compose multi-step **flows** — "when CPU > 85°C, switch to a cooling profile, ping me, and dim the room lights"; build conditional macros; bind custom variables to widgets; eventually write/install plugins.
- **Frustrations:** Incumbents force nested-IF gymnastics and offer no real branching, loops, or variables; logic and UI feel bolted together.
- **Success metric:** A non-trivial conditional flow (branch + variable + wait) built and working in < 10 minutes in the visual builder.

> Morgan is the persona the flow engine and plugin ecosystem exist for, and the one most likely to become an advocate/extension author.

---

## 3. User journeys

Each journey notes the phase in which it becomes fully possible. Journeys 1–3 are the V1 core loop; 4–7 layer on.

### Journey 0 — First-run setup *(Phase 1)*
1. User installs the single CyberDeck package on their PC; the **engine registers as a background service and starts**.
2. The **Desktop UI** opens; a first-run wizard confirms the engine is running (tray icon present) and shows a **pairing QR**.
3. User opens the CyberDeck client on their phone, taps "Pair," scans the QR; key exchange completes; the device appears in the engine's device list with a chosen label and device class.
4. User assigns a starter layout to the phone; it renders immediately. Done — no account, no activation.

### Journey 1 — Authoring a layout with live reflection *(Phase 1)*
1. In the Designer, user selects the target device ("Living Room iPad · 10×6 landscape").
2. User sets the grid (columns/rows/gutter/background), drags a **CPU gauge** onto a cell, binds it to `system.cpu.temp`.
3. The iPad, in preview mode, **shows the gauge appear in real time**.
4. User drags a **button**, maps `tap → media.play` and `longPress → flow_morning` via the schema-generated inspector.
5. User hits "done"; the layout is persisted by the engine and the iPad switches to runtime mode.

### Journey 2 — Gaming session start *(Phase 1 launch, Phase 3 optimization depth)*
1. User opens the client; the gaming layout loads in < 1s with live thermals.
2. Taps a game tile → launcher opens the game.
3. Taps "Competitive" profile → (Phase 3) perf mode + RAM clean + low-latency network apply together.
4. Monitors live FPS/CPU/GPU during play without alt-tabbing.

### Journey 3 — Notification triage *(Phase 1 badge, Phase 5 full)*
1. Badge shows 6 unread.
2. User opens the notifications surface → categorized list.
3. Filters to "Alerts"; dismisses non-critical; taps a message to open its source app.

### Journey 4 — Building a conditional flow *(Phase 1 model/manual, Phase 3 visual builder)*
1. Morgan opens the flow builder, creates "Cooling Guard."
2. Trigger: `stateChange` on `system.cpu.temp` crossing `> 85`.
3. Nodes: `action: system.performance.set{Silent}` → `if {var.notify_enabled}==true` → `action: notify` → `action: home.light.brightness{30}`.
4. Saves; the engine arms the trigger. When the threshold trips, the flow runs host-side.

### Journey 5 — Morning routine (smart home) *(Phase 4)*
1. User taps "Good Morning" scene on the wall tablet.
2. One flow sets lights, coffee, and AC (5 actions, 1 tap).
3. User checks the energy widget vs. yesterday.

### Journey 6 — Adding a second device with different permissions *(Phase 1)*
1. User pairs a kitchen tablet (QR).
2. In device settings, **denies power actions** and limits it to media + smart home.
3. Assigns a kitchen-specific layout; the tablet can't shut the PC down even if a layout tried.

### Journey 7 — Remote control from outside the LAN *(Phase 7)*
1. User enables remote access (account required); the engine registers with the relay.
2. From a phone on cellular, the client connects via the relay endpoint.
3. Identity, encryption, and sessions are **identical** to LAN — only the endpoint differs.

---

## 4. Feature inventory (by domain, prioritized, with phase)

**Priority key:** P0 = foundation-critical for V1 · P1 = important, near-term · P2 = valuable, mid-term · P3 = later/candidate.
**Phase** maps to Document 0 §11. A feature may have its *seam* in Phase 1 and its *full capability* later; the Phase column gives the phase of full capability, with seam notes inline.

### D1 — Platform & Engine Core
| ID | Feature | Priority | Phase |
|----|---------|----------|-------|
| D1-01 | Background engine service (boot-start, survives UI close) | P0 | 1 |
| D1-02 | System-tray presence (status, reopen UI, pause/quit engine) | P0 | 1 |
| D1-03 | Two-process/one-installer packaging (native `.exe`/`.msi`, `.dmg`/`.pkg`, `.deb`/`.rpm`/`.AppImage`) | P0 | 1 |
| D1-04 | Typed state store + delta broadcast | P0 | 1 |
| D1-05 | Action registry (schema-driven) | P0 | 1 |
| D1-06 | Widget-type registry (schema-driven) | P0 | 1 |
| D1-07 | Event bus | P0 | 1 |
| D1-08 | Profile/session model (per-device isolation) | P0 | 1 |
| D1-09 | SQLite durable persistence; in-memory live state | P0 | 1 |
| D1-10 | Engine health endpoint / status surface | P1 | 1 |
| D1-11 | Hot-reload of config without restart | P2 | 6 |
| D1-12 | Headless service-only operation (no GUI session) | P2 | 7 |

### D2 — Device Management (identity, discovery, pairing)
| ID | Feature | Priority | Phase |
|----|---------|----------|-------|
| D2-01 | Per-device keypair + UUID identity (account-independent) | P0 | 1 |
| D2-02 | QR pairing (token + fingerprint challenge-response) | P0 | 1 |
| D2-03 | mDNS/DNS-SD zero-config discovery | P0 | 1 |
| D2-04 | Manual IP/hostname + PIN pairing | P0 | 1 |
| D2-05 | Active subnet scan fallback (relocate by UUID) | P1 | 1 |
| D2-06 | Device record: label, class, locator hints, last-seen | P0 | 1 |
| D2-07 | Per-device permissions (category + destructive-action gating) | P0 | 1 |
| D2-08 | Device revocation (instant key rejection) | P0 | 1 |
| D2-09 | Device class management (grid defaults, orientation) | P0 | 1 |
| D2-10 | Pairing approval via privileged local control channel | P0 | 1 |

### D3 — Transport & Connectivity
| ID | Feature | Priority | Phase |
|----|---------|----------|-------|
| D3-01 | Endpoint abstraction (`TransportEndpoint`/`ConnectionManager`) | P0 | 1 |
| D3-02 | E2E-encrypted sessions over LAN | P0 | 1 |
| D3-03 | Three logical channels (Layout / State / Preview) | P0 | 1 |
| D3-04 | Heartbeat/keepalive (no sleep-induced drops) | P0 | 1 |
| D3-05 | Auto-reconnect w/ backoff → mDNS → scan | P0 | 1 |
| D3-06 | Graceful degradation (`--` fallback, connection badge) | P0 | 1 |
| D3-07 | Versioned resync on gap | P0 | 1 |
| D3-08 | Local UI↔engine loopback protocol + privileged control channel | P0 | 1 |
| D3-09 | Relay/rendezvous remote endpoint | P2 | 7 |
| D3-10 | NAT traversal | P2 | 7 |
| D3-11 | Compact binary codec for State channel | P3 | 2+ |

### D4 — Layout & Designer (desktop-only)
| ID | Feature | Priority | Phase |
|----|---------|----------|-------|
| D4-01 | WYSIWYG grid canvas (renders as target device class) | P0 | 1 |
| D4-02 | Fully customizable grid (cols/rows/gutter/margins/aspect/bg; no caps) | P0 | 1 |
| D4-03 | Drag-drop widget placement (snap-to-grid; no overlap) | P0 | 1 |
| D4-04 | Move/resize with throttled live preview | P0 | 1 |
| D4-05 | Schema-driven inspector (auto-generated param editors) | P0 | 1 |
| D4-06 | Appearance binding to states + conditional `valueRules` | P0 | 1 |
| D4-07 | Operation-log sync to bound devices (instant reflection) | P0 | 1 |
| D4-08 | Undo/redo (op inverses) | P0 | 1 |
| D4-09 | Per-device-class authoring + explicit device targeting | P0 | 1 |
| D4-10 | Profile management (create/assign/activate) | P0 | 1 |
| D4-11 | Layout import/export (share a layout) | P1 | 2 |
| D4-12 | Collaborative multi-author editing | P3 | 8 |
| D4-13 | Responsive/adaptive cross-class layouts | P3 | 8 |

### D5 — Widget Vocabulary
| ID | Feature | Priority | Phase |
|----|---------|----------|-------|
| D5-01 | Button | P0 | 1 |
| D5-02 | Toggle | P0 | 1 |
| D5-03 | Slider | P0 | 1 |
| D5-04 | Label / text | P0 | 1 |
| D5-05 | Image / icon | P0 | 1 |
| D5-06 | Circular gauge (+ optional sparkline) | P0 | 1 |
| D5-07 | Linear gauge / progress bar | P0 | 1 |
| D5-08 | Sparkline (series state) | P0 | 1 |
| D5-09 | Media card (art + metadata + controls) | P1 | 2 |
| D5-10 | Page-nav / profile-switch widget | P0 | 1 |
| D5-11 | Rolling line chart (60s) | P1 | 3 |
| D5-12 | Donut/distribution chart | P2 | 3 |
| D5-13 | Camera preview tile | P2 | 5 |
| D5-14 | Plugin-provided custom widget types | P2 | 6 |

### D6 — Interaction & Gestures
| ID | Feature | Priority | Phase |
|----|---------|----------|-------|
| D6-01 | Full gesture-slot model (tap/double/long/down/up/drag/swipe) defined | P0 | 1 |
| D6-02 | Designer UI for core slots (tap/long/drag) | P0 | 1 |
| D6-03 | Independent action target per slot (action/macro/flow/navigate) | P0 | 1 |
| D6-04 | 2-tap confirmation gating for destructive actions | P0 | 1 |
| D6-05 | Visual pressed-state + ≤500ms result feedback | P0 | 1 |
| D6-06 | Designer UI for remaining slots (double/down/up/swipe) | P1 | 2 |

### D7 — Automation (flows & macros)
| ID | Feature | Priority | Phase |
|----|---------|----------|-------|
| D7-01 | Flow data model + versioning | P0 | 1 |
| D7-02 | Flow executor (host-side, async, cancellable) | P0 | 1 |
| D7-03 | Core node set (action/if/setVar/wait/loop/navigate/random/subflow/stop) | P0 | 1 |
| D7-04 | Sandboxed expression language (interpolation, comparison, boolean, arithmetic) | P0 | 1 |
| D7-05 | User variables (`var.*`, typed, persisted, bindable) | P0 | 1 |
| D7-06 | Triggers: manual, event, stateChange | P0 | 1 |
| D7-07 | Local vs global scope | P0 | 1 |
| D7-08 | Macro = linear flow (first-class) | P0 | 1 |
| D7-09 | Visual flow builder UI | P1 | 3 |
| D7-10 | Schedule/cron triggers | P1 | 3 |
| D7-11 | Extended nodes (HTTP request, parallel/fork) | P2 | 3 |
| D7-12 | Plugin-provided flow nodes | P2 | 6 |

### D8 — System Telemetry
| ID | Feature | Priority | Phase |
|----|---------|----------|-------|
| D8-01 | CPU load/temp/freq/cores | P0 | 1 |
| D8-02 | GPU load/temp/VRAM | P0 | 1 |
| D8-03 | RAM used/available/percent | P0 | 1 |
| D8-04 | Storage used/free per drive | P0 | 1 |
| D8-05 | Network up/down/ping | P0 | 1 |
| D8-06 | System uptime | P1 | 1 |
| D8-07 | Threshold events (CPU/GPU temp, RAM%) | P0 | 1 |
| D8-08 | System health score (computed) | P1 | 3 |
| D8-09 | Top-processes table | P1 | 3 |
| D8-10 | Fan speed read | P2 | 3 |
| D8-11 | GPU telemetry provider chain (GPUtil → AMD/OpenHardwareMonitor → vendor NVAPI/ADL → unavailable) | P1 | 1 |

### D9 — System Control & Power
| ID | Feature | Priority | Phase |
|----|---------|----------|-------|
| D9-01 | Power: shutdown/restart/sleep/hibernate/lock/logoff (gated) | P0 | 1 |
| D9-02 | App launchers (Steam/Epic/Chrome/Discord/custom) | P0 | 1 |
| D9-03 | System volume control | P0 | 1 |
| D9-04 | Performance/power-plan selector | P1 | 3 |
| D9-05 | Kill process by PID | P1 | 3 |
| D9-06 | Launch system tools (Task Manager, Control Panel, etc.) | P1 | 1 |
| D9-07 | Fan control (write) | P2 | 3 |
| D9-08 | Unsaved-work warning before power actions | P1 | 1 |

### D10 — Media
| ID | Feature | Priority | Phase |
|----|---------|----------|-------|
| D10-01 | Now-playing metadata (track/artist/album) via OS media session | P0 | 1 |
| D10-02 | Playback controls (play/pause/next/prev) | P0 | 1 |
| D10-03 | Album art retrieval + cache | P1 | 2 |
| D10-04 | Playback position/progress | P1 | 2 |
| D10-05 | Shuffle/repeat | P1 | 2 |
| D10-06 | Multi-channel volume mixer (per-app) | P1 | 2 |
| D10-07 | Audio output device selection | P2 | 2 |
| D10-08 | EQ presets | P3 | 2 |

### D11 — Gaming
| ID | Feature | Priority | Phase |
|----|---------|----------|-------|
| D11-01 | Favourite-game grid launcher (cover art) | P1 | 3 |
| D11-02 | Live FPS via provider chain (native → PresentMon → FrameView → RTSS → vendor APIs → unavailable) | P1 | 3 |
| D11-03 | Game profiles (Competitive/AAA/Streaming/Battery) | P1 | 3 |
| D11-04 | RAM cleaner | P1 | 3 |
| D11-05 | Network boost / low-latency mode | P2 | 3 |
| D11-06 | Current-game detection | P2 | 3 |
| D11-07 | Achievements display | P3 | 3 |
| D11-08 | Screenshot / clip capture | P2 | 3 |

### D12 — Smart Home
| ID | Feature | Priority | Phase |
|----|---------|----------|-------|
| D12-01 | Home Assistant integration (REST + event bus) | P1 | 4 |
| D12-02 | Light toggle + brightness | P1 | 4 |
| D12-03 | Device/plug/switch toggle | P1 | 4 |
| D12-04 | Scene activation | P1 | 4 |
| D12-05 | Room overview cards | P1 | 4 |
| D12-06 | Environment sensors (temp/humidity/AQ) | P2 | 4 |
| D12-07 | Thermostat / AC set-temp | P2 | 4 |
| D12-08 | Energy monitor | P2 | 4 |
| D12-09 | Security camera previews | P2 | 5 |

### D13 — Notifications
| ID | Feature | Priority | Phase |
|----|---------|----------|-------|
| D13-01 | Unread count badge (OS action center) | P0 | 1 |
| D13-02 | Aggregated notification feed | P1 | 5 |
| D13-03 | Source filtering (Discord/System/Streamlabs/etc.) | P1 | 5 |
| D13-04 | Dismiss / mark-all-read | P1 | 5 |
| D13-05 | Priority badges | P2 | 5 |
| D13-06 | Open-source-app action | P1 | 5 |

### D14 — Security & Governance
| ID | Feature | Priority | Phase |
|----|---------|----------|-------|
| D14-01 | E2E encryption built for remote from day one | P0 | 1 |
| D14-02 | Action audit log (append-only, per-device) | P0 | 1 |
| D14-03 | Per-device permission enforcement | P0 | 1 |
| D14-04 | Privileged-local-only operations (service lifecycle, pairing) | P0 | 1 |
| D14-05 | Credential storage in OS secure store (for integrations) | P1 | 4 |
| D14-06 | Plugin permission declaration + enforcement | P1 | 6 |
| D14-07 | Plugin signing/sandboxing | P2 | 6 |
| D14-08 | Audit-log search/export UI | P2 | 6 |

### D15 — Plugin Ecosystem
| ID | Feature | Priority | Phase |
|----|---------|----------|-------|
| D15-01 | Plugin registration/manifest contract (used by first-party) | P0 | 1 |
| D15-02 | Out-of-process plugin host (crash isolation) — runs ALL plugins incl. first-party | P0 | 1 |
| D15-03 | First-party capabilities implemented as out-of-process plugins (same contract) | P0 | 1 |
| D15-04 | Public plugin SDK | P2 | 6 |
| D15-05 | Third-party plugin loading | P2 | 6 |
| D15-06 | Plugin distribution / marketplace path | P3 | 6 |

### D16 — Accounts & Cloud (licensing-gated)
| ID | Feature | Priority | Phase |
|----|---------|----------|-------|
| D16-01 | Optional account (overlay; never required for local use) | P2 | 7 |
| D16-02 | Layout/config cloud backup & sync | P2 | 7 |
| D16-03 | Remote access (account-gated) | P2 | 7 |
| D16-04 | Team sharing | P3 | 8 |

### D17 — Design System & Accessibility
| ID | Feature | Priority | Phase |
|----|---------|----------|-------|
| D17-01 | Neon cyberpunk theme tokens (palette/typography/spacing) — carried | P0 | 1 |
| D17-02 | Theming applied across designer + client | P0 | 1 |
| D17-03 | 48×48 px min touch targets | P0 | 1 |
| D17-04 | WCAG 2.1 AA contrast (4.5:1) | P0 | 1 |
| D17-05 | Colour-never-sole-indicator (icon + text accompany state) | P0 | 1 |
| D17-06 | Custom themes / user-defined palettes | P2 | 6 |

---

## 5. Functional requirements (V1 normative)

Requirements use SHALL. IDs are stable references for the TRD and per-phase docs. Only V1 (P0/early-P1) requirements are enumerated here; later-phase functional requirements live in their phase deep dives.

### FR-1 Engine & lifecycle
- FR-1.1 The engine SHALL run as an OS background service that starts on boot and continues running when the Desktop UI is closed.
- FR-1.2 Closing the Desktop UI window SHALL NOT terminate the engine.
- FR-1.3 The installer SHALL deliver both engine service and Desktop UI in one native package per target OS.
- FR-1.4 The system tray SHALL show engine status and allow reopening the UI and pausing/quitting the engine.
- FR-1.5 The engine SHALL be the single source of truth for all state, layouts, flows, and device records.

### FR-2 Identity, discovery & pairing
- FR-2.1 Each device and the engine SHALL generate a keypair + UUID on first launch, independent of any account.
- FR-2.2 The engine SHALL advertise via mDNS (`_cyberdeck._tcp.local`) with name, UUID, version, and fingerprint.
- FR-2.3 Pairing SHALL support QR (token + fingerprint challenge-response), and manual IP/hostname + PIN.
- FR-2.4 Identity SHALL be the keypair/UUID; IP and MAC SHALL be used only as locator hints.
- FR-2.5 If a known device's last IP fails and mDNS is silent, the engine MAY perform a bounded subnet scan, confirming identity by UUID.
- FR-2.6 Pairing approval SHALL be issuable only over the privileged local control channel.

### FR-3 Sessions & multi-device
- FR-3.1 The engine SHALL maintain an isolated session per device, each with its own active profile, subscriptions, and permissions.
- FR-3.2 Two or more devices SHALL be able to display different profiles simultaneously without interference.
- FR-3.3 Each device session SHALL be in exactly one of: runtime mode (state only) or edit/preview mode (state + layout ops + previews).

### FR-4 Permissions & governance
- FR-4.1 Each device record SHALL carry permissions controlling allowed action categories and destructive-action access.
- FR-4.2 The engine SHALL reject any action a device's permissions disallow, regardless of layout content.
- FR-4.3 A device SHALL be revocable; a revoked device's key SHALL be rejected at next handshake.
- FR-4.4 Every executed action SHALL be recorded in an append-only audit log with actor, type, resource, timestamp.

### FR-5 Transport & resilience
- FR-5.1 All session traffic SHALL be encrypted and authenticated, including on LAN.
- FR-5.2 The transport SHALL maintain heartbeat/keepalive to prevent sleep-induced disconnects.
- FR-5.3 On disconnect, the client SHALL auto-reconnect with backoff, then mDNS rediscovery, then bounded scan.
- FR-5.4 On disconnect, bound widgets SHALL render last value dimmed with a `--` fallback and a connection badge; no frozen or false display.
- FR-5.5 Each document SHALL carry a monotonic version; a client detecting a gap SHALL request a full resync.
- FR-5.6 The Layout, State, and Preview channels SHALL be logically separate.

### FR-6 State & telemetry
- FR-6.1 States SHALL be typed and namespaced (`category.subcategory.field`).
- FR-6.2 Only changed states SHALL be broadcast (delta).
- FR-6.3 CPU/GPU/RAM telemetry SHALL update at ≤1000ms; storage at ≤10000ms; per Document 0 cadences.
- FR-6.4 Display formatting (units) SHALL be a presentation concern; stored state values SHALL retain native type.
- FR-6.5 Series states (sparkline buffers) SHALL be maintained in-memory and SHALL NOT be persisted.
- FR-6.6 Threshold events SHALL fire at CPU > 85°C, GPU > 88°C, RAM > 90% (defaults; configurable).
- FR-6.7 Each integration/telemetry capability SHALL be backed by an ordered provider chain; the engine SHALL bind the highest-priority available provider.
- FR-6.8 Absence of all providers for a capability SHALL report the capability as **unavailable** and SHALL NOT cause system failure; dependent states SHALL render `--` and flows SHALL be able to branch on availability.

### FR-7 Actions
- FR-7.1 Actions SHALL be declared with a typed parameter schema in the action registry.
- FR-7.2 The Designer SHALL auto-generate parameter editors from action schemas with no per-action UI code.
- FR-7.3 Destructive actions SHALL require 2-tap confirmation on the client.
- FR-7.4 Numeric parameters SHALL be validated against schema min/max; out-of-range input SHALL be clamped or rejected per schema.
- FR-7.5 Power actions SHALL warn if unsaved-work detection indicates risk.

### FR-8 Layouts & Designer
- FR-8.1 Layout authoring SHALL be desktop-only; clients SHALL NOT edit layouts.
- FR-8.2 Grid configuration (cols/rows/gutter/margins/aspect/background) SHALL be fully user-customizable with no caps.
- FR-8.3 Layouts SHALL be authored against a specific device class.
- FR-8.4 Every edit SHALL be expressed as a versioned operation applied to the authoritative document.
- FR-8.5 Operations SHALL broadcast to subscribed device sessions, which SHALL repaint only affected widgets.
- FR-8.6 The Designer SHALL support undo/redo via operation inverses.
- FR-8.7 During drag, ephemeral previews SHALL ride the Preview channel and SHALL NOT be persisted; a durable op SHALL commit on drop.
- FR-8.8 The Designer SHALL always display its explicit target device.
- FR-8.9 Widgets SHALL NOT overlap; conflicting placement SHALL be rejected or pushed.

### FR-9 Widgets & interaction
- FR-9.1 Widget types SHALL be declared in the widget-type registry with a config schema and exposed gesture slots.
- FR-9.2 The client SHALL render widgets via a native renderer registry keyed by widget type.
- FR-9.3 A widget SHALL support independent action targets per gesture slot (tap/double/long/down/up/drag/swipe).
- FR-9.4 A gesture target SHALL be one of: single action, macro/flow, navigate, or none.
- FR-9.5 Appearance MAY bind to a state, with optional conditional styling (`valueRules`) evaluated client-side.
- FR-9.6 Button presses SHALL show a visual pressed state within 100ms and a result within 500ms.

### FR-10 Automation (flow engine)
- FR-10.1 Flows SHALL be stored, versioned, and executed host-side; clients SHALL only trigger.
- FR-10.2 The V1 node set SHALL include action, if/else, setVar, wait, loop, navigate, random, subflow, stop.
- FR-10.3 Conditions/values SHALL use a sandboxed expression language with token interpolation; arbitrary code execution SHALL NOT be possible.
- FR-10.4 User variables (`var.*`) SHALL be typed, persisted, and bindable as state sources.
- FR-10.5 Flows SHALL be triggerable by manual, event, and stateChange triggers in V1 (schedule reserved).
- FR-10.6 A flow run SHALL have a local scope; `var.*` SHALL be global and persistent.
- FR-10.7 Flows SHALL be cancellable and SHALL log failures with the failing node id.

### FR-11 Plugins (V1 contract)
- FR-11.1 All capabilities outside the engine core SHALL execute as plugins through the plugin host; first-party and third-party plugins SHALL share one lifecycle, IPC contract, permission model, and isolation boundary.
- FR-11.2 Plugins SHALL run out-of-process; a plugin crash SHALL NOT crash the engine.
- FR-11.3 Plugins SHALL declare required permissions; the host SHALL enforce them uniformly regardless of plugin origin.
- FR-11.4 The engine core SHALL NOT contain capability-specific business logic except core platform functions (transport, state store, flow engine, security, persistence, registries).
- FR-11.5 "First-party" vs "third-party" SHALL be trust metadata only (affecting signing, permission defaults, and UX), never a distinct execution model.

---

## 6. Non-functional requirements

Carried and upgraded from Document 0 §13; restated here as product requirements.

| ID | Category | Requirement | Target |
|----|----------|-------------|--------|
| NFR-01 | Performance | Tap-to-feedback latency (LAN) | < 100 ms |
| NFR-02 | Performance | Layout op → device reflection (LAN) | < 200 ms |
| NFR-03 | Performance | Client render rate during telemetry updates | 60 FPS |
| NFR-04 | Performance | Initial layout render | < 1 s |
| NFR-05 | Reliability | Reconnect after drop | < 5 s |
| NFR-06 | Reliability | Crash-free sessions (first month) | ≥ 99% |
| NFR-07 | Reliability | Plugin crash isolation | Engine always survives |
| NFR-08 | Scalability | Engine steady-state RAM | < 150 MB |
| NFR-09 | Scalability | Engine idle CPU | < 2% on 8-core |
| NFR-10 | Scalability | Concurrent device sessions (V1 target) | ≥ 8 without degradation |
| NFR-11 | Security | All traffic encrypted | Including LAN |
| NFR-12 | Security | Identity independent of account | Always |
| NFR-13 | Usability | Primary actions reachable | ≤ 2 taps from any page |
| NFR-14 | Usability | Min touch target | 48×48 px |
| NFR-15 | Accessibility | Text contrast | WCAG 2.1 AA (4.5:1) |
| NFR-16 | Compatibility | Host OS | Win 10/11, macOS (ARM+Intel), Linux x86-64/ARM64 |
| NFR-17 | Compatibility | Client OS | Android, iOS/iPadOS, Win, macOS, Linux |
| NFR-18 | Maintainability | Single client codebase across all surfaces | Flutter |
| NFR-19 | Portability | Native installer per desktop OS | `.exe`/`.msi`, `.dmg`/`.pkg`, `.deb`/`.rpm`/`.AppImage` |

---

## 7. Licensing principle (verbatim product statement)

> **Accounts are optional for local usage.**
> **Licensing is attached to the user account, not individual devices.**
> **A paid user may use multiple personal devices.**
> **Device-count restrictions are a non-goal.**

Supporting principles:

- **Free tier = local-only, no account.** Install, pair over LAN, design, automate — forever.
- **Account = optional overlay** required only for cloud services (sync, backup, remote access, team sharing).
- **Identity ≠ licensing.** Device identity (keypair/UUID) exists from first launch independent of any account; an account references device identities, it never owns or gates them.
- **No platform-locked purchases.** A paid account works across all of a user's platforms.

---

## 8. Success metrics

| Metric | Target | Method |
|--------|--------|--------|
| First-pair time (install → first device rendering a layout) | < 5 min | Onboarding instrumentation (opt-in) |
| Tap-to-feedback latency | < 100 ms (LAN) | Timed client instrumentation |
| Layout edit → device reflection | < 200 ms (LAN) | Designer↔device round-trip timing |
| Telemetry accuracy (CPU%) | ± 1% vs Task Manager | Comparison script |
| Time to build a non-trivial flow (Morgan persona) | < 10 min | Usability study |
| Crash-free sessions (first month) | ≥ 99% | Engine exception logs (opt-in) |
| Connection stability (sessions with zero unexpected drops over 1h) | ≥ 95% | Transport telemetry (opt-in) |
| Daily active use among target users (30-day) | ≥ 80% | Usage analytics (opt-in) |
| User-reported satisfaction | ≥ 4.5/5 | Post-release survey (n ≥ 50) |
| Engine steady RAM after 8h | < 150 MB | Soak test |

> All user analytics are **opt-in** and consistent with the no-exfiltration non-goal; local-only users are never required to send data.

---

## 9. Out-of-scope clarifications & dependencies

- **External hardware decks** (physical Stream Deck units) are out of scope; CyberDeck targets user-owned screens as surfaces.
- **Smart-home breadth** in V1 is limited to the Home Assistant integration model (Phase 4); other ecosystems are plugin candidates.
- **FPS sourcing** uses a provider chain (D11-02): **PresentMon** is the primary Windows source (open-source, no overlay, bundleable subject to a licensing review tracked in the TRD); FrameView/RTSS are fallbacks; vendor APIs (NVAPI/ADL) sit lower because they reliably expose GPU telemetry but not always per-application FPS. On macOS/Linux the chain may resolve to *unavailable* in V1 — a normal, non-breaking outcome under the provider-chain contract, not a gap.
- **macOS/iOS media + notification access** is subject to OS permission models; the TRD will specify per-OS capability coverage.

---

*End of PRD (Draft v0.1). Next pass: TRD (Document 2) — system architecture in depth, protocol/schema specs, engine internals, per-platform abstraction, data flows. Then per-phase deep dives starting with Phase 1.*
