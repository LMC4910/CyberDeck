# CyberDeck — Complete Enterprise Documentation Set

**Compiled master document** · Codebase ID: `com.shishir.cyberdeck`
Compiled: 2026-06-02 · 16 logical documents · 35 architecture decisions

> A cross-platform control-surface platform: a host **engine** exposes a computer's capabilities (telemetry, media, power, gaming, smart home, notifications, automation) as live **states** and **actions**; **client devices** render desktop-authored **layouts** and trigger them. Local-first, security-first, LAN-now / remote-ready.
>
> **This file concatenates the full set in reading order.** Authority chain: Foundation (Doc 0) → PRD (Doc 1) → TRD Master + subsystem TRDs (2 / 2A–2G) + Decision Log (2-ADR) → Per-Phase Deep Dives (Docs 3–10). Each constituent document retains its own version header and closing note.

---

# Master Table of Contents

1. [Document 0 — Foundation & Architecture](#document-0-foundation-architecture)
2. [Document 1 — Product Requirements Document (PRD)](#document-1-product-requirements-document-prd)
3. [Document 2 — TRD Master](#document-2-trd-master)
4. [Document 2-ADR — Architecture Decision Log](#document-2-adr-architecture-decision-log)
5. [Document 2E — TRD: Security & Identity](#document-2e-trd-security-identity)
6. [Document 2A — TRD: Transport & Connectivity](#document-2a-trd-transport-connectivity)
7. [Document 2B — TRD: Engine Core](#document-2b-trd-engine-core)
8. [Document 2F — TRD: Plugin Architecture](#document-2f-trd-plugin-architecture)
9. [Document 2G — TRD: Platform Abstraction Layer](#document-2g-trd-platform-abstraction-layer)
10. [Document 2C — TRD: Layout & Designer](#document-2c-trd-layout-designer)
11. [Document 2D — TRD: Flow Engine](#document-2d-trd-flow-engine)
12. [Document 3 — Phase 1 (Foundation) Deep Dive](#document-3-phase-1-foundation-deep-dive)
13. [Document 4 — Phase 2 (Media Integration) Deep Dive](#document-4-phase-2-media-integration-deep-dive)
14. [Document 5 — Phase 3 (Gaming + Automation Authoring) Deep Dive](#document-5-phase-3-gaming-automation-authoring-deep-dive)
15. [Document 6 — Phase 4 (Smart Home) Deep Dive](#document-6-phase-4-smart-home-deep-dive)
16. [Document 7 — Phase 5 (Notifications & Cameras) Deep Dive](#document-7-phase-5-notifications-cameras-deep-dive)
17. [Document 8 — Phase 6 (Plugin SDK & Ecosystem) Deep Dive](#document-8-phase-6-plugin-sdk-ecosystem-deep-dive)
18. [Document 9 — Phase 7 (Remote Access) Deep Dive](#document-9-phase-7-remote-access-deep-dive)
19. [Document 10 — Phase 8 (Advanced) Deep Dive](#document-10-phase-8-advanced-deep-dive)

---



<a id="document-0-foundation-architecture"></a>

# Document 0 — Foundation & Architecture

## CyberDeck — Foundation & Architecture Document

**Document 0 of the CyberDeck Enterprise Documentation Set**
Version 0.4 (Draft) · June 2026 · Product Owner: Shishir · Codebase ID: `com.shishir.cyberdeck`

---

### 0. How to read this document set

This is the **spine**. It fixes the decisions, the domain model, the architecture, the security posture, the technology stack, and the phase map that every other document depends on. It is deliberately written so that:

- **V1 (the foundation release) is specified in real detail** — the parts being built first are described down to the data structures, message shapes, and flows.
- **Every future feature is given a defined attachment point** — a "seam" in the V1 architecture that the later feature plugs into without re-architecting. Section 12 is the canonical index of these seams.

The full documentation set is built in passes:

| # | Document | Status | Purpose |
|---|----------|--------|---------|
| 0 | **Foundation & Architecture** (this doc) | Draft | The spine: decisions, domain model, architecture, stack, phase map, extension seams |
| 1 | Product Requirements Document (PRD) | Draft | Vision, personas, itemized + prioritized feature inventory, user journeys, functional/non-functional requirements, success metrics |
| 2 | **TRD Master** | Draft | System context, component & process model, trust boundaries, security-architecture overview, data-flow overview, deployment, coding standards, shared conventions, ADR index |
| 2-ADR | **Architecture Decision Log** | Draft | All ADRs, append-only, referenced by every document by ID |
| 2A | TRD — Transport & Connectivity | Pending | Discovery, pairing, session, encryption, reconnect, the three channels, relay seam |
| 2B | TRD — Engine Core | Pending | State store, event bus, registries, persistence, lifecycle, service management |
| 2C | TRD — Layout & Designer | Pending | Document model, op-log, undo/redo, sync, rendering contract |
| 2D | TRD — Flow Engine | Pending | Runtime, scheduler, expression language, variables, triggers, execution semantics |
| 2E | TRD — Security & Identity | Pending | Key management, identity, permissions, audit, secure storage, threat model |
| 2F | TRD — Plugin Architecture | Pending | Plugin host, IPC, lifecycle, permissions, SDK contract, sandboxing |
| 2G | TRD — Platform Abstraction Layer | Pending | Capability interfaces, provider chains, telemetry/media/power/notification providers |
| 3+ | Per-Phase Deep Dives (one per phase) | Pending | For each phase: functional flow, user journeys, feature capability, technical spec, code structure, data flow, test plan, acceptance criteria |

A reader implementing a phase should read: this doc (spine) → PRD (what) → TRD (how, system-wide) → that phase's deep dive (how, specifically).

---

### 1. Product definition

#### 1.1 What CyberDeck is

CyberDeck is a **cross-platform control-surface platform**. A long-running **engine** on a host computer exposes that computer's capabilities — system telemetry, media, power, gaming optimization, smart-home control, notifications, and arbitrary user-defined automations — as a set of **actions** and live **states**. One or more **client devices** (phones, tablets, desktops) connect to the engine and render **layouts**: grids of widgets that display state and trigger actions.

It is the conceptual successor to the scrapped Touch Portal plugin approach, but instead of skinning someone else's host, CyberDeck owns the entire stack: its own engine, its own transport, its own clients, its own layout language, and its own plugin SDK.

#### 1.2 What makes it different (the thesis)

Three capabilities, none of which the incumbents (Stream Deck, Touch Portal) deliver together, define the product:

1. **Live data as first-class widgets.** Circular gauges, sparklines, charts, and media cards bound to real-time engine state — not static button images rendered by plugins.
2. **A real automation engine.** A full conditional flow/macro engine with branching, variables, loops, and waits — authored visually on the desktop, executed on the engine.
3. **A real-time visual designer with instant device reflection.** Layouts are authored on the desktop against the exact target device class, and edits propagate live to bound devices via an operation-log sync model.

All three sit on a security-first, multi-device, LAN-now/remote-ready foundation.

#### 1.3 Platform targets

| Component | Platforms |
|-----------|-----------|
| **Engine (host)** | Windows 10/11, macOS (Apple Silicon + Intel), Linux (x86-64, ARM64) |
| **Client (control surface)** | Android, iOS/iPadOS, Windows, macOS, Linux |
| **Designer (authoring)** | Desktop only — bundled into the desktop client/engine app (Windows, macOS, Linux) |

A single machine typically runs **engine + desktop client + designer** in one application bundle; phones and tablets run the **client** only.

#### 1.4 Scope guardrails

- **LAN-only at launch.** All transport is local-network. Remote access is a defined future phase, and the architecture reserves the seam for it (Section 10) — but no cloud component ships in V1.
- **Desktop-only authoring.** Clients never edit layouts. They render and interact. This is a permanent product decision, not a phase limitation.
- **Per-device-class authored layouts.** A layout is designed against a specific grid/orientation profile and assigned to devices of that class. No automatic reflow across form factors in V1 (responsive adaptation is a possible later enhancement, Section 12).

---

### 2. Architectural philosophy

#### 2.1 The host-authority model

The engine is the **single source of truth**. It owns all state, all layout documents, all action execution, and all flow execution. Clients are **deterministic renderers of engine-defined UI** plus **input forwarders**. A client holds no business logic it could disagree with the engine about.

This is what guarantees the "no confusion which device" requirement: there is exactly one authority, and every device is a named, isolated session against it.

#### 2.2 The hybrid rendering choice

Rejected: **pixel streaming** (engine renders UI, ships frames) — laggy, heavy, fails the latency budget.

Chosen: **declarative layout + native rendering.** The engine ships a *layout document* (a structured description: "a CPU gauge bound to state X at grid cell 3,4, neon-cyan, tap → action Y"). The client owns a **native widget toolkit** and renders that description with native performance. The engine controls layout, bindings, and behavior; the client controls pixels.

This single choice is what makes responsiveness, the live designer, and the plugin-driven widget vocabulary all possible at once.

#### 2.3 The four layers

```
┌─────────────────────────────────────────────────────────────┐
│ PRESENTATION LAYER  — Client devices (Flutter)                │
│   Widget renderer registry · layout document interpreter      │
│   Gesture capture · connection manager · pairing UI           │
│   Designer (desktop only): canvas, op emitter, inspector      │
└───────────────────────────┬───────────────────────────────────┘
                            │  Transport (Section 5)
┌───────────────────────────┴───────────────────────────────────┐
│ TRANSPORT LAYER  — secure session channel                      │
│   Device registry · session manager · auth/crypto              │
│   Layout channel · State channel · Preview channel             │
│   Endpoint abstraction (LAN now → relay later, Section 10)     │
└───────────────────────────┬───────────────────────────────────┘
                            │
┌───────────────────────────┴───────────────────────────────────┐
│ ENGINE CORE  — host background service (Go, Section 9)         │
│   ONLY: Transport · State store · Flow engine · Security ·     │
│         Persistence · Registries (action/widget/flow-node)     │
│   + Plugin host (process supervision · IPC · permissions)      │
│   The core contains NO capability-specific business logic.     │
└───────────────────────────┬───────────────────────────────────┘
                            │  Plugin host IPC  +  PAL interfaces
┌───────────────────────────┴───────────────────────────────────┐
│ CAPABILITY LAYER  — ALL out-of-process plugins                 │
│   First-party AND third-party, identical contract:             │
│   Telemetry · Media · Power · Launchers · Smart Home ·         │
│   Notifications · FPS · (any community plugin)                 │
│   Each implements PAL capability interfaces with               │
│   per-capability ordered provider chains.                      │
│   "First-party" is metadata, not a different architecture.     │
└────────────────────────────────────────────────────────────────┘
```

**The engine core is deliberately small.** Per ADR-0006, the core contains *only*: transport, state store, flow engine, security, persistence, and the registries — plus the **plugin host** that supervises everything else. Every capability — telemetry, media, power, launchers, smart home, notifications, FPS — is an **out-of-process plugin**, and **first-party plugins use the exact same contract, lifecycle, IPC, permission model, and isolation boundary as third-party plugins.** Whether a plugin ships from CyberDeck or a community author is *metadata*, never a different execution model. (Rationale and the rejected in-process-first-party alternative: ADR-0006.)

The **Platform Abstraction Layer (PAL)** defines the *capability interfaces and provider-priority*; the **plugin host** defines *execution and isolation*. They compose: a capability provider (e.g. the PresentMon FPS provider) is both a PAL provider-chain entry and code running inside a plugin process. The engine core never contains an `if windows` branch; it calls a capability interface and the bound provider — inside its plugin — answers. (PAL↔plugin-host relationship pinned in ADR-0007.)

**Each capability is backed by an *ordered provider chain*, not a single implementation.** A capability declares a priority-ordered list of providers; the host probes them at startup (and may re-probe on change), binds the highest-available one, and exposes one interface upward. If **no** provider binds, the capability reports **unavailable** — never an error, never a crash; the bound state renders `--` and flows can branch on availability. This is the same graceful-degradation contract as a disconnected device, applied to the capability layer. (Worked example — the FPS chain: native-app-telemetry → PresentMon → FrameView → RTSS → vendor APIs → unavailable; detailed in TRD-2G.) Multi-provider-with-fallback is therefore a *foundation* property, not a per-feature detail.

---

### 3. The core domain model

This is the heart of the document. These structures are shared vocabulary across engine, transport, and clients, and they are the contract that the PRD/TRD elaborate and that plugins extend.

#### 3.1 The document tree

```
Account / Engine Identity
└─ Profile[]          a named, optionally context-activated set of pages
    └─ Page[]         one renderable screen, bound to a grid
        ├─ GridConfig
        └─ Widget[]
            ├─ placement   (col, row, colSpan, rowSpan)
            ├─ appearance  (style + optional state binding)
            ├─ interaction (gesture → action-target map)
            └─ config      (widget-type-specific properties)
```

**Profile** — a collection of pages plus an optional **activation rule** (e.g. "active when process `Cyberpunk2077.exe` is focused"). One profile is active per device at a time. The activation-rule field exists in V1 (the engine evaluates it); the *automatic* app-focus switching that consumes it is a near-term feature, but the field and the evaluation hook are foundation (Section 12).

**Page** — one screen. Belongs to exactly one grid configuration.

**GridConfig** — `{ columns, rows, gutter, marginX, marginY, cellAspect: square|fill, background: {color|image|gradient}, deviceClass }`. There is **no cap** on columns/rows (a deliberate rejection of Touch Portal's 15×15/110-button limit).

**Widget** — the atomic unit. See 3.2.

**DeviceClass** — `{ id, label, gridDefaults, orientation: portrait|landscape, referenceResolution }`. A layout is authored against a device class; devices are assigned a class at pairing time.

#### 3.2 The widget model

A widget separates **three independent concerns**, and this separation is the source of the product's flexibility:

```jsonc
{
  "id": "w_8f3a",
  "type": "gauge.circular",          // resolved against the Widget Type Registry (3.5)
  "placement": { "col": 3, "row": 4, "colSpan": 2, "rowSpan": 2 },

  // (a) APPEARANCE — what it looks like; may be driven by state
  "appearance": {
    "style": { "theme": "neon-cyan", "label": "CPU", "showValue": true },
    "stateBinding": "system.cpu.temp",        // value source (3.3)
    "valueRules": [                            // optional state→visual rules
      { "when": ">85", "style": { "theme": "status-error", "icon": "alert" } }
    ]
  },

  // (b) INTERACTION — each gesture maps independently
  "interaction": {
    "tap":        { "target": "action", "ref": "media.play" },
    "doubleTap":  { "target": "action", "ref": "media.next" },
    "longPress":  { "target": "flow",   "ref": "flow_morning" },
    "pressDown":  null,
    "pressUp":    null,
    "dragValue":  { "target": "action", "ref": "media.volume.set", "param": "level" },
    "swipeLeft":  { "target": "navigate", "ref": "page_2" }
  },

  // (c) CONFIG — widget-type-specific
  "config": { "min": 0, "max": 100, "unit": "°C", "sparkline": true }
}
```

- **(a) Appearance binding** — the widget may bind to a state ID; its rendered value/visual follows that state. `valueRules` allow conditional styling (the gauge turns red over 85°C) evaluated client-side for zero-latency feedback.
- **(b) Interaction map** — every gesture is an independent slot. Slots: `tap, doubleTap, longPress, pressDown, pressUp, dragValue, swipeLeft/Right/Up/Down`. This exceeds Stream Deck's three-action "Key Logic" and is defined in full in V1 even where the designer UI for some slots arrives later. Each slot's **target** is one of: `action` (single), `macro`/`flow` (Section 6), `navigate` (page/profile switch), or `none`.
- **(c) Config** — free-form, validated against the widget type's schema (3.5).

#### 3.3 The state model

A **state** is a named, typed, live value the engine publishes and clients subscribe to.

```jsonc
{
  "id": "system.cpu.temp",
  "kind": "scalar",                  // scalar | text | boolean | enum | series
  "valueType": "number",
  "unit": "°C",
  "value": 42.0,
  "updatedAt": 1719000000,
  "source": "plugin:core.telemetry"
}
```

- States are **namespaced**: `category.subcategory.field`, carried over from the prior design (`system.cpu.temp`, `media.track`, `home.light.living`).
- States are **typed** (this corrects a flaw in the prior design where everything was a formatted string). Formatting for display is a *presentation* concern carried in the widget/style, not baked into the value — so a gauge can use the raw number while a label shows "42.0 °C".
- A `series` state carries a ring buffer (e.g. 60 samples) for sparklines/charts.
- States are published by **state providers** (built-in services or plugins). The provider declares the state's descriptor; the engine owns the registry.

**Delta broadcasting**: only changed states are pushed, on the State channel (Section 5). Carried over from the prior design's ~80% idle-traffic reduction.

#### 3.4 The action registry

An **action** is a parameterized operation the engine can execute.

```jsonc
{
  "id": "media.volume.set",
  "label": "Set System Volume",
  "category": "media",
  "source": "plugin:core.media",
  "params": [
    { "name": "level", "type": "int", "min": 0, "max": 100, "required": true }
  ],
  "confirmation": false,             // 2-tap gating for destructive actions
  "returns": "void"
}
```

This is **the keystone contract.** The action registry is **schema-driven and populated by plugins** (built-in services register the same way third-party plugins do). The designer reads these schemas and **auto-generates the parameter editor**: an `int 0–100` becomes a slider, a `choice` becomes a dropdown, an `entity` type becomes a smart-home entity picker. A new plugin's actions therefore appear in the designer with full editing UI and **zero designer code changes**. This is why "plugin ecosystem" and "drag-and-drop designer" are one system, not two.

Param types (V1 set, extensible): `int, float, string, bool, choice, color, entity, file, folder, duration`.

#### 3.5 The widget type registry

Symmetric to the action registry: each widget type declares its schema.

```jsonc
{
  "type": "gauge.circular",
  "label": "Circular Gauge",
  "source": "builtin",
  "acceptsStateKinds": ["scalar"],
  "configSchema": [
    { "name": "min", "type": "float", "default": 0 },
    { "name": "max", "type": "float", "default": 100 },
    { "name": "unit", "type": "string", "default": "" },
    { "name": "sparkline", "type": "bool", "default": false }
  ],
  "gestures": ["tap", "longPress"]   // which interaction slots this type exposes
}
```

The client's **widget renderer registry** maps `type → native builder`. V1 ships a core widget vocabulary (button, toggle, slider, label, image, circular gauge, linear gauge/bar, sparkline, media card, page-nav). Plugins may register **custom widget types** in a later phase; the registry contract is foundation so that later addition requires no core change (Section 12).

#### 3.6 Variables (engine-scoped values)

Beyond OS-sourced states, the engine maintains **user variables** — named values the flow engine reads/writes (counters, toggles, last-used scene, etc.). Touch Portal calls these "Values." They are typed, persisted, namespaced under `var.*`, and are first-class state sources (a widget can bind to `var.mic_muted`). They exist in V1 because the flow engine (Section 6) is V1.

---

### 4. Device identity, discovery, pairing & security

This is built **fully** in V1 — security is not a later hardening pass, because identity and crypto cannot be retrofitted without breaking every paired device.

#### 4.1 Identity (not IP, not MAC)

The hard rule, established during design: **bind the trust relationship, not the network address.** Modern iOS/Android randomize MAC per network and DHCP rotates IPs, so both are unreliable as identity.

- On first launch, **each device and the engine generate a long-lived keypair** (Ed25519) and a stable **UUID**.
- Pairing establishes **mutual trust**: each side stores the other's public key + UUID + human label + device class.
- IP/MAC are stored only as **locator hints** to find a known device; they are never identity.
- **Identity is account-independent.** The keypair/UUID exists from first launch whether or not an account is ever created. An account (a later, optional overlay for cloud features) *references* device identities for sync/backup — it never *owns* or *gates* them. This is the architectural guarantee behind "install, run, use forever, no account" (Section 11.0 licensing): if identity required an account, the local-first promise would break and licensing would contaminate the identity layer.

#### 4.2 Discovery

| Mechanism | Use | Notes |
|-----------|-----|-------|
| **mDNS / DNS-SD** | Zero-config discovery on LAN | Engine advertises `_cyberdeck._tcp.local` with TXT records `{name, uuid, version, fingerprint}`. Primary happy path. |
| **QR pairing** | Fast trusted pairing | Engine displays QR encoding `{candidate addresses, port, short-lived pairing token, engine public-key fingerprint}`. Client scans → connects → key exchange. |
| **Manual entry** | Fallback when multicast blocked | User types IP/hostname; a PIN shown on the engine confirms (Plex/Spotify-Connect model). |
| **Active scan** | Last-resort relocate | If a known device's last-known IP fails and mDNS is silent, an optional bounded subnet scan locates it by attempting handshake (UUID confirms identity). |

mDNS **must** have fallbacks because enterprise networks frequently block multicast or isolate clients across VLANs — a known failure mode of the incumbents.

#### 4.3 Pairing handshake

```
1. Discover (mDNS) OR scan QR OR manual+PIN
2. Client → Engine: connect, present client public key + UUID + pairing token
3. Engine: validate token (short-lived, single-use), challenge-response over keypairs
4. Both sides verify the other's public-key fingerprint (blocks MITM)
5. Engine creates a Device record (4.4); both persist the trust
6. Session established (Section 5)
```

#### 4.4 Device record & permissions

```jsonc
{
  "uuid": "a3f2-…",
  "label": "Living Room iPad",
  "publicKey": "…",
  "deviceClass": "tablet-landscape-10",
  "assignedProfile": "profile_home",
  "permissions": {
    "allowPowerActions": false,        // this tablet may NOT shut the PC down
    "allowedCategories": ["media","home","notifications"]
  },
  "locatorHints": { "lastIp": "192.168.1.40", "hostname": "ipad.local" },
  "revoked": false,
  "lastSeen": 1719000000
}
```

**Per-device permissions** and **revocation** are V1: a tablet can be denied destructive actions, and any device can be revoked instantly (its key is rejected on next handshake). An **action audit log** records which device triggered which action — foundation for enterprise governance.

#### 4.5 Crypto posture

- **All session traffic is encrypted and authenticated**, even on LAN. (Transport security TLS-style channel over the established keys; exact primitive specified in the TRD.)
- This is deliberately **built for remote from day one** even though traffic stays local: when the relay seam (Section 10) activates, identity, pairing, and encryption are unchanged — only the endpoint moves. Retrofitting E2E security onto an unencrypted LAN protocol later would be a rewrite.

#### 4.6 "No confusion which device"

Every session is keyed by device UUID. The engine runs **independent sessions per device**, each with its own active profile, its own subscriptions, and its own permission set. Two tablets can show different profiles simultaneously with full isolation. The designer always names its target explicitly (Section 7.5).

---

### 5. Transport & real-time sync

#### 5.1 Endpoint abstraction (the forward-compat seam)

All addressing goes through one abstraction: a **TransportEndpoint** resolved by a **ConnectionManager**. In V1 every endpoint resolves to a direct LAN socket. The remote phase (Section 10) adds a relay-backed endpoint type. **No engine or client code above the ConnectionManager knows or cares** which kind it is. This is the single most important forward-compatibility decision in the document.

#### 5.2 Three logical channels

Sharing one secure session, but with different semantics:

| Channel | Direction | Payload | Cadence | Durability |
|---------|-----------|---------|---------|------------|
| **Layout** | Engine → Client | Structural layout operations (Section 5.4); client → engine action/interaction events | On edit / on tap | Durable, versioned |
| **State** | Engine → Client | Delta state updates (changed states only) | 0.5s–10s per state | Ephemeral |
| **Preview** | Designer → Engine → Client | Throttled ephemeral edit previews (live drag ghosting) | ~30–60 Hz, throttled | Never persisted |

Keeping these separate means a CPU value updating every second never touches the layout tree, and a live-drag preview never pollutes durable edit history.

#### 5.3 Connection resilience (a direct answer to the #1 incumbent pain)

The single most common real-world complaint about Touch Portal / Stream Deck mobile is flaky LAN connections. V1 transport bakes in:

- **Heartbeat/keepalive** with a defined interval; the engine keeps sessions warm (no OS-sleep-induced drops).
- **Auto-reconnect with exponential backoff**, then mDNS re-discovery, then active scan.
- **Graceful degradation**: on disconnect, bound widgets render their last value dimmed with a `--` fallback and a clear per-device connection badge (connected / degraded / disconnected). No frozen or lying UI.
- **Versioned resync** (5.4): a client that missed messages requests a full document resync rather than replaying gaps.

#### 5.4 The operation-log sync model (the live-designer engine)

Every layout edit is an **operation** applied to the authoritative document, versioned monotonically, and broadcast to subscribed device sessions.

Operation set (V1): `AddWidget, RemoveWidget, MoveWidget, ResizeWidget, SetStyle, SetBinding, SetInteraction, SetConfig, AddPage, RemovePage, ChangeGrid, AddProfile, SetProfileActivation`.

```jsonc
{
  "op": "MoveWidget",
  "docVersion": 412,                 // monotonic; client tracks last-applied
  "pageId": "page_2",
  "widgetId": "w_8f3a",
  "from": { "col": 3, "row": 4 },
  "to":   { "col": 5, "row": 4 }
}
```

This one model delivers four things from a single mechanism:

1. **Instant client reflection** — ops broadcast on commit; client applies the op and **repaints only the affected widget** (diffed, not full redraw).
2. **Undo/redo** — every op has an inverse; undo applies the inverse, redo reapplies.
3. **Multi-device sync** — the same op stream fans out to every subscribed session.
4. **Future collaborative editing** (Section 12) — the op log is already the substrate; V1 uses a simple single-writer edit lock to avoid CRDT/OT complexity, and the later collaboration phase layers conflict resolution on the *same* log.

**Live drag**: while dragging on the desktop canvas, the designer emits throttled ephemeral ghost positions on the **Preview** channel (never persisted); on drop it commits one durable `MoveWidget` op on the **Layout** channel. Premium live feel, clean history.

**Resync**: each document has a version; each client tracks last-applied. On a gap, the client requests the full document at the current version. The engine is the single source of truth, so this is always unambiguous.

#### 5.5 Runtime vs edit mode

A device session is in one of two modes:

- **Runtime mode** — receives State updates only; renders the assigned layout for use.
- **Edit/preview mode** — additionally receives live Layout ops and Preview ghosts, so you can watch a tablet update as you design on the PC.

A device flips between modes on demand (e.g. when you start editing the profile it's showing).

---

### 6. The conditional flow / macro engine

Per decision, CyberDeck ships a **full** conditional flow/macro engine — matching and exceeding Touch Portal's Flows. It is a **V1 foundation system** (the data model, executor, and core node set), with the visual flow *builder UI* and richer node types layered over the same model in later passes.

#### 6.1 What a flow is

A **flow** is a directed graph of **nodes** executed by the engine when triggered. A **macro** is the degenerate case: a linear flow of action nodes. Flows are stored as part of the document set, versioned like layouts, and referenced by widget interaction slots, events, or schedules.

```jsonc
{
  "id": "flow_morning",
  "label": "Good Morning",
  "trigger": { "kind": "manual" },           // manual | event | schedule | stateChange
  "nodes": [
    { "id": "n1", "kind": "action", "ref": "home.scene.activate", "params": {"scene_id":"morning"}, "next": "n2" },
    { "id": "n2", "kind": "if", "cond": "{var.coffee_enabled} == true", "then": "n3", "else": "n4" },
    { "id": "n3", "kind": "action", "ref": "home.device.toggle", "params": {"entity_id":"switch.coffee"}, "next": "n4" },
    { "id": "n4", "kind": "wait", "ms": 2000, "next": "n5" },
    { "id": "n5", "kind": "setVar", "var": "var.last_scene", "value": "morning", "next": null }
  ]
}
```

#### 6.2 Node types (V1 core set)

| Node | Purpose |
|------|---------|
| `action` | Execute a registered action with params |
| `if` / `else` / `endif` | Conditional branching on a boolean expression |
| `setVar` | Write a user variable |
| `wait` | Delay (fixed or expression) |
| `loop` / `endloop` | Repeat (count or while-condition) |
| `navigate` | Switch page/profile on the triggering device |
| `random` | Pick one of N branches (Stream Deck "Random Action" parity) |
| `subflow` | Call another flow (composition) |
| `stop` | Terminate the flow |

Later phases extend the node palette (HTTP request node, plugin-provided nodes, parallel/fork) — all on the **same executor and graph model**, registered the same way actions are (Section 12).

#### 6.3 The expression language

Conditions and dynamic values use a small, sandboxed expression language:

- **Token interpolation**: `{state.id}`, `{var.name}` resolve to current values.
- **Operators**: comparison (`== != > < >= <=`), boolean (`&& || !`), arithmetic (`+ - * / %`), string concat.
- **No arbitrary code execution** — the language is deliberately not Turing-complete-via-eval; it's parsed to an AST and evaluated by the engine. This is a security boundary (a flow is shared content; it must not be able to run shell code except via explicitly-registered, permission-gated actions).

#### 6.4 Triggers

Flows fire from: **manual** (a widget gesture), **event** (an engine event such as `cpu.high_temp`), **stateChange** (a watched state crossing a condition), or **schedule** (time/cron — a near-term trigger type, with the trigger field defined in V1). This makes the event architecture from the prior design (Section 8 of the old TRD) a *consumer* of the flow engine.

#### 6.5 Execution semantics

- Flows execute on the engine (host authority), not the client. The client only *triggers*.
- Each flow run is an isolated context with its own local scope; global `var.*` persists.
- Long-running flows (waits, loops) run as supervised async tasks; a flow can be cancelled.
- Failures are logged with the node id; a flow can declare per-node failure behavior (continue / stop / branch).

#### 6.6 Local vs global scope

Mirroring (and improving on) Touch Portal's local-states concept: a flow run has a **local scope** for transient values, and the engine has **global `var.*`**. This avoids the "create a global Value for every temporary calculation" clutter that the incumbents force.

---

### 7. The layout designer

Desktop-only authoring tool. It is a **reader of the registries** (3.4, 3.5) and an **emitter of operations** (5.4).

#### 7.1 Canvas

A WYSIWYG grid canvas rendering the page exactly as the target device class will. Snap-to-grid placement; widgets occupy `(col,row,colSpan,rowSpan)`; **no overlap in V1** (collisions rejected or pushed) to avoid z-index complexity.

#### 7.2 Drag-drop & mapping (the deep model)

- **Place**: drag a widget type from the palette onto a cell → emits `AddWidget`.
- **Move/Resize**: drag/handle → throttled `Preview` ghosts → `MoveWidget`/`ResizeWidget` on drop.
- **Bind appearance**: the inspector lists available states (filtered by the widget type's `acceptsStateKinds`); selecting one emits `SetBinding`.
- **Map interactions**: for each gesture slot the widget type exposes, pick a target (action / macro / flow / navigate). Choosing an action reveals an **auto-generated parameter editor** built from the action's param schema (3.4). → `SetInteraction`.
- **Style**: theme tokens, label, icon, conditional `valueRules`. → `SetStyle`.

Because the param editor is generated from schema, **every action — built-in or third-party plugin — is fully editable in the designer with no bespoke UI.**

#### 7.3 Grid configuration

Fully customizable per page: columns, rows, gutter, margins, cell aspect, background. No button/row/column caps.

#### 7.4 Live reflection

Any bound device in edit/preview mode shows edits instantly (5.4/5.5). The headline demo: drag a gauge on the PC, watch it appear on the tablet in real time.

#### 7.5 Explicit device targeting

The designer always shows its target: *"Editing: Living Room iPad · UUID a3f… · 10×6 landscape."* Ops route only to that device's assigned layout/sessions.

---

### 8. Plugin architecture

#### 8.1 What a plugin provides

A plugin is an out-of-process extension that may register any of: **state providers** (3.3), **actions** (3.4), **events**, **flow nodes** (6.2), and **widget types** (3.5). Built-in capabilities (telemetry, media, etc.) are implemented as **first-party plugins using the same contracts** — dogfooding the SDK guarantees it's real.

#### 8.1 What a plugin provides

A plugin is an **out-of-process** extension that may register any of: **state providers** (3.3), **actions** (3.4), **events**, **flow nodes** (6.2), and **widget types** (3.5), and may implement **PAL capability interfaces** (provider-chain entries). **All capabilities outside the engine core are plugins**, first-party and third-party alike — telemetry, media, power, launchers, smart home, notifications, FPS. Implementing the first-party set on the same contract is not just dogfooding; per ADR-0006 it is the *only* execution model, so there is no second runtime to maintain.

#### 8.2 Registration contract (foundation in V1)

The **registration contracts are defined and used in V1** by the first-party plugins. A plugin declares its registry contributions in a manifest; the host validates and merges them into the global registries. The designer surfaces them automatically. The **public SDK and third-party *loading*** are a later phase, but the contract they target is the one already in production use by first-party plugins on day one.

#### 8.3 Isolation & security (one model, no exceptions)

**Every plugin runs out-of-process** — first-party included (ADR-0006). A misbehaving plugin can never take down the engine (directly addressing the incumbents' fragility). Plugins communicate with the host over a single local IPC contract, declare required **permissions** (capabilities + action categories), and the host enforces them uniformly. "First-party" vs "third-party" is **trust metadata** (affects signing/UX/permission defaults), **never a different lifecycle, IPC path, or isolation boundary.** Third-party **sandboxing and signing** harden this model in the SDK phase but do not introduce a separate one.

#### 8.4 Why this unifies designer + ecosystem

The designer never hard-codes knowledge of any capability. It renders whatever the registries contain. Therefore the same machinery that lets the team add a new built-in action lets a third party ship one — and it shows up in the designer identically. The plugin ecosystem and the designer are **one schema-driven system viewed from two ends.**

---

### 9. Technology stack & rationale

| Layer | Choice | Rationale |
|-------|--------|-----------|
| **Client + Desktop UI + Designer** | **Flutter** (locked) | One codebase, all six targets (Android, iOS, Win, macOS, Linux). Its own rendering engine (Skia/Impeller) is ideal for the gauge/sparkline/waveform neon UI and the 60fps designer canvas — RN/Expo bridges to native views and leans on JS for animation, which is the wrong fit for high-frequency custom drawing. Flutter builds native installers for every desktop target *and* native mobile packages, so one framework covers all six surfaces. **Electron and Expo were both rejected** (see 9.3). |
| **Engine** | **Go** (locked) | Compiled native binary per OS, low footprint, strong concurrency/networking, clean long-running-daemon profile. Goroutines fit the per-service polling and per-session fan-out model directly. Cross-compiles to native Windows/macOS/Linux binaries trivially, satisfying the native-installer requirement without favoring Rust. (Rust + Tauri was the alternative but reintroduces a webview renderer and a second client toolkit — rejected for the same reason as Electron.) |
| **Transport** | Secure socket over the endpoint abstraction (5.1) | Direct LAN now; relay-ready. Exact wire protocol (length-prefixed framed messages, serialization format) specified in the TRD. |
| **Local UI↔Engine IPC** | Same secure protocol over loopback **+ a privileged local control channel** (see 9.2) | The desktop UI is "another client that also has the designer," reusing the entire data/designer protocol over loopback; a small separate privileged channel handles service lifecycle and pairing approval that a remote phone must never access. |
| **Serialization** | JSON (V1) with a path to a compact binary format | JSON for debuggability during V1; the framing abstraction allows swapping to a compact binary codec for the high-frequency State channel later without touching call sites. |
| **Serialization** | **JSON (locked for V1)** behind a channel-level `Serializer` abstraction | JSON for full debuggability and universal tooling. The abstraction (`Serializer → {Json, Binary}`) lets a future compact codec (MessagePack/CBOR/Protobuf) apply to **only the high-frequency State channel** without touching Layout/control traffic. Binary is deferred until traffic/latency profiling proves it's needed (9.5). |
| **PAL** | Per-capability **ordered provider chains** behind one Go interface | Each capability (telemetry, media, power, audio, FPS) declares priority-ordered providers; engine binds the highest available and degrades to "unavailable" if none — no single external dependency can block the system. |
| **Persistence** | **SQLite (locked)** as the single durable store; **live state in-memory** | SQLite for everything authored or audited (documents, registry, variables, audit log, workflows, devices, accounts) — indexing, transactions, history queries. High-frequency telemetry and sparkline ring buffers stay in-memory and never hit the disk hot path (9.4). Single embedded file; no server. |

A compiled Go engine as a single binary removes the old design's Python-dependency and PyInstaller friction entirely.

#### 9.1 Deployment & process model (two processes, one installer)

The single most important clarification: **the engine and the desktop UI are separate processes with separate lifecycles, shipped in one installer.** This is what reconciles "I need a desktop UI to design in" with "it must keep running when I close the app."

```
   One installer (.exe / .msi · .dmg / .pkg · .deb / .rpm / .AppImage)
   ├─ installs ─►  CyberDeck Engine   (Go native binary)
   │                 • registered as an OS background service / agent
   │                 • starts on boot, runs headless, survives UI close
   │                 • holds ALL state, sessions, layouts; runs flows
   │                 • THIS is "the app running in the background"
   │
   └─ installs ─►  CyberDeck Desktop  (Flutter app)
                     • the Designer (drag-drop authoring) + control view
                     • a CLIENT of the engine over loopback
                     • closing its window does NOT stop the engine
                     • a system-tray presence shows engine status,
                       reopens the UI, and can pause/quit the engine
```

- **"Where do I drag and drop?"** → the **Desktop UI** (the Flutter Designer). It connects to the local engine and emits layout operations (5.4); your edits are persisted by the engine and pushed live to bound devices.
- **"Works in the background when I close the app?"** → yes — closing the Desktop UI closes only a *client window*. The **engine service** keeps polling telemetry, holding device sessions, and running flows. Reopen the Desktop UI and it reconnects to the already-running engine and shows your live setup. (Same model as Docker Desktop, or how Stream Deck/Touch Portal hosts live in the tray/as a service.)
- **"Starts on startup?"** → the installer registers the **engine** as a startup service; the tray UI auto-launch is an optional user setting.

Per-OS background-service registration:

| OS | Engine runs as | Native installer |
|----|----------------|------------------|
| Windows | Windows Service (or startup-registered tray process) | `.exe` / `.msi` (Inno Setup / WiX / MSIX) |
| macOS | `launchd` LaunchAgent/LaunchDaemon | `.dmg` / `.pkg` (codesigned + notarized) |
| Linux | `systemd` user service | `.deb` / `.rpm` / `.AppImage` (`flutter_distributor` + native packaging) |
| Android | n/a (client only) | `.apk` / `.aab` |
| iOS/iPadOS | n/a (client only) | `.ipa` |

#### 9.2 The local UI↔engine channel split

Because the Desktop UI sits on the same machine as the engine, it has two kinds of traffic:

1. **Data & designer traffic** — state subscriptions, layout ops, action triggers. Rides the **same secure protocol over loopback** that phones use. The Desktop UI is, for this traffic, just a privileged client that also happens to own the Designer. Uniform, reuses everything in Sections 3–6.
2. **Privileged local control** — start/stop/restart the engine service, change service-level config, **approve or reject device pairing requests**, view the audit log. This rides a **separate privileged local-only control channel** that only a same-machine UI may use.

The security consequence is deliberate: a remote phone can issue media/home/flow actions (subject to its permissions) but can **never** issue "stop the engine" or "approve this new device" — those are gated to the local privileged channel. This keeps the host-authority model honest.

#### 9.3 Why Electron and Expo were rejected

| Tool | What it does well | Why rejected here |
|------|-------------------|-------------------|
| **Electron** (proposed for desktop) | Builds `.exe`/`.deb`/`.dmg` from web tech | A Chromium instance per window — heavy idle RAM/CPU for a 24/7 host, against the <150MB / <2% NFR. The systems work (mDNS, raw sockets, OS telemetry, plugin supervision) is Node's weak spot. Worst of all it would **split the client codebase** (Electron desktop + something-else mobile = two renderers, two widget toolkits, two layout interpreters), defeating the hybrid model. |
| **Expo / React Native** (proposed for mobile) | Native iOS/Android builds + OTA | Adopting it makes the client **React Native, not Flutter** — re-opening a locked decision. RN bridges to native views and animates via JS, the wrong engine for custom high-frequency gauge/sparkline/canvas drawing. Covers only 2 of 6 client targets; Flutter covers all 6 and builds the same native packages directly. |

**Net:** Flutter-everywhere + Go-engine gives every native installer you asked for (`.exe`, `.deb`, `.dmg`, `.apk`, `.ipa`) with **one** client renderer and a lean 24/7 background service — strictly better than Electron-desktop + Expo-mobile, which would give two renderers, two toolkits, and a heavier footprint.

#### 9.4 Persistence model

**SQLite is the single durable store.** No KV/SQL split — a split is only justified once a scale requirement proves it, and this product has none. The deciding factor is the audit log and the queries that *inevitably* arrive ("show all variables modified by workflow X in the last 7 days where source = device"); those are trivial in SQL and miserable on a hand-rolled KV index.

**The one hard rule — durable vs ephemeral:**

| Data | Store | Rationale |
|------|-------|-----------|
| Documents (profiles/pages/widgets) | SQLite | indexing, metadata, "find widgets bound to state X" |
| Registry items (actions/widget-types/flow-nodes) | SQLite | relationships, versioning |
| Variables (`var.*`) | SQLite | transactions, consistency, history |
| Audit log | SQLite | querying/filter/replay/diff/export is the whole point |
| Workflows (flows) | SQLite | versioned like documents |
| Devices, Accounts | SQLite | trust records, optional account overlay |
| **Live state** (`system.cpu.temp`, sparkline ring buffers) | **In-memory only** | telemetry ticks must never write to disk on the hot path — a per-tick disk write would blow the <2% idle-CPU NFR |

Live state crosses into SQLite **only** when it becomes durable: a flow writing a `var.*`, or an event the audit log records. Telemetry itself is never persisted (the prior design's in-memory ring buffers carry over unchanged).

Schema direction (detailed in the TRD): `documents`, `registry_items`, `variables`, `audit_log`, `workflows`, `devices`, `accounts`. The audit log is **append-only**, with a flexible `payload_json` column so event types can evolve without migrations:

```
audit_log
---------
id · timestamp · actor (device uuid / local-ui / system)
event_type · resource_type · resource_id · payload_json
```

#### 9.5 Serialization

**JSON throughout V1.** No binary codec is built yet — building one now creates an observability problem (a failed automation should be inspectable as `{"workflow":"lights","step":5,"state":"failed"}` in a log, not `0x3A 0x9F …`) for a bandwidth saving the product won't notice on a LAN. The `Serializer` abstraction is in place from day one so a future codec slots in **per channel** — and realistically only the high-frequency State channel would ever warrant it; Layout ops and control messages stay JSON permanently.

---

### 10. LAN-now / remote-later seam

The explicit forward-compatibility contract, so the remote phase is an *addition*, never a *rewrite*.

| Concern | V1 (LAN) | Remote phase | What stays identical |
|---------|----------|--------------|----------------------|
| **Identity** | Keypair + UUID | Keypair + UUID | **Unchanged** — same trust model |
| **Encryption** | E2E over session keys | E2E over session keys | **Unchanged** — built for remote from day one (4.5) |
| **Addressing** | Direct LAN socket via `TransportEndpoint` | Relay-backed `TransportEndpoint` | The `ConnectionManager` abstraction (5.1) — nothing above it changes |
| **Discovery** | mDNS / QR / manual | + rendezvous/relay registry | Local discovery still works; remote adds a lookup path |
| **Sessions** | Per-device, isolated | Per-device, isolated | **Unchanged** — session model is transport-agnostic |
| **New infra** | None | Relay/rendezvous server, NAT traversal | Additive cloud component, isolated behind the endpoint seam |

The rule: **everything that touches trust, crypto, sessions, and the document/state model is final in V1; only the endpoint resolution gains a new implementation.**

---

### 11. Phase map & roadmap

V1 is the **foundation release**: it must contain not just usable features but the *seams* (registries, op-log, endpoint abstraction, flow executor, security model) that every later phase plugs into. The principle, per your direction: **the foundation is built in V1; features evolve on top of it.**

#### 11.0 Licensing principles (architectural, not commercial)

Stated here because the wrong licensing model contaminates the identity layer (Section 4.1). The governing rule: **identity ≠ licensing.**

- **Free = local-only, no account.** Install, pair devices over LAN, design layouts, run flows — forever, with no account and no activation. This is the default and it minimizes friction.
- **Account = optional overlay for cloud services only** (sync, backup, remote access, team sharing). Users readily pay for *services*; they resent paying because they own three devices.
- **Licensing attaches to the account, not to devices.** A paid user uses multiple personal devices freely.
- **Device-count restrictions and platform-locked purchases are explicit non-goals** — both are documented pain points of the incumbents and both force a licensing-first architecture.

The PRD will state this verbatim as a product principle. The only V1 architectural obligation is the one already met in 4.1: identity must not depend on an account existing.

#### Phase 1 — Foundation (V1)
**Goal:** A secure, multi-device, single-engine control surface with live telemetry widgets, the core action set, a working desktop designer with live reflection, and the flow engine core.

- Engine core (deliberately small, per ADR-0006): transport, typed state store, flow engine, security, persistence, registries (action/widget/flow-node), event bus, profile/session model — **and the plugin host**. No capability-specific business logic in the core.
- **Capability plugins (out-of-process, ADR-0006)**: first-party telemetry/power/media/launcher capabilities ship as plugins using the **same contract, lifecycle, IPC, permissions, and isolation as third-party plugins**; the out-of-process plugin host exists in V1 because first-party capabilities run through it. PAL capability interfaces + provider chains (ADR-0007).
- **Deployment & lifecycle (9.1)**: engine packaged as a per-OS **background service** that starts on boot and survives Desktop-UI close; system-tray presence; native installers for Windows/macOS/Linux that drop both engine service and Desktop UI; local UI↔engine loopback protocol + privileged local control channel (9.2).
- **Security in full**: keypair identity, mDNS + QR + manual pairing, per-device permissions, revocation, audit log, E2E-encrypted sessions.
- **Transport in full**: endpoint abstraction, three channels, heartbeat, auto-reconnect, graceful degradation, versioned resync.
- **Designer (desktop)**: canvas, drag-drop, schema-driven inspector, op-log sync, live device reflection, per-device-class authoring, undo/redo.
- **Flow engine core**: data model, executor, V1 node set, expression language, manual + event + stateChange triggers.
- **Widget vocabulary (core)**: button, toggle, slider, label, image, circular gauge, linear gauge/bar, sparkline, media card, page-nav.
- **Full multi-gesture interaction model** (all slots defined; designer UI for the core slots).
- **First-party capability set**: live CPU/GPU/RAM/storage/network telemetry; system power actions (with 2-tap gating); volume; app launchers; basic notification count.

#### Phase 2 — Media & richer interaction
Full media pipeline (album art, progress, multi-channel mixer), richer media widgets, expanded gesture-slot designer UI, app-focus **automatic profile switching** (consuming the activation rule built in V1).

#### Phase 3 — Gaming & automation depth
FPS display, game profiles, RAM cleaner, network boost; **visual flow builder UI** over the V1 flow model; **schedule triggers**; richer flow nodes.

#### Phase 4 — Smart home
Home Assistant integration (REST + event bus), room/device/scene widgets, environment sensors, energy monitor — all as a first-party plugin proving the plugin contracts.

#### Phase 5 — Notifications & cameras
Full notification aggregation pipeline (Discord/Windows/Streamlabs), filter/dismiss, priority; camera preview widgets.

#### Phase 6 — Plugin SDK & ecosystem
Public SDK, third-party plugin loading, sandboxing/signing, plugin-provided **widget types** and **flow nodes**, a distribution/marketplace path. (Built on the V1 registry contracts.)

#### Phase 7 — Remote access
Relay/rendezvous infrastructure, NAT traversal, remote endpoint type — slotted behind the V1 endpoint abstraction (Section 10).

#### Phase 8+ — Advanced (candidates)
Collaborative multi-author editing (on the V1 op-log), responsive/adaptive layouts across device classes, AI-assisted contextual actions, cross-engine binding (one device → multiple engines).

> Durations and dependencies are deferred to the PRD/TRD and per-phase deep dives; this is the ordering and the layering, not the schedule.

---

### 12. Extension-seam index (the "future attaches here" contract)

This is the table that makes the document a *foundation*: every future feature names the **V1 seam** it depends on, and V1 is obligated to build that seam even when the feature is later.

| Future feature | Phase | V1 seam it attaches to | Built in V1? |
|----------------|-------|------------------------|--------------|
| Automatic app-focus profile switching | 2 | `Profile.activationRule` field + engine activation hook | Field + hook: **yes**; auto-eval consumer: P2 |
| Visual flow builder UI | 3 | Flow data model + executor + node registry (Section 6) | Model/executor: **yes**; builder UI: P3 |
| Schedule/cron flow triggers | 3 | `Flow.trigger.kind = schedule` enum value | Enum reserved: **yes**; scheduler: P3 |
| New flow node types (HTTP, parallel, plugin nodes) | 3/6 | Node registry + executor dispatch | Registry: **yes** |
| Smart-home integration | 4 | Plugin contracts + `entity` param type + state provider contract | Contracts: **yes** |
| Plugin-provided widget types | 6 | Widget type registry + client renderer registry (3.5) | Registries: **yes**; loader: P6 |
| Third-party plugin SDK & sandboxing | 6 | Plugin registration/manifest/IPC contract + permission model (Section 8) | Contracts + first-party use: **yes**; public SDK + sandbox: P6 |
| Plugin marketplace / distribution | 6 | Plugin manifest + signing fields | Manifest: **yes**; distribution: P6 |
| Remote access | 7 | `TransportEndpoint` + `ConnectionManager` abstraction (5.1) + E2E crypto (4.5) | Abstraction + crypto: **yes**; relay: P7 |
| Collaborative multi-author editing | 8 | Operation log + document versioning (5.4) | Op-log: **yes**; conflict resolution: P8 |
| Responsive/adaptive layouts | 8 | `DeviceClass` model + grid config | Model: **yes**; reflow engine: P8 |
| Compact binary State codec | 2+ | Serialization behind the framing abstraction (Section 9) | Abstraction: **yes**; codec: later |
| Cross-engine binding (device → many engines) | 8+ | Session model is engine-scoped; device can hold N trust records | Trust model supports N: **yes**; multi-engine UX: later |

If a later document proposes a feature whose seam is **not** in this table, that's a signal the foundation is missing something — and this doc gets revised first.

---

### 13. Non-functional foundations (carried & upgraded from prior design)

| Area | V1 target | Note |
|------|-----------|------|
| Tap-to-feedback latency | < 100 ms on LAN | The bar set by Stream Deck's "instant" feel |
| Layout op → device reflection | < 200 ms on LAN | The live-designer promise |
| State update cadence | 0.5s–10s per metric (per state) | Delta-broadcast on State channel |
| Engine idle CPU | < 2% on 8-core | Carried from prior NFR |
| Engine steady RAM | < 150 MB | Carried; compiled engine should beat this comfortably |
| Reconnect after drop | < 5 s | Heartbeat + backoff + rediscovery |
| Plugin crash isolation | Engine survives any plugin crash | Out-of-process plugins |
| Min touch target | 48×48 px | Accessibility carried |
| Text contrast | WCAG 2.1 AA (4.5:1) | Accessibility carried; dark neon theme must comply |

The **design system** (neon-purple/cyan palette, typography, spacing, component tokens) and the **personas, journeys, and feature domains** from the scrapped documentation are **retained as platform-independent assets** and migrate into the PRD unchanged in substance.

---

### 14. Decisions

#### Resolved

1. **Engine language → Go.** ✅ Compiled native background service per OS; cross-compiles to native installers cleanly, satisfying the native-installer requirement without favoring Rust. Goroutine model fits per-service/per-session work. (Section 9)
2. **Desktop shell → Flutter Desktop UI + Go engine as an installed background service.** ✅ Two processes, one installer (9.1). Closing the UI window leaves the engine running; the engine starts on boot. **Electron and Expo both rejected** (9.3) — Electron splits the client codebase and is too heavy for a 24/7 host; Expo would force the client to React Native, the wrong renderer for custom real-time drawing. Tauri/Rust also rejected (reintroduces a webview + second toolkit). Local UI↔engine traffic uses the loopback protocol plus a privileged local control channel (9.2).
3. **Persistence → SQLite as the single durable store; live state in-memory.** ✅ No KV/SQL split. Telemetry never hits the disk hot path; everything authored or audited is in SQLite; audit log is append-only with a `payload_json` escape hatch. (9.4)
4. **Wire serialization → JSON for V1**, behind a channel-level `Serializer` abstraction so a binary codec can later apply to only the State channel. ✅ (9.5)
5. **Licensing → identity ≠ licensing; local use is free and account-free; accounts gate cloud services only; device-count limits are a non-goal.** ✅ Architectural obligation (account-independent identity) met in 4.1; commercial detail lands in the PRD. (11.0)

#### Still open

*None at the architecture level.* Remaining specifics (exact SQLite schema/migrations, exact transport wire framing, exact crypto primitives) are **TRD-level detail**, not foundation decisions — they elaborate locked choices rather than change them.

---

*End of Foundation & Architecture Document (Draft v0.1). Next pass: PRD (Document 1), then TRD (Document 2), then per-phase deep dives.*

---



<a id="document-1-product-requirements-document-prd"></a>

# Document 1 — Product Requirements Document (PRD)

## CyberDeck — Product Requirements Document (PRD)

**Document 1 of the CyberDeck Enterprise Documentation Set**
Version 0.3 (Draft) · June 2026 · Product Owner: Shishir · Codebase ID: `com.shishir.cyberdeck`

> Read after Document 0 (Foundation & Architecture). This document defines **what** CyberDeck is and what it must do; the TRD (Document 2) defines **how**, and the per-phase deep dives detail each phase's build. Where this document references architecture (the engine/UI split, the registries, the flow engine, the security model, the LAN-now/remote-later seam), the authority is Document 0.

---

### 1. Vision

CyberDeck turns any computer into a programmable command center that you control from any screen you own. A background **engine** on the host exposes that machine's capabilities — telemetry, media, power, gaming, smart home, notifications, and arbitrary user-built automations — as live **states** and executable **actions**. From a desktop **Designer**, a user composes **layouts** of widgets and **flows** of logic, and pushes them live to **client devices** (phones, tablets, other desktops) that render them with native performance.

The product's promise in one line: **the flexibility of a real automation platform, the polish of a commercial control surface, and the freedom of a local-first tool you own.**

#### 1.1 The three pillars (what makes it worth building)

1. **Live data as first-class widgets** — gauges, sparklines, charts, and media cards bound to real-time engine state, not static images.
2. **A real automation engine** — full conditional flows with branching, variables, loops, waits, and triggers, authored visually.
3. **A live visual designer** — desktop drag-and-drop authoring that reflects to bound devices instantly, authored per device class.

All three on a **security-first, multi-device, local-first** foundation that is built for remote access later without re-architecting.

#### 1.2 Why now / why this over the incumbents

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

#### 1.3 Non-goals (V1 and as stated permanent decisions)

- **No cloud/remote access in V1** (defined future phase; seam reserved).
- **No on-device editing — ever.** Clients render and interact; authoring is desktop-only. (Permanent product decision.)
- **No automatic cross-form-factor reflow in V1.** Layouts are authored per device class. (Adaptive layouts are a later candidate.)
- **No device-count licensing, no platform-locked purchases.** (Permanent.)
- **No telemetry exfiltration.** All data stays on the local network; nothing leaves the host without an explicit, account-gated cloud feature the user opts into.

---

### 2. Personas

Four archetypes are carried from the prior research (they remain valid — they're usage profiles, not product-specific). A fifth is added because the V1 flow engine creates a genuinely new user the old design didn't serve.

#### Persona 1 — Alex, 24 · The Competitive Gamer
- **Devices:** Gaming PC (engine host), Android phone (client).
- **Goals:** Monitor FPS/thermals without alt-tabbing; one-touch game launch; apply a "competitive" profile (perf mode + RAM clean + low-latency network) in one tap.
- **Frustrations:** Juggling MSI Afterburner, Discord, Steam overlays at once.
- **Success metric:** All game-session tasks ≤ 2 taps from the gaming layout.

#### Persona 2 — Jordan, 28 · The Live Streamer
- **Devices:** High-end PC (host), iPad (client).
- **Goals:** Scene switching, audio mixing, clip capture, donation alerts — from one panel, no keyboard shortcuts.
- **Frustrations:** Current setup spans multiple boards and shortcuts.
- **Success metric:** A full stream session run without touching keyboard shortcuts.

#### Persona 3 — Sam, 32 · The Developer / Power User
- **Devices:** Workstation (host), Android tablet (client).
- **Goals:** Consolidated system-health view; quick tool/terminal launch; notification triage.
- **Frustrations:** No single health view; notification overload.
- **Success metric:** Health anomalies spotted in < 30s; triage in < 10s.

#### Persona 4 — Riley, 35 · The Home-Automation Enthusiast
- **Devices:** PC (host), 20+ IoT devices, wall-mounted tablet (client).
- **Goals:** Control lights/scenes/energy from a single touch surface; wall-tablet "home panel."
- **Frustrations:** Home Assistant's mobile app isn't touch-optimized for quick actions.
- **Success metric:** Any smart-home action in ≤ 2 taps.

#### Persona 5 — Morgan, 30 · The Builder / Automation Tinkerer *(new)*
- **Devices:** PC (host), phone + tablet (clients), tinkers across all domains.
- **Goals:** Compose multi-step **flows** — "when CPU > 85°C, switch to a cooling profile, ping me, and dim the room lights"; build conditional macros; bind custom variables to widgets; eventually write/install plugins.
- **Frustrations:** Incumbents force nested-IF gymnastics and offer no real branching, loops, or variables; logic and UI feel bolted together.
- **Success metric:** A non-trivial conditional flow (branch + variable + wait) built and working in < 10 minutes in the visual builder.

> Morgan is the persona the flow engine and plugin ecosystem exist for, and the one most likely to become an advocate/extension author.

---

### 3. User journeys

Each journey notes the phase in which it becomes fully possible. Journeys 1–3 are the V1 core loop; 4–7 layer on.

#### Journey 0 — First-run setup *(Phase 1)*
1. User installs the single CyberDeck package on their PC; the **engine registers as a background service and starts**.
2. The **Desktop UI** opens; a first-run wizard confirms the engine is running (tray icon present) and shows a **pairing QR**.
3. User opens the CyberDeck client on their phone, taps "Pair," scans the QR; key exchange completes; the device appears in the engine's device list with a chosen label and device class.
4. User assigns a starter layout to the phone; it renders immediately. Done — no account, no activation.

#### Journey 1 — Authoring a layout with live reflection *(Phase 1)*
1. In the Designer, user selects the target device ("Living Room iPad · 10×6 landscape").
2. User sets the grid (columns/rows/gutter/background), drags a **CPU gauge** onto a cell, binds it to `system.cpu.temp`.
3. The iPad, in preview mode, **shows the gauge appear in real time**.
4. User drags a **button**, maps `tap → media.play` and `longPress → flow_morning` via the schema-generated inspector.
5. User hits "done"; the layout is persisted by the engine and the iPad switches to runtime mode.

#### Journey 2 — Gaming session start *(Phase 1 launch, Phase 3 optimization depth)*
1. User opens the client; the gaming layout loads in < 1s with live thermals.
2. Taps a game tile → launcher opens the game.
3. Taps "Competitive" profile → (Phase 3) perf mode + RAM clean + low-latency network apply together.
4. Monitors live FPS/CPU/GPU during play without alt-tabbing.

#### Journey 3 — Notification triage *(Phase 1 badge, Phase 5 full)*
1. Badge shows 6 unread.
2. User opens the notifications surface → categorized list.
3. Filters to "Alerts"; dismisses non-critical; taps a message to open its source app.

#### Journey 4 — Building a conditional flow *(Phase 1 model/manual, Phase 3 visual builder)*
1. Morgan opens the flow builder, creates "Cooling Guard."
2. Trigger: `stateChange` on `system.cpu.temp` crossing `> 85`.
3. Nodes: `action: system.performance.set{Silent}` → `if {var.notify_enabled}==true` → `action: notify` → `action: home.light.brightness{30}`.
4. Saves; the engine arms the trigger. When the threshold trips, the flow runs host-side.

#### Journey 5 — Morning routine (smart home) *(Phase 4)*
1. User taps "Good Morning" scene on the wall tablet.
2. One flow sets lights, coffee, and AC (5 actions, 1 tap).
3. User checks the energy widget vs. yesterday.

#### Journey 6 — Adding a second device with different permissions *(Phase 1)*
1. User pairs a kitchen tablet (QR).
2. In device settings, **denies power actions** and limits it to media + smart home.
3. Assigns a kitchen-specific layout; the tablet can't shut the PC down even if a layout tried.

#### Journey 7 — Remote control from outside the LAN *(Phase 7)*
1. User enables remote access (account required); the engine registers with the relay.
2. From a phone on cellular, the client connects via the relay endpoint.
3. Identity, encryption, and sessions are **identical** to LAN — only the endpoint differs.

---

### 4. Feature inventory (by domain, prioritized, with phase)

**Priority key:** P0 = foundation-critical for V1 · P1 = important, near-term · P2 = valuable, mid-term · P3 = later/candidate.
**Phase** maps to Document 0 §11. A feature may have its *seam* in Phase 1 and its *full capability* later; the Phase column gives the phase of full capability, with seam notes inline.

#### D1 — Platform & Engine Core
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

#### D2 — Device Management (identity, discovery, pairing)
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

#### D3 — Transport & Connectivity
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

#### D4 — Layout & Designer (desktop-only)
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

#### D5 — Widget Vocabulary
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

#### D6 — Interaction & Gestures
| ID | Feature | Priority | Phase |
|----|---------|----------|-------|
| D6-01 | Full gesture-slot model (tap/double/long/down/up/drag/swipe) defined | P0 | 1 |
| D6-02 | Designer UI for core slots (tap/long/drag) | P0 | 1 |
| D6-03 | Independent action target per slot (action/macro/flow/navigate) | P0 | 1 |
| D6-04 | 2-tap confirmation gating for destructive actions | P0 | 1 |
| D6-05 | Visual pressed-state + ≤500ms result feedback | P0 | 1 |
| D6-06 | Designer UI for remaining slots (double/down/up/swipe) | P1 | 2 |

#### D7 — Automation (flows & macros)
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

#### D8 — System Telemetry
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

#### D9 — System Control & Power
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

#### D10 — Media
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

#### D11 — Gaming
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

#### D12 — Smart Home
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

#### D13 — Notifications
| ID | Feature | Priority | Phase |
|----|---------|----------|-------|
| D13-01 | Unread count badge (OS action center) | P0 | 1 |
| D13-02 | Aggregated notification feed | P1 | 5 |
| D13-03 | Source filtering (Discord/System/Streamlabs/etc.) | P1 | 5 |
| D13-04 | Dismiss / mark-all-read | P1 | 5 |
| D13-05 | Priority badges | P2 | 5 |
| D13-06 | Open-source-app action | P1 | 5 |

#### D14 — Security & Governance
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

#### D15 — Plugin Ecosystem
| ID | Feature | Priority | Phase |
|----|---------|----------|-------|
| D15-01 | Plugin registration/manifest contract (used by first-party) | P0 | 1 |
| D15-02 | Out-of-process plugin host (crash isolation) — runs ALL plugins incl. first-party | P0 | 1 |
| D15-03 | First-party capabilities implemented as out-of-process plugins (same contract) | P0 | 1 |
| D15-04 | Public plugin SDK | P2 | 6 |
| D15-05 | Third-party plugin loading | P2 | 6 |
| D15-06 | Plugin distribution / marketplace path | P3 | 6 |

#### D16 — Accounts & Cloud (licensing-gated)
| ID | Feature | Priority | Phase |
|----|---------|----------|-------|
| D16-01 | Optional account (overlay; never required for local use) | P2 | 7 |
| D16-02 | Layout/config cloud backup & sync | P2 | 7 |
| D16-03 | Remote access (account-gated) | P2 | 7 |
| D16-04 | Team sharing | P3 | 8 |

#### D17 — Design System & Accessibility
| ID | Feature | Priority | Phase |
|----|---------|----------|-------|
| D17-01 | Neon cyberpunk theme tokens (palette/typography/spacing) — carried | P0 | 1 |
| D17-02 | Theming applied across designer + client | P0 | 1 |
| D17-03 | 48×48 px min touch targets | P0 | 1 |
| D17-04 | WCAG 2.1 AA contrast (4.5:1) | P0 | 1 |
| D17-05 | Colour-never-sole-indicator (icon + text accompany state) | P0 | 1 |
| D17-06 | Custom themes / user-defined palettes | P2 | 6 |

---

### 5. Functional requirements (V1 normative)

Requirements use SHALL. IDs are stable references for the TRD and per-phase docs. Only V1 (P0/early-P1) requirements are enumerated here; later-phase functional requirements live in their phase deep dives.

#### FR-1 Engine & lifecycle
- FR-1.1 The engine SHALL run as an OS background service that starts on boot and continues running when the Desktop UI is closed.
- FR-1.2 Closing the Desktop UI window SHALL NOT terminate the engine.
- FR-1.3 The installer SHALL deliver both engine service and Desktop UI in one native package per target OS.
- FR-1.4 The system tray SHALL show engine status and allow reopening the UI and pausing/quitting the engine.
- FR-1.5 The engine SHALL be the single source of truth for all state, layouts, flows, and device records.

#### FR-2 Identity, discovery & pairing
- FR-2.1 Each device and the engine SHALL generate a keypair + UUID on first launch, independent of any account.
- FR-2.2 The engine SHALL advertise via mDNS (`_cyberdeck._tcp.local`) with name, UUID, version, and fingerprint.
- FR-2.3 Pairing SHALL support QR (token + fingerprint challenge-response), and manual IP/hostname + PIN.
- FR-2.4 Identity SHALL be the keypair/UUID; IP and MAC SHALL be used only as locator hints.
- FR-2.5 If a known device's last IP fails and mDNS is silent, the engine MAY perform a bounded subnet scan, confirming identity by UUID.
- FR-2.6 Pairing approval SHALL be issuable only over the privileged local control channel.

#### FR-3 Sessions & multi-device
- FR-3.1 The engine SHALL maintain an isolated session per device, each with its own active profile, subscriptions, and permissions.
- FR-3.2 Two or more devices SHALL be able to display different profiles simultaneously without interference.
- FR-3.3 Each device session SHALL be in exactly one of: runtime mode (state only) or edit/preview mode (state + layout ops + previews).

#### FR-4 Permissions & governance
- FR-4.1 Each device record SHALL carry permissions controlling allowed action categories and destructive-action access.
- FR-4.2 The engine SHALL reject any action a device's permissions disallow, regardless of layout content.
- FR-4.3 A device SHALL be revocable; a revoked device's key SHALL be rejected at next handshake.
- FR-4.4 Every executed action SHALL be recorded in an append-only audit log with actor, type, resource, timestamp.

#### FR-5 Transport & resilience
- FR-5.1 All session traffic SHALL be encrypted and authenticated, including on LAN.
- FR-5.2 The transport SHALL maintain heartbeat/keepalive to prevent sleep-induced disconnects.
- FR-5.3 On disconnect, the client SHALL auto-reconnect with backoff, then mDNS rediscovery, then bounded scan.
- FR-5.4 On disconnect, bound widgets SHALL render last value dimmed with a `--` fallback and a connection badge; no frozen or false display.
- FR-5.5 Each document SHALL carry a monotonic version; a client detecting a gap SHALL request a full resync.
- FR-5.6 The Layout, State, and Preview channels SHALL be logically separate.

#### FR-6 State & telemetry
- FR-6.1 States SHALL be typed and namespaced (`category.subcategory.field`).
- FR-6.2 Only changed states SHALL be broadcast (delta).
- FR-6.3 CPU/GPU/RAM telemetry SHALL update at ≤1000ms; storage at ≤10000ms; per Document 0 cadences.
- FR-6.4 Display formatting (units) SHALL be a presentation concern; stored state values SHALL retain native type.
- FR-6.5 Series states (sparkline buffers) SHALL be maintained in-memory and SHALL NOT be persisted.
- FR-6.6 Threshold events SHALL fire at CPU > 85°C, GPU > 88°C, RAM > 90% (defaults; configurable).
- FR-6.7 Each integration/telemetry capability SHALL be backed by an ordered provider chain; the engine SHALL bind the highest-priority available provider.
- FR-6.8 Absence of all providers for a capability SHALL report the capability as **unavailable** and SHALL NOT cause system failure; dependent states SHALL render `--` and flows SHALL be able to branch on availability.

#### FR-7 Actions
- FR-7.1 Actions SHALL be declared with a typed parameter schema in the action registry.
- FR-7.2 The Designer SHALL auto-generate parameter editors from action schemas with no per-action UI code.
- FR-7.3 Destructive actions SHALL require 2-tap confirmation on the client.
- FR-7.4 Numeric parameters SHALL be validated against schema min/max; out-of-range input SHALL be clamped or rejected per schema.
- FR-7.5 Power actions SHALL warn if unsaved-work detection indicates risk.

#### FR-8 Layouts & Designer
- FR-8.1 Layout authoring SHALL be desktop-only; clients SHALL NOT edit layouts.
- FR-8.2 Grid configuration (cols/rows/gutter/margins/aspect/background) SHALL be fully user-customizable with no caps.
- FR-8.3 Layouts SHALL be authored against a specific device class.
- FR-8.4 Every edit SHALL be expressed as a versioned operation applied to the authoritative document.
- FR-8.5 Operations SHALL broadcast to subscribed device sessions, which SHALL repaint only affected widgets.
- FR-8.6 The Designer SHALL support undo/redo via operation inverses.
- FR-8.7 During drag, ephemeral previews SHALL ride the Preview channel and SHALL NOT be persisted; a durable op SHALL commit on drop.
- FR-8.8 The Designer SHALL always display its explicit target device.
- FR-8.9 Widgets SHALL NOT overlap; conflicting placement SHALL be rejected or pushed.

#### FR-9 Widgets & interaction
- FR-9.1 Widget types SHALL be declared in the widget-type registry with a config schema and exposed gesture slots.
- FR-9.2 The client SHALL render widgets via a native renderer registry keyed by widget type.
- FR-9.3 A widget SHALL support independent action targets per gesture slot (tap/double/long/down/up/drag/swipe).
- FR-9.4 A gesture target SHALL be one of: single action, macro/flow, navigate, or none.
- FR-9.5 Appearance MAY bind to a state, with optional conditional styling (`valueRules`) evaluated client-side.
- FR-9.6 Button presses SHALL show a visual pressed state within 100ms and a result within 500ms.

#### FR-10 Automation (flow engine)
- FR-10.1 Flows SHALL be stored, versioned, and executed host-side; clients SHALL only trigger.
- FR-10.2 The V1 node set SHALL include action, if/else, setVar, wait, loop, navigate, random, subflow, stop.
- FR-10.3 Conditions/values SHALL use a sandboxed expression language with token interpolation; arbitrary code execution SHALL NOT be possible.
- FR-10.4 User variables (`var.*`) SHALL be typed, persisted, and bindable as state sources.
- FR-10.5 Flows SHALL be triggerable by manual, event, and stateChange triggers in V1 (schedule reserved).
- FR-10.6 A flow run SHALL have a local scope; `var.*` SHALL be global and persistent.
- FR-10.7 Flows SHALL be cancellable and SHALL log failures with the failing node id.

#### FR-11 Plugins (V1 contract)
- FR-11.1 All capabilities outside the engine core SHALL execute as plugins through the plugin host; first-party and third-party plugins SHALL share one lifecycle, IPC contract, permission model, and isolation boundary.
- FR-11.2 Plugins SHALL run out-of-process; a plugin crash SHALL NOT crash the engine.
- FR-11.3 Plugins SHALL declare required permissions; the host SHALL enforce them uniformly regardless of plugin origin.
- FR-11.4 The engine core SHALL NOT contain capability-specific business logic except core platform functions (transport, state store, flow engine, security, persistence, registries).
- FR-11.5 "First-party" vs "third-party" SHALL be trust metadata only (affecting signing, permission defaults, and UX), never a distinct execution model.

---

### 6. Non-functional requirements

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

### 7. Licensing principle (verbatim product statement)

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

### 8. Success metrics

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

### 9. Out-of-scope clarifications & dependencies

- **External hardware decks** (physical Stream Deck units) are out of scope; CyberDeck targets user-owned screens as surfaces.
- **Smart-home breadth** in V1 is limited to the Home Assistant integration model (Phase 4); other ecosystems are plugin candidates.
- **FPS sourcing** uses a provider chain (D11-02): **PresentMon** is the primary Windows source (open-source, no overlay, bundleable subject to a licensing review tracked in the TRD); FrameView/RTSS are fallbacks; vendor APIs (NVAPI/ADL) sit lower because they reliably expose GPU telemetry but not always per-application FPS. On macOS/Linux the chain may resolve to *unavailable* in V1 — a normal, non-breaking outcome under the provider-chain contract, not a gap.
- **macOS/iOS media + notification access** is subject to OS permission models; the TRD will specify per-OS capability coverage.

---

*End of PRD (Draft v0.1). Next pass: TRD (Document 2) — system architecture in depth, protocol/schema specs, engine internals, per-platform abstraction, data flows. Then per-phase deep dives starting with Phase 1.*

---



<a id="document-2-trd-master"></a>

# Document 2 — TRD Master

## CyberDeck — TRD Master (Document 2)

**Technical Requirements Document — Master**
Version 0.1 (Draft) · June 2026 · Codebase ID: `com.shishir.cyberdeck`

> The hub of the federated TRD set. This document holds **cross-cutting architecture and shared conventions**; subsystem depth lives in 2A–2G. Authority chain: Foundation (Doc 0) → PRD (Doc 1) → **TRD Master (this)** → subsystem TRD → per-phase deep dive. All decisions are recorded in the **ADR Log (2-ADR)** and referenced here by ID.

### Contents
1. System context
2. Component architecture
3. Process & deployment model
4. Trust boundaries & security architecture (overview)
5. Cross-cutting data-flow overview
6. Shared conventions (inherited by all subsystem docs)
7. Coding standards & repository structure
8. Cross-cutting NFR allocation
9. ADR index & subsystem map

---

### 1. System context

```
            ┌──────────────────────────────────────────────┐
            │                  HOST MACHINE                  │
            │                                                │
   ┌────────┴─────────┐        loopback         ┌───────────┴──────────┐
   │  Desktop UI       │◄───── data protocol ───►│  CyberDeck Engine    │
   │  (Flutter)        │◄── privileged control ──►│  (Go service)        │
   │  Designer +       │                          │  core + plugin host  │
   │  control view     │                          └───────┬──────────────┘
   └───────────────────┘                                  │ plugin-host IPC
                                                           │
                                            ┌──────────────┴───────────────┐
                                            │ Capability plugins (OOP)      │
                                            │ telemetry · media · power ·   │
                                            │ launchers · notifications ·   │
                                            │ (smart home, fps, 3rd-party)  │
                                            └──────────────┬───────────────┘
                                                           │ OS / 3rd-party APIs
                                                           ▼
                                                  OS · Home Assistant · etc.
            │
            │  LAN (encrypted sessions)
   ┌────────┴────────┐   ┌─────────────────┐   ┌──────────────────┐
   │ Phone client    │   │ Tablet client   │   │ Other-desktop    │
   │ (Flutter)       │   │ (Flutter)       │   │ client (Flutter) │
   └─────────────────┘   └─────────────────┘   └──────────────────┘

   (Future: a remote client reaches the Engine via a Relay endpoint —
    identity/crypto/sessions unchanged; only the endpoint differs. ADR-0010.)
```

**Actors.** The *host machine* runs the engine (always) and usually the Desktop UI. *Client devices* are user-owned screens rendering layouts. *Capability plugins* are out-of-process processes the engine supervises. *External systems* (OS APIs, Home Assistant, media sessions) are reached only by plugins, never the core.

**Boundaries crossed.** UI↔Engine (loopback, two channels — data + privileged control), Engine↔Plugins (host IPC), Engine↔Clients (encrypted LAN sessions), Plugins↔External (OS/3rd-party APIs). Each boundary is a trust boundary (§4).

### 2. Component architecture

#### 2.1 Engine core (small by mandate — ADR-0006, ADR-0002)
The core contains **only** these subsystems; everything else is a plugin.

| Core subsystem | Responsibility | Subsystem TRD |
|----------------|----------------|---------------|
| **Transport** | Sessions, channels, encryption, reconnect, endpoint abstraction | 2A |
| **State store** | Typed states, delta computation, in-memory live state, subscriptions | 2B |
| **Registries** | Action / widget-type / flow-node registries (schema-driven) | 2B |
| **Layout store** | Document tree, operation log, versioning | 2C |
| **Flow engine** | Node-graph runtime, expressions, variables, triggers, scheduler | 2D |
| **Security** | Identity, key mgmt, pairing, permissions, audit | 2E |
| **Persistence** | SQLite durable store | 2B |
| **Plugin host** | Process supervision, IPC, permission enforcement | 2F |
| **Session/profile model** | Per-device sessions, profile activation | 2B |
| **Event bus** | Internal pub/sub; feeds flow triggers | 2B |

#### 2.2 Capability plugins (all out-of-process — ADR-0006)
First-party and third-party alike. Each may contribute state providers, actions, events, flow nodes, widget types, and PAL capability implementations (provider chains — ADR-0007). Detailed in 2F (host/IPC/lifecycle) and 2G (capability interfaces/providers).

#### 2.3 Clients (Flutter — ADR-0004)
| Client subsystem | Responsibility |
|------------------|----------------|
| Connection manager | Endpoint resolution, pairing, reconnect, channel demux |
| Widget renderer registry | `widgetType → native builder` |
| Layout interpreter | Builds/diffs the widget tree from the layout doc + ops |
| State subscriber | Per-widget subscriptions; targeted repaint |
| Gesture capture | Maps device gestures to interaction-slot events |
| **Designer** *(desktop only — ADR-0018)* | Canvas, op emitter, schema-driven inspector, undo/redo |

### 3. Process & deployment model (ADR-0005)

**Three process kinds**: (1) **Engine** — Go background service, one per host; (2) **Desktop UI** — Flutter, optional, a privileged local client; (3) **Plugin processes** — one per loaded plugin, supervised by the host. Client devices run their own **Client** process (Flutter) on their own hardware.

**Lifecycle.** The engine registers as an OS service (Windows Service / launchd LaunchAgent / systemd user service), **starts on boot**, and **survives Desktop UI close**. The tray presence (part of the Desktop UI or a lightweight tray helper) shows status and can pause/quit the engine. Plugin processes start/stop under host supervision with restart-on-crash policy (2F).

**Packaging.** One native installer per desktop OS delivers engine + Desktop UI + bundled first-party plugins:

| OS | Installer | Service mechanism |
|----|-----------|-------------------|
| Windows | `.exe`/`.msi` (Inno Setup / WiX / MSIX) | Windows Service or startup-registered tray process |
| macOS | `.dmg`/`.pkg` (codesigned + notarized) | launchd LaunchAgent/LaunchDaemon |
| Linux | `.deb`/`.rpm`/`.AppImage` (`flutter_distributor` + native) | systemd user service |
| Android | `.apk`/`.aab` | client only |
| iOS/iPadOS | `.ipa` | client only |

### 4. Trust boundaries & security architecture (overview)

> Depth in 2E (key mgmt, threat model, audit) and 2A (session crypto, pairing wire protocol). This is the cross-cutting map.

| # | Boundary | Threat addressed | Control (overview) |
|---|----------|------------------|--------------------|
| TB-1 | Client ↔ Engine (LAN) | Sniffing, MITM, rogue device | E2E-encrypted authenticated sessions (ADR-0009); pairing via token + fingerprint challenge-response (ADR-0008); per-device permissions |
| TB-2 | UI ↔ Engine (loopback) | A remote client escalating to host control | **Privileged control channel is local-only**; service lifecycle + pairing approval gated there, never exposed to LAN clients (ADR-0005) |
| TB-3 | Engine ↔ Plugin | Malicious/buggy plugin damaging host or core | Out-of-process isolation (ADR-0006); permission declaration + host enforcement; (sandboxing/signing hardened in Phase 6) |
| TB-4 | Plugin ↔ External | Credential leakage, data exfiltration | Secrets in OS secure store (2E); no telemetry exfiltration (PRD non-goal); HTTPS for integrations |
| TB-5 | Flow execution | Shared flow content running arbitrary code | Sandboxed expression language, no eval; side effects only via permission-gated registered actions (ADR-0013) |
| TB-6 | Persistence | Local data tampering / secret leakage | Secrets never in SQLite or logs (redacted); audit log append-only (ADR-0014) |

**Identity recap (ADR-0008).** Keypair + UUID per device/engine, account-independent. Trust is the stored mutual public-key relationship; IP/MAC are locator hints only.

### 5. Cross-cutting data-flow overview

Three canonical flows; subsystem docs detail each. (Notation: `→` synchronous call, `⇒` channel message.)

**DF-A — Telemetry to screen (State channel).**
```
Plugin provider (e.g. CPU) → host IPC ⇒ State store (typed, in-memory)
  → delta computed (changed only) ⇒ State channel ⇒ each subscribed client session
  → client State subscriber → targeted widget repaint   (cadence 0.5–10s; ADR-0011)
```

**DF-B — User tap to action/flow (Layout channel up, execution host-side).**
```
Client gesture (e.g. tap) ⇒ Layout channel (interaction event) → Engine
  → permission check (device record) → resolve target:
      action  → Action executor → plugin IPC → external API
      flow    → Flow engine (host-side run; ADR-0013)
      navigate→ session profile/page switch
  → audit log append → resulting state changes flow back via DF-A
  (visual pressed-state is immediate client-side; result ≤500ms; NFR-01)
```

**DF-C — Designer edit to device (Layout + Preview channels).**
```
Designer drag → throttled ghosts ⇒ Preview channel ⇒ target device (ephemeral; ADR-0011)
Designer drop → Operation (versioned) → Layout store (authoritative, vN+1)
  ⇒ Layout channel ⇒ subscribed sessions → client applies op → repaint affected widget only
  (undo = inverse op; resync = request full doc at version; ADR-0012)
```

### 6. Shared conventions (inherited by all subsystem docs)

#### 6.1 Identifier schemes
- **State IDs**: `category.subcategory.field` (e.g. `system.cpu.temp`), engine-namespaced as `com.shishir.cyberdeck.<id>` on the wire.
- **Variables**: `var.<name>`.
- **Action IDs / widget types / flow-node kinds**: dotted, registry-unique (`media.volume.set`, `gauge.circular`, `if`).
- **Requirement IDs**: `FR-<n.m>` (PRD), `NFR-<nn>`, subsystem-local `T<letter>-<area>-<n>` (e.g. `TA-PAIR-3` in 2A).
- **ADR refs**: `ADR-####`.

#### 6.2 Requirement grammar
SHALL = mandatory; SHOULD = recommended; MAY = optional. Each subsystem TRD lists normative requirements with stable IDs and traces each to a PRD FR/NFR and/or ADR.

#### 6.3 Message envelope (all channels, JSON for V1 — ADR-0015)
Every wire message shares a common envelope; channel-specific payloads nest inside.
```jsonc
{
  "v": 1,                       // protocol version
  "ch": "state|layout|preview|control",
  "type": "stateUpdate|op|action|pair|...",
  "seq": 10432,                 // per-channel monotonic sequence
  "ts": 1719000000,
  "payload": { /* type-specific */ }
}
```
- Messages are newline-framed (or length-prefixed; final framing fixed in 2A).
- `seq` enables gap detection → resync (ADR-0012).
- The `Serializer` abstraction (ADR-0015) wraps encode/decode so a future binary codec swaps in per channel.

#### 6.4 Versioning
- **Protocol version** (`v`) negotiated at session start; engine supports a documented window of client versions.
- **Document version**: monotonic per layout document (ADR-0012).
- **Config/schema version**: stored; migrations run on engine startup.
- **Plugin API version**: declared in plugin manifest; host refuses incompatible majors.

#### 6.5 Time, units, formatting
- All timestamps are epoch-millis UTC on the wire.
- State values are **typed and unit-bare** (ADR-0019); units/precision are applied at render time from widget style.

#### 6.6 Error & degradation conventions
- Capability **unavailable** (no provider bound) is a first-class, non-error state → `--` in UI (ADR-0007).
- Disconnected session → last value dimmed + connection badge (NFR via FR-5.4).
- Plugin crash → host restarts per policy; dependent states go `--` until re-bound (2F).

### 7. Coding standards & repository structure

#### 7.1 Repository layout (monorepo)
```
cyberdeck/
├── engine/                  (Go)
│   ├── cmd/cyberdeck/        service entrypoint
│   ├── core/                 transport, state, registries, layout, flow, security, persistence
│   ├── pluginhost/           process supervision + IPC
│   ├── pal/                  capability interfaces + provider-chain framework
│   └── internal/…            wire, serializer, config
├── plugins/                 (Go — first-party, each its own process binary)
│   ├── telemetry/  media/  power/  launchers/  notifications/  fps/
├── client/                  (Flutter — shared)
│   ├── lib/render/           widget renderer registry
│   ├── lib/net/              connection manager, channels
│   ├── lib/designer/         desktop-only authoring
│   └── lib/app/              shell, pairing UI
├── shared/                  (schemas: action/widget/flow-node/state descriptors; protocol)
├── installers/              per-OS packaging
└── docs/                    this documentation set
```
> The Designer lives in the client codebase but is compiled/enabled only for desktop targets (ADR-0018).

#### 7.2 Standards
- **Go**: standard `gofmt`/`vet`/`golangci-lint`; context-based cancellation for all long-running tasks (flows, polls, sessions); no global mutable state outside the state store; every goroutine owned and cancellable.
- **Flutter/Dart**: `dart format`/`analyze`; widget renderers are pure functions of (descriptor, state); no business logic in widgets; no `localStorage`-style hidden state — all state from the engine or local UI state.
- **Schemas** in `shared/` are the single source of truth; engine and client generate/validate against them (no divergent hand-written copies).
- **Tests**: unit (per subsystem), integration (mock-session transport, mock plugin host), soak (8h memory/CPU), visual regression (designer/client). Detailed per phase.

### 8. Cross-cutting NFR allocation

| NFR | Owning subsystem(s) | Note |
|-----|--------------------|------|
| NFR-01 tap-to-feedback <100ms | 2A transport + client | Client shows pressed-state immediately; result round-trips |
| NFR-02 op reflection <200ms | 2C + 2A | Op-log broadcast + targeted repaint |
| NFR-03 60 FPS render | client | Native rendering; targeted repaint only |
| NFR-05 reconnect <5s | 2A | Heartbeat + backoff + rediscovery |
| NFR-07 plugin crash isolation | 2F | Out-of-process supervision |
| NFR-08/09 RAM/CPU budgets | 2B + 2G | In-memory live state; delta broadcast; bounded polling |
| NFR-10 ≥8 sessions | 2A + 2B | Per-session fan-out; goroutine model |
| NFR-11 encrypted always | 2A + 2E | Session crypto |
| NFR-12 identity ⟂ account | 2E | Keypair from first launch |
| NFR-15 WCAG AA | client + 2C | Theme tokens enforce contrast |

### 9. ADR index & subsystem map

All decisions: see **2-ADR**. Quick map of which ADRs bind which subsystem doc:

| Subsystem TRD | Governing ADRs |
|---------------|----------------|
| 2A Transport | 0009, 0010, 0011, 0015 |
| 2B Engine Core | 0002, 0005, 0014, 0019 |
| 2C Layout & Designer | 0003, 0011, 0012, 0017, 0018 |
| 2D Flow Engine | 0013, 0019 |
| 2E Security & Identity | 0008, 0009, 0016 |
| 2F Plugin Architecture | 0006, 0007 |
| 2G PAL | 0007 |

---

*End of TRD Master (Draft v0.1). Subsystem TRDs 2A–2G follow, each inheriting §6 conventions and tracing to §9 ADRs. Next: 2E (Security & Identity) and 2A (Transport) as the bedrock, then 2B, 2F, 2G, 2C, 2D.*

---



<a id="document-2-adr-architecture-decision-log"></a>

# Document 2-ADR — Architecture Decision Log

## CyberDeck — Architecture Decision Log

**Document 2-ADR of the CyberDeck Enterprise Documentation Set**
Version 0.5 (Draft) · June 2026 · Codebase ID: `com.shishir.cyberdeck`

> This log is **append-only**. ADRs are never deleted; a superseded ADR is marked `Superseded by ADR-XXXX` and kept. Every other document references decisions by ADR ID. Status values: `Accepted`, `Superseded`, `Proposed`, `Rejected`.
>
> Format per ADR: **Context** (the forces), **Decision** (what we chose), **Consequences** (what follows, good and bad), **Alternatives rejected** (and why).

### Index

| ID | Title | Status | Primary docs affected |
|----|-------|--------|----------------------|
| ADR-0001 | Own the full stack (engine + transport + clients + layout language) | Accepted | 0, 1, all |
| ADR-0002 | Host-authority model — engine is single source of truth | Accepted | 0, 2, 2B |
| ADR-0003 | Hybrid rendering — declarative layout + native client rendering | Accepted | 0, 2C |
| ADR-0004 | Client framework = Flutter (all six surfaces) | Accepted | 0, 2, 2C |
| ADR-0005 | Engine language = Go; two-process/one-installer model | Accepted | 0, 2, 2B |
| ADR-0006 | All capabilities are out-of-process plugins (incl. first-party) | Accepted | 0, 1, 2F |
| ADR-0007 | PAL defines capability interfaces + provider chains; plugin host defines isolation | Accepted | 0, 2F, 2G |
| ADR-0008 | Identity = keypair + UUID, account-independent; never IP/MAC | Accepted | 0, 2E |
| ADR-0009 | E2E encryption on all traffic incl. LAN, built for remote from day one | Accepted | 0, 2A, 2E |
| ADR-0010 | Transport endpoint abstraction (LAN now → relay later) | Accepted | 0, 2A |
| ADR-0011 | Three logical channels (Layout / State / Preview) | Accepted | 0, 2A, 2C |
| ADR-0012 | Operation-log layout sync with monotonic versioning | Accepted | 0, 2C |
| ADR-0013 | Full conditional flow/macro engine, host-side, sandboxed expressions | Accepted | 0, 2D |
| ADR-0014 | Persistence = SQLite (durable) + in-memory (live state) | Accepted | 0, 2B |
| ADR-0015 | Serialization = JSON for V1 behind a channel-level Serializer abstraction | Accepted | 0, 2A |
| ADR-0016 | Identity ≠ licensing; local use free + account-free; no device-count limits | Accepted | 0, 1 |
| ADR-0017 | Per-device-class authored layouts; no auto-reflow in V1 | Accepted | 0, 1, 2C |
| ADR-0018 | Desktop-only authoring; clients never edit (permanent) | Accepted | 0, 1, 2C |
| ADR-0019 | Typed states; formatting is a presentation concern | Accepted | 0, 2B |
| ADR-0020 | Federated TRD document set + append-only ADR log | Accepted | all |
| ADR-0021 | Binary asset delivery: content-addressed fetch + client cache | Accepted | 2A, Phase 2+ |
| ADR-0022 | Flow-document op model (persist-and-rearm, no device broadcast) | Accepted | 2D, Phase 3 |
| ADR-0023 | Elevated/privileged action gating with partial-success degradation | Accepted | 2E, Phase 3 |
| ADR-0024 | Network flow node permission (off by default; imported flows inert) | Accepted | 2D, 2E, Phase 3 |
| ADR-0025 | External-integration connection lifecycle & entity mapping pattern | Accepted | 2F, 2E, Phase 4+ |
| ADR-0026 | Periodic/streamed asset frames (refresh policy on ADR-0021) | Accepted | 2A, Phase 5 |
| ADR-0027 | Plugin signing & trust tiers (first/verified/unverified) | Accepted | 2E, 2F, Phase 6 |
| ADR-0028 | Plugin sandboxing model (OS confinement scaled by trust tier) | Accepted | 2F, Phase 6 |
| ADR-0029 | Plugin-provided UI as portable descriptors (no foreign code on clients) | Accepted | 2B, 2C, Phase 6 |
| ADR-0030 | Blind relay/rendezvous architecture (ciphertext-only forwarding) | Accepted | 2A, Phase 7 |
| ADR-0031 | Account overlay & licensing enforced only at the cloud boundary | Accepted | 2E, Phase 7 |
| ADR-0032 | Remote security hardening & relay trust | Accepted | 2E, Phase 7 |
| ADR-0033 | CRDT/OT collaboration layered on the op-log | Accepted | 2C, 2D, Phase 8 |
| ADR-0034 | Adaptive layouts: opt-in authored base + explicit rules | Accepted | 2C, Phase 8 |
| ADR-0035 | Cross-engine multi-bind & switching (not federation) | Accepted | 2A, 2E, Phase 8 |

---

### ADR-0001 — Own the full stack
**Status:** Accepted

**Context.** The original product was a Touch Portal plugin + page pack. That approach capped customization (someone else's host, someone else's page model, someone else's reliability) and could not deliver the live-data widgets, automation depth, or live designer the product needs. Stream Deck and Touch Portal hit the same ceiling; the products that broke past it (Macro Deck, Deckboard) all built their own engine + clients.

**Decision.** Build the entire stack: a host **engine**, a secure **transport**, native **clients**, a **layout language**, and a **plugin SDK**. Retain the prior work that is platform-independent (design system, personas, journeys, feature domains, state-naming conventions); replace only the delivery mechanism.

**Consequences.** Maximum flexibility and a real product moat (the layout language + registries). Much larger build than a plugin. Justifies the federated documentation effort.

**Alternatives rejected.** (a) Continue as a TP plugin — capped, the reason for the pivot. (b) Skin an existing open-source deck — inherits their model and limits.

---

### ADR-0002 — Host-authority model
**Status:** Accepted

**Context.** Multiple devices must show consistent, unambiguous state with no "which device is right?" confusion, and the system must be debuggable.

**Decision.** The engine is the **single source of truth** for all state, layouts, flows, and device records. Clients are deterministic renderers + input forwarders holding no authoritative business logic. Each device is a named, isolated **session** against the one authority.

**Consequences.** Eliminates client/server disagreement; makes resync trivial (ask the authority); enables per-session isolation and per-device permissions. Clients are "thin-ish" — they render and capture, they don't decide. Puts all execution load on the host (acceptable; the host is a real computer).

**Alternatives rejected.** Peer/distributed state — needless complexity for a single-host control surface and a source of the exact confusion we must avoid.

---

### ADR-0003 — Hybrid rendering
**Status:** Accepted

**Context.** Need Stream-Deck-class responsiveness, a gauge/sparkline-heavy UI, *and* the ability to change layouts without shipping app builds, *and* a live designer.

**Decision.** **Declarative layout + native client rendering.** The engine ships a structured layout *description* (widget, placement, binding, behavior); the client owns a **native widget toolkit** and renders it. Engine controls layout/bindings/behavior; client controls pixels.

**Consequences.** Native performance + remote-defined UI + the live designer all fall out of one choice. Requires a well-specified layout language and a client renderer registry (2C). Rejects pixel-streaming.

**Alternatives rejected.** (a) Pixel streaming — laggy, heavy, fails the <100ms budget. (b) Fully client-defined UI — loses central control and the live designer.

---

### ADR-0004 — Client framework = Flutter
**Status:** Accepted

**Context.** One control-surface codebase must run on Android, iOS/iPadOS, Windows, macOS, Linux, render custom real-time visuals (gauges, sparklines, waveforms, the designer canvas) at 60 FPS, and produce native installers for every desktop OS.

**Decision.** **Flutter** for client + Desktop UI + Designer. Its own rendering engine (Skia/Impeller) suits custom high-frequency drawing; it builds native packages for all six surfaces.

**Consequences.** One renderer, one widget toolkit, one layout interpreter everywhere. Native `.exe`/`.msi`, `.dmg`/`.pkg`, `.deb`/`.rpm`/`.AppImage`, `.apk`/`.aab`, `.ipa` via standard tooling.

**Alternatives rejected.** (a) **Electron** desktop — Chromium-per-window is too heavy for a 24/7 host (against <150MB/<2% NFR), weak at the systems work, and would *split the client codebase*. (b) **Expo/React Native** mobile — forces the client to RN (wrong engine for custom real-time drawing), covers only 2 of 6 targets. (c) .NET MAUI — no official Linux. (d) Compose Multiplatform — iOS still maturing.

---

### ADR-0005 — Engine = Go; two-process/one-installer
**Status:** Accepted

**Context.** The host needs a long-running background service: telemetry polling, per-session fan-out to N devices, flow execution, crypto, plugin supervision — at <150MB RAM / <2% idle CPU — that **keeps running when the UI window is closed** and **starts on boot**, while the user still needs a desktop UI to author in. Native installers required for every desktop OS.

**Decision.** Engine in **Go**, compiled to a native per-OS binary, installed as a **background service** (Windows Service / launchd / systemd). The **Flutter Desktop UI** (Designer + control view) is a *separate process* and a *client* of the engine. One installer drops both; closing the UI leaves the engine running; a tray presence manages it. Local UI↔engine uses the same loopback protocol as remote clients **plus a privileged local control channel** for service lifecycle and pairing approval.

**Consequences.** "Runs in background," "starts on startup," and "headless-capable" all derive from the engine being a standalone service rather than UI-embedded code. Go's goroutine model fits per-service/per-session concurrency. Removes the old Python/PyInstaller packaging pain.

**Alternatives rejected.** (a) **Rust + Tauri** — viable but Tauri reintroduces a webview renderer + second client toolkit (same flaw as Electron); Go cross-compiles to native binaries just as cleanly and builds faster. (b) Engine embedded in the UI process — breaks "runs when app closed."

---

### ADR-0006 — All capabilities are out-of-process plugins (including first-party)
**Status:** Accepted

**Context.** Plugins must be crash-isolated (incumbents are fragile). First-party capabilities (telemetry, media, power, etc.) could run in-process for simplicity while third-party run out-of-process — but that creates two execution models.

**Decision.** **All capabilities outside the engine core execute through the plugin host, out-of-process. First-party and third-party plugins share one lifecycle, IPC contract, permission model, and isolation boundary.** Whether a plugin ships from CyberDeck or a community author is **metadata, not architecture.** The engine core contains **no capability-specific business logic** — only transport, state store, flow engine, security, persistence, and registries (plus the plugin host).

**Consequences.** One runtime to build, test, debug, and secure. "Plugins are isolated" is true for the plugins that matter most. A first-party capability becoming community-extensible is a metadata change, not a rewrite. Every API change validates against one runtime. Cost: first-party capabilities pay IPC overhead from day one (acceptable; bounds the architecture honestly). The out-of-process host is therefore **P0/Phase 1**, not deferred.

**Alternatives rejected.** In-process first-party + out-of-process third-party — two lifecycles, two IPC assumptions, two debugging paths, two permission enforcements, and "architectural hypocrisy" (isolation false for core capabilities). Rejected.

---

### ADR-0007 — PAL ⊥ plugin host
**Status:** Accepted

**Context.** Two orthogonal concerns risk being conflated: *which implementation answers a capability* (and the fallback order) versus *how that code is executed and isolated*.

**Decision.** The **PAL** defines **capability interfaces and provider-priority chains** (e.g. `gaming.fps`: native → PresentMon → FrameView → RTSS → vendor APIs → unavailable). The **plugin host** defines **execution and isolation**. They compose: a capability provider is *both* a PAL provider-chain entry *and* code inside a plugin process. The host probes a capability's chain, binds the highest-available provider, and exposes one interface upward; absence of all providers reports **unavailable** (graceful, never a crash).

**Consequences.** No single external dependency (e.g. an FPS overlay tool) can block the system. Provider selection and process isolation evolve independently. Cross-platform "unavailable" (e.g. PresentMon is Windows-only) is a normal outcome, not a gap.

**Alternatives rejected.** Single hard-coded provider per capability (the old `FPS = RTSS` model) — a single point of failure and untestable across hardware.

---

### ADR-0008 — Identity = keypair + UUID, account-independent
**Status:** Accepted

**Context.** Devices must be unambiguously identifiable across IP/MAC churn (modern iOS/Android randomize MAC per network; DHCP rotates IPs), and local use must require no account.

**Decision.** On first launch each device and the engine generate an **Ed25519 keypair + stable UUID**. Pairing binds **mutual trust** (store the other's public key + UUID + label + class). IP/MAC are **locator hints only**, never identity. **Identity exists from first launch independent of any account.**

**Consequences.** Robust identity through network change; "no confusion which device" via UUID-keyed sessions; the architectural precondition for free, account-free local use (ADR-0016). Requires keypair generation/storage on every device (2E).

**Alternatives rejected.** (a) MAC binding — randomized, unreliable. (b) IP binding — rotates. (c) Account-derived identity — breaks local-first and contaminates identity with licensing.

---

### ADR-0009 — E2E encryption on all traffic, built for remote from day one
**Status:** Accepted

**Context.** Even LAN traffic can be sniffed (shared Wi-Fi, hostile networks). Retrofitting encryption later is a rewrite.

**Decision.** **All session traffic is encrypted and authenticated, including on LAN**, over the established device keys. The crypto and pairing are designed for remote from the start, so the future relay phase changes only the *endpoint*, not identity/crypto/sessions.

**Consequences.** Secure by default; remote is additive (ADR-0010). Slight per-message crypto cost (negligible on modern hardware). Exact primitives specified in 2E.

**Alternatives rejected.** Plaintext-on-LAN with encryption added for remote later — a protocol rewrite and a security hole in V1.

---

### ADR-0010 — Transport endpoint abstraction
**Status:** Accepted

**Context.** LAN-only now, remote later, without re-architecting.

**Decision.** All addressing goes through a **`TransportEndpoint`** resolved by a **`ConnectionManager`**. In V1 every endpoint resolves to a direct LAN socket. The remote phase adds a relay-backed endpoint type. **Nothing above the ConnectionManager** (engine, sessions, channels, document/state model) knows which kind it is.

**Consequences.** Remote access becomes a new endpoint implementation + relay infra, not a core change. Single most important forward-compat seam.

**Alternatives rejected.** Hard-coded LAN sockets throughout — would force a transport rewrite for remote.

---

### ADR-0011 — Three logical channels
**Status:** Accepted

**Context.** Structural layout edits, high-frequency telemetry, and live-drag previews have incompatible durability/cadence needs.

**Decision.** One secure session carries **three logical channels**: **Layout** (durable, versioned structural ops + action/interaction events), **State** (ephemeral delta state updates, 0.5–10s), **Preview** (ephemeral throttled edit previews, 30–60Hz, never persisted).

**Consequences.** A per-second CPU update never touches the layout tree; a live-drag preview never pollutes durable history. Clean separation enables a future binary codec on State only (ADR-0015).

**Alternatives rejected.** Single undifferentiated stream — couples cadences, risks desync, pollutes history.

---

### ADR-0012 — Operation-log layout sync
**Status:** Accepted

**Context.** Layout edits must reflect on devices instantly, support undo/redo, sync to many devices, and leave room for future collaboration.

**Decision.** Every edit is a **versioned operation** applied to the authoritative document and broadcast to subscribed sessions, which **repaint only affected widgets**. Each document has a **monotonic version**; clients track last-applied and request a full resync on a gap. V1 uses a single-writer edit lock.

**Consequences.** Instant reflection, undo/redo (op inverses), multi-device fan-out, and a collaboration substrate (ADR-future) all from one mechanism. Live drag = ephemeral Preview ghosts + one durable op on drop.

**Alternatives rejected.** (a) Full-document push per edit — wasteful, no granular repaint. (b) CRDT/OT in V1 — premature; the op-log supports adding it later.

---

### ADR-0013 — Full conditional flow/macro engine
**Status:** Accepted

**Context.** Incumbent logic is weak (Touch Portal needs nested IFs for a 3-state toggle; Stream Deck has only linear multi-actions). The "Builder" persona needs real branching, variables, loops.

**Decision.** Ship a **full conditional flow/macro engine**: a node graph (`action, if/else, setVar, wait, loop, navigate, random, subflow, stop`), a **sandboxed expression language** (interpolation + comparison + boolean + arithmetic, no arbitrary code execution), typed global `var.*` + per-run local scope, and triggers (`manual, event, stateChange`; `schedule` reserved). Flows execute **host-side**; clients only trigger. The data model + executor + core nodes are **V1**; the visual builder UI is a later phase over the same model.

**Consequences.** Differentiator vs incumbents; the event architecture becomes a *consumer* of the flow engine. Expression sandbox is a security boundary (flows are shareable content). Node palette extends via the same registry pattern (plugin nodes later).

**Alternatives rejected.** (a) Linear macros only — fails the Builder persona. (b) Embedding a general scripting language (Lua/JS) — security and sandboxing burden; the constrained expression language is safer and sufficient.

---

### ADR-0014 — Persistence = SQLite + in-memory
**Status:** Accepted

**Context.** Durable data (documents, registries, variables, audit log, workflows, devices, accounts) needs indexing/transactions/history queries; high-frequency telemetry must not hit disk.

**Decision.** **SQLite** is the single durable store (no KV/SQL split). **Live state** (telemetry, sparkline ring buffers) stays **in-memory** and never writes on the hot path; it crosses to SQLite only when durable (a flow writing `var.*`, or an audit event). Audit log is **append-only** with a flexible `payload_json` column.

**Consequences.** The inevitable history queries ("variables changed by workflow X in 7 days") are trivial SQL. Idle-CPU NFR protected (no per-tick disk write). Single embedded file, no server.

**Alternatives rejected.** (a) Embedded KV — hand-rolled indexes/queries as requirements evolve; the audit log is the deciding factor for SQL. (b) Persisting telemetry — blows the idle-CPU budget.

---

### ADR-0015 — Serialization = JSON for V1 behind an abstraction
**Status:** Accepted

**Context.** Need debuggability now; possible bandwidth optimization later.

**Decision.** **JSON throughout V1**, behind a channel-level **`Serializer`** abstraction (`Serializer → {Json, Binary}`). A future compact codec (MessagePack/CBOR/Protobuf) can apply to **only the State channel** without touching call sites.

**Consequences.** Failed automations are inspectable as readable JSON in logs; universal tooling. No premature binary-codec work. Binary deferred until profiling proves need (realistically only State channel would ever warrant it).

**Alternatives rejected.** Binary codec in V1 — creates an observability problem for a saving the product won't notice on LAN.

---

### ADR-0016 — Identity ≠ licensing
**Status:** Accepted

**Context.** Device-count/platform-locked licensing (the incumbent model) contaminates the identity layer and drives angry users + support burden.

**Decision.** **Local use is free and account-free, forever.** An **account is an optional overlay** required only for cloud services (sync, backup, remote, team). **Licensing attaches to the account, not devices**; a paid user uses multiple personal devices freely. **Device-count restrictions and platform-locked purchases are explicit non-goals.** Architecturally, identity (ADR-0008) must not depend on an account existing.

**Consequences.** Minimal friction; identity stays clean; cloud features have a natural paywall users accept. The only V1 obligation is account-independent identity (already met).

**Alternatives rejected.** Per-device or per-platform licensing — documented incumbent pain point; makes the architecture licensing-first.

---

### ADR-0017 — Per-device-class authored layouts
**Status:** Accepted

**Context.** A dense gauge/neon UI cannot auto-reflow gracefully across a phone, a 10" tablet, and an ultrawide.

**Decision.** Layouts are **authored against a specific device class** (grid/orientation/reference resolution) and assigned to devices of that class. **No automatic cross-form-factor reflow in V1.**

**Consequences.** No reflow-breakage; you design for the screen you target. Multiple device classes mean multiple authored layouts. Adaptive/responsive layouts remain a later candidate over the same `DeviceClass` model.

**Alternatives rejected.** Author-once-auto-reflow — much more "magic," much more breakage risk for this UI style.

---

### ADR-0018 — Desktop-only authoring (permanent)
**Status:** Accepted

**Context.** Authoring needs the precision of a large screen and pointer; on-device editing would double the input/UX surface and dilute focus.

**Decision.** **Authoring is desktop-only and permanent.** Clients render and interact; they never edit layouts.

**Consequences.** Clean client (no editor code paths); single authoring surface to polish. Designer always names its explicit target device. Not revisited as a phase.

**Alternatives rejected.** On-device editing — significant extra work, diluted product focus, and unnecessary given the desktop is always present (it hosts/accompanies the engine).

---

### ADR-0019 — Typed states; formatting is presentation
**Status:** Accepted

**Context.** The prior design stored everything as formatted strings ("42.0 °C"). The flow engine must compare values numerically (`cpu.temp > 85`).

**Decision.** States are **typed** (`scalar/number, text, boolean, enum, series`) and namespaced. **Display formatting (units, precision) is a presentation concern** held in the widget/style, not baked into the stored value.

**Consequences.** Flow conditions and gauges use the raw number; labels format for display. A real departure from the scrapped docs, captured deliberately.

**Alternatives rejected.** Formatted-string states — break numeric comparison in flows and conflate data with presentation.

---

### ADR-0020 — Federated TRD set + append-only ADR log
**Status:** Accepted

**Context.** A single TRD at the required depth would reach many hundreds of pages and become unnavigable; decisions accrue across subsystems and time.

**Decision.** A **federated TRD set**: a **TRD Master** (Document 2, cross-cutting architecture + conventions + ADR index) plus **subsystem TRDs** (2A Transport, 2B Engine Core, 2C Layout & Designer, 2D Flow Engine, 2E Security & Identity, 2F Plugin Architecture, 2G PAL). All decisions live in this **append-only ADR log** (2-ADR), referenced by ID from every document. Shared conventions (ID schemes, requirement grammar, message envelope, versioning) live in the Master and are inherited.

**Consequences.** Each subsystem doc stays navigable and independently ownable; the ADR log is the single decision registry; cross-references are stable by ID. Slight overhead maintaining the index and conventions front-matter.

**Alternatives rejected.** One monolithic TRD — unnavigable at the target depth.

---

### ADR-0021 — Binary asset delivery: content-addressed fetch + client cache
**Status:** Accepted (introduced Phase 2)

**Context.** Album art (and later game covers, camera thumbnails) is binary and must reach **remote clients that do not share the host filesystem**. The Phase-1 "local file URL" approach only works when client == host. Binary data must not ride the high-frequency JSON State channel (base64 per tick is wasteful and breaches budgets), and must not violate the three-channel model (ADR-0011).

**Decision.** **Content-addressed asset delivery with client-side caching.** The engine hashes each asset (e.g. SHA-256) and publishes a small **asset reference** as an ordinary state (`media.albumart.ref = "sha256:…"`). A client lacking the asset issues a typed **`assetRequest{ref}`** over the session; the engine replies with **`assetResponse{ref, mime, bytes}`** (length-framed binary, chunked if large). Clients cache by hash, so identical assets transfer **once per device, ever**. This is a request/response message pair over the existing session — **not** a new always-on channel — preserving ADR-0011.

**Consequences.** Art reaches remote phones; repeats are instant; metadata latency (NFR-04) is unaffected (metadata renders immediately, art progressively). The mechanism is capability-agnostic and is **reused by Phase 3 (game covers) and Phase 5 (camera thumbnails)** — built once. Asset bytes live in the host temp/asset cache (bounded LRU/TTL), not SQLite (binary, ephemeral, cheap to re-fetch).

**Alternatives rejected.** (a) Base64 art in State updates — wasteful, breaches budgets, pollutes the delta stream. (b) A separate persistent binary channel — over-engineered; request/response suffices and keeps the channel model intact. (c) Host-local file URLs — fail for remote/non-host clients (the whole problem).


---

### ADR-0022 — Flow-document op model (persist-and-rearm, no device broadcast)
**Status:** Accepted (introduced Phase 3)

**Context.** The layout designer edits via an op-log that **broadcasts to devices** for live reflection (ADR-0012). The Phase-3 visual flow builder needs undo/redo and versioning too — but **flows execute host-side and are never rendered on a device**, so live device broadcast is meaningless for them.

**Decision.** The flow builder edits the flow document with a **local op model** (`AddNode, RemoveNode, ConnectEdge, SetNodeParams, SetTrigger, …`) that has **inverses (undo/redo)** and **monotonic versioning** like the layout op-log, but **commits persist to `workflows` (2B) and re-arm triggers** instead of broadcasting on the Layout channel. Same op-model *shape*, different *delivery*: persist-and-rearm vs persist-and-broadcast.

**Consequences.** Consistent undo/redo and versioning across both authoring surfaces (layout + flow), with an honest reflection that flows are not a live device surface. The Phase-8 collaboration substrate (op-log) still applies to flows if ever wanted.

**Alternatives rejected.** (a) Reuse the broadcasting layout op-log verbatim — sends meaningless ops to devices. (b) No op model for flows (save whole document each edit) — loses cheap undo/redo and granular history.

---

### ADR-0023 — Elevated/privileged action gating with partial-success degradation
**Status:** Accepted (introduced Phase 3)

**Context.** Gaming/system actions (process priority of others, `EmptyWorkingSet`, power-plan changes, fan writes, kill process) require OS elevation. On locked-down/corporate machines elevation may be unavailable. The system must never crash or silently fail.

**Decision.** Extend the action registry descriptor with an **`elevated`** flag (alongside `destructive`). The engine service executes elevated actions **within the privilege level granted at install**. Where elevation is unavailable, an elevated action **executes the subset it can and reports partial success** — never a silent failure, never a crash. Every elevated action is **audited with its elevation outcome**.

**Consequences.** Honest behavior across privilege environments; corporate machines degrade gracefully. Game profiles apply as **transactional bundles** (each step has an undo closure; failure rolls back completed steps) and revert on profile switch/shutdown so the machine isn't left in an extreme state.

**Alternatives rejected.** (a) Require admin to run the engine — too heavy a demand for a control surface; breaks the low-friction promise. (b) Silently skip un-permitted steps — opaque and untrustworthy.

---

### ADR-0024 — Network flow node permission (off by default; imported flows inert)
**Status:** Accepted (introduced Phase 3)

**Context.** The Phase-3 `httpRequest` flow node can call arbitrary endpoints — an exfiltration/SSRF surface. Flows are **shareable content** (Phase-2 import; future marketplace), so a malicious shared flow could phone home if network access were implicit.

**Decision.** The `httpRequest` node requires an explicit **`flow.network` permission, off by default**, granted by a deliberate user action with a clear warning in the builder. An **imported** flow containing an `httpRequest` node is **inert until the user reviews and grants** network permission for it. HTTP nodes are **audited** (request host, not body; secrets redacted).

**Consequences.** Upholds the no-exfiltration product stance (2E TB-4/TB-5) while still offering the power of HTTP automation — explicitly, opt-in, user-authored. Marketplace flows (P6) inherit this gate automatically.

**Alternatives rejected.** (a) Implicit network access for http nodes — silent exfiltration risk on shared flows. (b) Banning the http node — removes a major automation capability the Builder persona wants.

---

### ADR-0025 — External-integration connection lifecycle & entity mapping pattern
**Status:** Accepted (introduced Phase 4)

**Context.** Home Assistant is the first integration with an **external, networked, credentialed third-party system**. Its connection handling, credential storage, real-time updates, and failure behavior will be repeated by every future integration, so the pattern should be specified once.

**Decision.** A reusable external-integration pattern: (1) **non-secret config** (base URL) in `config.json`, **secret (token) in the OS secure store** (2E §7), never plaintext; (2) a per-integration **connected/degraded/error** connection state mirroring the device-connection contract (2A §7.3), with entities following the integration's health; (3) **dual transport** — REST for actions/initial fetch + a **WebSocket/event push** for real-time updates, with a **timed REST poll fallback** when push is unavailable; (4) every external call has a **bounded timeout → error state** (no hangs); (5) external entities map to **dynamically-created typed states** keyed by a stable external ID so layouts survive reconnects; (6) the integration is an **out-of-process plugin** (ADR-0006) with `network: outbound` permission.

**Consequences.** Smart home (and every later integration) degrades gracefully, stores secrets safely, updates in real time, and survives restarts without breaking layouts. The whole smart-home domain is delivered with near-zero engine-core change — the plugin architecture validated on a real external system.

**Alternatives rejected.** (a) Poll-only (no event push) — laggy, wasteful. (b) Token in config/SQLite — violates 2E. (c) Building HA into the core — violates ADR-0006 and wouldn't generalize to other integrations.

---

### ADR-0026 — Periodic/streamed asset frames (refresh policy on ADR-0021)
**Status:** Accepted (introduced Phase 5)

**Context.** ADR-0021 handles *static* assets (album art: fetch once, cache by hash forever). Camera previews are *changing* images — a fresh frame every few seconds — which would either flood the session or pollute the static-asset cache with thousands of permanent single-use entries.

**Decision.** A **periodic-frame refresh policy layered on ADR-0021**: a camera tile binds a frame source with a configurable refresh interval; each refresh fetches a frame, hashes it, updates a `frame.ref` state, and the client pulls it via the existing `assetRequest` path. Frame cache is **short-TTL and tile-bounded** (latest 1–2 frames per tile, immediate eviction) — separate from the long-lived static-asset cache. Refresh runs **only while a tile is visible on a connected session** (subscription-gated), and frames degrade to a dimmed last frame + offline badge on failure.

**Consequences.** Camera previews reuse the asset transport without unbounded growth or static-cache pollution; off-screen cameras cost nothing; bandwidth is bounded by interval. Full live video (RTSP/HLS) playback remains deferred — this delivers periodic thumbnails only.

**Alternatives rejected.** (a) Treat each frame as a permanent static asset — unbounded cache growth. (b) Always-on frame push — wastes bandwidth on off-screen cameras. (c) A separate video channel — out of scope; thumbnails suffice for previews.

---

### ADR-0027 — Plugin signing & trust tiers
**Status:** Accepted (introduced Phase 6)

**Context.** Opening plugins to third parties (Phase 6) introduces untrusted code. First-party plugins shipped trusted-by-default since Phase 1; third-party needs verification without creating a second execution model (ADR-0006 forbids that).

**Decision.** **Trust tiers driven by signature, not by a binary first/third split.** First-party = signed by CyberDeck, installer-trusted. Verified third-party = signed by a registered developer key, signature-verified at install/update, permissions user-reviewed. Unverified/sideloaded = no recognized signature, explicit risk gate, strictest sandbox, no trusted permission defaults. Trust tier affects **permission defaults, sandbox tightness, and UX labeling only** — never the execution contract.

**Consequences.** Untrusted code is gated and confined without forking the architecture; "first-party = third-party, metadata differs" (ADR-0006) holds. Permission-changing updates force re-review; non-permission updates verify silently.

**Alternatives rejected.** (a) Trust all installed plugins equally — unsafe for sideloaded code. (b) A separate runtime for untrusted plugins — violates ADR-0006's one-model rule.

---

### ADR-0028 — Plugin sandboxing model
**Status:** Accepted (introduced Phase 6)

**Context.** Out-of-process isolation (ADR-0006) prevents a plugin crash from killing the engine, but does not by itself confine what a plugin *does* (filesystem, network, OS capabilities) — needed once third-party code runs.

**Decision.** **OS-level process confinement layered on out-of-process isolation, scaled by trust tier (ADR-0027)**, behind a single `PluginSandbox` interface implemented per OS (restricted tokens/job objects on Windows; sandbox profiles/entitlements on macOS; namespaces/seccomp/cgroups on Linux). Confinement: filesystem limited to the plugin's data dir + granted paths (never the SQLite/secret stores or other plugins' data); network denied unless declared+granted (ADR-0024 generalized); only declared+granted PAL capabilities; per-plugin CPU/RAM limits. Where OS sandboxing is unavailable, degrade to **isolation-only with a clear warning**. Sandbox denials are audited.

**Consequences.** A malicious/buggy plugin cannot crash the engine, exceed permissions, or exfiltrate; violations are recorded. Permission grants map to sandbox allowances. Provider-chain/degradation discipline (ADR-0007) applies to the sandbox capability itself.

**Alternatives rejected.** (a) Isolation-only (no confinement) — insufficient for untrusted code. (b) In-process sandboxing — impossible to confine safely; contradicts ADR-0006.

---

### ADR-0029 — Plugin-provided UI as portable descriptors
**Status:** Accepted (introduced Phase 6)

**Context.** Plugins are engine-side (Go, out-of-process) but need to contribute **client-side (Flutter) widgets**. Shipping third-party Flutter code into the client would be a code-execution surface on user devices — unacceptable.

**Decision.** **Plugin-provided UI is declarative data, not code.** A plugin registers a widget type as a **composition of built-in render primitives** (container, text, image/asset, gauge, sparkline, bar, icon, slider, toggle) plus a layout + binding spec referencing the plugin's states/actions. The trusted client renderer interprets the descriptor into a native tree; **no third-party code ever executes on a client device.** Bespoke custom-drawn widgets beyond primitive composition are out of scope; expanding the primitive vocabulary is the safe lever.

**Consequences.** Third parties create genuinely new widget *types* (novel compositions/bindings) with native performance and zero client-side code risk. `valueRules` and interaction slots work unchanged (already declarative). The client gains a descriptor interpreter alongside its hardcoded built-in builders.

**Alternatives rejected.** (a) Ship third-party UI code to clients — code-execution risk on user devices. (b) Server-rendered/pixel-streamed plugin widgets — laggy, contradicts ADR-0003. (c) No plugin widgets — cripples the ecosystem.

---

### ADR-0030 — Blind relay/rendezvous architecture
**Status:** Accepted (introduced Phase 7)

**Context.** Remote access (outside the LAN) needs a way to locate and reach an engine when mDNS (LAN-only) and direct connectivity (NAT/firewalls) don't apply — without the cloud ever seeing user data.

**Decision.** A **blind relay + rendezvous** service — the product's first and only cloud server, deliberately minimal. **Rendezvous**: engines register reachability by UUID; remote clients resolve their paired engine. **Relay**: forwards **ciphertext only** between client and engine; the E2E session keys (ADR-0009) are negotiated end-to-end through the relay, so the relay is a dumb pipe that cannot read media/telemetry/actions. The CyberDeck handshake (2E) runs end-to-end through the relay exactly as on LAN.

**Consequences.** Remote works through hostile NATs; a relay compromise leaks at most traffic metadata, never plaintext. The cloud component carries no application logic. Rendezvous also serves as the signaling channel for NAT hole-punching (direct preferred, relay fallback).

**Alternatives rejected.** (a) A smart relay that terminates encryption — would see plaintext; unacceptable. (b) Port-forwarding/DDNS only — fragile, user-hostile, fails on symmetric NAT. (c) No remote — fails a stated future requirement.

---

### ADR-0031 — Account overlay & licensing enforced only at the cloud boundary
**Status:** Accepted (introduced Phase 7)

**Context.** Remote/backup/sync need an account, but local use must stay free and account-free (ADR-0016), and licensing must never contaminate identity (ADR-0008).

**Decision.** The account is an **optional overlay** that **references** engine/device UUIDs for cloud services; it never owns identity, and deleting it doesn't affect local function. **Licensing is enforced only at the cloud boundary** (rendezvous/relay/backup APIs) — never in the local engine. A lapsed subscription disables remote/backup/sync and nothing else. **Device-count is never enforced**; a paid account uses any number of personal devices.

**Consequences.** Local-first promise intact (install, run, use forever, no account); cloud features have a natural, accepted paywall; identity stays clean. The engine's cloud client is inert without an account and changes nothing locally by its absence.

**Alternatives rejected.** (a) Account required for the app — breaks local-first. (b) Local licensing checks — contaminate identity, create the incumbent's pain. (c) Device-count limits — explicit non-goal (ADR-0016).

---

### ADR-0032 — Remote security hardening & relay trust
**Status:** Accepted (introduced Phase 7)

**Context.** Remote access widens the attack surface (relay, rendezvous, accounts, WAN exposure) beyond the V1 LAN threat model (2E §8 deferred these).

**Decision.** Harden at the new edges without weakening the E2E core: relay is **blind** (ADR-0030); **remote is off by default** and enable-able **only via the privileged local channel** (a remote attacker can't enable it); rendezvous has **rate/bandwidth limits + anomaly logging**; **remote devices remain ordinary permissioned/audited devices** (2E §5) with an **optional stricter remote permission profile** (e.g. deny power actions off-LAN); replay/abuse defeated by existing session nonces + forward secrecy plus connection-level limits. Threat-model additions: relay compromise (metadata only), rendezvous abuse (limited), credential stuffing (account controls), remote DoS (limits).

**Consequences.** Remote is safe-by-default and least-privilege; the E2E core is untouched. Users can be stricter for off-LAN sessions.

**Alternatives rejected.** (a) Remote on by default — dangerous. (b) Trusting the relay — contradicts ADR-0030. (c) Granting remote devices extra capability — violates the permission model.

---

### ADR-0033 — CRDT/OT collaboration layered on the op-log
**Status:** Accepted (introduced Phase 8, candidate)

**Context.** Real-time multi-author editing is a desired advanced capability. V1 used a single-writer edit lock (2C §4.3) — explicitly a simplification chosen so collaboration could be added later.

**Decision.** Layer **operational transformation or a CRDT** onto the **existing op-log** (ADR-0012). Operations are already discrete, versioned, and invertible — the prerequisites — so collaboration is a **convergence layer over the same operation set**, not a new sync model. Merged ops broadcast on the same Layout channel (live reflection unchanged); the approach extends to flows (ADR-0022's flow op-model). OT-vs-CRDT chosen at a design spike (CRDT favored for offline-tolerant merge).

**Consequences.** Collaborative editing without a foundational rewrite — the op-log's intended payoff. The single-writer lock is replaced (it was always a placeholder). Presence/cursors are additive UI.

**Alternatives rejected.** (a) A separate collaboration backend — wasteful; the op-log already fits. (b) Keep single-writer forever — forecloses a planned capability.

---

### ADR-0034 — Adaptive layouts: opt-in authored base + explicit rules
**Status:** Accepted (introduced Phase 8, candidate)

**Context.** Per-device-class authored layouts (ADR-0017) avoid ugly auto-reflow but require authoring per class. Some users want broader coverage from less authoring.

**Decision.** Adaptive layout is **opt-in and explicit**: one **authored base** layout plus **author-written adaptation rules** (show/hide by tag, re-flow within a target grid, swap widget variants) that **derive** per-class layouts (normal documents, so rendering/op-log/reflection are unchanged). **ADR-0017 remains the default**; adaptive and per-class authoring coexist per profile, and derived layouts can be hand-tweaked.

**Consequences.** Breadth for users who accept compromise, without imposing silent reflow on everyone or breaking the dense-UI default. Author stays in control (rules, not inference).

**Alternatives rejected.** (a) Silent auto-reflow as default — breaks dense neon UIs (the original rejection). (b) No adaptive option ever — leaves multi-form-factor users authoring everything by hand.

---

### ADR-0035 — Cross-engine multi-bind & switching (not federation)
**Status:** Accepted (introduced Phase 8, candidate)

**Context.** A user may own several engines (desktop + laptop) and want one device to reach all of them. The product's core value is "no confusion which device/engine."

**Decision.** A device may **bind multiple engines** (identity already supports it — trust is a set keyed by engine UUID, ADR-0008 §3.3) and **switch** between them, with **one active engine at a time** and an **always-visible active-engine label**. This is **switching, not federation** — engines are never merged; each stays isolated and authoritative (ADR-0002). Bound engines may be LAN or remote (the endpoint abstraction handles both).

**Consequences.** Multi-engine convenience without reintroducing ambiguity. Mostly client-side session management over existing identity/transport.

**Alternatives rejected.** (a) Federating/merging engine state — recreates the exact confusion the product exists to avoid. (b) One-engine-per-device only — needlessly limiting for multi-machine users.

---

*End of Architecture Decision Log (Draft v0.5). 35 decisions recorded. Append new ADRs here as decisions are made; update the index and any superseded statuses.*

---



<a id="document-2e-trd-security-identity"></a>

# Document 2E — TRD: Security & Identity

## CyberDeck — TRD 2E: Security & Identity

**Subsystem TRD · Document 2E** · Version 0.1 (Draft) · June 2026
Inherits conventions from TRD Master §6. Governing ADRs: **0008, 0009, 0016** (also 0005 for the privileged channel, 0006 for plugin permissions).

### Contents
1. Scope & responsibilities
2. Identity model & key management
3. Pairing handshake (wire sequence)
4. Session security
5. Permission model
6. Audit log
7. Secret storage (per-OS)
8. Threat model
9. Normative requirements

---

### 1. Scope & responsibilities

This subsystem owns: device/engine **identity** (keypairs + UUIDs), **pairing** (trust establishment), **session crypto** (handshake → keys; the byte-level transport framing is 2A), the **permission model** the engine enforces on every action, the **audit log**, and **secret storage** for integration credentials. It does **not** own discovery (2A), the action registry (2B), or plugin sandboxing internals (2F) — but it defines the permission contract those enforce.

### 2. Identity model & key management (ADR-0008)

#### 2.1 Identities
Two identity kinds, structurally identical:
- **Engine identity** — one per engine install. `{ uuid, ed25519_keypair, label, created_at }`.
- **Device identity** — one per client device (and the Desktop UI is itself a local device identity). Same shape.

Generated **once at first launch**, before and independent of any account (ADR-0016). The UUID is a random 128-bit value; the keypair is Ed25519 (signing/verification) with an X25519 key derived for ECDH session-key agreement.

#### 2.2 Storage of one's own keys
The private key never leaves the device and is stored in the OS secure store (§7). The UUID + public key + label are stored in SQLite (engine side) / platform secure prefs (client side). Loss of the private key = identity reset (re-pair required); documented, not recoverable by design (no key escrow in V1).

#### 2.3 The trust table (engine side, SQLite — see 2B schema)
Pairing writes a **trust record** per known device:
```
devices
-------
uuid            TEXT PK
label           TEXT
public_key      BLOB        -- the device's Ed25519 public key (the identity anchor)
device_class    TEXT
permissions     TEXT(json)  -- §5
locator_hints   TEXT(json)  -- {lastIp, hostname} — hints only, never identity
revoked         INTEGER     -- 0/1
paired_at       INTEGER
last_seen       INTEGER
```
Trust = "I hold your public key and have marked you paired." IP/MAC are never consulted for trust decisions.

### 3. Pairing handshake (ADR-0008, ADR-0009)

Pairing must: prove the device possesses its private key, prove the engine is the intended one (anti-MITM), and authorize the device (anti-rogue). Three entry methods feed one handshake.

#### 3.1 Entry methods
| Method | Carries | Anti-rogue control | Anti-MITM control |
|--------|---------|--------------------|-------------------|
| **QR** (primary) | engine addr(s), port, **short-lived single-use pairing token**, engine pubkey **fingerprint** | token | fingerprint match |
| **Manual** | user-typed addr + port | **PIN** shown on engine, entered on device | fingerprint shown for visual confirm |
| **mDNS-initiated** | discovered addr + fingerprint (TXT) | falls back to PIN/token approval on engine | fingerprint from TXT |

The pairing token and PIN are issued by the engine and surfaced **only via the privileged local control channel** (ADR-0005) — i.e. on the host's own Desktop UI/tray. A LAN client can never mint its own authorization.

#### 3.2 Handshake sequence
```
Device                                Engine
  │  (has: engine addr, token|PIN, engine fingerprint)
  │ ── ClientHello ─────────────────►  { device_uuid, device_pubkey,
  │                                       proto_v, token|pin_ref }
  │                                     · validate token (single-use, unexpired)
  │                                       OR await local PIN approval
  │ ◄── ServerHello ───────────────── { engine_uuid, engine_pubkey, nonce_e }
  │   · verify engine_pubkey fingerprint == expected (from QR/TXT/visual)
  │ ── KeyConfirm ──────────────────► { nonce_d,
  │                                       sig_d = Sign(privD, nonce_e‖nonce_d) }
  │                                     · verify sig_d with device_pubkey
  │                                       (proves device holds its private key)
  │ ◄── PairResult ────────────────── { sig_e = Sign(privE, nonce_d‖nonce_e),
  │                                       assigned_class?, default_perms }
  │   · verify sig_e  (proves engine holds its private key)
  │                                     · write trust record (§2.3)
  │  ── both derive session keys (ECDH over X25519) ──►  Session (§4)
```
On success both sides persist the trust relationship; subsequent connects skip token/PIN and go straight to a mutually-authenticated session (§4) using stored public keys.

#### 3.3 Re-pair / multi-engine
A device may hold trust records for **multiple engines** (ADR-future cross-engine seam): trust is a set, keyed by engine UUID. Re-pairing an existing device refreshes its record; it does not duplicate identity.

### 4. Session security (ADR-0009)

- **Every session is encrypted and authenticated**, including on LAN. No plaintext mode exists.
- **Key agreement**: ECDH (X25519) using the paired long-term keys + per-session ephemeral keys → forward-secret session keys. (Exact suite — e.g. an established AEAD like ChaCha20-Poly1305 — fixed in the 2A wire spec; this subsystem mandates *that* it is authenticated + forward-secret, 2A mandates *how* it's framed.)
- **Mutual authentication**: each side proves possession of the long-term private key whose public half is in the other's trust table. A device whose public key isn't a (non-revoked) trust record is rejected at handshake.
- **Reconnect** reuses the trust record (no re-pair) but performs a fresh ephemeral key agreement (forward secrecy per session).
- **Privileged local control channel** (loopback, ADR-0005): authenticated as the local engine identity; bound to loopback only; carries service lifecycle + pairing approval + audit access. A network endpoint can never be routed to it.

### 5. Permission model

#### 5.1 Shape (stored per device, §2.3 `permissions`)
```jsonc
{
  "allowPowerActions": false,
  "allowedCategories": ["media", "home", "notifications"],   // action categories
  "deniedActions": ["system.killprocess"],                    // explicit denies override category allow
  "allowEditTrigger": true                                    // may put its session into edit/preview mode
}
```

#### 5.2 Enforcement points
Permissions are enforced **at the engine, on every interaction event** (TRD Master DF-B) — never trusted to the client/layout. The check order:
```
1. Session authenticated & device not revoked?      → else reject
2. Target action's category ∈ allowedCategories?    → else reject
3. Action ∉ deniedActions?                           → else reject
4. Action is destructive & allowPowerActions==false? → reject
5. Plugin providing the action has its own perms?    → host enforces (2F)
→ execute, then audit (§6)
```
A layout containing a forbidden action simply produces rejected taps on that device — the layout need not be device-specific for safety; the engine is the gate.

#### 5.3 Revocation
Setting `revoked=1` causes the device's key to be rejected at the next handshake and any live session to be torn down. Instant, no key rotation needed (the device's own key is simply no longer trusted).

### 6. Audit log (ADR-0014)

Append-only; the durable record of who did what. Schema (2B owns the DB; this subsystem owns semantics):
```
audit_log
---------
id            INTEGER PK
ts            INTEGER         -- epoch ms UTC
actor         TEXT            -- device uuid | "local-ui" | "system" | "flow:<id>"
event_type    TEXT            -- action.executed | action.rejected | device.paired
                              --  | device.revoked | flow.run | flow.failed
                              --  | permission.denied | session.opened | session.closed
resource_type TEXT            -- action | flow | device | session
resource_id   TEXT
payload_json  TEXT            -- type-specific detail; secrets redacted
```
- **Every executed and every rejected action is logged** (FR-4.4) with actor + resource.
- Secrets/tokens are **never** written (redacted `[REDACTED]`).
- Searchable via SQL; an audit-search/export UI is Phase 6 (D14-08) but the data is captured from V1.

### 7. Secret storage (per-OS)

Integration credentials (e.g. a Home Assistant token, Phase 4) and the local private keys live in the **OS secure store**, never in `config.json`, SQLite, or logs:

| OS | Mechanism |
|----|-----------|
| Windows | Windows Credential Manager (DPAPI-backed) |
| macOS | Keychain Services |
| Linux | Secret Service API (libsecret / GNOME Keyring / KWallet); documented fallback to an encrypted file with a clear group-policy note where no keyring exists |

Fallback (headless Linux with no Secret Service) uses an encrypted local file keyed by a machine-bound secret, with an explicit security caveat in operator docs. Never silent plaintext.

### 8. Threat model

| Threat | Vector | Mitigation |
|--------|--------|------------|
| LAN sniffing | Shared Wi-Fi | All traffic encrypted (ADR-0009) |
| MITM during pairing | Spoofed engine | Fingerprint verification (QR/TXT/visual) before key confirm |
| Rogue device pairing | Attacker on LAN attempts pair | Single-use short-lived token / local PIN approval via privileged channel |
| Replay | Captured handshake re-sent | Per-session nonces + ephemeral keys; signatures bind both nonces |
| Compromised device | Stolen paired tablet | Per-device permissions limit blast radius; instant revocation |
| Malicious flow content | Shared/imported flow | Sandboxed expressions, no eval; side effects only via permission-gated actions (ADR-0013) |
| Privilege escalation from LAN | Client tries host control | Privileged control = loopback-only, never network-routable (ADR-0005) |
| Credential theft | Reading config/logs | Secrets only in OS secure store; redacted in logs |
| Data exfiltration | Plugin phones home | Out-of-process perms + no-exfiltration policy; HTTPS-only integrations; (sandbox/signing Phase 6) |
| Key loss | Lost private key | Re-pair required; documented; no escrow (reduces attack surface) |

Out of scope for V1 threat model (revisit with remote phase): relay-server compromise, NAT-traversal abuse, multi-tenant isolation.

### 9. Normative requirements

| ID | Requirement | Trace |
|----|-------------|-------|
| TE-ID-1 | Each device/engine SHALL generate an Ed25519 keypair + 128-bit UUID at first launch, independent of any account. | ADR-0008/0016, FR-2.1 |
| TE-ID-2 | Private keys SHALL be stored in the OS secure store and SHALL NOT leave the device. | ADR-0008 |
| TE-ID-3 | Trust SHALL be the stored public-key relationship; IP/MAC SHALL be locator hints only. | ADR-0008, FR-2.4 |
| TE-PAIR-1 | Pairing SHALL prove device key possession, verify engine fingerprint, and authorize via single-use token or local PIN. | FR-2.3 |
| TE-PAIR-2 | Pairing tokens/PINs SHALL be issued only via the privileged local control channel. | ADR-0005, FR-2.6 |
| TE-PAIR-3 | Pairing tokens SHALL be single-use and time-limited. | §3.1 |
| TE-SEC-1 | All sessions SHALL be encrypted, authenticated, and forward-secret, including on LAN. | ADR-0009, FR-5.1, NFR-11 |
| TE-SEC-2 | A device whose public key is absent or revoked SHALL be rejected at handshake. | §4, FR-4.3 |
| TE-SEC-3 | The privileged control channel SHALL bind to loopback only and SHALL NOT be network-routable. | ADR-0005 |
| TE-PERM-1 | The engine SHALL enforce per-device permissions on every interaction event, regardless of layout content. | FR-4.1/4.2 |
| TE-PERM-2 | Destructive actions SHALL be denied to devices without `allowPowerActions`. | FR-4.1 |
| TE-PERM-3 | Revocation SHALL reject the device at next handshake and tear down live sessions. | FR-4.3 |
| TE-AUD-1 | Every executed and rejected action SHALL be appended to the audit log with actor, type, resource, timestamp. | FR-4.4, ADR-0014 |
| TE-AUD-2 | Secrets/tokens SHALL never be written to the audit log or any log. | §6/§7 |
| TE-STO-1 | Integration credentials SHALL be stored in the OS secure store, never in config files, SQLite, or logs. | §7 |

---
*End of TRD 2E (Draft v0.1). Wire-level framing/crypto suite specifics are fixed in 2A §4. Plugin permission enforcement detail is in 2F.*

---



<a id="document-2a-trd-transport-connectivity"></a>

# Document 2A — TRD: Transport & Connectivity

## CyberDeck — TRD 2A: Transport & Connectivity

**Subsystem TRD · Document 2A** · Version 0.1 (Draft) · June 2026
Inherits TRD Master §6. Governing ADRs: **0009, 0010, 0011, 0015** (pairing/crypto semantics in 2E).

### Contents
1. Scope & responsibilities
2. Endpoint abstraction (LAN now → relay later)
3. Discovery
4. Connection lifecycle & state machine
5. Wire protocol (framing, envelope, crypto suite)
6. The three channels
7. Resilience (heartbeat, reconnect, degradation, resync)
8. Multi-session fan-out
9. Normative requirements

---

### 1. Scope & responsibilities

Owns: how bytes move between engine and devices (and engine↔Desktop UI over loopback). Discovery, the endpoint abstraction, connection lifecycle, wire framing, the crypto suite (the *how* behind 2E's mandates), the three logical channels, and resilience. Does **not** own trust decisions (2E) or message *semantics* (2B/2C/2D); it carries their payloads.

### 2. Endpoint abstraction (ADR-0010 — the forward-compat seam)

All addressing flows through a single interface:
```go
type TransportEndpoint interface {
    Dial(ctx) (Conn, error)      // open a raw transport connection
    Describe() EndpointInfo       // kind, address(es), reachability
}
type ConnectionManager interface {
    Resolve(deviceUUID) ([]TransportEndpoint, error) // ordered candidates
    Open(deviceUUID) (Session, error)                // resolve → dial → handshake → session
}
```
**V1**: `Resolve` returns `LanEndpoint`s (direct sockets) built from locator hints + discovery. **Remote phase**: adds `RelayEndpoint`; `Resolve` may return it as an additional candidate. **Nothing above `ConnectionManager`** (sessions, channels, engine, document model) knows the endpoint kind. This is the seam that makes remote additive, not a rewrite.

Endpoint **candidate ordering** (V1): last-known direct IP → mDNS-resolved address → active-scan result. (Remote phase appends relay as a lower-priority candidate so LAN stays preferred when both are reachable.)

### 3. Discovery (FR-2.2, FR-2.5)

| Mechanism | Role | Detail |
|-----------|------|--------|
| **mDNS / DNS-SD** | Primary zero-config | Engine advertises `_cyberdeck._tcp.local`, TXT = `{name, uuid, ver, fp}` (fp = engine pubkey fingerprint, used for anti-MITM at pair). Clients browse to find hosts. |
| **QR** | Fast trusted pair | Encodes candidate addrs + port + token + fp (2E §3). |
| **Manual** | Multicast-blocked nets | User types addr:port; PIN confirms (2E). |
| **Active scan** | Relocate known device | If last IP fails and mDNS silent, bounded subnet sweep attempting handshake; **UUID in the handshake confirms identity** (not IP). Rate-limited, opt-in, bounded to the local subnet. |

Enterprise reality: mDNS is often blocked or VLAN-isolated, so manual + active-scan fallbacks are **required**, not optional (a documented incumbent failure mode).

### 4. Connection lifecycle & state machine

```
        ┌─────────┐  discover/known        ┌────────────┐
        │  IDLE   │ ─────────────────────► │ RESOLVING  │
        └─────────┘                        └─────┬──────┘
             ▲                                    │ endpoint chosen
             │ give up (user)                     ▼
        ┌────┴────────┐   backoff expired   ┌────────────┐
        │ DISCONNECTED│ ◄────────────────── │  DIALING   │
        └────┬────────┘                     └─────┬──────┘
             │                                    │ tcp ok
             │ reconnect                           ▼
             │                              ┌────────────┐  not trusted/ revoked
             │                              │ HANDSHAKE  │ ───────────────► FAIL→DISCONNECTED
             │                              └─────┬──────┘
             │                                    │ session keys (2E)
             │                                    ▼
             │  drop / heartbeat-miss      ┌────────────┐
             └──────────────────────────── │ CONNECTED  │ (runtime or edit mode)
                                            └────────────┘
```
On drop from `CONNECTED`: → `RESOLVING` (reconnect path) with exponential backoff; if direct fails → mDNS rediscovery → active scan; on success a fresh forward-secret session is established (2E §4). UI reflects each state via the connection badge.

### 5. Wire protocol

#### 5.1 Framing
- Transport: TCP (LAN). One **length-prefixed** frame per message: `uint32 length ‖ ciphertext`. (Length-prefix chosen over newline-delimited so binary-safe ciphertext needs no escaping; the JSON payload lives *inside* the encrypted frame.)
- After handshake, every frame's payload is AEAD-encrypted with the session key.

#### 5.2 Envelope (TRD Master §6.3, JSON for V1 — ADR-0015)
Decrypted payload is the shared envelope:
```jsonc
{ "v":1, "ch":"state|layout|preview|control", "type":"…", "seq":10432, "ts":1719000000, "payload":{…} }
```
`seq` is **per-channel monotonic**, enabling gap detection (§7.4). The `Serializer` abstraction wraps encode/decode so a future binary codec (MessagePack/CBOR) can replace JSON **per channel** — realistically only the State channel ever would (ADR-0015).

#### 5.3 Crypto suite (the *how* for 2E §4)
- Handshake key agreement: **X25519 ECDH** (paired long-term keys + per-session ephemerals) → forward-secret shared secret → HKDF → directional AEAD keys.
- Record encryption: an established **AEAD** (e.g. ChaCha20-Poly1305) with per-direction nonce counters.
- Mutual auth: Ed25519 signatures over handshake nonces (2E §3.2).
- Loopback (Desktop UI): same suite; the privileged control channel additionally restricted to loopback bind (2E §4).

### 6. The three channels (ADR-0011)

One session multiplexes three logical channels (the `ch` field); they differ by cadence and durability, not by socket.

| Channel | Dir | Payload (owned by) | Cadence | Durability | Backpressure policy |
|---------|-----|--------------------|---------|-----------|---------------------|
| **State** | E→C | delta state updates (2B) | 0.5–10s/state | ephemeral | coalesce: newest value wins; drop stale |
| **Layout** | E↔C | versioned ops (2C) down; interaction/action events (2B/2C) up | on edit / on tap | durable, ordered | never dropped; ordered delivery; gap→resync |
| **Preview** | E→C | throttled drag ghosts (2C) | 30–60 Hz | never persisted | drop-on-overflow; latest-only |
| **Control** | UI↔E | service lifecycle, pairing approval, audit (2E) | rare | n/a | loopback-only |

Rationale: a per-second CPU update (State, droppable) must never block or pollute a layout op (Layout, durable, ordered). Coalescing State means a slow client gets the *latest* value, not a backlog.

### 7. Resilience (the #1 incumbent pain — directly targeted)

#### 7.1 Heartbeat / keepalive (FR-5.2)
Bidirectional heartbeat at a fixed interval keeps the session warm and detects silent death. The engine treats a device as alive across OS sleep windows by tolerating heartbeat gaps up to a grace bound before declaring drop — avoiding the spurious disconnects that plague the incumbents.

#### 7.2 Reconnect (FR-5.3)
Exponential backoff (capped) on the reconnect loop: direct last-IP → mDNS rediscovery → active scan. Each attempt re-runs the full lifecycle (§4). Target: reconnect < 5s under normal LAN conditions (NFR-05).

#### 7.3 Graceful degradation (FR-5.4)
On drop, the client does **not** freeze or lie: bound widgets render their **last value dimmed** with a **connection badge** (`connected` / `degraded` / `disconnected`), and any capability that was `unavailable` stays `--`. No false "live" data.

#### 7.4 Versioned resync (FR-5.5, ADR-0012)
Each channel carries `seq`; the Layout channel additionally carries the document version. A client detecting a `seq` gap (missed messages during a blip) **requests a full document resync at the current version** rather than attempting to replay missing ops. The engine, being the single source of truth (ADR-0002), answers authoritatively. State channel needs no resync (next tick supersedes).

### 8. Multi-session fan-out (NFR-10)

The engine maintains an **independent session per device** (per-session goroutines in Go — ADR-0005). State deltas are computed once and fanned out to each session's State channel filtered by that session's **subscriptions** (a client only receives states its current layout binds). Layout ops are fanned out only to sessions whose device is assigned the edited profile and in edit/preview mode. Target: ≥8 concurrent sessions with no degradation (NFR-10); the per-session model scales linearly with cores.

Subscription model: on layout assignment/op, the client's set of bound state IDs is known to the engine; the engine sends deltas only for subscribed states (reinforcing the ~80% idle-traffic reduction from delta broadcast).

### 9. Normative requirements

| ID | Requirement | Trace |
|----|-------------|-------|
| TA-EP-1 | All addressing SHALL flow through `TransportEndpoint`/`ConnectionManager`; no component above it SHALL know the endpoint kind. | ADR-0010 |
| TA-EP-2 | V1 endpoints SHALL resolve to direct LAN sockets; a relay endpoint type SHALL be addable without changes above the ConnectionManager. | ADR-0010 |
| TA-DISC-1 | The engine SHALL advertise via mDNS with name/uuid/version/fingerprint TXT records. | FR-2.2 |
| TA-DISC-2 | Manual and active-scan fallbacks SHALL exist for multicast-blocked networks; active scan SHALL confirm identity by UUID. | FR-2.5 |
| TA-WIRE-1 | Messages SHALL be length-prefixed frames; post-handshake payloads SHALL be AEAD-encrypted. | ADR-0009 |
| TA-WIRE-2 | All messages SHALL use the shared envelope with per-channel monotonic `seq`. | Master §6.3, ADR-0012 |
| TA-WIRE-3 | Encode/decode SHALL go through the `Serializer` abstraction (JSON in V1) to allow a per-channel binary codec later. | ADR-0015 |
| TA-CRYP-1 | Sessions SHALL be forward-secret via per-session ephemeral X25519 agreement. | ADR-0009, 2E TE-SEC-1 |
| TA-CH-1 | The session SHALL multiplex State, Layout, Preview channels (+ Control on loopback). | ADR-0011 |
| TA-CH-2 | State channel SHALL coalesce (latest-wins, droppable); Layout channel SHALL be ordered and lossless. | ADR-0011 |
| TA-CH-3 | Preview messages SHALL be droppable and SHALL NOT be persisted. | ADR-0011 |
| TA-RES-1 | The transport SHALL maintain heartbeat tolerant of OS-sleep gaps within a grace bound. | FR-5.2 |
| TA-RES-2 | On drop, reconnect SHALL use backoff → mDNS → active scan; target <5s on LAN. | FR-5.3, NFR-05 |
| TA-RES-3 | On disconnect, the client SHALL show last value dimmed + connection badge; never frozen/false live data. | FR-5.4 |
| TA-RES-4 | A client detecting a Layout `seq` gap SHALL request a full document resync. | FR-5.5, ADR-0012 |
| TA-FAN-1 | The engine SHALL maintain an isolated session per device and fan out deltas filtered by subscription. | FR-3.1, NFR-10 |

---
*End of TRD 2A (Draft v0.1). Crypto suite specifics (exact KDF/AEAD params) and relay-endpoint wire details to be deepened on review or at the remote phase.*

---



<a id="document-2b-trd-engine-core"></a>

# Document 2B — TRD: Engine Core

## CyberDeck — TRD 2B: Engine Core

**Subsystem TRD · Document 2B** · Version 0.1 (Draft) · June 2026
Inherits TRD Master §6. Governing ADRs: **0002, 0005, 0014, 0019** (registries also feed 2C/2D/2F).

### Contents
1. Scope & responsibilities
2. State store
3. Registries (action / widget-type / flow-node)
4. Event bus
5. Session & profile model
6. Persistence (SQLite schema)
7. Service lifecycle & supervision
8. Normative requirements

---

### 1. Scope & responsibilities

The engine core is **deliberately small** (ADR-0006): it owns the **state store**, the **registries**, the **event bus**, the **session/profile model**, **persistence (SQLite)**, and **service lifecycle** — plus it *hosts* (but does not implement) transport (2A), security (2E), flow engine (2D), layout store (2C), and the plugin host (2F). It contains **no capability-specific business logic**; all capabilities are plugins (ADR-0006).

### 2. State store (ADR-0019)

#### 2.1 Model
The authoritative, in-memory registry of all current state values.
```go
type State struct {
    ID        string      // "system.cpu.temp"
    Kind      StateKind   // scalar | text | boolean | enum | series
    ValueType string      // number | string | bool
    Unit      string      // presentation hint only ("°C")
    Value     any         // TYPED native value (42.0), not "42.0 °C"  (ADR-0019)
    Series    *RingBuffer // non-nil for Kind==series (in-memory, e.g. 60 samples)
    UpdatedAt int64
    Source    string      // "plugin:core.telemetry"
}
```
**Typed values, not formatted strings** (ADR-0019) — so the flow engine can evaluate `system.cpu.temp > 85` numerically and a gauge can use the raw number; units/precision are applied at render time from widget style.

#### 2.2 Update path & delta computation (feeds 2A State channel)
```
provider (plugin) → host IPC → StateStore.Set(id, value)
  → if value unchanged: no-op (delta suppression)
  → else: update value+UpdatedAt; if series: push to ring buffer
       → mark dirty
       → emit to event bus (threshold checks, flow stateChange triggers)
       → enqueue delta for fan-out (2A): only dirty states, only to subscribers
```
**Delta broadcasting** (only changed states) and **per-session subscription filtering** together produce the ~80% idle-traffic reduction. Series ring buffers live **only in memory** and are never persisted (ADR-0014).

#### 2.3 Subscriptions
Each session declares the set of state IDs its current layout binds (derived by 2C from the layout doc). The store fans a delta to a session only if that state ∈ its subscription set.

#### 2.4 Variables as states (`var.*`)
User variables (2D) are first-class states under the `var.` namespace — durable (SQLite, §6), typed, and **bindable by widgets** like any other state. A flow writing `var.mic_muted` updates the state store, which fans out and triggers any watchers, exactly like telemetry.

### 3. Registries (schema-driven — the keystone)

Three parallel registries; all schema-driven, all populated by plugins (first-party and third-party identically — ADR-0006). The **designer reads these schemas to auto-generate its UI** (2C); this is what unifies the plugin ecosystem and the designer.

#### 3.1 Action registry
```jsonc
{ "id":"media.volume.set", "label":"Set System Volume", "category":"media",
  "source":"plugin:core.media",
  "params":[ {"name":"level","type":"int","min":0,"max":100,"required":true} ],
  "confirmation":false, "destructive":false }
```
Param types (V1): `int, float, string, bool, choice, color, entity, file, folder, duration`. `category` + `destructive` feed the permission model (2E §5). Numeric `min/max` are validated by the engine on action receipt (clamp or reject per schema).

#### 3.2 Widget-type registry
```jsonc
{ "type":"gauge.circular", "label":"Circular Gauge", "source":"builtin",
  "acceptsStateKinds":["scalar"],
  "configSchema":[ {"name":"min","type":"float","default":0}, {"name":"max","type":"float","default":100},
                   {"name":"unit","type":"string","default":""}, {"name":"sparkline","type":"bool","default":false} ],
  "gestures":["tap","longPress"] }
```
`acceptsStateKinds` lets the designer offer only compatible states when binding. `gestures` declares which interaction slots the type exposes.

#### 3.3 Flow-node registry (feeds 2D)
Core nodes are registered like actions; plugins may add nodes later (Phase 6). Each declares its kind, params schema, and execution contract handle.

#### 3.4 Registration & merge
Plugins declare contributions in their manifest (2F). The host validates against the schema-of-schemas and merges into the global registries; ID collisions are rejected with a diagnostic. Registries are queryable (e.g. "all actions in category media", "all widgets accepting scalar states") — backing the designer's pickers.

### 4. Event bus

Internal pub/sub decoupling producers (state changes, plugin events, lifecycle) from consumers (flow triggers, threshold alerts, audit, fan-out).
- **Events**: `state.changed`, `threshold.crossed` (cpu/gpu/ram), `device.*`, `plugin.*`, `session.*`, `flow.*`.
- The **flow engine subscribes** for `event` and `stateChange` triggers (2D §triggers); the **audit log subscribes** for governance; **fan-out** subscribes for client delivery.
- In-process, ordered per topic, non-blocking (slow consumers get a bounded queue; overflow policy logged).

### 5. Session & profile model (ADR-0002)

#### 5.1 Sessions
One **session per connected device** (created by 2A post-handshake, identity from 2E). Holds: device UUID, permissions snapshot, active profile, subscription set, mode (`runtime` | `edit/preview`). **Isolated** — two sessions never share mutable state, which is what guarantees "no confusion which device" and lets two tablets show different profiles simultaneously (FR-3.1/3.2).

#### 5.2 Profiles & activation
A **profile** is a named set of pages with an optional **activation rule**. V1 stores the rule and provides the **evaluation hook**; the consumer that auto-switches on app focus is Phase 2 (foundation seam per Doc 0 §12).
```jsonc
{ "id":"profile_game", "label":"Gaming",
  "activationRule": { "kind":"appFocus", "match":"Cyberpunk2077.exe" },  // evaluated, not yet auto-applied in V1
  "pages":[ "page_dash", "page_stats" ] }
```
A session has one active profile at a time; `navigate` (widget or flow) switches page/profile within the session.

### 6. Persistence — SQLite schema (ADR-0014)

Single embedded SQLite file; durable data only (live state is in-memory, §2). Append-only audit log. Tables:

```sql
-- documents: profiles, pages, widgets serialized as the layout doc tree (2C owns shape)
documents(
  id TEXT PRIMARY KEY, kind TEXT,            -- 'profile' | 'page'
  device_class TEXT, version INTEGER,         -- monotonic doc version (2C/ADR-0012)
  body_json TEXT, updated_at INTEGER );

-- registry_items: merged registry contributions (action/widget/flow-node)
registry_items(
  id TEXT PRIMARY KEY, kind TEXT,             -- 'action'|'widget'|'flownode'
  source TEXT, schema_json TEXT, version INTEGER );

-- variables: var.* — typed, durable
variables(
  name TEXT PRIMARY KEY, value_type TEXT, value_json TEXT, updated_at INTEGER );

-- workflows: flows (2D owns shape)
workflows(
  id TEXT PRIMARY KEY, label TEXT, version INTEGER, body_json TEXT, updated_at INTEGER );

-- devices: trust + permissions (2E owns semantics)
devices(
  uuid TEXT PRIMARY KEY, label TEXT, public_key BLOB, device_class TEXT,
  permissions_json TEXT, locator_hints_json TEXT, revoked INTEGER, paired_at INTEGER, last_seen INTEGER );

-- accounts: optional cloud overlay (Phase 7); references device UUIDs, never owns identity (ADR-0016)
accounts(
  id TEXT PRIMARY KEY, email TEXT, tier TEXT, created_at INTEGER );

-- audit_log: append-only (2E §6 owns semantics)
audit_log(
  id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER, actor TEXT,
  event_type TEXT, resource_type TEXT, resource_id TEXT, payload_json TEXT );

-- meta: schema/config versioning for migrations
meta( key TEXT PRIMARY KEY, value TEXT );
```
- `body_json`/`schema_json`/`*_json` hold the typed structures the owning subsystems define; SQLite gives indexing, transactions, and the history queries the audit log needs (ADR-0014).
- **Migrations** run on startup keyed by `meta.schema_version`; forward-only with documented steps (Master §6.4).
- Secrets are **never** here (2E §7).

### 7. Service lifecycle & supervision (ADR-0005)

#### 7.1 Boot
```
OS service start → load config.json + open SQLite (migrate if needed)
  → init core (state store, registries, event bus, session mgr)
  → start plugin host → launch bundled first-party plugins (2F)
     → plugins register contributions → registries populated
  → start transport (2A): bind LAN listener + loopback control + mDNS advertise
  → ready (state broadcast begins as sessions connect)
```
Target: connect-ready quickly; first-state-broadcast within a few seconds of a session opening (carried perf goal).

#### 7.2 Run / shutdown
- The engine runs headless as a service, **independent of the Desktop UI** (closing the UI does not stop it — ADR-0005).
- Graceful shutdown: stop accepting sessions → flush durable writes → stop plugins (SIGTERM then kill) → close SQLite.
- Crash of the **engine** → OS service manager restarts it; clients see disconnect → reconnect (2A §7). Crash of a **plugin** → host restarts that plugin only; engine unaffected (2F).

#### 7.3 Config
`config.json` (non-secret) holds intervals, thresholds, HA base URL, display prefs (schema in Doc 0 §16 carried). Hot-reload via file watcher is a later nicety (Doc 0 §12); V1 reads at startup.

### 8. Normative requirements

| ID | Requirement | Trace |
|----|-------------|-------|
| TB-ST-1 | State values SHALL be stored typed; display formatting SHALL be a render-time concern. | ADR-0019, FR-6.1/6.4 |
| TB-ST-2 | Only changed states SHALL be enqueued for fan-out (delta). | FR-6.2 |
| TB-ST-3 | Series/ring-buffer state SHALL be in-memory only and SHALL NOT be persisted. | ADR-0014, FR-6.5 |
| TB-ST-4 | A delta SHALL be sent to a session only if the state is in that session's subscription set. | FR-3.1 |
| TB-VAR-1 | `var.*` SHALL be typed, durable (SQLite), and bindable as states. | ADR-0014, FR-10.4 |
| TB-REG-1 | Actions, widget types, and flow nodes SHALL be schema-declared and plugin-populated via one registration path (first-party = third-party). | ADR-0006, FR-7.1/9.1 |
| TB-REG-2 | The registries SHALL be queryable to drive the designer's auto-generated UI. | FR-7.2 |
| TB-REG-3 | ID collisions on registration SHALL be rejected with a diagnostic. | §3.4 |
| TB-SES-1 | The engine SHALL maintain one isolated session per device, each with its own profile/subscriptions/permissions/mode. | ADR-0002, FR-3.1/3.3 |
| TB-SES-2 | Multiple sessions SHALL be able to display different profiles simultaneously without interference. | FR-3.2 |
| TB-PRF-1 | Profiles SHALL carry an activation rule field with an engine evaluation hook in V1 (auto-switch consumer deferred). | Doc 0 §12, FR-3 |
| TB-PER-1 | All durable data SHALL be in one SQLite store; the audit log SHALL be append-only. | ADR-0014 |
| TB-PER-2 | Schema migrations SHALL run on startup keyed by a stored schema version. | Master §6.4 |
| TB-PER-3 | Secrets SHALL NOT be stored in SQLite or config files. | 2E §7 |
| TB-LIF-1 | The engine SHALL run as a background service independent of the Desktop UI and restart on crash via the OS service manager. | ADR-0005, FR-1.1/1.2 |
| TB-LIF-2 | A plugin crash SHALL NOT crash the engine. | NFR-07, ADR-0006 |

---
*End of TRD 2B (Draft v0.1). Layout doc `body_json` shape is 2C; flow `body_json` shape is 2D; plugin registration/IPC is 2F.*

---



<a id="document-2f-trd-plugin-architecture"></a>

# Document 2F — TRD: Plugin Architecture

## CyberDeck — TRD 2F: Plugin Architecture

**Subsystem TRD · Document 2F** · Version 0.1 (Draft) · June 2026
Inherits TRD Master §6. Governing ADRs: **0006, 0007** (registries in 2B; capability interfaces in 2G; permissions in 2E).

### Contents
1. Scope & responsibilities
2. The one-model principle
3. Plugin anatomy & manifest
4. Plugin host & process supervision
5. IPC contract
6. Lifecycle & state machine
7. Permissions & enforcement
8. First-party vs third-party (metadata only)
9. SDK & sandboxing (Phase 6 seam)
10. Normative requirements

---

### 1. Scope & responsibilities

Owns: the **plugin host** (a core subsystem — 2B), how plugin **processes** are launched/supervised/restarted, the **IPC contract** between host and plugins, the plugin **manifest**, and **permission enforcement** at the host boundary. Defines the contract that **all** capabilities implement (telemetry, media, power, launchers, notifications, FPS, smart home, third-party). Capability *interfaces and provider chains* are 2G; *what gets registered* (action/widget/flow-node schemas) is 2B; *trust metadata and signing policy* is 2E.

### 2. The one-model principle (ADR-0006)

**Every capability outside the engine core runs as an out-of-process plugin, and first-party plugins use the identical contract, lifecycle, IPC, permission model, and isolation as third-party plugins.** Whether a plugin ships from CyberDeck or a community author is **metadata, not architecture** (§8). Consequences that shape this whole document:
- One runtime to build, test, debug, secure.
- A misbehaving plugin can never crash the engine (NFR-07).
- A first-party capability becoming community-extensible is a metadata change, not a rewrite.
- The host exists and runs first-party plugins **in V1** (P0) — it is not deferred to the ecosystem phase.

### 3. Plugin anatomy & manifest

A plugin is a separate executable (Go binary for first-party; any language honoring the IPC contract for third-party) plus a **manifest** declaring its contributions and required permissions.

```jsonc
// plugin.manifest.json
{
  "id": "core.telemetry",
  "version": "1.0.0",
  "apiVersion": 1,                       // host refuses incompatible majors (Master §6.4)
  "origin": "first-party",               // metadata only (§8)
  "entrypoint": { "windows":"telemetry.exe", "darwin":"telemetry", "linux":"telemetry" },
  "permissions": {                        // declared up-front; host enforces (§7)
    "capabilities": ["telemetry.read"],
    "actionCategories": [],
    "network": "none",                    // none | localhost | outbound
    "filesystem": "none"
  },
  "contributes": {
    "states":   [ {"id":"system.cpu.temp","kind":"scalar","valueType":"number","unit":"°C"} ],
    "actions":  [],
    "events":   [ {"id":"threshold.cpu_temp"} ],
    "widgets":  [],                        // plugin-provided widget types (Phase 6)
    "flowNodes":[],                        // plugin-provided nodes (Phase 6)
    "capabilities": [                      // PAL provider-chain entries (2G)
      { "interface":"Telemetry", "providers":["psutil","wmi"] }
    ]
  }
}
```
At load the host validates the manifest, checks `apiVersion`, registers `contributes` into the global registries (2B §3.4), and records declared permissions.

### 4. Plugin host & process supervision

The host (in the engine core) is responsible for the full process lifecycle:
- **Launch**: spawn each plugin process with its working dir and a handshake handle (a loopback IPC endpoint or stdio pipe — §5). Bundled first-party plugins launch at engine boot (2B §7.1); third-party plugins launch on enable (Phase 6).
- **Supervise**: monitor liveness via IPC heartbeat; capture stdout/stderr to per-plugin logs.
- **Restart policy**: on crash, restart with backoff up to a cap; on repeated failure, mark the plugin `faulted` and surface it (its states go `--`, its capabilities become `unavailable` per 2G). The **engine is never affected** (NFR-07).
- **Shutdown**: SIGTERM → grace period → kill; flush plugin logs.

Resource accounting per plugin (CPU/RAM) is tracked toward the engine's overall budget; a noisy plugin can be throttled or faulted (hardening detail Phase 6).

### 5. IPC contract

#### 5.1 Transport
Local IPC over loopback (or stdio pipes), **JSON messages** (ADR-0015) using the shared envelope (Master §6.3) with `ch:"plugin"`. Not the network transport (2A) — this is host↔plugin, same-machine, but uses the same envelope/serializer discipline for consistency.

#### 5.2 Message types
| Direction | Type | Purpose |
|-----------|------|---------|
| host→plugin | `init` | hand over config slice + granted permissions |
| plugin→host | `register` | (redundant safety) re-assert manifest contributions |
| plugin→host | `stateUpdate` | publish a state value → StateStore.Set (2B §2.2) |
| plugin→host | `event` | emit an event → event bus (2B §4) |
| host→plugin | `invokeAction` | execute a registered action with validated params |
| plugin→host | `actionResult` | success/failure + optional return |
| host→plugin | `queryCapability` / plugin→host `capabilityResult` | PAL interface calls (2G) |
| both | `heartbeat` | liveness |
| plugin→host | `log` | structured log line (secrets pre-redacted) |

#### 5.3 Contract guarantees
- Params on `invokeAction` are **already validated** by the engine against the action schema (2B §3.1) — the plugin may trust ranges/types but SHOULD still guard.
- A plugin SHALL NOT receive any state/credential it didn't request via permissions.
- Backpressure: `stateUpdate` is coalesced by the host into the store's delta path; a flooding plugin is rate-limited.

### 6. Lifecycle & state machine

```
   ┌─────────┐ manifest ok      ┌──────────┐ init ack    ┌─────────┐
   │ DISCOVERED│ ───────────────►│ LAUNCHING │ ──────────►│ READY   │
   └─────────┘                   └────┬──────┘            └────┬────┘
        ▲ enable (P6) / boot (1P)     │ launch fail            │ crash / exit
        │                             ▼                        ▼
   ┌────┴─────┐  repeated fail  ┌──────────┐  restart      ┌──────────┐
   │ DISABLED │ ◄────────────── │ FAULTED  │ ◄──────────── │RESTARTING│
   └──────────┘                 └──────────┘                └──────────┘
```
`READY` plugins serve capability calls and publish states. `FAULTED` plugins have their contributions kept in the registries (so layouts don't break) but their states read `--` and capabilities are `unavailable` until recovered.

### 7. Permissions & enforcement (with 2E)

- A plugin **declares** required permissions in its manifest (§3); the host **grants** them at load (first-party: defaults trusted; third-party: user-approved at install, Phase 6).
- The host **enforces** at the IPC boundary: a plugin can only publish states it declared, only expose actions it registered, and only access network/filesystem at its declared level.
- **Action-level** device permissions (which device may invoke which category) are enforced by the engine *before* `invokeAction` reaches the plugin (2E §5.2). So there are two gates: device→action (2E) and plugin→capability (here).
- All invocations are audited (2E §6).

### 8. First-party vs third-party — metadata only (ADR-0006)

`origin` and signing status affect **only**:
- **Permission defaults** — first-party bundled plugins are trusted by default; third-party require explicit user approval of their declared permissions.
- **Signing/verification** — third-party plugins are signature-verified (Phase 6); first-party are part of the signed installer.
- **UX/labeling** — provenance shown to the user.

They do **not** affect lifecycle, IPC, isolation, or registration. There is exactly one execution model (§2).

### 9. SDK & sandboxing (Phase 6 seam)

The V1 contract (manifest + IPC + permissions) **is** the SDK surface; Phase 6 publishes it, adds third-party **loading** (discover/install/enable), **signing/verification**, and **sandboxing** (tighter OS-level confinement of plugin processes — e.g. restricted tokens / sandbox profiles per OS). Because first-party already runs on this contract, the SDK is validated by construction (nothing first-party does is off-contract).

### 10. Normative requirements

| ID | Requirement | Trace |
|----|-------------|-------|
| TF-1 | All capabilities outside the engine core SHALL run as out-of-process plugins. | ADR-0006, FR-11.1/11.4 |
| TF-2 | First-party and third-party plugins SHALL share one lifecycle, IPC contract, permission model, and isolation boundary. | ADR-0006, FR-11.1/11.5 |
| TF-3 | A plugin crash SHALL NOT crash the engine; the host SHALL restart per policy and fault on repeated failure. | NFR-07, FR-11.2 |
| TF-4 | A faulted plugin's contributions SHALL remain registered; its states SHALL read `--` and capabilities `unavailable`. | ADR-0007, 2G |
| TF-5 | Plugins SHALL declare required permissions in a manifest; the host SHALL enforce them at the IPC boundary. | FR-11.3 |
| TF-6 | The host SHALL refuse plugins declaring an incompatible `apiVersion` major. | Master §6.4 |
| TF-7 | `invokeAction` params SHALL be engine-validated against the action schema before reaching the plugin. | 2B §3.1, FR-7.4 |
| TF-8 | A plugin SHALL only publish states it declared and access resources at its declared level. | FR-11.3 |
| TF-9 | `origin` (first/third-party) SHALL affect only permission defaults, signing, and UX — never execution model. | ADR-0006, FR-11.5 |
| TF-10 | First-party capabilities SHALL be running through the host in V1 (P0). | Doc 0 Phase 1, FR-11.1 |

---
*End of TRD 2F (Draft v0.1). PAL capability interfaces and provider-chain probing are 2G; registry schemas are 2B; signing/trust policy detail is 2E + Phase 6 deep dive.*

---



<a id="document-2g-trd-platform-abstraction-layer"></a>

# Document 2G — TRD: Platform Abstraction Layer

## CyberDeck — TRD 2G: Platform Abstraction Layer (PAL)

**Subsystem TRD · Document 2G** · Version 0.1 (Draft) · June 2026
Inherits TRD Master §6. Governing ADR: **0007** (plugin host/isolation in 2F; registries in 2B).

### Contents
1. Scope & responsibilities
2. PAL ⟂ plugin host (the relationship)
3. Capability interface model
4. Provider chains: probe → bind → degrade
5. Worked example: the FPS chain
6. Capability catalog & per-OS availability matrix
7. Dependency & licensing register
8. Normative requirements

---

### 1. Scope & responsibilities

The PAL defines, **for each OS- or third-party-backed capability, a single Go interface plus an ordered list of providers** that implement it. It owns: the capability interface definitions, the provider-chain framework (probe/bind/re-probe), and the "unavailable is graceful" contract. It does **not** own process isolation (2F) or what a capability *contributes to registries* (2B) — a capability provider lives inside a plugin process (2F) and may publish states/actions (2B). PAL is *which implementation answers and in what priority*; 2F is *how that code is executed*.

### 2. PAL ⟂ plugin host (ADR-0007)

These are orthogonal and must not be conflated:
- **PAL** = capability **interface + provider priority**. ("FPS comes from native → PresentMon → FrameView → RTSS → vendor → unavailable.")
- **Plugin host (2F)** = **execution + isolation**. ("That provider's code runs in an out-of-process plugin the host supervises.")

They compose: a provider (e.g. the PresentMon FPS provider) is *both* a PAL chain entry *and* code inside a plugin process. The engine core calls a capability interface; the bound provider — inside its plugin — answers over IPC (2F §5). The core never branches on OS.

### 3. Capability interface model

Each capability is one Go interface; the engine calls it without knowing which provider (or OS) satisfies it.
```go
type Telemetry interface {
    CPULoad() (float64, bool)     // value, ok  (ok=false → unavailable)
    CPUTemp() (float64, bool)
    GPULoad() (float64, bool)
    GPUTemp() (float64, bool)
    // …
}
type FPS interface { Current() (int, bool) }
type MediaControl interface { /* play/pause/next/prev/meta */ }
type Power interface { /* shutdown/restart/sleep/… */ }
type Notifications interface { /* subscribe to OS action center */ }
```
The `(value, ok)` shape makes **unavailable** a normal return, never an error/panic. A capability with no bound provider returns `ok=false` for every call; bound states render `--` (2B) and flows can branch on availability (2D).

### 4. Provider chains: probe → bind → degrade

#### 4.1 Declaration
A capability declares an **ordered** provider list (highest priority first), contributed via plugin manifests (2F §3) and merged by the host.
```
Capability "FPS" providers (priority order):
  1 native_app_telemetry   (only if we own the rendering pipeline — usually inert)
  2 presentmon             (Windows; open-source; no overlay; PRIMARY)
  3 frameview
  4 rtss
  5 vendor_api             (NVAPI/ADL — GPU telemetry reliable, per-app FPS not always)
  → unavailable
```

#### 4.2 Probe & bind
At startup (and on a re-probe trigger — hardware/driver/plugin change), the host **probes each provider in priority order** and **binds the first that reports available**. Probing is cheap and side-effect-free (can this provider start? are its deps/permissions present?). The bound provider answers all interface calls until it faults or a re-probe rebinds.

#### 4.3 Degrade
If **no** provider binds, the capability is **unavailable** — not an error, not a crash (ADR-0007). This is the same graceful-degradation contract as a disconnected device or a faulted plugin (2F §6): dependent states read `--`; nothing breaks. A provider that faults at runtime triggers a re-probe (may rebind to a lower-priority provider, or go unavailable).

#### 4.4 Why ordering matters (rationale captured, not implicit)
- **PresentMon is primary on Windows**: open-source, actively maintained, no on-screen overlay to scrape, bundleable (subject to the licensing review in §7) — more stable as a telemetry source than scraping overlay tools.
- **Vendor APIs (NVAPI/ADL) rank *below* PresentMon for FPS** specifically because they reliably expose *GPU* telemetry (load/temp — useful for the Telemetry capability) but **not always per-application FPS**. They're a strong fallback for GPU metrics, a weak one for the FPS number.
- **native_app_telemetry ranks first but is usually inert** — it only applies if CyberDeck measures FPS of its *own* rendered content, which a control-surface product rarely does. Kept as the ideal-when-applicable top entry.

### 5. Worked example: the FPS chain (end to end)

```
Engine wants gaming.fps:
  host.Capability("FPS").Current()
    → bound provider = presentmon (on a Windows host where it probed available)
        → PresentMon plugin reads frame timing → returns (144, true)
    → StateStore.Set("gaming.fps", 144)  (2B)  → delta → State channel (2A) → gauge repaints

On a macOS host:
  probe: native(inert) → presentmon(Windows-only, unavailable) → frameview(unavailable)
         → rtss(unavailable) → vendor(no per-app FPS) → UNAVAILABLE
    → FPS.Current() returns (0, false) → state "gaming.fps" renders "--"
    → a flow with `if {gaming.fps} available` branch simply takes the else path
```
"Unavailable on this OS" is a normal outcome of the chain, not a gap to apologize for.

### 6. Capability catalog & per-OS availability (V1 expectation)

| Capability | Interface | Providers (priority) | Win | macOS | Linux | Phase |
|------------|-----------|----------------------|-----|-------|-------|-------|
| Telemetry (CPU/RAM/net/disk) | `Telemetry` | gopsutil → OS-native | ✓ | ✓ | ✓ | 1 |
| GPU telemetry | `Telemetry` (GPU) | GPUtil → OHM/AMD → vendor (NVAPI/ADL) → unavailable | ✓ | partial | partial | 1 |
| Power actions | `Power` | OS-native (shutdown/restart/sleep/lock) | ✓ | ✓ | ✓ | 1 |
| Media control/metadata | `MediaControl` | SMTC (Win) / MPNowPlaying (mac) / MPRIS (Linux) | ✓ | ✓ | ✓ | 1–2 |
| App launchers | `Launcher` | OS process launch | ✓ | ✓ | ✓ | 1 |
| Notifications (read) | `Notifications` | WinRT listener / mac UN / Linux portal | ✓ | partial | partial | 1/5 |
| FPS | `FPS` | native → PresentMon → FrameView → RTSS → vendor → unavailable | ✓ | ✗(→unavail) | ✗(→unavail) | 3 |
| Fan control | `Fans` | WMI/vendor → unavailable | partial | ✗ | partial | 3 |
| Smart home | (plugin actions/states) | Home Assistant REST + event bus | ✓ | ✓ | ✓ | 4 |

"partial" = provider exists but coverage varies by hardware/OS permission; the chain degrades to `unavailable` cleanly where unsupported. Honest cross-platform posture: several gaming/hardware capabilities are Windows-strong and degrade elsewhere — acceptable because the chain makes that non-breaking.

### 7. Dependency & licensing register

Tracked here so external dependencies don't surprise implementation:

| Dependency | Capability | Note / action |
|------------|------------|---------------|
| **PresentMon** | FPS (Win primary) | Open-source; **bundling requires a licensing review** (track to completion before shipping it bundled). |
| FrameView / RTSS | FPS fallback | Third-party install presence; provider probes for it, never requires it. |
| NVAPI / AMD ADL | GPU telemetry / FPS fallback | Vendor SDKs; per-app FPS unreliable (see §4.4). |
| gopsutil | Core telemetry | Permissive license; cross-platform. |
| Home Assistant | Smart home (P4) | User-run; long-lived token via secure store (2E §7). |
| OS media/notification APIs | Media/Notifications | Subject to per-OS permission models; degrade where denied. |

### 8. Normative requirements

| ID | Requirement | Trace |
|----|-------------|-------|
| TG-1 | Each OS/third-party capability SHALL be defined as one interface with an ordered provider list. | ADR-0007 |
| TG-2 | The host SHALL probe providers in priority order and bind the first available. | ADR-0007 |
| TG-3 | Absence of all providers SHALL yield `unavailable` (graceful), never an error or crash. | ADR-0007, FR-6.8 |
| TG-4 | Capability interfaces SHALL use a `(value, ok)` shape so unavailable is a normal return. | §3 |
| TG-5 | A runtime provider fault SHALL trigger a re-probe that may rebind or go unavailable. | §4.3 |
| TG-6 | FPS provider priority SHALL be native → PresentMon → FrameView → RTSS → vendor → unavailable. | PRD D11-02 |
| TG-7 | Vendor APIs SHALL NOT be relied upon for per-application FPS; they MAY serve GPU telemetry. | §4.4 |
| TG-8 | The engine core SHALL call capability interfaces only; it SHALL contain no OS branch. | ADR-0007, FR-11.4 |
| TG-9 | A capability provider SHALL execute inside a plugin process (2F); PAL priority and process isolation are orthogonal. | ADR-0007 |
| TG-10 | Bundled third-party dependencies (e.g. PresentMon) SHALL pass a licensing review before shipping. | §7 |

---
*End of TRD 2G (Draft v0.1). Provider implementations are first-party plugins (2F); states/actions they contribute follow 2B registries.*

---



<a id="document-2c-trd-layout-designer"></a>

# Document 2C — TRD: Layout & Designer

## CyberDeck — TRD 2C: Layout & Designer

**Subsystem TRD · Document 2C** · Version 0.1 (Draft) · June 2026
Inherits TRD Master §6. Governing ADRs: **0003, 0011, 0012, 0017, 0018** (registries 2B; channels 2A).

### Contents
1. Scope & responsibilities
2. The layout document model
3. The widget model (appearance / interaction / config)
4. Operation log & versioning
5. Sync model (engine ↔ devices)
6. Undo / redo
7. Client rendering contract
8. The Designer (desktop-only)
9. Normative requirements

---

### 1. Scope & responsibilities

Owns: the **layout document tree** (profiles/pages/widgets), the **operation log** and versioning, the **sync model** that reflects edits to devices, the **client rendering contract**, and the **desktop-only Designer**. Consumes the registries (2B) to know what widgets/actions/states exist, the channels (2A) to move ops/previews, and the session model (2B) for targeting. Authoring is **desktop-only and permanent** (ADR-0018); layouts are **per-device-class** (ADR-0017).

### 2. The layout document model

```
Profile  (2B owns persistence; 2C owns shape)
  └─ Page
       ├─ GridConfig
       └─ Widget[]
```

#### 2.1 GridConfig (no caps — ADR-0017)
```jsonc
{ "columns":24, "rows":18, "gutter":8, "marginX":16, "marginY":16,
  "cellAspect":"fill",            // square | fill
  "background":{ "type":"gradient", "from":"#141428", "to":"#0D0D1A" },
  "deviceClass":"tablet-landscape-10" }   // layout authored FOR this class (ADR-0017)
```
No column/row/widget caps (a deliberate rejection of the incumbents' 15×15/110-button limits).

#### 2.2 DeviceClass
```jsonc
{ "id":"tablet-landscape-10", "label":"10\" Tablet (landscape)",
  "orientation":"landscape", "referenceResolution":[1280,800], "gridDefaults":{…} }
```
A device is assigned a class at pairing (2E `device_class`); the Designer authors against the class, and the matching layout is served to devices of that class. **No auto-reflow across classes in V1** (ADR-0017); adaptive layouts are a later candidate on this same model (Doc 0 §12).

### 3. The widget model (three independent concerns)

The separation of appearance / interaction / config is the source of the product's flexibility (Doc 0 §3.2).
```jsonc
{
  "id":"w_8f3a", "type":"gauge.circular",                 // type ∈ widget-type registry (2B §3.2)
  "placement":{ "col":3,"row":4,"colSpan":2,"rowSpan":2 },

  "appearance":{                                           // (a) looks; may follow state
    "style":{ "theme":"neon-cyan","label":"CPU","showValue":true },
    "stateBinding":"system.cpu.temp",
    "valueRules":[ {"when":">85","style":{"theme":"status-error","icon":"alert"}} ] // client-side, zero-latency
  },

  "interaction":{                                          // (b) each gesture independent
    "tap":{"target":"action","ref":"media.play"},
    "doubleTap":{"target":"action","ref":"media.next"},
    "longPress":{"target":"flow","ref":"flow_morning"},
    "dragValue":{"target":"action","ref":"media.volume.set","param":"level"},
    "swipeLeft":{"target":"navigate","ref":"page_2"}
  },

  "config":{ "min":0,"max":100,"unit":"°C","sparkline":true } // (c) per-type, validated vs registry schema
}
```
- **Appearance** binds to a state (filtered by the type's `acceptsStateKinds`); `valueRules` are evaluated **client-side** for instant visual feedback (the gauge turns red ≥85°C without a round-trip).
- **Interaction** slots (`tap, doubleTap, longPress, pressDown, pressUp, dragValue, swipe*`) each independently target `action | macro/flow | navigate | none`. The full slot set is defined in V1; designer UI for `tap/longPress/dragValue` is V1, the rest Phase 2 (Doc 0 §12).
- **Config** is validated against the widget type's `configSchema` (2B §3.2).
- **No overlap** (ADR-0017 placement rule): a placement colliding with an existing widget is rejected or pushed; z-index is avoided in V1.

### 4. Operation log & versioning (ADR-0012)

Every edit is a **versioned operation** applied to the authoritative document (held by the engine). The op log is the substrate for instant reflection, undo/redo, multi-device sync, and future collaboration — one mechanism, four payoffs.

#### 4.1 Operation set (V1)
`AddWidget, RemoveWidget, MoveWidget, ResizeWidget, SetStyle, SetBinding, SetInteraction, SetConfig, AddPage, RemovePage, ChangeGrid, AddProfile, SetProfileActivation`.
```jsonc
{ "op":"MoveWidget", "docVersion":412, "pageId":"page_2",
  "widgetId":"w_8f3a", "from":{"col":3,"row":4}, "to":{"col":5,"row":4} }
```

#### 4.2 Versioning
- Each document carries a **monotonic version**; an applied op increments it.
- Clients track **last-applied version**; a `seq`/version gap (2A) → **full document resync** (never replay gaps — the engine is the single source of truth, ADR-0002).
- The op log is persisted enough to support undo within a session; long-term it's the document `version` in SQLite (2B) that matters for resync.

#### 4.3 Concurrency (V1)
**Single-writer edit lock** per document: one Designer edits a given profile at a time. This sidesteps CRDT/OT entirely in V1; the op log nonetheless *is* the collaboration substrate, so the Phase 8 multi-author feature layers conflict resolution on the same log (Doc 0 §12) without redesign.

### 5. Sync model (engine ↔ devices) (ADR-0011, ADR-0012)

#### 5.1 Channels used
- **Layout channel** (durable, ordered): committed ops engine→device; interaction/action events device→engine.
- **Preview channel** (ephemeral, droppable, never persisted): live-drag ghosts during authoring.

#### 5.2 Edit → device flow (TRD Master DF-C, expanded)
```
Designer drag begins
  → throttled ghost positions (30–60Hz) ⇒ Preview channel ⇒ target device
     (device shows the widget moving; nothing persisted)
Designer drops
  → Designer emits durable op (e.g. MoveWidget) → engine
  → engine applies to authoritative doc (vN→vN+1), persists (2B)
  → broadcasts op ⇒ Layout channel ⇒ all sessions subscribed to that profile in edit/preview mode
  → each client applies op → repaints ONLY the affected widget (diff, not full redraw)
```
Result: the headline demo — drag a gauge on the PC, watch it appear on the tablet in real time — with clean durable history (one op) and a premium live feel (ephemeral ghosts). Targets: op→reflection <200ms (NFR-02).

#### 5.3 Runtime vs edit mode
A session is in **runtime** (State updates only) or **edit/preview** (State + Layout ops + Preview ghosts). A device flips to edit/preview when the Designer targets the profile it's showing, so authors can watch live; otherwise devices stay in runtime and never receive op/preview traffic.

### 6. Undo / redo (ADR-0012)

Every op has an **inverse** (e.g. `MoveWidget A→B` ⟷ `MoveWidget B→A`; `AddWidget` ⟷ `RemoveWidget`). Undo applies the inverse (a new op, version-incrementing) and broadcasts it like any edit, so devices reflect undo instantly too. Redo re-applies. The undo stack is per-document, per-edit-session.

### 7. Client rendering contract (ADR-0003)

The client is a **deterministic renderer** of the layout doc (host-authority — ADR-0002).

#### 7.1 Renderer registry
`widgetType → native builder`. On receiving a layout doc, the client builds the widget tree once. V1 core vocabulary (button, toggle, slider, label, image, circular gauge, linear gauge/bar, sparkline, media card, page-nav) maps to native Flutter builders. Plugin-provided widget types (Phase 6) register additional builders (the registry contract exists in V1).

#### 7.2 Repaint discipline
- A **state update** repaints only widgets subscribed to that state (2B subscription set ← the doc's bindings).
- A **layout op** diffs the tree and rebuilds only affected nodes.
- `valueRules` are applied client-side on each state update (no round-trip), keeping conditional styling within the 60 FPS budget (NFR-03).
- An unknown widget type (e.g. a plugin not present) renders a safe placeholder, never a crash.

#### 7.3 Degradation
On disconnect (2A §7.3): bound widgets show last value dimmed + connection badge; `unavailable` capabilities show `--`. The renderer never fabricates live data.

### 8. The Designer (desktop-only — ADR-0018)

A reader of the registries (2B) and an emitter of ops (§4). Lives in the client codebase, enabled only for desktop targets.

#### 8.1 Canvas
WYSIWYG grid rendering the page exactly as the target device class will (same renderer registry as the client, §7). Snap-to-grid; no overlap (§3).

#### 8.2 Drag-drop & mapping (the deep model)
| Designer action | Emits |
|-----------------|-------|
| Drag widget type from palette onto a cell | `AddWidget` |
| Move/resize (with live preview ghosts) | `MoveWidget` / `ResizeWidget` on drop |
| Bind appearance (inspector lists states filtered by `acceptsStateKinds`) | `SetBinding` |
| Map a gesture slot to a target | `SetInteraction` |
| Edit style / `valueRules` | `SetStyle` |
| Edit type-specific config | `SetConfig` |
| Change grid / background | `ChangeGrid` |

**The keystone**: when mapping a gesture to an action, the inspector reads the action's **param schema** (2B §3.1) and **auto-generates the parameter editor** — `int 0–100` → slider, `choice` → dropdown, `entity` → smart-home entity picker. Therefore **every action, first-party or third-party plugin, is fully editable with zero designer code changes** (the unification of designer + ecosystem, ADR-0006).

#### 8.3 Explicit device targeting (FR-8.8)
The Designer always shows its target: *"Editing: Living Room iPad · UUID a3f… · 10×6 landscape."* Ops route only to that device's assigned layout and its sessions. Authoring a class with multiple assigned devices updates all of them.

#### 8.4 Profiles
Create/assign/activate profiles; set the activation rule (stored + hook in V1; auto-switch consumer Phase 2). Assign a profile to a device class.

### 9. Normative requirements

| ID | Requirement | Trace |
|----|-------------|-------|
| TC-DOC-1 | A layout SHALL be a Profile→Page→Widget tree with a GridConfig per page. | Doc 0 §3.1 |
| TC-DOC-2 | Grid config SHALL be fully customizable with no column/row/widget caps. | FR-8.2, ADR-0017 |
| TC-DOC-3 | A layout SHALL be authored against a specific device class; no auto-reflow in V1. | ADR-0017, FR-8.3 |
| TC-WID-1 | A widget SHALL separate appearance, interaction, and config. | Doc 0 §3.2 |
| TC-WID-2 | Each gesture slot SHALL independently target action/macro/flow/navigate/none. | FR-9.3/9.4 |
| TC-WID-3 | `valueRules` SHALL be evaluated client-side for zero-latency conditional styling. | FR-9.5 |
| TC-WID-4 | Widgets SHALL NOT overlap; conflicting placement SHALL be rejected or pushed. | FR-8.9, ADR-0017 |
| TC-OP-1 | Every edit SHALL be a versioned operation applied to the authoritative document. | ADR-0012, FR-8.4 |
| TC-OP-2 | Ops SHALL broadcast to subscribed sessions; clients SHALL repaint only affected widgets. | FR-8.5, NFR-02 |
| TC-OP-3 | Each op SHALL have an inverse enabling undo/redo. | FR-8.6, ADR-0012 |
| TC-OP-4 | Drag previews SHALL ride the Preview channel and SHALL NOT be persisted; a durable op commits on drop. | FR-8.7, ADR-0011 |
| TC-OP-5 | A version/seq gap SHALL trigger a full document resync, not gap replay. | FR-5.5, ADR-0012 |
| TC-OP-6 | V1 SHALL use a single-writer edit lock per document. | §4.3 |
| TC-REN-1 | The client SHALL render via a widgetType→native-builder registry; unknown types SHALL render a safe placeholder. | ADR-0003, FR-9.2 |
| TC-REN-2 | State updates SHALL repaint only subscribed widgets; layout ops only affected nodes. | NFR-03 |
| TC-DSGN-1 | Authoring SHALL be desktop-only; clients SHALL NOT edit layouts. | ADR-0018, FR-8.1 |
| TC-DSGN-2 | The inspector SHALL auto-generate parameter editors from action/config schemas with no per-action UI code. | FR-7.2, ADR-0006 |
| TC-DSGN-3 | The Designer SHALL always display its explicit target device. | FR-8.8 |

---
*End of TRD 2C (Draft v0.1). Flow targets referenced by interaction slots are defined in 2D; registry schemas the inspector reads are in 2B.*

---



<a id="document-2d-trd-flow-engine"></a>

# Document 2D — TRD: Flow Engine

## CyberDeck — TRD 2D: Flow Engine

**Subsystem TRD · Document 2D** · Version 0.1 (Draft) · June 2026
Inherits TRD Master §6. Governing ADRs: **0013, 0019** (state/var model 2B; actions 2B; security boundary 2E).

### Contents
1. Scope & responsibilities
2. Flow document model
3. Node catalog (V1)
4. The expression language
5. Variables & scope
6. Triggers
7. Execution runtime & semantics
8. Failure, cancellation, safety
9. Composition (subflows) & the registry seam
10. Normative requirements

---

### 1. Scope & responsibilities

Owns the **conditional flow / macro engine** (ADR-0013): the flow document model, the node-graph runtime, the **sandboxed expression language**, variable scoping, the trigger model, and execution semantics. Flows execute **host-side** (clients only trigger — ADR-0002). Consumes: the action registry (2B §3.1) to invoke actions, the state store (2B §2) and `var.*` for expressions, the event bus (2B §4) for triggers, and the permission/audit model (2E) for governance. This subsystem is what differentiates CyberDeck from the incumbents' weak logic and is the home of the "Builder" persona.

**V1 = data model + executor + core nodes + expressions + manual/event/stateChange triggers.** The **visual flow builder UI** and **schedule triggers** are Phase 3 over this same model (Doc 0 §12); plugin-provided nodes are Phase 6.

### 2. Flow document model

A flow is a directed graph of nodes. A **macro** is the degenerate linear case (first-class — ADR-0013). Stored in SQLite `workflows` (2B §6), versioned, referenced by widget interaction slots (2C §3), events, or schedules.

```jsonc
{
  "id":"flow_cooling_guard", "label":"Cooling Guard", "version":4,
  "trigger":{ "kind":"stateChange", "state":"system.cpu.temp", "when":">85" },
  "entry":"n1",
  "nodes":[
    { "id":"n1","kind":"action","ref":"system.performance.set","params":{"profile":"Silent"},"next":"n2" },
    { "id":"n2","kind":"if","cond":"{var.notify_enabled} == true","then":"n3","else":"n4" },
    { "id":"n3","kind":"action","ref":"notify.send","params":{"msg":"CPU hot — cooling profile on"},"next":"n4" },
    { "id":"n4","kind":"action","ref":"home.light.brightness","params":{"entity_id":"light.office","level":30},"next":"n5" },
    { "id":"n5","kind":"setVar","var":"var.last_guard_ts","value":"{now}","next":null }
  ]
}
```
- `entry` names the start node; each node names its `next` (or branch targets); `null` ends a path.
- Node `ref` for `action`/`subflow` resolves against the registries (2B); `params` values may contain expressions (§4).

### 3. Node catalog (V1)

| kind | Fields | Semantics |
|------|--------|-----------|
| `action` | `ref, params, next` | Invoke a registered action (params expression-resolved + schema-validated by 2B); await result; continue. |
| `if` | `cond, then, else` | Evaluate boolean expression; branch. (`else` optional → falls through.) |
| `setVar` | `var, value, next` | Evaluate expression; write a `var.*` (2B), which fans out/triggers like any state. |
| `wait` | `ms` (or expr), `next` | Suspend this run for a duration; non-blocking (other flows/sessions proceed). |
| `loop` | `mode(count|while), count|cond, body, next` | Repeat `body` subgraph; `while` re-evaluates each iteration. Bounded (max iterations cap) to prevent runaway. |
| `navigate` | `target(page|profile), ref, next` | Switch the **triggering device's** session page/profile (2B session). No-op if non-interactive trigger. |
| `random` | `branches:[…], next` | Pick one branch uniformly (Stream Deck "Random Action" parity). |
| `subflow` | `ref, next` | Invoke another flow synchronously; returns to `next` on completion (§9). |
| `stop` | — | Terminate this run immediately. |

Node kinds are themselves registry entries (2B §3.3); Phase 6 plugin nodes (HTTP request, parallel/fork) register the same way — the executor dispatches by `kind` (§9).

### 4. The expression language (the security boundary — ADR-0013)

Conditions (`if`, `loop while`), dynamic params, and `setVar` values use a small, **sandboxed** expression language. It is **not** a general scripting language and **cannot execute arbitrary code** — flows are shareable/importable content, so this is a trust boundary (2E TB-5).

#### 4.1 Grammar (informal)
```
expr     := or
or       := and ('||' and)*
and      := cmp ('&&' cmp)*
cmp      := add (('=='|'!='|'>'|'<'|'>='|'<=') add)?
add      := mul (('+'|'-') mul)*
mul      := unary (('*'|'/'|'%') unary)*
unary    := '!'? primary
primary  := number | string | bool | token | '(' expr ')'
token    := '{' dotted '}'          // {state.id} | {var.name} | {now}
```
- **Token interpolation**: `{system.cpu.temp}` → current typed state value; `{var.x}` → variable; `{now}` → engine epoch-ms. Tokens resolve at evaluation time against the state store (2B). Typed values (ADR-0019) make `{system.cpu.temp} > 85` a numeric comparison, not string.
- **Operators**: boolean, comparison, arithmetic, string concat (via `+` on strings).
- **No** function calls into the host, no I/O, no loops *in the expression* (loops are nodes), no `eval`. Parsed to an AST and evaluated by a bounded interpreter.

#### 4.2 Evaluation
- Unknown/`unavailable` token → typed zero/empty with an **availability flag**; a flow may test availability (e.g. an `if` whose `cond` references an unavailable state takes the safe/else path). This composes with the PAL "unavailable" contract (2G).
- Type mismatches resolve by documented coercion rules or fail the node (recorded, §8) — never crash the engine.

### 5. Variables & scope

- **Global `var.*`** — typed, persisted (SQLite `variables`, 2B), bindable by widgets (2B §2.4). The durable shared memory of automations.
- **Local scope per run** — a flow run has a transient scratch scope for intermediate values (Touch Portal's "local states," improved). Locals never persist and never fan out; they avoid the incumbent anti-pattern of creating a global for every temporary calculation.
- Resolution order in expressions: local scope → global `var.*` → states.

### 6. Triggers

A flow declares one trigger; the engine arms it.

| kind | Armed via | Fires when | Phase |
|------|-----------|-----------|-------|
| `manual` | widget interaction slot (2C) | user gesture targets the flow | 1 |
| `event` | event bus subscription (2B §4) | a named engine event occurs (e.g. `threshold.cpu_temp`) | 1 |
| `stateChange` | state-watch on the store (2B §2.2) | a watched state crosses a condition (`when` expr) | 1 |
| `schedule` | scheduler | cron/time match | 3 (field reserved in V1) |

`stateChange` triggers are edge-triggered (fire on the crossing, not every tick while true) with optional debounce, so "CPU > 85" doesn't re-fire 60×/min. The event architecture from the old design becomes a **consumer** of this trigger model.

### 7. Execution runtime & semantics

#### 7.1 Host-side, async, isolated
- Flows run **on the engine** as supervised async tasks (Go goroutines with a context — ADR-0005); the client that triggered only sends the interaction event (2C) and receives resulting state changes back via the State channel (2A).
- Each run gets an isolated **run context**: run-id, local scope, the triggering device (for `navigate`), a cancellation handle, and a step cursor.

#### 7.2 Step loop
```
run(flow):
  ctx = newRunContext(trigger, device)
  node = flow.nodes[flow.entry]
  while node != null and not ctx.cancelled:
     audit(flow.run step) [debug level]
     node = dispatch(node, ctx)        // returns next node id resolved
  audit(flow.run completed | stopped | failed)
```
`dispatch` evaluates the node by kind (§3); `action` nodes await the action result (via plugin IPC, 2F) before continuing; `wait` reschedules the cursor after the delay without holding a thread.

#### 7.3 Concurrency
- Multiple flows (and multiple runs of the same flow) may run concurrently; each has its own context and local scope. Global `var.*` writes are serialized through the state store (2B), last-write-wins (Master/ADR-0014).
- A `stateChange`/`event` flow already running when it re-triggers: V1 policy = **allow concurrent runs** with a per-flow max-concurrency cap; (queue/debounce policies are a per-flow option to refine in the Phase 3 deep dive).

#### 7.4 Permissions & audit
- An `action` node invokes through the engine's action path, so **device permissions still apply** when the flow was manually triggered by a device; **system/event/stateChange-triggered** flows run as actor `flow:<id>` and are bounded by the flow's own configuration (a flow cannot do what no action permits).
- Every run is audited (`flow.run`, `flow.failed`) and every action it invokes is audited (2E §6).

### 8. Failure, cancellation, safety

- **Per-node failure behavior**: a node may declare `onError: continue | stop | branch(target)` (default `stop`). Failures log the failing node id + reason (FR-10.7).
- **Cancellation**: a run is cancellable (ctx cancel) — e.g. user stops it, engine shutdown, or a supersede policy. `wait`/`loop` honor cancellation promptly.
- **Runaway protection**: `loop` has a max-iteration cap; total run has a wall-clock budget; exceeding either fails the run safely (audited).
- **No engine impact**: a failing/throwing node never crashes the engine — the run fails, is recorded, and other runs proceed (mirrors the plugin-isolation discipline of 2F).
- **Expression safety**: the sandbox (no eval/IO/host calls) means imported/shared flows cannot run arbitrary code; side effects are only via permission-gated registered actions (2E TB-5).

### 9. Composition (subflows) & the registry seam

- **`subflow`** invokes another flow synchronously and returns on completion, enabling reusable building blocks (e.g. a "notify me" subflow). Recursion is bounded by the run wall-clock + a depth cap.
- **Node extensibility**: the executor dispatches by `kind` against the **flow-node registry** (2B §3.3). Core nodes are registered at boot; **Phase 6 plugin nodes** (HTTP request, parallel/fork, vendor-specific) register identically and the executor dispatches them with no core change — the same one-model principle as capabilities (ADR-0006). The **visual flow builder UI** (Phase 3) reads node + action schemas to render its palette and param editors, exactly as the layout Designer does for widgets/actions (2C §8.2) — the unification of automation authoring and the registries.

### 10. Normative requirements

| ID | Requirement | Trace |
|----|-------------|-------|
| TD-1 | Flows SHALL be stored, versioned, and executed host-side; clients SHALL only trigger. | ADR-0013, FR-10.1 |
| TD-2 | The V1 node set SHALL include action, if/else, setVar, wait, loop, navigate, random, subflow, stop. | FR-10.2 |
| TD-3 | Conditions/values SHALL use a sandboxed expression language with token interpolation; arbitrary code execution SHALL NOT be possible. | ADR-0013, FR-10.3, 2E TB-5 |
| TD-4 | Token resolution SHALL use typed state/var values (numeric comparison, not string). | ADR-0019, FR-10.3 |
| TD-5 | An expression referencing an unavailable state SHALL resolve safely with an availability flag, never crash. | 2G, §4.2 |
| TD-6 | `var.*` SHALL be global/persistent and bindable; each run SHALL have a transient local scope. | FR-10.4/10.6 |
| TD-7 | Triggers SHALL include manual, event, stateChange in V1; schedule SHALL be a reserved field. | FR-10.5, Doc 0 §12 |
| TD-8 | `stateChange` triggers SHALL be edge-triggered with optional debounce. | §6 |
| TD-9 | Runs SHALL be cancellable; `wait`/`loop` SHALL honor cancellation; `loop` SHALL be iteration-capped. | FR-10.7, §8 |
| TD-10 | A failing node SHALL fail the run safely (logged with node id) and SHALL NOT crash the engine. | FR-10.7, §8 |
| TD-11 | Manually-triggered flows SHALL respect the triggering device's permissions; all runs and invoked actions SHALL be audited. | 2E §5/§6 |
| TD-12 | Node kinds SHALL be registry-dispatched so plugin nodes (Phase 6) add without core changes. | ADR-0006, §9 |

---
*End of TRD 2D (Draft v0.1). This completes the federated TRD set (2 + 2-ADR + 2A–2G). Next: per-phase deep dives, beginning with Phase 1.*

---



<a id="document-3-phase-1-foundation-deep-dive"></a>

# Document 3 — Phase 1 (Foundation) Deep Dive

## CyberDeck — Phase 1 (Foundation) Deep Dive

**Document 3 of the CyberDeck Enterprise Documentation Set · Per-Phase Deep Dive**
Version 0.1 (Draft) · June 2026 · Codebase ID: `com.shishir.cyberdeck`

> Implementation-depth specification for **Phase 1 (Foundation / V1)**. Authority chain: Foundation (Doc 0) → PRD (Doc 1) → TRD Master + subsystem TRDs (2/2A–2G) + ADR Log (2-ADR) → **this**. Where this doc cites a structure or rule, the owning TRD is the source of truth; here we specify *what is built in Phase 1, in what order, how the pieces connect, and how we prove it's done.*

### Contents
1. Phase intent & definition of done
2. Scope: in / out
3. Workstream map & dependency order
4. WS-1 Engine bootstrap, service lifecycle & packaging
5. WS-2 Persistence & core data layer
6. WS-3 Security & identity
7. WS-4 Transport & connectivity
8. WS-5 Plugin host & first-party capability plugins
9. WS-6 State store, registries & event bus
10. WS-7 Flow engine core
11. WS-8 Client runtime & widget vocabulary
12. WS-9 Designer (desktop)
13. End-to-end realized journeys
14. Consolidated code structure
15. Test plan
16. Milestones & sequencing
17. Risks & mitigations
18. Acceptance criteria (traced)

---

### 1. Phase intent & definition of done

**Intent.** Deliver a secure, multi-device, single-engine control surface that a user can install, pair devices to over LAN, author layouts for on the desktop with live reflection, run live telemetry and core actions through, and automate with the flow-engine core — *and* whose internal seams (registries, op-log, endpoint abstraction, flow executor, plugin host, security model) are complete enough that Phases 2–8 attach without re-architecture.

**Definition of done (phase-level).** Phase 1 is complete when:
- All Phase-1 functional requirements (PRD FR-1…FR-11 V1 scope) are implemented and pass automated tests.
- All Phase-1 acceptance criteria (§18) are verified.
- NFR budgets hold on reference hardware: engine < 150 MB RAM steady, < 2% idle CPU, tap-to-feedback < 100 ms, op→reflection < 200 ms, 60 FPS client render, reconnect < 5 s, ≥ 8 concurrent sessions.
- The installer for each desktop OS deploys engine-service + Desktop UI + bundled first-party plugins; the engine starts on boot and survives UI close.
- Soak test (8 h) passes (RSS growth < 5 MB/h; no plugin-induced engine crash).

### 2. Scope: in / out

#### In scope (Phase 1)
| Area | Included |
|------|----------|
| Lifecycle | Engine as OS background service; tray; native installers (Win/macOS/Linux); loopback + privileged control channel |
| Security | Keypair+UUID identity (account-independent); QR + mDNS + manual pairing; E2E sessions; per-device permissions; revocation; audit log |
| Transport | Endpoint abstraction; 3 channels (+control); heartbeat; reconnect; degradation; versioned resync; multi-session fan-out |
| Persistence | SQLite durable store + migrations; in-memory live state |
| Plugin host | Out-of-process host running first-party plugins; IPC; supervision/restart |
| Capabilities (1P plugins) | Telemetry (CPU/GPU/RAM/storage/network/uptime); Power (shutdown/restart/sleep/hibernate/lock/logoff); Volume; Launchers; Notification count; system-tool launch |
| State/registries | Typed state store; action/widget/flow-node registries; event bus; profile/session model |
| Flow engine | Model + executor + V1 node set + expression language + manual/event/stateChange triggers + variables |
| Client | Connection mgr; renderer registry; core widget vocabulary; full gesture model (core slots in UI); degradation UI |
| Designer | Canvas; drag-drop; schema-driven inspector; op-log sync + live reflection; per-device-class; undo/redo; profile mgmt |

#### Out of scope (later phases — seams built, capability deferred)
Album art / progress / mixer (P2) · auto app-focus profile switching (P2, *rule field + hook built*) · gaming optimization & FPS (P3) · visual flow builder UI & schedule triggers (P3, *model built*) · smart home (P4) · full notification aggregation & cameras (P5) · plugin SDK / third-party loading / signing / sandboxing (P6, *contract built & used by 1P*) · remote/relay (P7, *endpoint seam built*) · accounts/cloud (P7) · collaborative editing & adaptive layouts (P8, *op-log & DeviceClass built*).

### 3. Workstream map & dependency order

```
WS-1 Bootstrap/Lifecycle ─┐
WS-2 Persistence ─────────┼─► WS-6 State/Registries/EventBus ─► WS-7 Flow core
WS-3 Security/Identity ───┤                                   │
WS-4 Transport ───────────┘                                   │
WS-5 Plugin host + 1P plugins ───────────────────────────────►┤
                                                              ▼
WS-8 Client runtime + widgets ◄──(transport, registries)──────┤
WS-9 Designer ◄──(client renderer, registries, op-log)────────┘
```
**Build order (critical path):** WS-1/2/3 in parallel → WS-4 → WS-6 → WS-5 (host + first telemetry plugin) → WS-8 (render telemetry) → WS-7 (flows over states/actions) → WS-9 (author it all). Security (WS-3) and Transport (WS-4) gate everything client-facing and must land before WS-8.

---

### 4. WS-1 — Engine bootstrap, service lifecycle & packaging

**Owning TRD:** 2B §7, TRD Master §3. **ADRs:** 0005.

#### 4.1 Functional flow
```
Installer → registers engine as OS service + drops Desktop UI + bundled 1P plugins
OS boot → service manager starts engine
  engine: load config.json → open/migrate SQLite (WS-2) → init core (WS-6)
        → start plugin host (WS-5) → start transport (WS-4) → mDNS advertise
        → READY
User opens Desktop UI → connects over loopback (data + privileged control)
User closes Desktop UI window → engine keeps running (service)
```

#### 4.2 Capability detail
- **Service registration** per OS: Windows Service (or startup-registered tray process), launchd LaunchAgent/Daemon, systemd user service.
- **Tray presence**: status (connected/degraded/error), reopen UI, pause/quit engine, "show pairing QR."
- **Start-on-boot** default on; user-toggleable.
- **Single-instance** guard (one engine per host); second launch focuses the UI.

#### 4.3 Technical spec
- Engine entrypoint parses service-mode vs foreground (`cyberdeck --service` / `--console`).
- Graceful shutdown handler: stop accepting sessions → flush durable writes → SIGTERM plugins (grace) → close SQLite.
- Config schema (`config.json`, non-secret) carried from Doc 0 §16 (intervals, thresholds, HA URL placeholder, display prefs); read at startup (hot-reload deferred, Doc 0 §12).

#### 4.4 Code structure
```
engine/cmd/cyberdeck/main.go          // flag parse, service vs console
engine/internal/lifecycle/            // boot sequence, shutdown, single-instance
engine/internal/service/{windows,darwin,linux}.go   // service registration glue
engine/internal/config/               // config.json load + schema + defaults
client/lib/tray/                      // tray UI (desktop only)
installers/{windows,macos,linux}/     // packaging scripts
```

#### 4.5 Data flow
Config + SQLite handle injected into core init; no runtime data flow of its own beyond lifecycle signals.

---

### 5. WS-2 — Persistence & core data layer

**Owning TRD:** 2B §6. **ADRs:** 0014.

#### 5.1 Capability detail
- Single SQLite file; the 9 tables of 2B §6 (`documents, registry_items, variables, workflows, devices, accounts, audit_log, meta`).
- Forward-only migrations keyed by `meta.schema_version`.
- Repository layer: typed Go accessors per table; transactions for multi-row writes; the audit log is append-only (insert-only API, no update/delete).

#### 5.2 Technical spec
- Use a single writer connection + a read pool (SQLite WAL mode) to keep telemetry-adjacent reads (e.g. `var.*`) non-blocking.
- All `*_json` columns validated against the owning subsystem's schema on write.
- Secrets are **never** written here (2E §7); a lint/test asserts no secret-typed field reaches a repo.

#### 5.3 Code structure
```
engine/core/persistence/
  db.go            // open, WAL, migrate
  migrations/      // 0001_init.sql, …
  repo_documents.go  repo_registry.go  repo_variables.go
  repo_workflows.go  repo_devices.go   repo_audit.go  repo_meta.go
```

#### 5.4 Data flow
Write path from WS-3 (devices, audit), WS-6 (registry_items, variables), WS-9 (documents), WS-7 (workflows, variables, audit). Read path on boot (rehydrate registries/documents/devices) and on demand.

---

### 6. WS-3 — Security & identity

**Owning TRD:** 2E. **ADRs:** 0008, 0009, 0016.

#### 6.1 Functional flow (pairing — happy path, QR)
```
Desktop UI (privileged control) → engine: "issue pairing token" → token+fp shown as QR
Phone scans QR → ClientHello(uuid,pubkey,token) → engine validates token
  → ServerHello(engine uuid,pubkey,nonce) → phone verifies fingerprint
  → KeyConfirm(sig) → engine verifies → PairResult(sig) → phone verifies
  → trust records written both sides → session keys derived → CONNECTED
```

#### 6.2 Capability detail
- Identity: Ed25519 keypair + 128-bit UUID generated at first launch, stored in OS secure store (private) + SQLite/secure-prefs (public/uuid/label). Account-independent (ADR-0016).
- Pairing: QR (token+fingerprint), manual (addr + PIN), mDNS-initiated (TXT fingerprint → token/PIN approval). Token single-use, time-limited, issued only over privileged control channel.
- Permissions: per-device `{allowPowerActions, allowedCategories, deniedActions, allowEditTrigger}`; enforced engine-side on every interaction (5-step order, 2E §5.2).
- Revocation: `revoked=1` → reject at handshake + tear down live session.
- Audit: append every executed/rejected action + pairing/revoke/session/flow events.

#### 6.3 Technical spec
- Crypto suite per 2A §5.3 (X25519 ECDH + HKDF + ChaCha20-Poly1305 AEAD; Ed25519 sigs over nonces). Forward secrecy via per-session ephemerals.
- Secret storage providers per OS (2E §7) behind a `SecretStore` interface (a PAL-style capability — note it's a host concern, bundled, not a downloadable plugin).
- Permission check is a pure function `authorize(session, actionDescriptor) → allow|reason`; unit-tested exhaustively.

#### 6.4 Code structure
```
engine/core/security/
  identity.go        // keypair+uuid gen/load
  pairing.go         // handshake state machine (server side)
  session_auth.go    // mutual auth, key derivation
  permissions.go     // authorize() + model
  audit.go           // append-only audit semantics
  secretstore/{windows,darwin,linux}.go
client/lib/net/pairing.dart   // client handshake + QR scan + fingerprint verify
```

#### 6.5 Data flow
Pairing writes `devices`; every action (WS-6/WS-7) calls `authorize()` then `audit.append()`. Secrets flow only to/from the OS secure store, never SQLite/logs.

---

### 7. WS-4 — Transport & connectivity

**Owning TRD:** 2A. **ADRs:** 0009, 0010, 0011, 0015.

#### 7.1 Capability detail
- `TransportEndpoint`/`ConnectionManager` with V1 `LanEndpoint` only (relay seam reserved).
- Discovery: mDNS advertise/browse; manual; bounded active scan (UUID-confirmed).
- Three channels (State/Layout/Preview) + loopback Control; per-channel backpressure (State coalesces; Layout ordered-lossless; Preview drop-on-overflow).
- Resilience: sleep-tolerant heartbeat; reconnect backoff→mDNS→scan (<5 s); dimmed-last-value degradation; versioned resync.
- Multi-session fan-out with per-session subscription filtering.

#### 7.2 Technical spec
- TCP, length-prefixed encrypted frames; shared JSON envelope (Master §6.3) through the `Serializer` abstraction (binary deferred).
- Per-session goroutine set: reader, writer, heartbeat, channel demux. Cancellation via context on drop/shutdown.
- mDNS via a maintained Zeroconf library; active scan rate-limited to local subnet, opt-in.

#### 7.3 Code structure
```
engine/core/transport/
  endpoint.go connmgr.go        // abstraction (LAN now)
  discovery_mdns.go discovery_scan.go
  session.go channels.go heartbeat.go reconnect.go
  framing.go serializer.go      // length-prefix + JSON serializer seam
client/lib/net/
  connection_manager.dart channels.dart heartbeat.dart discovery.dart resync.dart
```

#### 7.4 Data flow
Instantiates TRD Master DF-A/B/C over the wire: State deltas down (filtered by subscription), interaction events up, ops down + interaction up on Layout, ghosts on Preview, control on loopback.

---

### 8. WS-5 — Plugin host & first-party capability plugins

**Owning TRD:** 2F (host), 2G (capabilities). **ADRs:** 0006, 0007.

#### 8.1 Capability detail
- **Plugin host** in the engine: launch/supervise/restart bundled 1P plugins; IPC (loopback/stdio, JSON envelope `ch:"plugin"`); permission enforcement at the boundary; fault handling (faulted plugin keeps contributions; states→`--`).
- **First-party plugins (Phase 1):**
  - `telemetry` — CPU/GPU/RAM/storage/network/uptime; provider chains (gopsutil → OS-native; GPU: GPUtil → OHM/AMD → vendor → unavailable). Emits threshold events.
  - `power` — shutdown/restart/sleep/hibernate/lock/logoff; destructive flags; unsaved-work warning.
  - `volume` — system master volume get/set.
  - `launchers` — Steam/Epic/Chrome/Discord/custom launch; system-tool launch (Task Manager, etc.).
  - `notifications` — unread count from OS action center (count only in P1; full feed P5).

#### 8.2 Technical spec
- Each plugin = separate Go binary + manifest (2F §3). Manifests declare `contributes` (states/actions/events/capabilities) merged into registries (WS-6) and required permissions.
- Capability interfaces (2G §3) with `(value, ok)` returns; provider probe→bind→degrade at host start; re-probe on fault.
- Telemetry cadences per Doc 0 §14 (CPU/GPU/RAM 1 s, storage 10 s, uptime 60 s) — each provider a goroutine in the plugin, publishing via `stateUpdate` IPC.

#### 8.3 Code structure
```
engine/pluginhost/  host.go supervise.go ipc.go permissions.go lifecycle.go
engine/pal/         telemetry.go fps.go media.go power.go notifications.go  // interfaces + chain framework
plugins/telemetry/  main.go manifest.json providers/{gopsutil.go,gputil.go,amd.go,vendor.go}
plugins/power/      main.go manifest.json power_{windows,darwin,linux}.go
plugins/volume/     main.go manifest.json
plugins/launchers/  main.go manifest.json
plugins/notifications/ main.go manifest.json listener_{windows,darwin,linux}.go
```

#### 8.4 Data flow
Provider → plugin `stateUpdate` → host → StateStore.Set (WS-6) → delta → fan-out (WS-4). Action: engine `invokeAction` (post-authorize) → plugin → external OS API → `actionResult` → audit.

---

### 9. WS-6 — State store, registries & event bus

**Owning TRD:** 2B §2–§5. **ADRs:** 0019, 0006.

#### 9.1 Capability detail
- Typed state store with delta suppression + series ring buffers (in-memory); subscription filtering.
- Three registries (action/widget/flow-node), schema-driven, plugin-populated; queryable for the Designer.
- Event bus (state.changed, threshold.crossed, device.*, plugin.*, session.*, flow.*).
- Session/profile model with the activation-rule field + evaluation hook (auto-switch deferred).

#### 9.2 Technical spec
- `StateStore.Set` does change detection, ring-buffer push, dirty-marking, event emission, fan-out enqueue.
- Registry merge validates schema-of-schemas; rejects ID collisions; persists `registry_items`.
- `var.*` are states backed by the `variables` table (durable) and bindable.

#### 9.3 Code structure
```
engine/core/state/    store.go state.go ringbuffer.go subscriptions.go delta.go
engine/core/registry/ actions.go widgets.go flownodes.go merge.go query.go
engine/core/eventbus/ bus.go topics.go
engine/core/session/  session.go profile.go activation.go mode.go
shared/schemas/       action.schema.json widget.schema.json flownode.schema.json state.descriptor.json
```

#### 9.4 Data flow
Central hub of DF-A (state→fan-out) and the resolution point for DF-B (interaction→action/flow). Registries feed the Designer (DF-C authoring).

---

### 10. WS-7 — Flow engine core

**Owning TRD:** 2D. **ADRs:** 0013, 0019.

#### 10.1 Capability detail
- Flow model + host-side async executor; V1 node set (action/if/setVar/wait/loop/navigate/random/subflow/stop); sandboxed expression language; global `var.*` + local scope; triggers manual/event/stateChange (schedule field reserved); cancellation; failure handling; audit.

#### 10.2 Technical spec
- Executor = step loop over the node graph in a run context (run-id, local scope, triggering device, cancel handle). `action` nodes await IPC result; `wait` reschedules without holding a thread; `loop` iteration-capped; run wall-clock budget.
- Expression engine: lexer→parser→AST→bounded evaluator; tokens resolve typed values from the state store; unavailable→safe value + availability flag; **no eval/IO/host calls** (security boundary, 2E TB-5).
- `stateChange` triggers edge-triggered + debounced via event bus.

#### 10.3 Code structure
```
engine/core/flow/
  model.go executor.go runcontext.go
  nodes/{action.go,if.go,setvar.go,wait.go,loop.go,navigate.go,random.go,subflow.go,stop.go}
  expr/{lexer.go,parser.go,ast.go,eval.go}
  triggers.go scope.go
```

#### 10.4 Data flow
Trigger (event bus / interaction) → executor → `action` nodes via WS-6 action path (authorize+audit) → state changes ripple back via DF-A. `setVar` writes `variables` (WS-2) + state store (WS-6).

---

### 11. WS-8 — Client runtime & widget vocabulary

**Owning TRD:** 2C §7, 2A (client side). **ADRs:** 0003, 0004.

#### 11.1 Capability detail
- Connection manager (pairing UI, reconnect, channel demux, resync).
- Renderer registry: `widgetType → native Flutter builder`. **V1 widgets:** button, toggle, slider, label, image, circular gauge, linear gauge/bar, sparkline, media card (basic), page-nav.
- Layout interpreter: build tree from doc; apply ops (diff/targeted repaint); subscribe per-widget to bound states.
- Full gesture capture (tap/double/long/down/up/drag/swipe); maps to interaction-slot events upstream.
- Degradation UI: dimmed last value + connection badge; `--` for unavailable; placeholder for unknown widget type.
- Runtime vs edit/preview mode handling.

#### 11.2 Technical spec
- Widget builders are pure functions of `(descriptor, boundState)`; no business logic; `valueRules` evaluated client-side per state update for zero-latency conditional styling (60 FPS budget).
- Pressed-state visual ≤100 ms; result reflected when state returns (≤500 ms).
- 2-tap confirmation UI for destructive actions.

#### 11.3 Code structure
```
client/lib/
  net/ (WS-4 client)
  render/registry.dart widgets/{button,toggle,slider,label,image,gauge_circular,gauge_linear,sparkline,media_card,page_nav}.dart
  render/value_rules.dart interpreter.dart repaint.dart
  gestures/capture.dart slots.dart confirm.dart
  app/shell.dart pairing.dart connection_badge.dart
  theme/tokens.dart   // neon palette/typography/spacing (Doc 0 design system)
```

#### 11.4 Data flow
Receives DF-A state deltas → targeted repaint; emits DF-B interaction events on tap; in edit mode receives DF-C ops + preview ghosts.

---

### 12. WS-9 — Designer (desktop)

**Owning TRD:** 2C §8. **ADRs:** 0012, 0017, 0018, 0006.

#### 12.1 Capability detail
- WYSIWYG grid canvas (renders as target device class via the same renderer registry as the client).
- Drag-drop placement (snap-to-grid, no overlap); move/resize with live preview ghosts.
- Schema-driven inspector: appearance binding (states filtered by `acceptsStateKinds`), per-gesture interaction mapping with **auto-generated param editors from action schemas**, style + `valueRules`, type config.
- Op-log sync: emits versioned ops; live reflection to bound devices in edit/preview mode.
- Undo/redo via op inverses; profile create/assign/activate; explicit device targeting; grid config (no caps).

#### 12.2 Technical spec
- Canvas emits ops on commit; drag emits throttled ghosts on Preview; drop commits one durable op.
- Inspector reads registry schemas (WS-6) → renders editors generically (int→slider, choice→dropdown, entity→picker stub for P1). **Zero per-action UI code** — proves the designer↔ecosystem unification.
- Undo stack per document/edit-session; single-writer edit lock.

#### 12.3 Code structure
```
client/lib/designer/   // compiled for desktop targets only (ADR-0018)
  canvas.dart palette.dart inspector/{appearance.dart,interaction.dart,style.dart,config.dart}
  op_emitter.dart undo.dart device_target.dart grid_config.dart profile_manager.dart
  schema_form.dart      // auto-generates editors from registry schemas
```

#### 12.4 Data flow
Reads registries (DF-C); emits ops → engine layout store (authoritative, vN+1, persisted WS-2) → broadcast → devices repaint. The headline live-reflection loop.

---

### 13. End-to-end realized journeys (Phase 1)

**J0 First-run & pair (PRD Journey 0).** Install → engine service starts → Desktop UI shows QR → phone scans → handshake (WS-3) → device record + session (WS-4) → assign starter layout → renders. No account.

**J1 Author with live reflection (PRD Journey 1).** Designer targets the iPad → set grid → drag CPU gauge → `AddWidget` op → iPad (edit/preview) shows it instantly → bind `system.cpu.temp` → map `tap→media.play`, `longPress→flow` via schema inspector → done → iPad → runtime mode.

**J2 Gaming-start core (PRD Journey 2, P1 portion).** Gaming layout loads <1 s with live thermals; game tile launches via `launchers`; "Competitive" profile is present (full optimization is P3).

**J3 Notification badge (PRD Journey 3, P1 portion).** Badge reflects OS action-center unread count (full feed/triage P5).

**J4 Build a flow (PRD Journey 4, P1 model/manual).** Author "Cooling Guard" as a flow doc (no visual builder yet — authored via the flow data model/JSON or a minimal P1 form); trigger `stateChange system.cpu.temp > 85`; nodes set Silent profile + notify + dim (smart-home action stubbed/deferred to P4, but the flow runs its available actions). Engine arms the trigger and runs host-side on the crossing.

**J6 Second device, different permissions (PRD Journey 6).** Pair a kitchen tablet; deny power actions + limit categories; assign kitchen layout; engine rejects any forbidden tap regardless of layout.

> J5 (smart home), J7 (remote) are out of Phase 1 (seams only).

---

### 14. Consolidated code structure

```
cyberdeck/
├── engine/                      (Go)
│   ├── cmd/cyberdeck/main.go
│   ├── core/
│   │   ├── transport/  (WS-4)
│   │   ├── security/   (WS-3)
│   │   ├── state/ registry/ eventbus/ session/  (WS-6)
│   │   ├── flow/       (WS-7)
│   │   └── persistence/ (WS-2)
│   ├── pluginhost/     (WS-5)
│   ├── pal/            (WS-5 interfaces + chains)
│   └── internal/ lifecycle/ service/ config/  (WS-1)
├── plugins/            (WS-5: telemetry power volume launchers notifications)
├── client/lib/         (Flutter — WS-8 + WS-9 + WS-1 tray)
│   ├── net/ render/ gestures/ app/ theme/ tray/
│   └── designer/       (desktop-only)
├── shared/schemas/     (action/widget/flownode/state + protocol envelope)
├── installers/         (windows macos linux)
└── docs/               (this set)
```

### 15. Test plan

| Layer | Scope | Tooling | Pass criteria |
|-------|-------|---------|---------------|
| Unit — engine | state store delta/ring buffer; `authorize()` matrix; expression eval; registry merge; formatters | Go test | >80% branch; 100% pass |
| Unit — client | widget builders (descriptor→render); value_rules; op apply/diff | Flutter test | golden tests pass |
| Integration — pairing | full handshake incl. bad token, wrong fingerprint, revoked device | mock client + engine | all rejection paths correct |
| Integration — transport | 3-channel multiplex; heartbeat/drop/reconnect; resync on gap; fan-out to N sessions | mock-session harness | states broadcast <3 s of session open; reconnect <5 s |
| Integration — plugin host | launch/crash/restart; faulted plugin → states `--`, engine alive | mock + real telemetry plugin | engine survives induced plugin panic |
| Integration — flow | each node; if/loop branching; stateChange edge-trigger + debounce; cancellation; permission-gated action in a flow | Go test | deterministic outcomes; no engine crash on node failure |
| E2E | J0/J1/J2/J6 on Android emulator + desktop | Appium/Flutter integration | journeys complete without error |
| Visual regression | Designer canvas + client widgets vs design tokens | golden screenshots | <2% pixel diff |
| Performance soak | 8 h engine run, ≥8 sessions, telemetry live | psutil reporter | RSS growth <5 MB/h; idle CPU <2%; 60 FPS render |
| Security | sniff (must be ciphertext); MITM (fingerprint blocks); rogue pair (token blocks); secret never in logs/db | scripted | all controls hold |

### 16. Milestones & sequencing

| Milestone | Content | Gate |
|-----------|---------|------|
| **M1 Engine skeleton** | WS-1 + WS-2: service boots, SQLite migrates, tray shows status | engine runs as service, survives UI close |
| **M2 Secure session** | WS-3 + WS-4: pair a device, encrypted session, heartbeat/reconnect | phone pairs via QR; reconnect <5 s |
| **M3 Live telemetry** | WS-5 + WS-6: telemetry plugin publishes; client renders a gauge | CPU gauge live on phone; delta broadcast verified |
| **M4 Actions & permissions** | power/volume/launchers; authorize+audit; 2-tap confirm | forbidden device tap rejected + audited |
| **M5 Flows** | WS-7: model + executor + triggers; a stateChange flow runs | Cooling-Guard-style flow fires host-side |
| **M6 Designer** | WS-9: drag-drop, schema inspector, op-log live reflection, undo | drag gauge on PC → appears on tablet <200 ms |
| **M7 Harden** | soak, all ACs, installers for 3 OSes, security tests | Definition of Done (§1) met |

### 17. Risks & mitigations

| Risk | Prob | Impact | Mitigation |
|------|------|--------|-----------|
| mDNS blocked on enterprise/VLAN LANs | Med | Med | Manual + active-scan fallbacks are P1, not optional (2A §3) |
| Per-OS secret store gaps (headless Linux) | Med | Med | Documented encrypted-file fallback + operator note (2E §7) |
| GPU telemetry coverage varies (AMD/Intel) | Med | Med | Provider chain degrades to `unavailable` cleanly (2G) |
| OOP plugin IPC overhead vs NFR budget | Low | Med | Coalesced stateUpdate; delta-only; soak test gates early |
| Designer live-reflection latency >200 ms | Low | Med | Targeted repaint + throttled preview; measured at M6 |
| Crypto suite mis-implementation | Low | High | Use vetted libraries; security test suite; external review before P7 remote |
| Flutter desktop packaging friction (notarization, Linux variants) | Med | Low | `flutter_distributor` + per-OS scripts validated at M7 |

### 18. Acceptance criteria (traced)

Phase-1 ACs (extending PRD §8 and carried AC-001…010), each verified in §15/§16:

| AC | Criterion | Trace |
|----|-----------|-------|
| P1-AC-01 | Engine installs as a service, starts on boot, survives Desktop UI close. | FR-1.1/1.2, M1 |
| P1-AC-02 | A phone pairs via QR with token+fingerprint; rogue token and wrong fingerprint are rejected. | FR-2.3, 2E, M2 |
| P1-AC-03 | All session traffic is ciphertext on the wire; verified by capture. | FR-5.1, M2 |
| P1-AC-04 | CPU/GPU/RAM/storage/network telemetry renders live within cadence; matches Task Manager CPU% ±1%. | FR-6.3, M3 |
| P1-AC-05 | A bound gauge shows `--` when its provider is unavailable; UI never crashes. | FR-6.8, 2G, M3 |
| P1-AC-06 | Tapping Restart shows a 2-tap confirmation; second tap restarts. | FR-7.3, M4 |
| P1-AC-07 | A device denied power actions cannot restart the PC even via a layout that contains the action; attempt is audited. | FR-4.1/4.2/4.4, M4 |
| P1-AC-08 | A `stateChange` flow fires host-side on threshold crossing and runs its node graph; failures are logged, engine survives. | FR-10.1/10.5/10.7, M5 |
| P1-AC-09 | Dragging a widget in the Designer reflects on a bound device in <200 ms; undo reverts on both. | FR-8.5/8.6, NFR-02, M6 |
| P1-AC-10 | The inspector edits any registered action's params via auto-generated editors with no per-action UI code. | FR-7.2, ADR-0006, M6 |
| P1-AC-11 | Two devices show different profiles simultaneously without interference. | FR-3.2, M3/M6 |
| P1-AC-12 | On disconnect, widgets dim to last value with a connection badge; reconnect <5 s restores live data. | FR-5.4, NFR-05, M2 |
| P1-AC-13 | A plugin crash leaves the engine running; the plugin's states read `--` until restart. | NFR-07, 2F, M3 |
| P1-AC-14 | Engine holds <150 MB RAM and <2% idle CPU after 8 h with ≥8 sessions. | NFR-08/09/10, M7 |
| P1-AC-15 | Native installers produce working `.exe`/`.msi`, `.dmg`/`.pkg`, `.deb`/`.rpm`/`.AppImage`. | NFR-19, M7 |
| P1-AC-16 | All text meets WCAG 2.1 AA (4.5:1) on the dark theme; touch targets ≥48×48. | NFR-14/15, M6 |

---
*End of Phase 1 Deep Dive (Draft v0.1). Subsequent per-phase deep dives (Phase 2 Media, Phase 3 Gaming & Automation UI, etc.) follow the same structure and attach at the seams this phase builds.*

---



<a id="document-4-phase-2-media-integration-deep-dive"></a>

# Document 4 — Phase 2 (Media Integration) Deep Dive

## CyberDeck — Phase 2 (Media Integration) Deep Dive

**Document 4 of the CyberDeck Enterprise Documentation Set · Per-Phase Deep Dive**
Version 0.1 (Draft) · June 2026 · Codebase ID: `com.shishir.cyberdeck`

> Implementation-depth specification for **Phase 2 (Media Integration)**. Builds entirely on the Phase 1 foundation and its seams. Authority chain unchanged (Doc 0 → 1 → 2/2A–2G/2-ADR → this). New architectural decision introduced here: **ADR-0021 (binary asset delivery)**.

### Contents
1. Phase intent & definition of done
2. Scope: in / out
3. What this phase consumes from Phase 1 (the seams)
4. Workstream map & dependency order
5. WS-2.1 Media capability plugin (full metadata + transport controls)
6. WS-2.2 Binary asset delivery (album art) — new seam
7. WS-2.3 Multi-channel volume mixer & audio output
8. WS-2.4 Media widget family
9. WS-2.5 Expanded gesture-slot designer UI
10. WS-2.6 App-focus automatic profile switching
11. WS-2.7 Layout import / export
12. WS-2.8 EQ presets (P3, opportunistic)
13. End-to-end realized journeys
14. Code structure (additions)
15. Test plan
16. Milestones & sequencing
17. Risks & mitigations
18. Acceptance criteria (traced)

---

### 1. Phase intent & definition of done

**Intent.** Turn the Phase-1 "media controls + system volume" stub into a complete media experience — full now-playing metadata, album art on every device (including remote phones), playback position/progress, shuffle/repeat, a multi-channel volume mixer, and a rich media widget family — while delivering two cross-cutting capabilities that media motivates first but the whole product needs: **binary asset delivery** and **automatic app-focus profile switching** (the first consumer of the Phase-1 activation-rule seam). Also completes the **designer UI for the remaining gesture slots** and adds **layout import/export**.

**Definition of done.**
- Now-playing metadata, album art, progress, shuffle/repeat live on all paired device classes, including a remote phone that never shares the host's filesystem.
- Album art transfers once per image (content-addressed cache) and respects the media-state-update latency budget (NFR-04 < 500 ms for metadata; art may arrive slightly later, progressively).
- Multi-channel mixer controls per-app volumes independently of system master.
- The Designer can map all gesture slots (double/down/up/swipe) and edit the media widgets.
- App-focus switching changes a device's active profile automatically per a profile's activation rule, with no client involvement.
- Layout import/export round-trips a profile between engines.
- All Phase-2 ACs (§18) verified; NFR budgets still hold (asset cache must not breach engine RAM budget).

### 2. Scope: in / out

#### In scope (Phase 2)
| Area | Included | PRD |
|------|----------|-----|
| Media metadata | track/artist/album, duration, position (≤500 ms), shuffle, repeat | D10-04/05 |
| Album art | retrieval, cache, **binary delivery to remote clients** | D10-03 |
| Volume | multi-channel per-app mixer; audio output device selection | D10-06/07 |
| Media widgets | rich media card, now-playing, progress bar, mixer widget, output selector | D5-09 |
| Designer | UI for double/down/up/swipe slots; media-widget editing | D6-06 |
| Profiles | **automatic app-focus profile switching** (consumes V1 activation rule) | D2 / Doc 0 §12 |
| Portability | layout import/export | D4-11 |
| EQ | EQ presets (P3, opportunistic if time) | D10-08 |

#### Out of scope (later)
Gaming optimization/FPS (P3) · smart home (P4) · full notification feed (P5) · plugin SDK (P6) · remote/relay (P7). The **asset delivery** built here is reused by P3 game covers and P5 camera thumbnails (seam, not re-built).

### 3. What this phase consumes from Phase 1 (the seams)

| Phase-1 seam | Phase-2 use |
|--------------|-------------|
| PAL capability interface + provider chains (2G) | `MediaControl` interface gains full metadata/position; new `AudioSessions` + `WindowFocus` capabilities |
| Plugin host + 1P plugin model (2F) | `media` plugin expanded; `windowfocus` provider added; all out-of-process, same contract |
| State store + typed states (2B) | new media/mixer states; album-art state now carries an **asset reference**, not a local path |
| Widget-type registry + renderer registry (2B/2C) | new media widget types registered; client builders added |
| Interaction slot model (2C §3) | designer UI extended to the already-modeled double/down/up/swipe slots |
| Profile activation rule **field + hook** (2B §5.2) | the **consumer** that evaluates the rule and switches profiles is built now |
| Transport channels (2A) | a new **request/response asset fetch** rides the session (ADR-0021) |
| Op-log + document model (2C) | import/export serializes/deserializes a profile document |

No Phase-1 contract changes — every Phase-2 feature attaches at a pre-built seam, validating the foundation design.

### 4. Workstream map & dependency order

```
WS-2.1 Media plugin (metadata/controls) ─┐
WS-2.2 Asset delivery (album art) ────────┼─► WS-2.4 Media widgets ─► WS-2.5 Designer gesture UI
WS-2.3 Volume mixer / output ─────────────┘
WS-2.6 App-focus switching (independent) ─────────────────────────────────────────────
WS-2.7 Import/export (independent) ───────────────────────────────────────────────────
WS-2.8 EQ presets (opportunistic) ────────────────────────────────────────────────────
```
Critical path: WS-2.1 → WS-2.2 → WS-2.4 → WS-2.5. WS-2.3, WS-2.6, WS-2.7 parallelizable. WS-2.8 only if capacity remains.

---

### 5. WS-2.1 — Media capability plugin (full metadata + transport controls)

**Owning TRD:** 2G (`MediaControl`), 2F (plugin). **PRD:** D10-01…05.

#### 5.1 Functional flow
```
OS media session changes (track/state/position)
  → media plugin (SMTC/MPNowPlaying/MPRIS provider) fires change handler
  → fetch metadata (title/artist/album/duration); compute position
  → stateUpdate(media.*) via host IPC → StateStore (2B) → delta → clients
  → on track change: emit media.track_changed event (event bus) → triggers album-art fetch (WS-2.2)
User taps play/pause/next/prev/shuffle/repeat
  → interaction event → authorize → invokeAction(media.*) → plugin → OS session command
```

#### 5.2 Capability detail
- States (typed): `media.track, media.artist, media.album, media.duration, media.position, media.playing, media.shuffle, media.repeat, media.albumart.ref` (asset ref, see WS-2.2).
- Actions: `media.play/pause/next/previous/shuffle.toggle/repeat.toggle` (no params); position updated ≤500 ms via a polling/event task.
- Provider chain (`MediaControl`): SMTC (Windows) → MPNowPlaying (macOS) → MPRIS (Linux) → unavailable.

#### 5.3 Technical spec
- Position: provider task polls playback info on a ≤500 ms cadence; only pushes on change (delta).
- Repeat is tri-state (off/one/all) → enum state; shuffle boolean.
- The plugin owns formatting-free typed values (ADR-0019): `media.position` as seconds (number), client formats `1:24`.

#### 5.4 Code structure
```
plugins/media/
  main.go manifest.json
  providers/{smtc_windows.go, mpnowplaying_darwin.go, mpris_linux.go}
  metadata.go position.go controls.go
engine/pal/media.go        // MediaControl interface extended (metadata+position+shuffle/repeat)
```

#### 5.5 Data flow
DF-A for media states; new `media.track_changed` event drives WS-2.2. Actions via DF-B.

---

### 6. WS-2.2 — Binary asset delivery (album art) — NEW SEAM (ADR-0021)

**Owning TRD:** 2A (transport addition), 2B (asset ref state). **ADR:** **0021 (new)**.

#### 6.1 The problem
Phase 1 represented album art as a local file URL — valid only when client == host. A **remote phone** has no access to the host filesystem, so the art bytes must be transferred. Binary data must not bloat the JSON State channel (base64 per tick would be wasteful and breach budgets).

#### 6.2 The decision (ADR-0021)
**Content-addressed asset delivery with client-side cache.**
- The engine computes a **content hash** (e.g. SHA-256) of each asset (album art image) and exposes it as an **asset reference** (`media.albumart.ref = "sha256:abcd…"`), published as an ordinary state (small string).
- When a client needs an asset it doesn't have cached, it issues an **`assetRequest{ref}`** over the session; the engine replies with **`assetResponse{ref, mime, bytes}`** (binary, chunked if large).
- The client caches by hash; identical art (same album replayed, same art across devices) transfers **once per device, ever**.
- This is a **request/response** over the existing session (a typed message pair), not a new always-on channel — keeping ADR-0011's three-channel model intact. Binary payloads are length-framed (2A §5.1) and need no base64.

#### 6.3 Capability detail
- Engine-side asset store: the media plugin saves fetched art to the host art cache (carried from old design: `%TEMP%/cyberdeck_art`, TTL 24 h, LRU, ≤100 MB), keyed by content hash; the engine indexes hash→bytes.
- Client-side asset cache: bounded LRU on device; eviction independent of engine.
- Progressive UX: the media card renders metadata immediately and the art when it arrives (a frame or two later) — metadata latency (NFR-04) is unaffected by art transfer.

#### 6.4 Technical spec
- New message types (shared envelope, `type:"assetRequest"|"assetResponse"`); large assets chunked with an ordered reassembly.
- Asset bytes are **not** persisted in SQLite (binary, ephemeral) — host cache is the in-memory/temp index; survives restart only via the temp cache (acceptable, art re-fetches cheaply).
- Reused by P3 (game covers, SteamGridDB) and P5 (camera thumbnails) — the asset reference + fetch is capability-agnostic (`asset.ref` shape generalized).

#### 6.5 Code structure
```
engine/core/transport/assets.go      // assetRequest/Response handling, chunking
engine/core/assetstore/store.go      // hash index, host cache, LRU/TTL
plugins/media/albumart.go            // fetch art → hash → register in asset store → set ref state
client/lib/net/asset_fetch.dart      // request-on-miss, reassembly
client/lib/cache/asset_cache.dart    // client LRU by hash
```

#### 6.6 Data flow
```
track change → plugin fetches art → assetstore.put(bytes) → hash
  → stateUpdate(media.albumart.ref = hash) → clients (DF-A)
client media card sees new ref → cache miss → assetRequest(hash)
  → engine assetResponse(bytes) → client caches → art renders
```

---

### 7. WS-2.3 — Multi-channel volume mixer & audio output

**Owning TRD:** 2G (`AudioSessions`, `AudioOutput`), 2F. **PRD:** D10-06/07.

#### 7.1 Capability detail
- Per-app volume: enumerate active audio sessions (app name, current volume, mute); set per-app volume independent of system master (FR-3.5 carried).
- System master volume already exists (Phase 1 `volume` plugin) — mixer extends it.
- Audio output device selection: list output devices; switch default output.

#### 7.2 Technical spec
- New PAL capabilities: `AudioSessions` (per-app) and `AudioOutput` (device list/select). Provider chain: Core Audio sessions (Windows/pycaw-equivalent) → CoreAudio (macOS) → PulseAudio/PipeWire (Linux) → unavailable.
- States: `media.volume.system` (exists), `media.volume.<app>` (dynamic per session), `audio.output.current`, `audio.output.list` (enum).
- Actions: `media.volume.set{level}`, `media.volume.app.set{app,level}`, `audio.output.select{device}`.
- Dynamic states: per-app volume states are **created at runtime** as sessions appear/disappear (2B dynamic state creation; designer binds to known ones, with a generic "active app N" fallback).

#### 7.3 Code structure
```
plugins/volume/  (expanded)
  sessions_{windows,darwin,linux}.go   output_{windows,darwin,linux}.go
engine/pal/audio.go                    // AudioSessions, AudioOutput interfaces
```

---

### 8. WS-2.4 — Media widget family

**Owning TRD:** 2C §7. **PRD:** D5-09.

#### 8.1 Capability detail
New client widget types (registered in widget-type registry, 2B; native builders in client renderer registry, 2C):
- **`media.card`** — album art (asset ref) + track/artist/album + progress bar + transport controls + shuffle/repeat + favourite.
- **`media.nowplaying`** — compact variant (art + title + play/pause) for the persistent media bar.
- **`media.progress`** — standalone progress/scrubber bound to `media.position`/`media.duration`.
- **`media.mixer`** — multi-row per-app volume sliders (binds to `media.volume.*`).
- **`audio.output.selector`** — dropdown bound to `audio.output.list`/`current`.

#### 8.2 Technical spec
- `media.card` consumes the asset-ref → asset-fetch path (WS-2.2); renders metadata instantly, art progressively.
- Progress widget updates from `media.position` deltas (≤500 ms) with client-side interpolation between updates for smoothness (no extra traffic).
- Persistent media bar (`media.nowplaying`) appears on non-dashboard pages (carried design intent) — implemented as a page-template element the Designer can include.

#### 8.3 Code structure
```
client/lib/render/widgets/{media_card.dart, media_nowplaying.dart, media_progress.dart, media_mixer.dart, audio_output_selector.dart}
shared/schemas/widgets/ (new media widget descriptors)
```

---

### 9. WS-2.5 — Expanded gesture-slot designer UI

**Owning TRD:** 2C §8. **PRD:** D6-06.

#### 9.1 Capability detail
The interaction-slot **model** for double-tap/press-down/press-up/swipe already exists from Phase 1 (2C §3); Phase 2 adds the **Designer UI** to map them. The inspector's interaction tab gains slots for `doubleTap, pressDown, pressUp, swipeLeft/Right/Up/Down`, each with the same target picker (action/macro/flow/navigate) and schema-driven param editor as the Phase-1 `tap/longPress/dragValue` slots.

#### 9.2 Technical spec
- Pure inspector extension — emits the same `SetInteraction` ops (2C §4.1) for the new slots; no engine change (the slots were always in the widget model). The client gesture capture for these slots already exists from Phase 1 (WS-8); this just exposes authoring.
- pressDown/pressUp are surfaced as a paired "momentary" affordance in the UI (e.g. push-to-talk) to make the down/up semantics clear.

#### 9.3 Code structure
```
client/lib/designer/inspector/interaction.dart  (extended: all slots)
```

---

### 10. WS-2.6 — App-focus automatic profile switching

**Owning TRD:** 2B §5.2 (consumer), 2G (`WindowFocus`). **PRD:** D2/Doc 0 §12 seam.

#### 10.1 Functional flow
```
foreground app changes on host
  → windowfocus provider emits focus event (app id/exe/title)
  → session manager evaluates each device session's profiles' activationRule
  → if a profile's rule matches (e.g. appFocus match "Cyberpunk2077.exe")
       and that device is set to auto-switch → switch session active profile
  → engine pushes the new profile's layout to that device (DF-C-style) → device shows it
```

#### 10.2 Capability detail
- New PAL capability `WindowFocus` (provider chain: Win32 foreground hooks → macOS NSWorkspace → Linux X11/Wayland → unavailable; degrades cleanly where unsupported).
- Consumes the Phase-1 `Profile.activationRule` field and the engine evaluation hook (built but inert in V1).
- Per-device opt-in (`permissions.allowEditTrigger` analog / a device setting `autoSwitch`), so a wall-panel tablet can pin one profile while a gaming phone auto-switches.
- Manual override: a user navigation pins until released (so auto-switch doesn't fight the user).

#### 10.3 Technical spec
- Activation rule kinds (V1 reserved → now active): `appFocus{match}`. Future kinds (state-based, time-based) extend the same evaluator.
- Debounced focus events (avoid thrash on rapid alt-tab); last-stable-wins.
- Switching is a session operation (no new document); it just changes which profile the session renders, reusing the layout push path.

#### 10.4 Code structure
```
engine/pal/windowfocus.go
plugins/windowfocus/ main.go manifest.json focus_{windows,darwin,linux}.go
engine/core/session/activation.go  (now consumes focus events; was a hook stub in P1)
```

---

### 11. WS-2.7 — Layout import / export

**Owning TRD:** 2C (document model). **PRD:** D4-11.

#### 11.1 Capability detail
Export a profile (and its pages/widgets) to a portable file; import it into another engine (or back up). Useful for sharing community layouts (precursor to the P6 marketplace).

#### 11.2 Technical spec
- Export serializes the profile document tree (the same `body_json` shape SQLite stores, 2B) + a manifest (device class, required widget types, required actions, schema versions) into a `.cyberdeck-layout` file (a zip with `profile.json` + manifest).
- Import validates: device class compatibility, and that **required widget types/actions exist** in the target engine's registries (a layout depending on a not-installed plugin's action warns and offers to map/skip). This makes the registry-dependency explicit — a layout is portable only as far as its capabilities are present.
- No credentials/secrets in an exported layout (consistent with 2E).

#### 11.3 Code structure
```
engine/core/layout/portability.go    // export/import serialization + dependency check
client/lib/designer/import_export.dart
shared/schemas/layout_package.schema.json
```

---

### 12. WS-2.8 — EQ presets (P3 priority, opportunistic)

**PRD:** D10-08 (P3). Included in Phase 2 only if capacity remains, since it's lower priority.

- EQ preset buttons that apply a system/app EQ where the OS/app exposes one; otherwise the capability is `unavailable` (provider chain). States: `media.eq.preset`. Action: `media.eq.set{preset}`. Implemented as a media-plugin extension; deferred without guilt if Phase 2 is tight (it's P3).

---

### 13. End-to-end realized journeys (Phase 2)

**Streamer media session (PRD Persona 2 / Journey extension).** Jordan's iPad shows a `media.card` with live art + progress; taps next/shuffle; adjusts mic vs music via the `media.mixer`; switches audio output to headphones via the selector — all without keyboard shortcuts.

**Album art on a remote-less phone.** A phone (no host FS access) plays a new track → metadata appears instantly → art arrives a frame later via content-addressed fetch → replaying the album shows art instantly (cached).

**Auto-switch on game launch (completes PRD Journey 2).** Launching Cyberpunk brings it to focus → the gaming phone auto-switches to the Gaming profile with no tap; alt-tabbing back to desktop switches back (debounced).

**Share a layout.** A user exports their "Streaming" profile and sends the file to a friend, who imports it; the importer is warned that it needs the (first-party) media actions, which are present, so it loads.

---

### 14. Code structure (additions to the Phase-1 tree)

```
engine/
  core/transport/assets.go
  core/assetstore/store.go
  core/layout/portability.go
  core/session/activation.go        (now active)
  pal/{media.go(extended), audio.go, windowfocus.go}
plugins/
  media/   (expanded: providers, metadata, position, controls, albumart)
  volume/  (expanded: sessions, output)
  windowfocus/  (new)
client/lib/
  net/asset_fetch.dart   cache/asset_cache.dart
  render/widgets/{media_card,media_nowplaying,media_progress,media_mixer,audio_output_selector}.dart
  designer/inspector/interaction.dart (extended)  designer/import_export.dart
shared/schemas/  (media widgets, layout_package)
```

### 15. Test plan

| Layer | Scope | Pass criteria |
|-------|-------|---------------|
| Unit — media plugin | metadata mapping; position cadence; shuffle/repeat enum; provider fallback | correct typed states; unavailable degrades |
| Unit — asset store | hash dedupe; LRU/TTL eviction; chunk reassembly | identical art stored once; bounded size |
| Integration — asset delivery | art reaches a client with no host FS access; cached on second play | one transfer per device per hash; metadata latency unaffected |
| Integration — mixer | per-app volume independent of master; dynamic session states appear/disappear | independent control verified |
| Integration — app-focus | rule match switches profile; debounce; manual override pins | correct profile shown; no thrash |
| Integration — import/export | round-trip a profile; import with missing dependency warns | dependency check correct |
| E2E | streamer journey on iPad emulator; auto-switch on focus | journeys pass |
| Performance | asset cache under RAM budget; media updates ≤500 ms | NFR-04 holds; engine RAM < 150 MB incl. art index |
| Visual regression | media widgets vs design tokens | <2% diff |

### 16. Milestones & sequencing

| Milestone | Content | Gate |
|-----------|---------|------|
| **M2.1 Media metadata live** | WS-2.1 | track/artist/state/position live on a device |
| **M2.2 Art everywhere** | WS-2.2 | album art on a phone with no host FS; cached on replay |
| **M2.3 Mixer & output** | WS-2.3 | per-app volume + output switch |
| **M2.4 Media widgets + designer slots** | WS-2.4 + WS-2.5 | media card authored; all gesture slots mappable |
| **M2.5 Auto-switch** | WS-2.6 | game-launch profile switch, debounced |
| **M2.6 Portability + harden** | WS-2.7 (+WS-2.8 if time) + ACs | import/export round-trips; ACs met |

### 17. Risks & mitigations

| Risk | Prob | Impact | Mitigation |
|------|------|--------|-----------|
| SMTC/MPRIS metadata coverage varies by app | Med | Med | Provider reports partial fields; widgets handle missing fields gracefully |
| Album art latency hurts perceived snappiness | Med | Low | Metadata renders instantly; art progressive; content-addressed cache makes repeats instant |
| Asset cache breaches engine RAM budget | Low | Med | Bounded LRU + TTL on host index; bytes in temp, not RAM-resident long-term |
| Per-app volume API differences (esp. Linux Pulse vs PipeWire) | Med | Med | Provider chain; degrade to system-master-only where unsupported |
| Window-focus detection on Wayland is restricted | Med | Med | Provider chain → unavailable on locked-down Wayland; document; auto-switch simply inert there |
| Chunked binary over the JSON-envelope session | Low | Med | Length-framed binary payloads (2A §5.1); not base64; tested with large art |

### 18. Acceptance criteria (traced)

| AC | Criterion | Trace |
|----|-----------|-------|
| P2-AC-01 | Now-playing metadata (track/artist/album/duration) and play/pause/next/prev work on all paired classes. | D10-01/02, M2.1 |
| P2-AC-02 | Playback position updates ≤500 ms; progress widget interpolates smoothly between updates. | D10-04, NFR-04, M2.1 |
| P2-AC-03 | Shuffle and repeat (tri-state) reflect and toggle correctly. | D10-05, M2.1 |
| P2-AC-04 | Album art displays on a phone with no host filesystem access; identical art transfers once per device (cached). | D10-03, ADR-0021, M2.2 |
| P2-AC-05 | Per-app volume is controllable independently of system master; output device is selectable. | D10-06/07, M2.3 |
| P2-AC-06 | The media card renders metadata immediately and art progressively without breaching media latency. | NFR-04, M2.2/M2.4 |
| P2-AC-07 | The Designer can map all gesture slots (double/down/up/swipe) using the same schema-driven editors. | D6-06, M2.4 |
| P2-AC-08 | Bringing a matching app to focus auto-switches a device's profile (debounced); manual navigation overrides. | Doc 0 §12, M2.5 |
| P2-AC-09 | A profile exports to a portable file and imports into another engine; missing-capability dependencies are detected and warned. | D4-11, M2.6 |
| P2-AC-10 | All Phase-1 NFR budgets still hold with media + asset cache active (RAM <150 MB, 60 FPS, idle CPU <2%). | NFR-08/09, M2.6 |
| P2-AC-11 | Where a media/audio/focus provider is unsupported on an OS, the capability degrades to `unavailable`/`--` with no crash. | ADR-0007, all |

---
*End of Phase 2 Deep Dive (Draft v0.1). New decision ADR-0021 appended to the Decision Log. Next: Phase 3 (Gaming Integration + the visual flow builder UI + schedule triggers).*

---



<a id="document-5-phase-3-gaming-automation-authoring-deep-dive"></a>

# Document 5 — Phase 3 (Gaming + Automation Authoring) Deep Dive

## CyberDeck — Phase 3 (Gaming Integration + Automation Authoring) Deep Dive

**Document 5 of the CyberDeck Enterprise Documentation Set · Per-Phase Deep Dive**
Version 0.1 (Draft) · June 2026 · Codebase ID: `com.shishir.cyberdeck`

> Implementation-depth specification for **Phase 3**. Two thrusts: (a) the **gaming capability set** and deeper system telemetry/control; (b) the **automation-authoring leap** — the visual flow builder UI, schedule triggers, and extended flow nodes — all over the Phase-1 flow model. Authority chain unchanged. New decisions introduced: **ADR-0022 (flow-document op model)**, **ADR-0023 (privileged/elevated action gating)**, **ADR-0024 (HTTP/network flow node permission)**.

### Contents
1. Phase intent & definition of done
2. Scope: in / out
3. Seams consumed from Phases 1–2
4. Workstream map & dependency order
5. WS-3.1 FPS capability (provider chain implemented)
6. WS-3.2 Game detection & game-cover launcher
7. WS-3.3 Game profiles & optimization (privileged actions)
8. WS-3.4 Deep telemetry & system control
9. WS-3.5 Gaming widgets & charts
10. WS-3.6 Visual flow builder UI
11. WS-3.7 Schedule triggers & extended flow nodes
12. WS-3.8 Capture & achievements (opportunistic)
13. End-to-end realized journeys
14. Code structure (additions)
15. Test plan
16. Milestones & sequencing
17. Risks & mitigations
18. Acceptance criteria (traced)

---

### 1. Phase intent & definition of done

**Intent.** Make CyberDeck a first-class gaming control surface (live FPS, one-tap game launch from cover art, optimization profiles, deep telemetry) **and** make the flow engine *authorable by humans* — the Phase-1 model/executor exists, but until now flows had to be written as data. Phase 3 ships the **visual flow builder**, **schedule triggers**, and **extended nodes**, completing the "Builder" persona's experience.

**Definition of done.**
- Live FPS renders where a provider is available (PresentMon primary on Windows), and degrades to `unavailable` elsewhere with no breakage.
- Game launch from cover-art tiles works for the major launchers; covers fetch via the Phase-2 asset pipeline.
- Game profiles apply power plan + process priorities (+ best-effort RAM clean / network tweaks) atomically and reversibly; privileged operations are gated and audited.
- The visual flow builder lets a user assemble a non-trivial conditional flow (branch + variable + wait) and run it — the Morgan-persona "< 10 min" metric is now testable.
- Schedule triggers fire flows on time/cron; the HTTP-request and parallel nodes work under permission gating.
- All Phase-3 ACs verified; NFR budgets hold.

### 2. Scope: in / out

#### In scope (Phase 3)
| Area | Included | PRD |
|------|----------|-----|
| FPS | provider chain implemented (native→PresentMon→FrameView→RTSS→vendor→unavailable) | D11-02 |
| Launch | game-cover grid launcher; current-game detection | D11-01/06 |
| Optimization | game profiles (Competitive/AAA/Streaming/Battery); RAM cleaner; network boost (best-effort) | D11-03/04/05 |
| Telemetry | system health score; top-processes table; fan speed read | D8-08/09/10 |
| Control | performance/power-plan selector; kill process; fan control write | D9-04/05/07 |
| Widgets | rolling line chart; donut/distribution chart; FPS/resource displays | D5-11/12 |
| **Automation UI** | **visual flow builder** | D7-09 |
| **Triggers** | **schedule/cron triggers** | D7-10 |
| **Nodes** | HTTP request, parallel/fork | D7-11 |
| Capture | screenshot/clip capture; achievements (P3, opportunistic) | D11-07/08 |

#### Out of scope
Smart home (P4) · notifications/cameras (P5) · plugin-provided nodes/widgets & SDK (P6) · remote (P7). Capture/achievements are opportunistic.

### 3. Seams consumed from Phases 1–2

| Seam | Phase-3 use |
|------|-------------|
| PAL provider chains (2G) | FPS chain finally implemented; new `Processes`, `PowerPlan`, `Fans`, `GameDetect` capabilities |
| Privileged actions (2E permissions + `destructive`) | profile changes, kill process, fan write, RAM clean → elevated gating (ADR-0023) |
| Asset delivery (ADR-0021) | **game covers** (SteamGridDB) reuse the content-addressed fetch — no new mechanism |
| Flow model + executor + registries (2D/2B) | the **visual builder** reads node/action schemas and edits the flow document; extended nodes register the same way |
| `Flow.trigger.kind=schedule` reserved field (2D §6) | the scheduler consumer is built now |
| Op-log pattern (2C/ADR-0012) | adapted into a **flow-document op model** (ADR-0022) for builder undo/redo |
| Layout designer inspector (2C §8.2) | the flow builder's param editors reuse the same schema-form generator |

No foundation contract changes; three new ADRs refine existing seams rather than replace them.

### 4. Workstream map & dependency order

```
WS-3.1 FPS ─────────┐
WS-3.2 Launch/detect ┼─► WS-3.5 Gaming widgets & charts
WS-3.3 Profiles/opt ─┤        (FPS display, charts, resource bars)
WS-3.4 Deep telem/ctl┘
WS-3.6 Visual flow builder ───► WS-3.7 Schedule + extended nodes
WS-3.8 Capture/achievements (opportunistic)
```
Two parallel tracks: **gaming** (3.1–3.5) and **automation** (3.6–3.7). They share nothing but the registries/asset seam, so they can be built by separate sub-teams concurrently. Critical path on the gaming track: 3.1–3.4 → 3.5; on the automation track: 3.6 → 3.7.

---

### 5. WS-3.1 — FPS capability (provider chain implemented)

**Owning TRD:** 2G §4–§5. **PRD:** D11-02. **ADR:** 0007.

#### 5.1 Functional flow
```
host start → FPS capability probe in priority order:
   native_app_telemetry (inert) → PresentMon (Windows) → FrameView → RTSS → vendor → unavailable
   → bind first available
during play → bound provider samples frame timing → FPS.Current() → (144, true)
   → stateUpdate(gaming.fps) → clients; if FPS<30 for 5s → gaming.fps_low event → (optional flow)
```

#### 5.2 Capability detail
- Implements the FPS chain specified in 2G; **PresentMon is the Windows primary** (open-source, no overlay; bundling pending the licensing review tracked in 2G §7 — that review **must close before this ships bundled**).
- Vendor APIs remain ranked low for FPS (GPU telemetry reliable, per-app FPS not — 2G §4.4).
- macOS/Linux: chain resolves to `unavailable` in V1 unless a native/vendor path exists — a normal, non-breaking outcome.

#### 5.3 Technical spec
- The FPS plugin spawns/attaches to the chosen provider; PresentMon integration runs it as a child capture process, parses its frame-time stream, derives FPS (`1/frametime` smoothed), publishes `gaming.fps` (number) at ~1 s cadence with optional series buffer for a sparkline.
- Re-probe on provider fault (2G §4.3) — e.g. PresentMon permission denied → fall to next or unavailable.

#### 5.4 Code structure
```
plugins/fps/ main.go manifest.json
  providers/{presentmon_windows.go, frameview_windows.go, rtss_windows.go, vendor.go, native.go}
  parse.go smooth.go
engine/pal/fps.go   (interface from P1 2G now satisfied)
```

---

### 6. WS-3.2 — Game detection & game-cover launcher

**Owning TRD:** 2G (`GameDetect`), 2F, ADR-0021. **PRD:** D11-01/06.

#### 6.1 Capability detail
- **Current-game detection**: scan running processes against a known-launcher/game heuristic; publish `gaming.currentgame`.
- **Game-cover launcher**: a grid of game tiles with cover art. Covers fetched from **SteamGridDB** (or launcher metadata), stored in the host asset store, exposed as **asset refs** (ADR-0021) — clients fetch covers exactly like album art. Tapping a tile launches the title via its native launcher.

#### 6.2 Technical spec
- New PAL `GameDetect` (process-scan provider) and a `Launcher` extension for per-title launch (Steam URI `steam://rungameid/…`, Epic, etc.).
- Cover fetch: on first reference of a game, fetch cover → hash → asset store → set the tile's `cover.ref`; cached persistently in `assets/gameart/` (carried from old design, ≤500 MB, manual purge).
- Game library is a user-curated list (favourites) stored as part of a profile/config; the launcher widget binds to it.

#### 6.3 Code structure
```
plugins/gamedetect/ main.go manifest.json scan_{windows,darwin,linux}.go
plugins/launchers/  (extended: per-title launch, cover fetch via SteamGridDB)
engine/pal/gamedetect.go
client/lib/render/widgets/game_grid.dart   // tiles consume cover asset refs
```

---

### 7. WS-3.3 — Game profiles & optimization (privileged actions)

**Owning TRD:** 2E (permissions), 2D (profiles can be applied via flows). **PRD:** D11-03/04/05, D9-04. **ADR:** **0023 (new — elevated action gating)**.

#### 7.1 Functional flow
```
User taps "Competitive" profile
  → authorize (device perms; profile changes are privileged) → audit
  → game-profile action applies ATOMICALLY:
       set Windows power plan (e.g. Ultimate Performance)
       raise game process priority; lower background priorities
       (best-effort) RAM clean (EmptyWorkingSet on eligible processes)
       (best-effort) network tweak (QoS / disable background bandwidth)
  → on any step failure → roll back applied steps → report partial + audit
  → set gaming.mode = "Competitive"
```

#### 7.2 Capability detail
- **Game profiles**: Competitive / AAA / Streaming / Battery Saver, each a named bundle of {power plan, process-priority policy, optional RAM clean, optional network tweak}. Reversible: switching profiles reverts the prior one's changes.
- **RAM cleaner**: `EmptyWorkingSet` on non-critical processes; reports a count; never touches protected/system processes.
- **Network boost**: **honestly best-effort** — applies a documented, bounded set (process QoS, deprioritize background transfers). Where the OS doesn't permit it, the step degrades to no-op and says so. (No magic; no kernel-level claims.)
- **Performance/power-plan selector** (D9-04): Silent/Balanced/Performance/Turbo mapped to OS power plans.

#### 7.3 Elevated action gating (ADR-0023)
Several operations require **OS elevation** (admin/root) — process priority of others, `EmptyWorkingSet`, power-plan changes, fan writes. Decision:
- The engine **declares which actions are `elevated`** in their registry descriptor (extends the `destructive` flag with an `elevated` flag).
- The **engine service runs at the privilege level granted at install**; elevated actions execute within that. Where elevation is unavailable, the action degrades to the subset it can do and **reports partial success** (never silently fails, never crashes).
- Elevated actions are **always audited** with the elevation outcome.

#### 7.4 Technical spec
- A game profile is applied as a **transactional bundle**: each step records an undo closure; failure triggers rollback of completed steps. (Implemented as a built-in macro/flow internally — dogfooding the flow engine.)
- Process-priority and power-plan changes are reverted on profile switch or engine shutdown (so the machine isn't left in "Turbo" forever).

#### 7.5 Code structure
```
plugins/gameopt/ main.go manifest.json
  profiles.go powerplan_{windows,darwin,linux}.go priority.go ramclean_{windows,...}.go netboost.go rollback.go
engine/core/registry/actions.go   // + "elevated" flag
```

---

### 8. WS-3.4 — Deep telemetry & system control

**Owning TRD:** 2G, 2B. **PRD:** D8-08/09/10, D9-05/07.

#### 8.1 Capability detail
- **System health score** (D8-08): computed state (0–100) — weighted average of thermal headroom, storage health, RAM pressure, driver/system signals. A pure function over existing telemetry states; published as `system.health.score` + a label (Excellent/Good/Fair/Poor).
- **Top-processes table** (D8-09): top N by CPU/memory; a `series`/table-shaped state; backs a processes widget.
- **Fan speed read** (D8-10) + **fan control write** (D9-07): `Fans` capability (WMI/vendor providers); read RPM; write where supported (elevated, ADR-0023); degrade to read-only or unavailable otherwise.
- **Kill process** (D9-05): `system.killprocess{pid}` — privileged, audited, with confirmation.

#### 8.2 Technical spec
- Health score computed in a small first-party "health" plugin subscribing to telemetry states; recomputed on a 5 s cadence (carried).
- Top-processes is a bounded snapshot (no per-process state explosion); transmitted as one structured state, refreshed at a modest cadence to protect the budget.

#### 8.3 Code structure
```
plugins/health/    main.go manifest.json score.go
plugins/processes/ main.go manifest.json top.go kill.go
plugins/fans/      main.go manifest.json read_{windows,...}.go write_{windows,...}.go
```

---

### 9. WS-3.5 — Gaming widgets & charts

**Owning TRD:** 2C §7. **PRD:** D5-11/12.

#### 9.1 Capability detail
New client widget types: **`chart.line.rolling`** (60 s rolling line, tab-selectable CPU/GPU/RAM/FPS — binds to series states), **`chart.donut`** (storage/distribution), **FPS display** (large number + sparkline), **resource bars** (GPU/CPU/RAM/VRAM), **game grid** (WS-3.2), **profiles widget** (the 4 game profiles + create), **processes table widget**, **health gauge** (reuses circular gauge with the health score).

#### 9.2 Technical spec
- The rolling line chart consumes a `series` state's ring buffer (2B) — already transmitted as part of state; the widget renders the buffer and appends on each delta (60 FPS budget; no extra traffic).
- Charts are native Flutter custom painters (no heavy chart lib needed for these shapes), keeping the bundle lean and the render fast.

#### 9.3 Code structure
```
client/lib/render/widgets/{chart_line_rolling.dart, chart_donut.dart, fps_display.dart, resource_bars.dart, profiles.dart, processes_table.dart}
shared/schemas/widgets/ (new gaming/chart widget descriptors)
```

---

### 10. WS-3.6 — Visual flow builder UI (the automation leap)

**Owning TRD:** 2D (model/executor it authors), 2B (registries it reads). **ADR:** **0022 (new — flow-document op model)**, 0006.

#### 10.1 Functional flow
```
User opens the flow builder (desktop, alongside the layout designer)
  → builder reads flow-node registry + action registry (2B) → renders palette
  → user drags nodes onto a graph canvas, connects next/branch edges
  → selecting a node opens a schema-generated param editor (reuses 2C §8.2 schema-form)
  → setting a trigger (manual/event/stateChange/schedule) configures arming
  → save → flow document persisted (versioned, 2B workflows) → engine arms triggers
  → "test run" executes host-side; the builder shows live node-by-node execution trace
```

#### 10.2 Capability detail
- A **graph canvas** for flows: nodes (action/if/setVar/wait/loop/navigate/random/subflow/stop + Phase-3 HTTP/parallel) placed and wired; branches (`then`/`else`, loop body) drawn as labeled edges.
- **Schema-driven param editors** — identical machinery to the layout designer's inspector (ADR-0006): an action node's params, a `setVar` value, an `if` condition (with an expression editor + token autocomplete from available states/vars) all generated from schemas. **The Morgan persona's "< 10 min" target lives here.**
- **Trigger configuration** UI: manual (attach to a widget slot — cross-links to the layout designer), event (pick an engine event), stateChange (pick state + condition), schedule (cron/interval — WS-3.7).
- **Test run + live trace**: execute the flow on the engine and stream a per-node execution trace back (which node ran, branch taken, values) — invaluable for debugging, and a direct answer to the incumbents' opaque automation.
- **Validation**: the builder flags unreachable nodes, missing required params, type-mismatched expressions, and unbounded loops *before* save.

#### 10.3 Flow-document op model (ADR-0022)
The layout designer uses an op-log with **device broadcast** (ADR-0012) because edits must reflect live on devices. **Flows execute host-side and are not rendered on devices**, so they need **no live device broadcast** — but they *do* benefit from undo/redo and versioning. Decision:
- The flow builder edits the flow document via a **local op model** (AddNode, RemoveNode, ConnectEdge, SetNodeParams, SetTrigger, …) with **inverses for undo/redo** and **monotonic document versioning** (like layouts), but **without** the Layout-channel broadcast — commits persist to `workflows` (2B) and re-arm triggers.
- This keeps undo/redo + versioning consistent across both authoring surfaces while honestly reflecting that flows aren't a live device surface. The op model is the same *shape*, a different *delivery* (persist-and-rearm vs persist-and-broadcast).

#### 10.4 Technical spec
- The builder is desktop-only (same constraint as the layout designer, ADR-0018) and lives in the client codebase.
- The live trace rides a diagnostic message type over the loopback/session (debug-level; gated so it's only sent to the authoring desktop, not broadcast).
- Cross-link with layout: a `manual` trigger can be bound from either the layout designer (widget slot → flow) or the flow builder (flow → "attach to a widget") — both write the same interaction-slot reference.

#### 10.5 Code structure
```
client/lib/flowbuilder/   // desktop-only
  canvas.dart palette.dart edges.dart
  node_inspector.dart expression_editor.dart trigger_config.dart
  op_model.dart undo.dart validation.dart test_run_trace.dart
engine/core/flow/trace.go     // emit per-node execution trace (debug) to the authoring session
```

---

### 11. WS-3.7 — Schedule triggers & extended flow nodes

**Owning TRD:** 2D §6 (schedule reserved → active), §3 (node catalog extension). **ADR:** **0024 (new — network flow node permission)**.

#### 11.1 Schedule triggers
- The Phase-1-reserved `Flow.trigger.kind = "schedule"` becomes active: cron expression or fixed interval; a scheduler in the engine arms timers and fires the flow at match.
- Missed-fire policy on engine downtime: documented (default = skip missed, run next; optional "catch-up once").
- Time zone = host local; surfaced clearly in the builder.

#### 11.2 Extended nodes
- **`httpRequest`** node: call an external HTTP(S) endpoint (method, URL, headers, body, timeout) and capture the response into a local/`var` value for downstream nodes. **Powerful and dangerous**, so gated (ADR-0024).
- **`parallel` / `fork`** node: run multiple branches concurrently; an optional `join` waits for all (or first) before continuing. Concurrency bounded; each branch shares the run's global `var.*` (last-write-wins) but has its own local scope.

#### 11.3 Network flow node permission (ADR-0024)
A flow that can make arbitrary HTTP calls is an exfiltration/SSRF surface, and flows are shareable content. Decision:
- The `httpRequest` node requires an explicit **`flow.network` permission** that is **off by default**; enabling it is a deliberate user action surfaced in the builder with a clear warning.
- An **imported** flow (Phase-2 import, or future marketplace) containing an `httpRequest` node is **inert until the user reviews and grants** network permission for it — never silently network-capable.
- HTTP nodes are audited (URL host, not body; secrets redacted), and respect the no-exfiltration product stance by being **explicit, user-authored, opt-in** — consistent with 2E TB-4/TB-5.

#### 11.4 Code structure
```
engine/core/flow/scheduler.go
engine/core/flow/nodes/{http.go, parallel.go, join.go}
engine/core/flow/netperm.go   // flow.network permission gating
client/lib/flowbuilder/trigger_config.dart  (schedule UI)
```

---

### 12. WS-3.8 — Capture & achievements (opportunistic)

**PRD:** D11-07 (achievements, P3), D11-08 (capture, P2). Included if capacity remains.
- **Screenshot/clip capture**: `gaming.screenshot`, `gaming.record.toggle` (via OBS WebSocket where present, else OS snip) — provider-chained, degrade to unavailable.
- **Achievements**: top in-progress achievements display where a launcher API exposes them; otherwise omitted. Lower priority; deferred without guilt.

---

### 13. End-to-end realized journeys (Phase 3)

**Gaming session, complete (PRD Journey 2, now full).** Alex's phone: gaming layout with live FPS + thermals; taps a cover tile → game launches; taps "Competitive" → power plan + priorities + RAM clean apply atomically (and revert on exit); rolling charts track CPU/GPU/FPS during play.

**Builder builds a real flow (PRD Journey 4, now visual — Morgan's headline).** Morgan opens the flow builder, drags `stateChange(cpu.temp>85)` trigger → `setVar` → `if` → `action(performance.set Silent)` → `httpRequest`(ping a webhook, after granting network permission) → wires the branches, runs a **test run**, watches the live node trace, fixes a condition, saves. Under 10 minutes. The success metric is now measurable.

**Scheduled automation.** A "nightly wind-down" flow fires at 11 pm (schedule trigger): sets Balanced power plan, lowers volume, switches the wall tablet to a clock profile.

---

### 14. Code structure (additions)

```
plugins/ fps/ gamedetect/ gameopt/ health/ processes/ fans/   (+launchers extended)
engine/
  pal/{fps.go, gamedetect.go, fans.go(+write)}
  core/registry/actions.go        (+elevated flag)
  core/flow/{scheduler.go, trace.go, netperm.go, nodes/{http.go,parallel.go,join.go}}
client/lib/
  render/widgets/{chart_line_rolling, chart_donut, fps_display, resource_bars, profiles, processes_table, game_grid}.dart
  flowbuilder/   (new desktop-only authoring surface)
shared/schemas/  (gaming/chart widgets; http/parallel node descriptors)
```

### 15. Test plan

| Layer | Scope | Pass criteria |
|-------|-------|---------------|
| Unit — FPS | provider probe order; smoothing; re-probe on fault | PresentMon bound on Win; unavailable elsewhere, no crash |
| Unit — gameopt | profile bundle apply/rollback; RAM-clean process exclusion; netboost no-op where unsupported | atomic apply; protected processes untouched |
| Unit — flow nodes | http (timeout/error capture); parallel/join; scheduler cron parse | deterministic; bounded concurrency |
| Unit — flow builder | op model inverses (undo/redo); validation (unreachable/missing param/type mismatch/unbounded loop) | all caught pre-save |
| Integration — elevated gating | elevated action with/without privilege → full vs partial + audit | partial success reported, never crash |
| Integration — covers | cover fetch → asset store → client render via ADR-0021 | covers reuse asset pipeline; cached |
| Integration — schedule | flow fires on cron; missed-fire policy on downtime | fires correctly; policy honored |
| Integration — network perm | imported flow with http node is inert until granted; audit logs host not body | gating + redaction correct |
| E2E | full gaming session; visual flow build + test run | journeys pass; <10 min flow build (usability) |
| Performance | charts/FPS at 60 FPS; engine budget with gaming plugins + scheduler | NFR-03/08/09 hold |
| Security | http node SSRF/exfil review; elevated actions audited | controls hold |

### 16. Milestones & sequencing

| Milestone | Content | Gate |
|-----------|---------|------|
| **M3.1 FPS live** | WS-3.1 | FPS on Windows via PresentMon; unavailable elsewhere clean |
| **M3.2 Launch & covers** | WS-3.2 | cover-tile launch; covers via asset pipeline |
| **M3.3 Profiles & control** | WS-3.3 + WS-3.4 | Competitive applies+reverts; elevated gating + audit; health/processes/fans |
| **M3.4 Gaming widgets** | WS-3.5 | rolling charts + FPS display + profiles widget |
| **M3.5 Flow builder** | WS-3.6 | build+test-run a branching flow with live trace; undo/redo |
| **M3.6 Schedule + nodes** | WS-3.7 (+WS-3.8 if time) | scheduled flow fires; http(gated)+parallel work |
| **M3.7 Harden** | ACs + budgets | Definition of Done met |

### 17. Risks & mitigations

| Risk | Prob | Impact | Mitigation |
|------|------|--------|-----------|
| PresentMon licensing review not cleared before ship | Med | High | Track to closure as a release gate (2G §7); fallback chain works without it |
| Per-app FPS only reliable on Windows | High | Med | Provider chain → unavailable elsewhere is acceptable & documented |
| Elevated ops blocked on locked-down/corp machines | Med | Med | Elevated-action gating: partial success + audit, never crash (ADR-0023) |
| "Network boost" overpromises | Med | Med | Specified as honest best-effort; no kernel claims; no-op where unsupported |
| HTTP flow node misused (SSRF/exfil) | Med | High | Off-by-default permission; imported flows inert until granted; audited (ADR-0024) |
| Flow builder complexity balloons | Med | Med | Reuse layout-designer schema-form + op model; validation early; scope nodes to V1 set + http/parallel |
| Charts hurt 60 FPS on low-end tablets | Low | Med | Native painters; series already in-state; measured at M3.4 |

### 18. Acceptance criteria (traced)

| AC | Criterion | Trace |
|----|-----------|-------|
| P3-AC-01 | Live FPS renders via the bound provider (PresentMon on Win); degrades to `unavailable` with no crash where no provider exists. | D11-02, 2G, M3.1 |
| P3-AC-02 | A game launches from a cover-art tile within 3 s; covers fetch via the asset pipeline and cache. | D11-01, ADR-0021, M3.2 |
| P3-AC-03 | Applying a game profile changes power plan + priorities atomically and reverts on switch/exit; failures roll back with partial-success report. | D11-03, M3.3 |
| P3-AC-04 | RAM cleaner empties working sets of non-critical processes only and reports a count. | D11-04, M3.3 |
| P3-AC-05 | Elevated actions execute within granted privilege; where elevation is unavailable they report partial success and are audited — never crash. | ADR-0023, M3.3 |
| P3-AC-06 | System health score, top-processes table, and fan read render; fan write works where supported. | D8-08/09/10, M3.3/3.4 |
| P3-AC-07 | Rolling line and donut charts render at 60 FPS from series states with no extra traffic. | D5-11/12, NFR-03, M3.4 |
| P3-AC-08 | A user assembles a branching flow (trigger + if + var + wait + action) in the visual builder, runs a test, sees a live per-node trace, and saves; undo/redo works. | D7-09, M3.5 |
| P3-AC-09 | A scheduled flow fires on its cron/interval; the missed-fire policy is honored across engine downtime. | D7-10, M3.6 |
| P3-AC-10 | The HTTP node is off by default; an imported flow containing it is inert until the user grants network permission; calls are audited (host, not body). | D7-11, ADR-0024, M3.6 |
| P3-AC-11 | The parallel node runs branches concurrently with bounded concurrency and correct join semantics. | D7-11, M3.6 |
| P3-AC-12 | NFR budgets hold with the gaming plugin set + scheduler active. | NFR-08/09, M3.7 |

---
*End of Phase 3 Deep Dive (Draft v0.1). New decisions ADR-0022/0023/0024 to be appended to the Decision Log. Next: Phase 4 (Smart Home).*

---



<a id="document-6-phase-4-smart-home-deep-dive"></a>

# Document 6 — Phase 4 (Smart Home) Deep Dive

## CyberDeck — Phase 4 (Smart Home Integration) Deep Dive

**Document 6 of the CyberDeck Enterprise Documentation Set · Per-Phase Deep Dive**
Version 0.1 (Draft) · June 2026 · Codebase ID: `com.shishir.cyberdeck`

> Implementation-depth specification for **Phase 4 (Smart Home)**. This is the first integration with an **external, networked, credentialed third-party system** (Home Assistant), so it doubles as the real-world proof of the plugin contract (2F), the secret-storage model (2E §7), the `entity` param type (2B), and dynamic state creation. New decision: **ADR-0025 (external-integration connection lifecycle & entity mapping)**.

### Contents
1. Phase intent & definition of done
2. Scope: in / out
3. Seams consumed
4. Workstream map
5. WS-4.1 Home Assistant connection & credentials
6. WS-4.2 Entity model & dynamic state mapping
7. WS-4.3 Smart-home actions (lights/devices/scenes/climate)
8. WS-4.4 Environment sensors & energy
9. WS-4.5 Smart-home widgets
10. WS-4.6 Smart-home in flows (the payoff)
11. End-to-end realized journeys
12. Code structure (additions)
13. Test plan
14. Milestones & sequencing
15. Risks & mitigations
16. Acceptance criteria (traced)

---

### 1. Phase intent & definition of done

**Intent.** Let a user control their home (lights, plugs, switches, scenes, climate) and monitor it (environment sensors, energy) from any CyberDeck surface, integrated through **Home Assistant** as a first-party plugin that behaves exactly like any third-party integration would — validating that the plugin/PAL/secret/permission seams are real. The deeper payoff is that smart-home actions become available to the **flow engine** (Phase 3), enabling automations like "CPU hot → dim the office lights."

**Definition of done.**
- A user connects CyberDeck to their Home Assistant instance with a long-lived token stored in the OS secure store (never plaintext).
- HA entities (lights/switches/scenes/sensors/climate/cameras) are discovered and mapped to typed CyberDeck states/actions, created dynamically.
- Light toggle/brightness, device toggle, scene activation, and climate set-temp work within the latency budget, with the 3 s timeout → error-state behavior.
- Environment sensors and energy data render; cameras are reserved for Phase 5.
- Smart-home actions are usable as flow nodes (the "Good Morning"/"cooling" automations).
- Connection loss to HA degrades gracefully (entities show offline/`--`), and recovers.
- All Phase-4 ACs verified; secrets never leak; NFR budgets hold.

### 2. Scope: in / out

#### In scope (Phase 4)
| Area | Included | PRD |
|------|----------|-----|
| Connection | HA REST + WebSocket event bus; token via secure store | D12-01 |
| Entities | discover + dynamic state mapping; offline detection | D12-01 |
| Control | light toggle/brightness; device/plug/switch toggle; scene activation; climate set-temp | D12-02/03/04/07 |
| Monitoring | room overview; environment sensors (temp/humidity/AQ); energy monitor | D12-05/06/08 |
| Widgets | room cards, device rows, scene cards, environment panel, energy widget | D12-* |
| Automation | smart-home actions as flow nodes/targets | D7 + D12 |
| Credentials | HA token in OS secure store (first real use of 2E §7) | D14-05 |

#### Out of scope
Security camera previews (P5 — needs the asset/stream pipeline) · plugin SDK/third-party loading (P6, though this phase *uses* the same contract) · remote (P7).

### 3. Seams consumed

| Seam | Phase-4 use |
|------|-------------|
| Plugin contract (2F) | `smarthome` plugin — out-of-process, manifest-declared, **the first integration with `network: outbound` permission** |
| Secret store (2E §7) | HA long-lived token stored per-OS; first production use |
| `entity` param type (2B §3.1) | actions take HA entity IDs; the designer's **entity picker** (stubbed in P1) is now fully implemented |
| Dynamic state creation (2B) | HA entities → states created at runtime as they're discovered |
| Provider/degradation contract (2G/ADR-0007) | HA unreachable → entities `unavailable`/offline, no crash |
| Flow engine (2D) | smart-home actions become flow targets; events feed stateChange triggers |
| Asset delivery (ADR-0021) | reserved for camera thumbnails in P5 (not built here) |

### 4. Workstream map

```
WS-4.1 HA connection/creds ─► WS-4.2 Entity mapping ─► WS-4.3 Actions ─► WS-4.5 Widgets
                                          └──────────► WS-4.4 Sensors/energy ──┘
WS-4.6 Smart-home in flows (after 4.3) ─────────────────────────────────────────
```
Critical path: 4.1 → 4.2 → 4.3/4.4 → 4.5. WS-4.6 follows 4.3.

---

### 5. WS-4.1 — Home Assistant connection & credentials

**Owning TRD:** 2F (plugin, network perm), 2E §7 (secret). **PRD:** D12-01, D14-05. **ADR:** **0025 (new)**.

#### 5.1 Functional flow
```
User opens Smart Home settings (Desktop UI, privileged) → enters HA base URL + long-lived token
  → token stored in OS secure store (NOT config.json/SQLite/logs)
  → smarthome plugin reads URL+token at startup → REST /api/ health check
  → opens WebSocket to HA event bus → subscribe state_changed
  → on success: connection state = connected; entities loaded (WS-4.2)
  → on failure/timeout: connection state = error; surfaced in UI; retry w/ backoff
```

#### 5.2 External-integration connection lifecycle (ADR-0025)
HA is the template for all external integrations, so its lifecycle is specified as a reusable pattern:
- **Config**: non-secret (base URL) in `config.json`; **secret (token) in the OS secure store** (2E §7).
- **Connection capability**: a connected/degraded/error state per integration, mirroring the device-connection contract (2A §7.3) — entities follow the integration's connection health.
- **Dual transport**: REST for actions + initial state fetch; **WebSocket event bus** for real-time `state_changed` (push, not poll), with a **30 s REST poll fallback** if the WS is unavailable (carried from old design).
- **Timeout/degradation**: every HA call has a **3 s timeout → entity `error` state** (carried PF-007); the integration auto-reconnects with backoff; on disconnect entities go offline/`--`, never frozen/false.
- This pattern is **reused by any future integration** (the same connected/degraded/error + secret + timeout shape).

#### 5.3 Code structure
```
plugins/smarthome/
  main.go manifest.json            // network: outbound; capabilities: homeassistant
  connection.go                    // REST client + WS event bus + health/backoff
  credentials.go                   // reads token via host secret-store API
```
Manifest declares `network: "outbound"` and the HA capability; the host grants it (first-party trusted; a third-party equivalent would prompt the user — 2F §7).

---

### 6. WS-4.2 — Entity model & dynamic state mapping

**Owning TRD:** 2B (dynamic states), 2G. **PRD:** D12-01. **ADR:** 0025.

#### 6.1 Capability detail
- On connect, fetch `/api/states`; map each HA entity to a typed CyberDeck state under `home.*` / `environment.*`, **created dynamically** (2B): e.g. `light.living_room` → `home.light.living_room` (boolean on/off + a brightness scalar), `sensor.office_temp` → `environment.office_temp` (scalar °C).
- WS `state_changed` events update the mapped states in real time → DF-A to clients.
- Entity → state mapping table is maintained by the plugin; domains map to state kinds (light→boolean+scalar, switch→boolean, sensor→scalar/text, scene→action-only, climate→scalar+enum, camera→reserved P5).
- **Offline detection**: HA `unavailable` entity state → CyberDeck `device.offline` event + the mapped state reads `--`.

#### 6.2 Technical spec
- Dynamic states are registered with descriptors so the **designer can bind to them** and the **entity picker** can list them.
- The mapping is **stable across reconnects** (keyed by HA entity_id) so layouts binding `home.light.living_room` survive HA restarts.
- Entity count can be large (Riley persona: 20+ devices); states are created lazily/bounded and only fanned out by subscription (2A) — a layout binding 6 entities doesn't pay for 200.

#### 6.3 Code structure
```
plugins/smarthome/
  entities.go        // /api/states fetch, domain→state mapping, dynamic registration
  events.go          // WS state_changed → state updates; offline detection
  mapping.go         // domain → (state kind, action set)
```

---

### 7. WS-4.3 — Smart-home actions

**Owning TRD:** 2B (actions, `entity` param), 2D (flow targets). **PRD:** D12-02/03/04/07.

#### 7.1 Capability detail
Actions (all take an `entity` param, validated against discovered entities; 3 s timeout → error):
- `home.light.toggle{entity}` / `home.light.brightness{entity, level 0–100}`
- `home.device.toggle{entity}` (switch/plug)
- `home.scene.activate{scene}` → HA `scene.turn_on`
- `home.climate.set_temp{entity, temp}` (validate 10–35 °C, carried)
- (camera view reserved P5)

#### 7.2 Technical spec
- Action → HA REST `/api/services/{domain}/{service}` with entity data; await ≤3 s; on timeout set entity `error` state + toast; optimistic UI optional (reflect intended state immediately, reconcile on WS confirmation).
- The **`entity` param type** is now fully realized: the designer's inspector renders an **entity picker** populated from discovered entities (the P1 stub becomes real — proving the schema-driven inspector handles a domain-specific param type with zero designer special-casing beyond the picker widget).
- Brightness/temp validated by the engine against schema range before reaching the plugin (2B/2F).

#### 7.3 Code structure
```
plugins/smarthome/ actions.go service_call.go
client/lib/designer/inspector/entity_picker.dart   // realizes the entity param editor
```

---

### 8. WS-4.4 — Environment sensors & energy

**PRD:** D12-06/08.

#### 8.1 Capability detail
- **Environment**: temperature, humidity, air quality, CO2, noise — mapped sensor states (`environment.*`), updated via WS events (or 30 s poll fallback). Each can carry a `series` buffer for a sparkline.
- **Energy monitor**: total kWh, estimated cost, efficiency, a month bar — from HA energy entities where present; degrades to `unavailable` where the user hasn't configured HA energy.

#### 8.2 Technical spec
- Sensor cadence governed by HA push; the 30 s REST fallback (carried) applies if WS is down.
- Energy aggregation reads HA's energy dashboard entities; if absent, the energy widget shows `unavailable` (provider/degradation contract).

---

### 9. WS-4.5 — Smart-home widgets

**Owning TRD:** 2C §7. **PRD:** D12-05/* .

New widget types: **room card** (name, device count, temp, quick toggles), **device row** (icon, name, toggle, brightness/level slider), **scene card** (name, action count, activate button), **environment panel** (temp/humidity/AQ + sparklines), **energy widget** (kWh dial + cost + month bar). All bind to the dynamically-mapped `home.*`/`environment.*` states and use existing widget primitives (toggle, slider, gauge, sparkline) plus a few composites.

```
client/lib/render/widgets/{room_card, device_row, scene_card, environment_panel, energy_widget}.dart
```

---

### 10. WS-4.6 — Smart-home in flows (the payoff)

**Owning TRD:** 2D. **PRD:** D7 × D12.

#### 10.1 Capability detail
Because smart-home operations are **registered actions** (WS-4.3), they are **automatically available as flow `action` nodes** — no flow-engine change (the registry-driven design pays off again). This unlocks:
- **"Good Morning" scene flow** (PRD Journey 5): one flow → lights + coffee plug + climate set-temp (5 actions, 1 tap).
- **Cross-domain automation** (the headline): the Phase-3 "Cooling Guard" flow's deferred smart-home step now works — `if cpu.temp>85 → performance.set Silent → home.light.brightness{office,30}`.
- HA events (e.g. motion) feed the event bus → **stateChange/event flow triggers** (2D §6), enabling "on motion at front door, switch the wall tablet to the camera profile" (camera view itself is P5).

#### 10.2 Technical spec
- No new flow machinery — smart-home actions appear in the visual flow builder's palette (Phase 3) automatically because they're registry entries. The `entity` param uses the same entity picker (WS-4.3) inside the flow builder's node inspector.
- HA-sourced events are normalized into the engine event bus so flow triggers treat them uniformly with system events.

---

### 11. End-to-end realized journeys (Phase 4)

**Morning routine (PRD Journey 5, now real).** Riley taps "Good Morning" on the wall tablet → a flow sets lights, coffee plug, and climate in one tap; the energy widget shows today vs yesterday.

**Cross-domain automation completes (from Phase 3).** "Cooling Guard" now dims the office lights when the CPU overheats — the smart-home action that was stubbed in Phase 3 is live.

**Riley's 20-device home.** Pairs a wall tablet; the smart-home page shows room cards and device rows for discovered entities; toggling a light reflects in <500 ms; unplugging HA shows entities offline, and they recover when HA returns.

### 12. Code structure (additions)

```
plugins/smarthome/   main.go manifest.json connection.go credentials.go
                     entities.go events.go mapping.go actions.go service_call.go energy.go
client/lib/
  designer/inspector/entity_picker.dart   // entity param editor (realizes P1 stub)
  render/widgets/{room_card, device_row, scene_card, environment_panel, energy_widget}.dart
shared/schemas/widgets/ (smart-home widgets)
```
> Note how small the engine-side footprint is: **almost everything is in the plugin**, with only a designer entity-picker widget added to the core client. This is the plugin architecture (ADR-0006) working as intended — a whole domain added as an out-of-process plugin with near-zero core change.

### 13. Test plan

| Layer | Scope | Pass criteria |
|-------|-------|---------------|
| Unit — connection | health check; WS subscribe; backoff; 30 s poll fallback | connects; falls back when WS down |
| Unit — mapping | domain→state mapping; dynamic registration; stable across reconnect | entity_id-keyed stability |
| Unit — actions | service-call construction; 3 s timeout → error; range validation | timeout sets error state, no hang |
| Integration — secret | token stored in OS secure store; never in config/SQLite/logs | secret-leak test passes |
| Integration — offline | HA down → entities `--`/offline; recovery on return | graceful degrade + recover |
| Integration — flows | smart-home action runs in a flow; HA event triggers a flow | cross-domain automation works |
| Integration — entity picker | designer lists discovered entities; binds correctly | picker populated; zero core special-casing |
| E2E | morning-routine flow on wall tablet; 20-entity home | journeys pass |
| Security | token redaction; outbound limited to configured HA host; no exfiltration | controls hold |
| Performance | 20+ entities, subscription-filtered fan-out | budgets hold; no fan-out of unsubscribed entities |

### 14. Milestones & sequencing

| Milestone | Content | Gate |
|-----------|---------|------|
| **M4.1 Connected** | WS-4.1 | HA connects; token in secure store; health/error states |
| **M4.2 Entities live** | WS-4.2 | entities mapped, dynamic states, WS updates, offline detect |
| **M4.3 Control** | WS-4.3 + WS-4.4 | lights/devices/scenes/climate work ≤500 ms; sensors/energy render; entity picker real |
| **M4.4 Widgets** | WS-4.5 | room/device/scene/environment/energy widgets |
| **M4.5 Automation + harden** | WS-4.6 + ACs | smart-home in flows; cross-domain automation; secrets/degradation verified |

### 15. Risks & mitigations

| Risk | Prob | Impact | Mitigation |
|------|------|--------|-----------|
| HA API/version drift | Med | Med | Version-pin tested HA API; integration tests against an HA Docker; degrade on unknown entities |
| Token leakage | Low | High | Secret store only; redaction; outbound limited to configured host; security test |
| WS event bus instability | Med | Med | 30 s REST poll fallback; reconnect backoff |
| Large entity counts hurt budget | Med | Med | Subscription-filtered fan-out; lazy/bounded state creation |
| LAN latency to HA | Low | Med | 3 s timeout → error state; optimistic UI optional |
| Energy data absent on user's HA | Med | Low | Energy widget degrades to `unavailable` cleanly |

### 16. Acceptance criteria (traced)

| AC | Criterion | Trace |
|----|-----------|-------|
| P4-AC-01 | CyberDeck connects to HA via REST + WS; the token is stored in the OS secure store and never appears in config/SQLite/logs. | D12-01, D14-05, 2E §7, M4.1 |
| P4-AC-02 | HA entities are discovered and mapped to typed states, created dynamically, stable across HA reconnects. | D12-01, M4.2 |
| P4-AC-03 | Light toggle/brightness, device toggle, scene activation, and climate set-temp work; a call exceeding 3 s sets the entity to error (no hang). | D12-02/03/04/07, M4.3 |
| P4-AC-04 | The designer's entity picker lists discovered entities and binds them with no designer special-casing beyond the picker widget. | 2B `entity`, M4.3 |
| P4-AC-05 | Environment sensors and energy render; energy degrades to `unavailable` where HA energy isn't configured. | D12-06/08, M4.4 |
| P4-AC-06 | Smart-home actions are usable as flow nodes; the "Good Morning" multi-action flow runs in one tap; the cross-domain "cooling" automation dims lights on CPU overheat. | D7×D12, M4.5 |
| P4-AC-07 | HA disconnection shows entities offline/`--` and recovers on reconnect; the engine never crashes. | ADR-0007/0025, M4.2 |
| P4-AC-08 | The entire smart-home domain is delivered as an out-of-process plugin with near-zero engine-core change. | ADR-0006, all |
| P4-AC-09 | NFR budgets hold with 20+ entities via subscription-filtered fan-out. | NFR-08/09, M4.5 |

---
*End of Phase 4 Deep Dive (Draft v0.1). New decision ADR-0025 appended to the Decision Log. Next: Phase 5 (Notifications & Security Cameras).*

---



<a id="document-7-phase-5-notifications-cameras-deep-dive"></a>

# Document 7 — Phase 5 (Notifications & Cameras) Deep Dive

## CyberDeck — Phase 5 (Notifications & Security Cameras) Deep Dive

**Document 7 of the CyberDeck Enterprise Documentation Set · Per-Phase Deep Dive**
Version 0.1 (Draft) · June 2026 · Codebase ID: `com.shishir.cyberdeck`

> Implementation-depth specification for **Phase 5**. Completes the unified notification pipeline (Phase 1 shipped only a count badge) and adds security-camera previews. Camera previews extend the Phase-2 asset pipeline (ADR-0021) into **periodic/streamed** frames. New decision: **ADR-0026 (streamed/periodic asset frames vs static assets)**.

### Contents
1. Phase intent & definition of done
2. Scope: in / out
3. Seams consumed
4. Workstream map
5. WS-5.1 Notification aggregation pipeline
6. WS-5.2 Notification model, priority & filtering
7. WS-5.3 Notification actions & widgets
8. WS-5.4 Camera previews (streamed asset frames)
9. WS-5.5 Notifications & cameras in flows
10. End-to-end realized journeys
11. Code structure (additions)
12. Test plan
13. Milestones & sequencing
14. Risks & mitigations
15. Acceptance criteria (traced)

---

### 1. Phase intent & definition of done

**Intent.** Turn the Phase-1 notification *count badge* into a full **aggregation, triage, and action** experience across sources (Windows action center, Discord, Streamlabs, Spotify, system, smart-home), and add **security-camera preview tiles** by extending the asset pipeline to handle periodically-refreshed frames.

**Definition of done.**
- Notifications from multiple sources aggregate into one feed with source, title, body, timestamp, and priority.
- Filtering (All/System/Apps/Alerts/Messages), dismiss, mark-all-read, and open-source-app all work.
- Camera tiles show periodically-refreshed thumbnails (reusing/extending the asset pipeline), with a clear live/last-updated indicator and graceful unavailability.
- Notification events feed the flow engine (e.g. "on Streamlabs donation → flash a light").
- All Phase-5 ACs verified; no exfiltration; budgets hold (camera frames must not blow RAM/bandwidth).

### 2. Scope: in / out

#### In scope (Phase 5)
| Area | Included | PRD |
|------|----------|-----|
| Aggregation | Windows action center, Discord, Streamlabs, Spotify, system, smart-home | D13-02/03 |
| Model | source/title/body/timestamp/priority; 50-item ring buffer (carried) | D13-03/05 |
| Triage | filter tabs; dismiss; mark-all-read; open-source-app | D13-03/04/06 |
| Widgets | notification feed/panel, filter tabs, priority badges, count badge (exists) | D13-* |
| Cameras | preview tiles (periodic thumbnails); live/last-updated indicator | D12-09 |
| Automation | notification & camera-motion events as flow triggers | D7 × D13 |

#### Out of scope
Full real-time video streaming (only periodic thumbnails in V-scope; live RTSP/HLS playback is a later enhancement) · plugin SDK (P6) · remote (P7).

### 3. Seams consumed

| Seam | Phase-5 use |
|------|-------------|
| Plugin contract (2F) | `notifications` plugin expanded; camera frames via the smart-home plugin (HA `camera_proxy`) |
| `Notifications` PAL capability (2G) | OS action-center listener (P1) extended; multi-source aggregation |
| Asset delivery (ADR-0021) | camera thumbnails reuse content-addressed fetch — extended to **periodic frames** (ADR-0026) |
| Event bus + flow triggers (2B/2D) | notification.received / camera.motion events trigger flows |
| External-integration pattern (ADR-0025) | Streamlabs (WebSocket) + Discord/HA sources follow the same connection lifecycle |
| Ring buffer (in-memory, 2B) | the 50-item notification buffer is in-memory, not persisted (carried) |

### 4. Workstream map

```
WS-5.1 Aggregation ─► WS-5.2 Model/priority/filter ─► WS-5.3 Actions & widgets
WS-5.4 Camera previews (independent; extends ADR-0021) ────────────────────────
WS-5.5 Notifications/cameras in flows (after 5.2 / 5.4) ───────────────────────
```

---

### 5. WS-5.1 — Notification aggregation pipeline

**Owning TRD:** 2G (`Notifications`), 2F, ADR-0025 (for networked sources). **PRD:** D13-02.

#### 5.1 Functional flow
```
Source emits a notification:
  Windows action center (WinRT listener) / Discord (WinRT) / Streamlabs (WS) /
  Spotify (SMTC track change) / system / smart-home (HA event)
  → notifications plugin normalizes into a NotificationItem
  → append to 50-item in-memory ring buffer (oldest discarded)
  → notification.count++ ; notification.latest.* states updated
  → notification.received event → event bus (flow triggers, WS-5.5)
  → feed states → clients (DF-A)
```

#### 5.2 Capability detail
- **Sources** (each a provider within the notifications plugin, following ADR-0025 where networked): Windows action center & Discord via WinRT listener; Streamlabs via WebSocket; Spotify via SMTC track-change; system; smart-home via HA events.
- **NotificationItem**: `{ id, source, title, body, timestamp, priority }`. Per-source priority mapping carried from the old design (Discord DM=High, mention=Med, server=Low; system security=High; Streamlabs donation=High; etc.).
- **No credential storage for Discord** (carried SR-003): reads OS action-center notifications only — does not store Discord tokens.

#### 5.3 Technical spec
- The ring buffer is **in-memory** (2B; not persisted — carried). `notification.latest.*` are normal states; the full buffer is exposed to the feed widget via a buffer-snapshot request (a small request/response, like assets but text).
- Networked sources (Streamlabs WS) use the ADR-0025 connection lifecycle (connected/degraded/error, reconnect).

#### 5.4 Code structure
```
plugins/notifications/ (expanded)
  main.go manifest.json
  sources/{winrt_actioncenter.go, discord_winrt.go, streamlabs_ws.go, spotify_smtc.go, system.go, smarthome.go}
  model.go ringbuffer.go priority.go aggregate.go
```

---

### 6. WS-5.2 — Notification model, priority & filtering

**PRD:** D13-03/05.

- **Categories** for filtering: All / System / Apps / Alerts / Messages — each source maps to a category; the filter is a client-side view over the buffer plus an engine-side `notification.filter.set` action that sets the active filter state.
- **Priority badges** (D13-05, P2): high/medium/low, colour + icon (never colour alone — accessibility, Doc 0 §9).
- Unread tracking: per-item read flag; `notification.count` reflects unread across sources.

---

### 7. WS-5.3 — Notification actions & widgets

**PRD:** D13-03/04/06.

#### 7.1 Actions
- `notification.dismiss{id}`, `notification.markallread`, `notification.filter.set{source|category|all}`, `notification.open.app{app}` (open the source app; toast if not found).

#### 7.2 Widgets
- **notification feed/panel** — scrollable cards (source icon, app, timestamp, 2-line body, unread dot colour-coded by priority); tap → open source app; swipe/long-press → dismiss.
- **filter tabs** widget; **priority badge**; the **count badge** already exists (P1) and now reflects the aggregated unread count.
- Slide-over panel access from any page via a bell icon (carried design).

```
client/lib/render/widgets/{notification_feed, notification_filter_tabs, notification_card, priority_badge}.dart
```

---

### 8. WS-5.4 — Camera previews (streamed/periodic asset frames)

**Owning TRD:** ADR-0021 (extended), ADR-0025 (HA source). **PRD:** D12-09. **ADR:** **0026 (new)**.

#### 8.1 The problem
Album art (Phase 2) is a **static** asset — fetched once, cached forever by hash. A camera preview is a **changing** image — a fresh frame every few seconds. Content-addressed caching still applies per-frame (each frame has its own hash), but we need a mechanism for **periodic refresh** without flooding the session or treating each frame as a brand-new permanent cache entry.

#### 8.2 The decision (ADR-0026)
**Periodic asset frames as a refresh policy layered on ADR-0021.**
- A camera tile binds to a **frame-producing asset source** with a **refresh interval** (e.g. every 2–5 s, configurable, default conservative).
- Each refresh: the engine (via the HA `camera_proxy` provider) fetches a JPEG frame → hashes it → updates the tile's `frame.ref` state. The client fetches the new frame via the existing `assetRequest` path (ADR-0021).
- **Frame cache is short-TTL and tile-bounded** (unlike album art's long-lived cache) — old frames evict immediately; only the latest 1–2 frames per tile are retained. This keeps it from polluting the static-asset cache or growing unbounded.
- Refresh runs **only while a camera tile is on a visible page of a connected session** (no fetching for off-screen cameras) — a subscription-driven optimization, mirroring state subscription filtering (2A).
- A **live/last-updated indicator** shows freshness; on fetch failure/timeout the tile shows the last frame dimmed + an offline badge (degradation contract).

#### 8.3 Capability detail
- Camera entities discovered via HA (Phase 4 mapping); `home.camera.*` exposes a frame source.
- `home.camera.view{entity}` action (carried from 2A TRD): opens the full stream URL in the system browser if available (full in-app video playback is out of scope — periodic thumbnails only).
- Real video (RTSP/HLS) playback is explicitly **deferred** — Phase 5 delivers preview tiles, not a video player.

#### 8.4 Technical spec
- The periodic-frame fetcher is a smart-home/notifications-plugin task gated by visibility subscription; respects the 3 s timeout → offline (ADR-0025).
- Bandwidth-aware: configurable interval; the engine never pushes frames unsolicited — the client pulls the latest `frame.ref` on its refresh cadence (consistent with ADR-0021 request/response).

#### 8.5 Code structure
```
plugins/smarthome/ camera.go            // camera_proxy frame fetch → hash → frame.ref state
engine/core/assetstore/frames.go        // short-TTL, tile-bounded frame cache (vs static asset cache)
engine/core/transport/assets.go         // (reused) assetRequest/Response carries frames too
client/lib/render/widgets/camera_tile.dart   // periodic refresh, live/last-updated indicator
```

---

### 9. WS-5.5 — Notifications & cameras in flows

**PRD:** D7 × D13.

- **Notification events** (`notification.received` with source/priority) feed `event`/`stateChange` flow triggers — e.g. "on Streamlabs donation (High) → flash the office light + play a sound."
- **Camera motion** (HA motion event) → `device.*`/event trigger → e.g. "on front-door motion → switch the wall tablet to the camera profile" (the camera profile shows the tile; full view in browser via the action).
- No flow-engine change — these are registry events/actions consumed by the existing trigger model (the registry-driven design paying off yet again).

---

### 10. End-to-end realized journeys (Phase 5)

**Notification triage (PRD Journey 3, now full).** Badge shows 6 unread → user opens the slide-over feed → filters to Alerts → dismisses non-critical → taps a Discord message to open Discord. (Phase 1 had only the badge; this completes it.)

**Streamer donation reaction.** Jordan's "donation" flow flashes a light and plays a sound when a Streamlabs donation arrives — notification event → flow.

**Home monitoring.** Riley's wall tablet shows four camera tiles refreshing every few seconds with a last-updated indicator; on front-door motion, a flow switches the tablet to the camera profile; tapping a tile opens the full stream in the browser.

### 11. Code structure (additions)

```
plugins/notifications/ (expanded: sources/, model, ringbuffer, priority, aggregate)
plugins/smarthome/ camera.go
engine/core/assetstore/frames.go
client/lib/render/widgets/{notification_feed, notification_filter_tabs, notification_card, priority_badge, camera_tile}.dart
shared/schemas/widgets/ (notification + camera widgets)
```

### 12. Test plan

| Layer | Scope | Pass criteria |
|-------|-------|---------------|
| Unit — aggregation | source normalization; priority mapping; ring-buffer eviction (50) | correct items/priority; oldest discarded |
| Unit — frame cache | per-frame hash; short-TTL tile-bounded eviction; latest-only | no unbounded growth; static cache unaffected |
| Integration — sources | each source emits → feed updates; Streamlabs WS reconnect | all sources aggregate; networked sources degrade per ADR-0025 |
| Integration — triage | filter/dismiss/mark-all-read/open-app | correct feed + count behavior |
| Integration — cameras | periodic refresh only when visible+connected; offline → dimmed last frame | visibility-gated; graceful offline |
| Integration — flows | notification/motion event triggers a flow | cross-domain reactions work |
| Performance | 4 cameras @ refresh + multi-source notifications | budgets hold; no off-screen fetching |
| Security | no Discord token stored; no exfiltration; frames stay on LAN | controls hold |

### 13. Milestones & sequencing

| Milestone | Content | Gate |
|-----------|---------|------|
| **M5.1 Aggregation** | WS-5.1 + WS-5.2 | multi-source feed + priority + filter |
| **M5.2 Triage** | WS-5.3 | dismiss/mark-all/open-app; feed widget |
| **M5.3 Cameras** | WS-5.4 | periodic preview tiles, visibility-gated, offline-graceful |
| **M5.4 Automation + harden** | WS-5.5 + ACs | notification/motion flows; budgets/security verified |

### 14. Risks & mitigations

| Risk | Prob | Impact | Mitigation |
|------|------|--------|-----------|
| OS notification-access permissions blocked | Med | Med | Provider degrades to unavailable; document the OS permission steps |
| Camera frames blow bandwidth/RAM | Med | Med | Visibility-gated pull; short-TTL tile-bounded frame cache (ADR-0026); configurable interval |
| Streamlabs/Discord API/listener drift | Med | Low | ADR-0025 lifecycle + per-source isolation; degrade per source |
| Users expect live video, get thumbnails | Med | Low | Clear "preview"/last-updated labeling; full stream opens in browser; live playback flagged as later |
| Notification flooding | Low | Low | 50-item ring buffer; coalescing; priority surfacing |

### 15. Acceptance criteria (traced)

| AC | Criterion | Trace |
|----|-----------|-------|
| P5-AC-01 | Notifications from multiple sources aggregate into one feed with source/title/body/timestamp/priority. | D13-02/03, M5.1 |
| P5-AC-02 | Filter tabs, dismiss, mark-all-read, and open-source-app all work; the count badge reflects aggregated unread. | D13-03/04/06, M5.2 |
| P5-AC-03 | Priority badges use colour **and** icon/text (never colour alone). | Doc 0 §9, M5.1 |
| P5-AC-04 | Camera tiles refresh periodically only while visible on a connected session; off-screen cameras are not fetched. | D12-09, ADR-0026, M5.3 |
| P5-AC-05 | A camera tile shows a live/last-updated indicator and degrades to a dimmed last frame + offline badge on failure. | ADR-0026/0007, M5.3 |
| P5-AC-06 | Per-frame caching does not pollute or unbound the static-asset cache. | ADR-0026, M5.3 |
| P5-AC-07 | Notification and camera-motion events trigger flows with no flow-engine change. | D7×D13, M5.4 |
| P5-AC-08 | No Discord token is stored; no notification or frame data is exfiltrated; frames stay on LAN. | SR-003 carried, M5.4 |
| P5-AC-09 | NFR budgets hold with 4 cameras + multi-source notifications active. | NFR-08/09, M5.4 |

---
*End of Phase 5 Deep Dive (Draft v0.1). New decision ADR-0026 appended to the Decision Log. Next: Phase 6 (Plugin SDK & Ecosystem).*

---



<a id="document-8-phase-6-plugin-sdk-ecosystem-deep-dive"></a>

# Document 8 — Phase 6 (Plugin SDK & Ecosystem) Deep Dive

## CyberDeck — Phase 6 (Plugin SDK & Ecosystem) Deep Dive

**Document 8 of the CyberDeck Enterprise Documentation Set · Per-Phase Deep Dive**
Version 0.1 (Draft) · June 2026 · Codebase ID: `com.shishir.cyberdeck`

> Implementation-depth specification for **Phase 6**. Turns the V1 plugin *contract* (used internally by first-party plugins since Phase 1) into a **public, signed, sandboxed third-party surface** with discovery/installation, plugin-provided widget types and flow nodes, and a distribution/marketplace path. This is the phase that realizes ADR-0006's promise: "first-party = third-party, it's metadata not architecture." New decisions: **ADR-0027 (plugin signing & trust tiers)**, **ADR-0028 (plugin sandboxing model)**, **ADR-0029 (plugin-provided UI: widgets & nodes as portable descriptors + sandboxed render)**.

### Contents
1. Phase intent & definition of done
2. Scope: in / out
3. Seams consumed (the whole point)
4. Workstream map
5. WS-6.1 Public SDK & plugin packaging
6. WS-6.2 Plugin discovery, install & lifecycle (third-party)
7. WS-6.3 Signing & trust tiers
8. WS-6.4 Sandboxing
9. WS-6.5 Plugin-provided widget types
10. WS-6.6 Plugin-provided flow nodes
11. WS-6.7 Marketplace / distribution
12. WS-6.8 Hot-reload & developer experience
13. End-to-end realized journeys
14. Code structure (additions)
15. Test plan
16. Milestones & sequencing
17. Risks & mitigations
18. Acceptance criteria (traced)

---

### 1. Phase intent & definition of done

**Intent.** Open CyberDeck to third-party extension. Because first-party capabilities have run on the plugin contract since Phase 1 (ADR-0006), the *contract* is already proven; Phase 6 adds the **public-facing layer** around it: a documented SDK, packaging, discovery/install, **signing + trust tiers**, **sandboxing**, plugin-provided **widgets** and **flow nodes**, and a **marketplace** path. The hardening that first-party plugins didn't strictly need (untrusted code isolation, signature verification, permission review UX) is built here.

**Definition of done.**
- A third-party developer can build, package, sign, and publish a plugin using public docs/SDK, and a user can discover, install, permission-review, and run it.
- Third-party plugins run under the **same contract** as first-party but with **tighter sandboxing** and **mandatory signature verification**; an unsigned/untrusted plugin is gated.
- A third-party plugin can contribute **actions, states, events, flow nodes, and widget types**, all of which surface in the designer/flow-builder automatically (the schema-driven payoff).
- A malicious or buggy third-party plugin cannot crash the engine, exceed its declared permissions, or exfiltrate data.
- All Phase-6 ACs verified.

### 2. Scope: in / out

#### In scope (Phase 6)
| Area | Included | PRD |
|------|----------|-----|
| SDK | public SDK + packaging + docs + samples | D15-04 |
| Loading | third-party discovery/install/enable/disable/update | D15-05 |
| Trust | signing + verification + trust tiers | D14-07 |
| Sandbox | OS-level confinement of plugin processes | D14-07 |
| UI extension | plugin-provided widget types | D5-14 |
| Automation extension | plugin-provided flow nodes | D7-12 |
| Permissions | declaration + user review/grant + enforcement (hardened) | D14-06 |
| Distribution | marketplace path | D15-06 |
| DX | hot-reload (config + plugin dev loop) | D1-11 |
| Governance | audit-log search/export UI | D14-08 |

#### Out of scope
Remote (P7) · collaboration/adaptive layouts (P8). Cloud-hosted marketplace backend depends on the P7 account/cloud overlay; Phase 6 can ship a **local/sideload + signed-registry** model first.

### 3. Seams consumed (the whole point)

| Seam (built in V1, used by 1P since) | Phase-6 public realization |
|--------------------------------------|----------------------------|
| Plugin manifest + IPC + lifecycle (2F) | published as the **SDK contract**; third-party plugins use it verbatim |
| Out-of-process isolation (2F/ADR-0006) | hardened into **sandboxing** (ADR-0028) for untrusted code |
| Permission declaration + host enforcement (2F §7) | **user-facing review/grant** flow + stricter defaults for third-party |
| Registry merge (action/widget/flow-node, 2B §3) | third-party contributions merge identically → auto-surface in designer/builder |
| Widget-type registry + client renderer registry (2B/2C) | **plugin-provided widgets** (ADR-0029) |
| Flow-node registry + executor dispatch (2D §9) | **plugin-provided flow nodes** (registry-dispatched, no core change) |
| Network flow-node permission model (ADR-0024) | generalized to **plugin network permission** review |
| `origin` metadata (ADR-0006 §8) | now drives signing/trust-tier/permission-default differences |

The defining property: **almost nothing in the engine core changes** — Phase 6 adds the *public surface, trust, and sandbox* around a contract that already exists. That's the validation of the entire architecture.

### 4. Workstream map

```
WS-6.1 SDK/packaging ─► WS-6.2 Discovery/install/lifecycle ─► WS-6.7 Marketplace
WS-6.3 Signing/trust ─┐                                    
WS-6.4 Sandboxing ────┴─► (gate third-party at install/run)
WS-6.5 Plugin widgets ─┐
WS-6.6 Plugin nodes ───┴─► auto-surface in designer/builder
WS-6.8 Hot-reload/DX (cross-cutting)
WS-6.9 Audit search/export UI (governance)
```

---

### 5. WS-6.1 — Public SDK & plugin packaging

**Owning TRD:** 2F. **PRD:** D15-04.

#### 5.1 Capability detail
- **SDK**: the documented manifest schema, IPC message contract (envelope, message types), capability interfaces (PAL), and registry-contribution schemas (action/widget/flow-node) — i.e. exactly what first-party plugins use (2F/2B/2G), now published with reference docs, language-agnostic protocol docs, and a Go reference library + at least one other-language example (since IPC is JSON over loopback, any language works).
- **Packaging**: a plugin package format (`.cyberdeck-plugin`) = the plugin binary(ies) per OS + manifest + signature + assets; install drops it into the plugins data folder (the engine's existing host launches it).

#### 5.2 Technical spec
- The SDK is **versioned** (`apiVersion`, Master §6.4); the host refuses incompatible majors (2F TF-6) — already enforced for first-party, now the public compatibility guarantee.
- Reference SDK provides manifest scaffolding, IPC client, and typed helpers for `stateUpdate`/`invokeAction`/`registerContribution`.

#### 5.3 Code structure
```
sdk/                      // public
  go/cyberdeck-plugin/    // Go reference library
  protocol/               // language-agnostic protocol + manifest schema docs
  samples/{hello-state, custom-action, custom-widget, custom-node}/
tools/packager/           // build .cyberdeck-plugin (+sign, WS-6.3)
```

---

### 6. WS-6.2 — Plugin discovery, install & lifecycle (third-party)

**Owning TRD:** 2F §6 (lifecycle), §9 (SDK seam). **PRD:** D15-05.

#### 6.1 Functional flow
```
User browses marketplace / sideloads a .cyberdeck-plugin
  → install: verify signature (WS-6.3) → show declared permissions for review
  → user grants/denies permissions → host registers plugin (DISABLED)
  → user enables → host launches in sandbox (WS-6.4) → plugin registers contributions
  → contributions auto-surface in designer/flow-builder (schema-driven)
  → update: new version → re-verify signature → re-review only if permissions changed
  → disable/uninstall: stop process, keep/remove contributions (faulted-keeps vs uninstall-removes)
```

#### 6.2 Capability detail
- Full third-party lifecycle on the Phase-1 state machine (2F §6: DISCOVERED→LAUNCHING→READY→…→DISABLED), now with **install/uninstall/update/enable/disable** user operations and the **permission-review gate**.
- **Disabled by default on install**; explicit enable required (no auto-run of freshly-installed third-party code).

#### 6.3 Code structure
```
engine/pluginhost/ install.go update.go enable.go review.go   (third-party lifecycle ops)
client/lib/plugins/ browse.dart install.dart permission_review.dart manage.dart
```

---

### 7. WS-6.3 — Signing & trust tiers

**Owning TRD:** 2E, 2F §8. **PRD:** D14-07. **ADR:** **0027 (new)**.

#### 7.1 The decision (ADR-0027)
**Trust tiers driven by signature, not by a binary first/third distinction.**
- **First-party**: signed by CyberDeck's key, part of the signed installer; trusted defaults.
- **Verified third-party**: signed by a developer key registered with the marketplace; signature verified at install + each update; permissions user-reviewed.
- **Unverified/sideloaded**: signature absent or unrecognized; install requires an explicit "I understand the risk" gate, runs with the **strictest sandbox** and **no trusted permission defaults** (everything must be explicitly granted).
- Trust tier affects **permission defaults, sandbox tightness, and UX labeling** — *never* the execution contract (consistent with ADR-0006: still one model, metadata differs).

#### 7.2 Technical spec
- Signatures over the package (manifest + binaries + assets); developer keys registered/managed via the marketplace (WS-6.7). Verification at install and update.
- Revisions that change declared permissions force re-review; revisions that don't can update silently (still signature-verified).

#### 7.3 Code structure
```
engine/core/security/plugin_signing.go   // verify package signatures, trust-tier resolution
tools/packager/sign.go
```

---

### 8. WS-6.4 — Sandboxing

**Owning TRD:** 2F §9. **PRD:** D14-07. **ADR:** **0028 (new)**.

#### 8.1 The decision (ADR-0028)
**OS-level process confinement layered on the existing out-of-process isolation, scaled by trust tier.**
- Out-of-process isolation (ADR-0006) already prevents a plugin crash from taking the engine down. Sandboxing adds **confinement of what a plugin process can do**:
  - **Filesystem**: confined to the plugin's own data dir + explicitly-granted paths; no access to the SQLite store, secret store, or other plugins' data.
  - **Network**: denied unless the manifest declares (and the user grants) `network` (generalizing ADR-0024's flow-network gate to plugins); outbound only, to declared hosts where feasible.
  - **OS capabilities**: only the PAL capabilities the manifest declares and the host grants.
- Implemented per-OS with the available primitives (e.g. restricted tokens/job objects on Windows, sandbox profiles/entitlements on macOS, namespaces/seccomp/cgroups on Linux) behind a single `PluginSandbox` interface (PAL-style, provider-chained — degrades to "isolation-only" with a clear warning where OS sandboxing is unavailable).
- **Trust-tier scaling**: unverified plugins get the tightest profile; verified third-party a standard profile; first-party the installer-trusted profile.

#### 8.2 Technical spec
- The host applies the sandbox profile at plugin launch; permission grants map to sandbox allowances (network grant → network namespace allowance, etc.).
- Resource limits (CPU/RAM) per plugin enforced; a plugin exceeding limits is throttled or faulted (2F §4).
- Audit: sandbox denials are logged (a plugin attempting un-granted access is recorded).

#### 8.3 Code structure
```
engine/pluginhost/sandbox/{windows,darwin,linux}.go   // PluginSandbox per OS
engine/pluginhost/sandbox/sandbox.go                  // interface + trust-tier profiles
```

---

### 9. WS-6.5 — Plugin-provided widget types

**Owning TRD:** 2B §3.2 (widget registry), 2C §7 (renderer registry). **PRD:** D5-14. **ADR:** **0029 (new)**.

#### 9.1 The challenge
Plugins (engine-side, Go, out-of-process) need to add **client-side (Flutter) widgets**. The plugin can't ship Flutter code into the client. So how does a third-party widget render?

#### 9.2 The decision (ADR-0029)
**Plugin-provided UI is declarative, not code: a widget type is a portable descriptor composed from primitive render elements the client already knows, plus data bindings — never arbitrary executable UI code shipped to the client.**
- A plugin registers a widget type as a **composition of built-in render primitives** (containers, text, image/asset, gauge, sparkline, bar, icon, slider, toggle) with a **layout + binding spec** referencing the plugin's states and actions.
- The client renders it with its **existing native primitives** driven by the descriptor — so a third-party widget is *data*, interpreted by the trusted client renderer, not foreign code executing on the device.
- This keeps the client safe (no third-party code on user devices), preserves native performance, and still lets plugins create genuinely new widget *types* (novel compositions/bindings).
- Truly bespoke custom-drawn widgets (beyond composition of primitives) are **out of scope** for V-ecosystem; the primitive set is rich enough for the vast majority, and expanding the primitive vocabulary is a safer lever than shipping code.

#### 9.3 Technical spec
- Widget descriptor schema extends the 2B widget-type registry: `renderTree` of primitives + `bindings` + `gestures`. The client's renderer registry gains a **descriptor interpreter** that builds a native tree from the descriptor (vs a hardcoded builder for built-in types).
- `valueRules` and interaction slots work identically (they're already declarative).

#### 9.4 Code structure
```
shared/schemas/widget_descriptor.schema.json   // composition-of-primitives spec
client/lib/render/descriptor_interpreter.dart   // builds native tree from a plugin widget descriptor
engine/core/registry/widgets.go                 // accept plugin descriptors
```

---

### 10. WS-6.6 — Plugin-provided flow nodes

**Owning TRD:** 2D §9 (registry-dispatched executor), 2B §3.3. **PRD:** D7-12.

#### 10.1 Capability detail
- A plugin registers a **flow node** (kind, param schema, an execution handle) into the flow-node registry; the executor **dispatches by kind** to the plugin over IPC (2D §9 was built for exactly this).
- The node appears in the visual flow builder's palette automatically (schema-driven), with auto-generated param editors.
- Node execution runs **in the plugin's sandbox** (WS-6.4); a node needing network requires the plugin's network grant (ADR-0024 generalized).

#### 10.2 Technical spec
- Executor `dispatch(node)` for an unknown built-in kind routes to the registering plugin via an `invokeNode` IPC call (symmetric to `invokeAction`), awaiting a result that yields the next node + any local-scope writes.
- Failure/cancellation semantics identical to built-in nodes (2D §8) — a plugin node that throws fails the run safely, never crashes the engine.

#### 10.3 Code structure
```
engine/core/flow/plugin_node.go     // invokeNode dispatch over IPC
engine/core/registry/flownodes.go   // accept plugin node registrations
```

---

### 11. WS-6.7 — Marketplace / distribution

**PRD:** D15-06.

#### 11.1 Capability detail
- A **distribution path** for plugins (and, reusing Phase-2 export, **layouts** and flows): browse, install, update, rate.
- **Two delivery models**, sequenced: (a) **sideload + signed registry** (a signed index of verified plugins, installable without a cloud account) shippable in Phase 6; (b) **cloud-hosted marketplace** which depends on the Phase-7 account/cloud overlay — so the full hosted marketplace may straddle P6→P7.
- Developer key registration + signing (WS-6.3) underpins the verified tier.

#### 11.2 Technical spec
- The client's plugin-browse UI talks to the registry (signed index for model (a); cloud API for model (b)). Installs always go through signature verification (WS-6.3) and permission review (WS-6.2).
- Marketplace flows containing `httpRequest` nodes inherit ADR-0024's gate automatically.

---

### 12. WS-6.8 — Hot-reload & developer experience

**PRD:** D1-11.

- **Config hot-reload** (deferred from V1, Doc 0 §12): a file-watcher reloads `config.json` without an engine restart.
- **Plugin dev loop**: a dev mode that reloads a plugin on rebuild (stop → relaunch in sandbox → re-register), so developers iterate fast. Dev mode relaxes signing (local unsigned dev plugins allowed under an explicit dev flag) but **never** relaxes sandboxing.

---

### 13. End-to-end realized journeys (Phase 6)

**Third-party developer ships a plugin.** A developer uses the SDK to build a "Philips Hue direct" plugin (states + actions + a custom room widget composed from primitives + a "set scene" flow node), packages and signs it, publishes to the registry. The plugin's actions/widget/node appear in another user's designer and flow builder automatically after install — zero CyberDeck code change.

**User installs and reviews.** A user browses the marketplace, installs the plugin, reviews its declared permissions (network to the Hue bridge, no filesystem), grants them, enables it; it runs sandboxed. A buggy update that crashes is restarted by the host and faulted without affecting the engine; a version that adds a new permission forces re-review.

**Untrusted sideload.** A user sideloads an unsigned plugin; the install warns and runs it in the strictest sandbox with no default permissions; an attempt to read outside its data dir is denied and audited.

### 14. Code structure (additions)

```
sdk/  (public: go lib, protocol docs, samples)
tools/packager/  (build + sign .cyberdeck-plugin)
engine/
  pluginhost/{install,update,enable,review}.go
  pluginhost/sandbox/{sandbox.go,windows.go,darwin.go,linux.go}
  core/security/plugin_signing.go
  core/registry/{widgets.go(+descriptors), flownodes.go(+plugin nodes)}
  core/flow/plugin_node.go
client/lib/
  plugins/{browse,install,permission_review,manage}.dart
  render/descriptor_interpreter.dart
  governance/audit_search.dart        // WS-6.9 audit search/export UI
shared/schemas/widget_descriptor.schema.json
```

### 15. Test plan

| Layer | Scope | Pass criteria |
|-------|-------|---------------|
| SDK | build/package/sign a sample plugin; install in a clean engine | sample runs; contributions surface |
| Signing | verified/unverified/tampered package | tampered rejected; unverified gated; verified installs |
| Sandbox | filesystem/network/capability denial per tier; resource limits | denials enforced + audited; engine unaffected |
| Lifecycle | install→review→enable→update(perm change→re-review)→disable→uninstall | gates correct; disabled-by-default |
| Plugin widget | descriptor → native render; malicious descriptor (no code exec) | renders safely; no code path for foreign code |
| Plugin node | registry dispatch; node failure isolation; network-gated node | dispatched; failure safe; gate enforced |
| Marketplace | browse/install/update via signed registry | install path end-to-end |
| Security (red-team) | malicious plugin: crash, over-permission, exfiltration, escape sandbox | all contained; engine survives; nothing exfiltrated |
| Compatibility | apiVersion major mismatch refused | refused with diagnostic |

### 16. Milestones & sequencing

| Milestone | Content | Gate |
|-----------|---------|------|
| **M6.1 SDK + packaging** | WS-6.1 | a sample third-party plugin builds, packages, installs |
| **M6.2 Trust + sandbox** | WS-6.3 + WS-6.4 | signature gating + per-tier sandbox enforced + audited |
| **M6.3 Lifecycle + review** | WS-6.2 | install/enable/update/disable + permission review |
| **M6.4 UI/automation extension** | WS-6.5 + WS-6.6 | plugin widget renders; plugin node runs; both auto-surface |
| **M6.5 Marketplace + DX + governance** | WS-6.7 + WS-6.8 + WS-6.9 | signed-registry install; hot-reload dev loop; audit search UI |
| **M6.6 Harden (red-team)** | ACs + security | malicious-plugin suite contained |

### 17. Risks & mitigations

| Risk | Prob | Impact | Mitigation |
|------|------|--------|-----------|
| Sandbox escape | Low | Critical | Per-OS confinement + least-privilege + red-team suite; out-of-process isolation as the floor; degrade to isolation-only with warning where OS sandbox unavailable |
| Malicious plugin exfiltration | Med | High | Network denied unless granted (ADR-0024 generalized); declared-host limits; audit |
| Plugin-widget code-injection attempt | Low | High | ADR-0029: widgets are descriptors interpreted by the trusted client, never foreign code |
| Permission-review fatigue (users click-through) | Med | Med | Minimal, clear, tier-scoped prompts; sensible defaults for verified; strict for unverified |
| apiVersion churn breaks ecosystem | Med | Med | Documented compatibility window; major-version refusal with diagnostic |
| Cloud marketplace depends on P7 | Med | Low | Ship signed-registry/sideload model (a) in P6; hosted model (b) straddles into P7 |

### 18. Acceptance criteria (traced)

| AC | Criterion | Trace |
|----|-----------|-------|
| P6-AC-01 | A third-party developer can build, package, sign, and publish a plugin using public SDK/docs; a user can install and run it. | D15-04/05, M6.1/6.3 |
| P6-AC-02 | Third-party plugins run on the **same contract** as first-party, with tighter sandbox and mandatory signature verification; tampered packages are rejected. | ADR-0006/0027, M6.2 |
| P6-AC-03 | A plugin's actions/states/events/flow-nodes/widgets auto-surface in the designer and flow builder with zero CyberDeck code change. | D5-14/D7-12, M6.4 |
| P6-AC-04 | Plugin-provided widgets render via descriptor interpretation — no third-party code executes on client devices. | ADR-0029, M6.4 |
| P6-AC-05 | A malicious/buggy plugin cannot crash the engine, exceed declared permissions, or exfiltrate data; violations are audited. | ADR-0028, M6.6 |
| P6-AC-06 | Plugins are disabled by default on install; enabling requires explicit permission review; permission-changing updates force re-review. | D14-06, M6.3 |
| P6-AC-07 | Network access is denied to plugins/nodes unless declared and granted. | ADR-0024 generalized, M6.2 |
| P6-AC-08 | A signed-registry/sideload install path works without a cloud account; hosted marketplace may depend on P7. | D15-06, M6.5 |
| P6-AC-09 | Config hot-reload and a plugin dev-reload loop work; dev mode relaxes signing but never sandboxing. | D1-11, M6.5 |
| P6-AC-10 | Audit-log search/export UI lets an operator inspect actions/permissions/denials. | D14-08, M6.5 |

---
*End of Phase 6 Deep Dive (Draft v0.1). New decisions ADR-0027/0028/0029 appended to the Decision Log. Next: Phase 7 (Remote Access) — activating the LAN-now/remote-later seam.*

---



<a id="document-9-phase-7-remote-access-deep-dive"></a>

# Document 9 — Phase 7 (Remote Access) Deep Dive

## CyberDeck — Phase 7 (Remote Access) Deep Dive

**Document 9 of the CyberDeck Enterprise Documentation Set · Per-Phase Deep Dive**
Version 0.1 (Draft) · June 2026 · Codebase ID: `com.shishir.cyberdeck`

> Implementation-depth specification for **Phase 7 (Remote Access)**. This is the phase the whole architecture was built to make *additive*: activating the LAN-now/remote-later seam (ADR-0010) so a client outside the LAN can reach the engine — **without changing identity, crypto, sessions, or the document/state model** (ADR-0008/0009/0002). It also introduces the optional **account/cloud overlay** (ADR-0016) that gates remote and the hosted marketplace. New decisions: **ADR-0030 (relay/rendezvous architecture)**, **ADR-0031 (account overlay & licensing enforcement boundary)**, **ADR-0032 (remote security hardening & relay trust)**.

### Contents
1. Phase intent & definition of done
2. Scope: in / out
3. The seam this phase activates (and what must NOT change)
4. Workstream map
5. WS-7.1 Relay / rendezvous service
6. WS-7.2 Remote endpoint type & connection manager
7. WS-7.3 NAT traversal & path selection
8. WS-7.4 Account / cloud overlay
9. WS-7.5 Cloud backup & sync
10. WS-7.6 Remote security hardening
11. End-to-end realized journeys
12. Code structure (additions)
13. Test plan
14. Milestones & sequencing
15. Risks & mitigations
16. Acceptance criteria (traced)

---

### 1. Phase intent & definition of done

**Intent.** Let a user control their engine from outside the local network (e.g. home PC from the office) and back up/sync their configuration — by adding a relay-backed transport endpoint behind the Phase-1 `ConnectionManager` abstraction and an optional account overlay, **without touching the trust, crypto, session, or data model.** This phase proves ADR-0010's promise: remote is an *addition*, not a *rewrite*.

**Definition of done.**
- A paired client connects to its engine from outside the LAN; identity, encryption, and sessions behave identically to LAN (only the endpoint differs).
- The relay is a **blind transport** — it cannot read session contents (E2E encryption from ADR-0009 holds end-to-end through the relay).
- LAN remains preferred when both paths are reachable; remote is a fallback candidate.
- Account creation is optional and gates **only** cloud features (remote, backup, sync, hosted marketplace) — local use stays free and account-free (ADR-0016).
- Cloud backup/sync round-trips configuration (never secrets).
- All Phase-7 ACs verified; remote-specific threats mitigated; no regression to LAN behavior.

### 2. Scope: in / out

#### In scope (Phase 7)
| Area | Included | PRD |
|------|----------|-----|
| Relay | rendezvous + relay transport (blind) | D3-09 |
| NAT | traversal + direct-vs-relay path selection | D3-10 |
| Endpoint | `RelayEndpoint` behind ConnectionManager (ADR-0010 realized) | — |
| Account | optional account overlay; licensing-gating | D16-01, D16-03 |
| Cloud | config backup & sync | D16-02 |
| Security | remote hardening, relay trust, abuse limits | — |
| Marketplace | hosted marketplace backend (straddles from P6) | D15-06 |

#### Out of scope
Team sharing (P8) · collaboration/adaptive layouts (P8). Cross-engine binding is P8.

### 3. The seam this phase activates (and what must NOT change)

This phase is the explicit test of Doc 0 §10. The contract:

| Concern | Stays identical (built P1) | Phase 7 adds |
|---------|----------------------------|--------------|
| Identity | keypair + UUID (ADR-0008) | — |
| Encryption | E2E over session keys (ADR-0009) | E2E now traverses a relay; relay is blind |
| Sessions | per-device, isolated (ADR-0002) | — transport-agnostic, unchanged |
| Document/state model | unchanged | — |
| Addressing | `TransportEndpoint`/`ConnectionManager` (ADR-0010) | a `RelayEndpoint` implementation |
| Discovery | mDNS/QR/manual | + a rendezvous lookup for remote |
| Permissions/audit | per-device (2E) | unchanged (a remote device is still a device) |

**The rule (non-negotiable):** nothing above the `ConnectionManager` learns that a session is remote. If any engine/session/document code needs an `if remote` branch, the seam was wrong — and it wasn't (ADR-0010 was designed for exactly this).

### 4. Workstream map

```
WS-7.1 Relay/rendezvous service ─► WS-7.2 RelayEndpoint ─► WS-7.3 NAT/path selection
WS-7.4 Account overlay ─► WS-7.5 Backup/sync ; gates WS-7.1 (remote) + hosted marketplace
WS-7.6 Remote security hardening (cross-cutting, gates GA)
```

---

### 5. WS-7.1 — Relay / rendezvous service

**ADR:** **0030 (new)**. **PRD:** D3-09.

#### 5.1 The decision (ADR-0030)
**A blind relay + rendezvous service; the cloud never sees plaintext.**
- **Rendezvous**: a lookup service where an engine (with an account, WS-7.4) registers its reachability; a remote client resolves its paired engine's current relay address by engine UUID. (Replaces mDNS, which is LAN-only, for the remote path.)
- **Relay**: forwards encrypted frames between client and engine when a direct path can't be established. The relay **only sees ciphertext** — the E2E session keys (ADR-0009) are negotiated end-to-end between the paired device and engine; the relay is a dumb pipe. It cannot read media, telemetry, actions, or anything.
- The relay/rendezvous is the **first and only cloud-hosted server component** in the product; it is deliberately minimal (transport only — no application logic, no plaintext).

#### 5.2 Technical spec
- Engine registers with rendezvous on remote-enable: `{engine_uuid, account_id, relay_session_token}`; heartbeats to stay registered.
- A remote client authenticates to rendezvous via its account, requests its engine's relay path, and opens a relayed connection; the **CyberDeck handshake (2E §3) then runs end-to-end through the relay** exactly as on LAN — the relay never participates in key agreement.
- Relay enforces per-account rate/bandwidth limits (abuse control, WS-7.6).

#### 5.3 Code structure
```
cloud/relay/          // the relay/rendezvous service (Go) — minimal, transport-only
  rendezvous.go register.go resolve.go
  relay.go forward.go   // ciphertext forwarding; no plaintext access
  limits.go             // per-account rate/bandwidth
engine/core/transport/relay_register.go   // engine registers/heartbeats when remote-enabled
```

---

### 6. WS-7.2 — Remote endpoint type & connection manager

**ADR:** 0010 (realized). 

#### 6.1 Capability detail
- A new `RelayEndpoint` implements the Phase-1 `TransportEndpoint` interface. `ConnectionManager.Resolve(deviceUUID)` now may return, as ordered candidates: direct last-IP → mDNS (LAN) → **RelayEndpoint** (remote). LAN candidates rank above relay so **LAN is preferred** when both are reachable.
- Everything above the ConnectionManager (sessions, channels, document model, engine) is **untouched** — it dials an endpoint and runs the same handshake/session.

#### 6.2 Technical spec
- `RelayEndpoint.Dial` resolves via rendezvous (WS-7.1) and opens a relayed connection; from the session's perspective it's just a `Conn`.
- The three channels (2A) ride the relayed connection identically; resilience (heartbeat/reconnect/resync) works unchanged — reconnect may now re-resolve via rendezvous as an additional candidate.
- Asset delivery (ADR-0021) and periodic frames (ADR-0026) work over relay transparently (they're request/response over the session).

#### 6.3 Code structure
```
engine/core/transport/endpoint_relay.go   // RelayEndpoint (impl of TransportEndpoint)
engine/core/transport/connmgr.go           // (extended) relay as a lower-priority candidate
client/lib/net/connection_manager.dart      // (extended) remote candidate + rendezvous lookup
```

---

### 7. WS-7.3 — NAT traversal & path selection

**PRD:** D3-10.

#### 7.1 Capability detail
- Attempt **direct peer-to-peer** first (hole-punching via the rendezvous as a signaling channel — STUN-like); fall back to **relay** when direct fails (symmetric NAT, restrictive firewalls).
- **Path selection** order: LAN direct → WAN direct (hole-punched) → relay. Always prefer the cheapest/lowest-latency reachable path; relay is the guaranteed-works fallback.

#### 7.2 Technical spec
- Rendezvous doubles as the **signaling** channel for hole-punching (exchange candidate addresses); if direct succeeds, the relay is bypassed (lower latency, no relay bandwidth cost); if not, frames flow through the relay.
- Path can upgrade/downgrade mid-session (e.g. relay → direct once hole-punch succeeds) transparently to the session.

#### 7.3 Code structure
```
engine/core/transport/nat/{holepunch.go, candidates.go, path_select.go}
client/lib/net/nat.dart
```

---

### 8. WS-7.4 — Account / cloud overlay

**ADR:** **0031 (new)**. **PRD:** D16-01/03.

#### 8.1 The decision (ADR-0031)
**The account is an optional overlay that references device identities; it never owns them, and it gates cloud features only.**
- **Identity stays account-independent** (ADR-0008/0016): keypair+UUID exist from first launch. An account, when created, is a *separate* record that **references** the engine/device UUIDs for cloud services. Deleting the account does not delete identities or local function.
- **Licensing enforcement boundary**: licensing is checked **only at the cloud boundary** (rendezvous/relay/backup APIs), never in the local engine. Local control, designer, flows, plugins — all work with no account, no check, forever. A lapsed subscription disables *remote/backup/sync*; it never touches local use (ADR-0016).
- **Device-count is never enforced** — a paid account uses any number of personal devices (ADR-0016 restated as an enforcement rule).

#### 8.2 Technical spec
- Account record (the `accounts` table reserved in 2B §6) links to engine/device UUIDs; auth via standard account credentials to the cloud APIs.
- The engine gains a thin "cloud client" that authenticates to rendezvous/backup; it is **inert without an account** and its absence changes nothing locally.
- Licensing tier (`accounts.tier`) gates which cloud APIs the account may call; enforced server-side at the cloud boundary.

#### 8.3 Code structure
```
engine/core/cloud/account.go authclient.go   // optional; inert without account
cloud/api/{account,auth,licensing}.go         // cloud boundary; licensing enforced here ONLY
client/lib/cloud/account_ui.dart
```

---

### 9. WS-7.5 — Cloud backup & sync

**PRD:** D16-02.

#### 9.1 Capability detail
- **Backup**: export the document set (profiles/pages/widgets), flows, variables, device labels, and config to the cloud — **never secrets** (2E §7; credentials are re-entered after restore, carried).
- **Sync**: keep configuration consistent across a user's engines (e.g. desktop + laptop) — last-write-wins per document with version (the op-log/versioning from ADR-0012 provides the version basis).

#### 9.2 Technical spec
- Backup payload is the same serialized document set used by Phase-2 import/export (WS-2.7) — reused, not reinvented; encrypted client-side before upload (cloud stores ciphertext blobs — the backup server is as blind as the relay).
- Restore: download → decrypt → import (Phase-2 import path) → re-enter credentials.
- Sync conflicts: document version compare; last-write-wins with a surfaced "this was changed elsewhere" notice (full CRDT merge is P8 collaboration territory).

#### 9.3 Code structure
```
engine/core/cloud/backup.go sync.go         // client-side encrypt; reuse layout portability
cloud/api/backup.go                          // blind blob store
```

---

### 10. WS-7.6 — Remote security hardening

**ADR:** **0032 (new)**. 

#### 10.1 The decision (ADR-0032)
**Remote widens the attack surface; harden at the new edges without weakening the E2E core.**
- **Relay is blind** (ADR-0030): cannot read session contents; compromise of the relay leaks *traffic metadata at most*, never plaintext.
- **Rendezvous abuse control**: rate limits, account-scoped registration, and engine-side **explicit remote-enable** (remote is off by default; a user must turn it on per engine via the privileged local channel — a remote attacker cannot enable remote).
- **Remote device permissions unchanged**: a remote device is still a device with per-device permissions (2E §5) and full audit; remote does not grant extra capability. Users may set **stricter permissions for remote sessions** (e.g. deny power actions when off-LAN) — an optional per-device "remote profile."
- **Replay/abuse at the relay**: session-level nonces/forward-secrecy (2E/2A) already defeat replay; the relay adds connection-level rate limiting and anomaly logging.
- **Threat-model additions** (deferred from 2E §8): relay compromise (mitigated: blind), rendezvous compromise (mitigated: metadata only + abuse limits), credential stuffing on accounts (standard account-security controls), and remote DoS (rate/bandwidth limits).

#### 10.2 Code structure
```
engine/core/transport/relay_register.go   // remote-enable gated to privileged local channel
engine/core/security/remote_perms.go       // optional stricter remote permission profile
cloud/relay/limits.go anomaly.go
```

---

### 11. End-to-end realized journeys (Phase 7)

**Control home PC from the office (PRD Journey 7, now real).** User enables remote on the home engine (privileged local action) + signs into an account → engine registers with rendezvous. From a phone on cellular, the client resolves the engine via rendezvous, hole-punches (or relays), runs the **same handshake and session** as on LAN, and controls the PC. Returning home, the client prefers the LAN path automatically.

**Blind relay.** Even when traffic flows through the relay, the relay operator sees only ciphertext — media, telemetry, and actions are unreadable (E2E from ADR-0009).

**Backup & restore.** A user backs up their configuration to the cloud (encrypted client-side); after reinstalling on a new PC, they restore the document set and flows, then re-enter integration credentials (never backed up).

**Lapsed subscription.** A user's subscription lapses → remote/backup stop working → **local use is completely unaffected** (no account check ever runs locally).

### 12. Code structure (additions)

```
cloud/                         // FIRST cloud component in the product
  relay/{rendezvous,register,resolve,relay,forward,limits,anomaly}.go
  api/{account,auth,licensing,backup}.go
engine/core/
  transport/{endpoint_relay.go, relay_register.go, nat/*}
  cloud/{account.go, authclient.go, backup.go, sync.go}
  security/remote_perms.go
client/lib/
  net/{connection_manager.dart(+relay), nat.dart}
  cloud/{account_ui.dart, backup_ui.dart}
```
> Note the engine-core additions are thin: a relay endpoint, a relay-register hook, NAT helpers, an inert-without-account cloud client. **Sessions, channels, documents, flows, permissions, audit — all unchanged.** ADR-0010 validated.

### 13. Test plan

| Layer | Scope | Pass criteria |
|-------|-------|---------------|
| Unit — endpoint | RelayEndpoint as a drop-in TransportEndpoint; candidate ordering (LAN>relay) | LAN preferred; relay fallback |
| Integration — relay blind | capture relay traffic | ciphertext only; no plaintext recoverable |
| Integration — handshake over relay | full 2E handshake through relay | identical session to LAN |
| Integration — NAT | direct hole-punch success + relay fallback; mid-session upgrade | path selection correct |
| Integration — no `if remote` | audit engine/session/document code for transport-kind branches | none exist (seam holds) |
| Integration — account optional | full local use with no account; remote/backup gated by account | local unaffected; cloud gated |
| Integration — backup/restore | round-trip config; secrets excluded; client-side encryption | restore works; no secrets in cloud |
| Integration — remote-enable gating | attempt remote-enable from a remote session | denied; only privileged local channel can enable |
| Security (red-team) | relay compromise, rendezvous abuse, credential stuffing, remote DoS | metadata-only leak; abuse limited; no plaintext |
| Regression — LAN | all prior phases on LAN | no regression |

### 14. Milestones & sequencing

| Milestone | Content | Gate |
|-----------|---------|------|
| **M7.1 Relay/rendezvous** | WS-7.1 | engine registers; client resolves; blind ciphertext forwarding |
| **M7.2 Remote endpoint** | WS-7.2 | handshake+session over relay identical to LAN; LAN preferred |
| **M7.3 NAT** | WS-7.3 | direct hole-punch + relay fallback + mid-session upgrade |
| **M7.4 Account + backup/sync** | WS-7.4 + WS-7.5 | optional account; remote/backup gated; config round-trips encrypted |
| **M7.5 Harden + hosted marketplace** | WS-7.6 (+P6 hosted marketplace) | red-team contained; remote off-by-default; no LAN regression |

### 15. Risks & mitigations

| Risk | Prob | Impact | Mitigation |
|------|------|--------|-----------|
| Any `if remote` creeping into core | Low | High | The seam (ADR-0010) forbids it; audited in tests; if found, fix the seam not the symptom |
| Relay sees plaintext | Low | Critical | E2E keys end-to-end (ADR-0009); relay is a ciphertext pipe; verified by capture test |
| Rendezvous/relay as a SPOF or abuse target | Med | Med | Minimal blind service; rate/bandwidth limits; anomaly logging; LAN works without it |
| Remote enabled by an attacker | Low | High | Remote-enable gated to the privileged local channel (off by default) |
| Subscription lapse breaks local use | Low | High | Licensing enforced only at the cloud boundary; local never checks (ADR-0031) |
| NAT traversal fails on hostile networks | Med | Low | Relay fallback guarantees connectivity (at a latency cost) |
| Cloud cost/scale of relaying media frames | Med | Med | Prefer direct path; relay bandwidth-limited; assets are pull-based and cached |

### 16. Acceptance criteria (traced)

| AC | Criterion | Trace |
|----|-----------|-------|
| P7-AC-01 | A paired client controls its engine from outside the LAN; identity, encryption, and sessions are identical to LAN. | ADR-0010, M7.2 |
| P7-AC-02 | The relay is blind: captured relay traffic is ciphertext only; no plaintext is recoverable. | ADR-0009/0030, M7.1 |
| P7-AC-03 | LAN is preferred when reachable; relay is a fallback; direct hole-punch is tried before relay. | ADR-0010, M7.2/7.3 |
| P7-AC-04 | No engine/session/document code branches on transport kind (no `if remote`). | ADR-0010, M7.2 |
| P7-AC-05 | Account creation is optional; local use (control/designer/flows/plugins) works fully with no account. | ADR-0016/0031, M7.4 |
| P7-AC-06 | Remote/backup/sync are gated by account+licensing at the cloud boundary only; a lapsed subscription never affects local use. | ADR-0031, M7.4 |
| P7-AC-07 | Device-count is never enforced; a paid account uses any number of personal devices. | ADR-0016, M7.4 |
| P7-AC-08 | Backup round-trips configuration encrypted client-side; secrets are excluded and re-entered on restore. | D16-02, M7.4 |
| P7-AC-09 | Remote is off by default and can only be enabled via the privileged local channel. | ADR-0032, M7.5 |
| P7-AC-10 | Remote sessions honor per-device permissions and audit; optional stricter remote permission profiles work. | 2E, ADR-0032, M7.5 |
| P7-AC-11 | All prior-phase LAN behavior is unchanged (no regression). | all, M7.5 |

---
*End of Phase 7 Deep Dive (Draft v0.1). New decisions ADR-0030/0031/0032 appended to the Decision Log. Next: Phase 8 (Advanced).*

---



<a id="document-10-phase-8-advanced-deep-dive"></a>

# Document 10 — Phase 8 (Advanced) Deep Dive

## CyberDeck — Phase 8 (Advanced) Deep Dive

**Document 10 of the CyberDeck Enterprise Documentation Set · Per-Phase Deep Dive**
Version 0.1 (Draft) · June 2026 · Codebase ID: `com.shishir.cyberdeck`

> Implementation-depth specification for **Phase 8 (Advanced)** — the candidate phase of capabilities that each layer onto a seam built much earlier: **collaborative multi-author editing** (on the op-log, ADR-0012), **responsive/adaptive layouts** (on the DeviceClass model, ADR-0017), **cross-engine binding** (on the multi-trust identity model, ADR-0008), and **team sharing** (on the account overlay, ADR-0031). These are explicitly *candidates* — prioritized by post-launch signal, not committed. New decisions: **ADR-0033 (CRDT/OT collaboration on the op-log)**, **ADR-0034 (adaptive layout model — opt-in, authored-base + rules)**, **ADR-0035 (cross-engine multi-bind & engine switching)**.

### Contents
1. Phase intent & definition of done
2. Scope: in / out (and the candidate caveat)
3. Seams consumed
4. Workstream map
5. WS-8.1 Collaborative multi-author editing
6. WS-8.2 Responsive / adaptive layouts
7. WS-8.3 Cross-engine binding & switching
8. WS-8.4 Team sharing
9. End-to-end realized journeys
10. Code structure (additions)
11. Test plan
12. Milestones & sequencing
13. Risks & mitigations
14. Acceptance criteria (traced)

---

### 1. Phase intent & definition of done

**Intent.** Deliver the "someday" capabilities the architecture deliberately left room for, each as a clean addition at a pre-built seam: real-time collaborative editing, layouts that adapt across device classes, a single device bound to multiple engines, and account-based team sharing. The intent is also to **prove the seams one final time** — if any of these needs a foundational rewrite, the foundation was wrong; the thesis is that none of them do.

**Definition of done (per candidate, if undertaken).**
- **Collaboration**: two authors edit the same profile concurrently with conflict-free convergence, on the existing op-log — no new sync substrate.
- **Adaptive layouts**: a user opts a profile into adaptive mode; one authored base layout adapts to other device classes via explicit rules — without breaking the per-device-class default (ADR-0017 stays the default).
- **Cross-engine**: a device bound to multiple engines switches between them with clear, unambiguous context — on the multi-trust identity model.
- **Team sharing**: an account can share layouts/flows/plugins with team members through the cloud overlay.

> Because Phase 8 is candidate-driven, "definition of done" is scoped to whichever candidates are greenlit; each is independently shippable.

### 2. Scope: in / out (and the candidate caveat)

#### Candidates (each independent; prioritize by signal)
| Candidate | Seam it rides | PRD |
|-----------|---------------|-----|
| Collaborative multi-author editing | op-log + versioning (ADR-0012) | D4-12 |
| Responsive / adaptive layouts | DeviceClass model (ADR-0017) | D4-13 |
| Cross-engine binding & switching | multi-trust identity (ADR-0008) | Doc 0 §12 |
| Team sharing | account overlay (ADR-0031) | D16-04 |

#### Explicitly not assumed
None of these is committed for a fixed date; they are sequenced after market signal. The value of documenting them now is to (a) confirm the seams hold and (b) prevent earlier phases from accidentally foreclosing them.

### 3. Seams consumed

| Seam | Phase-8 use |
|------|-------------|
| Operation log + monotonic versioning (ADR-0012) | the substrate for collaborative editing — CRDT/OT layers on it (ADR-0033) |
| Single-writer edit lock (2C §4.3) | replaced by multi-writer convergence (the lock was always a V1 simplification, not a wall) |
| DeviceClass + GridConfig (ADR-0017) | the base for adaptive rules (ADR-0034) |
| Multi-trust identity (ADR-0008 §3.3: a device holds N trust records) | cross-engine binding (ADR-0035) |
| Account overlay (ADR-0031) | team sharing |
| Flow-document op model (ADR-0022) | collaboration extends to flows too |
| Cloud blind-storage (ADR-0030/backup) | shared artifacts distributed via the same blind store |

Every candidate attaches at a seam named in Doc 0 §12 — the final validation of the foundation's extension-seam index.

### 4. Workstream map

```
WS-8.1 Collaboration (op-log → CRDT/OT) ─── independent
WS-8.2 Adaptive layouts (DeviceClass → rules) ─── independent
WS-8.3 Cross-engine binding (multi-trust → switch UX) ─── independent
WS-8.4 Team sharing (account → shared artifacts) ─── depends on P7 account
```
All four are independent (8.4 needs the P7 account); pick and sequence by signal.

---

### 5. WS-8.1 — Collaborative multi-author editing

**Owning TRD:** 2C §4 (op-log), 2D (flow op-model). **PRD:** D4-12. **ADR:** **0033 (new)**.

#### 5.1 The decision (ADR-0033)
**Layer conflict-free convergence onto the existing op-log; do not replace it.**
- V1 used a **single-writer edit lock** (2C §4.3) as a deliberate simplification — *explicitly* so that collaboration could be added later without redesign. The op-log itself was always the collaboration substrate (ADR-0012).
- Phase 8 replaces the lock with **operational transformation or a CRDT** over the same operation set (AddWidget, MoveWidget, etc.). Operations are already discrete, versioned, and invertible — the prerequisites for OT/CRDT — so the change is a **convergence layer**, not a new model.
- Concurrent edits from multiple authors are transformed/merged to a consistent document; the merged ops broadcast on the **same Layout channel** to devices (live reflection unchanged).

#### 5.2 Technical spec
- Each op carries author + a causal context (version vector or Lamport stamp); the convergence layer transforms concurrent ops to commute. Choice of OT vs CRDT is an implementation decision deferred to the candidate's design spike (both fit the op model; CRDT favored for offline-tolerant merge).
- Presence (who's editing what) and per-author cursors are additive UI over the same channel.
- Applies to **flows too** (ADR-0022's flow op-model is the same shape) — collaborative flow authoring falls out for free.

#### 5.3 Code structure
```
engine/core/layout/collab/{convergence.go, version_vector.go, presence.go}
client/lib/designer/collab/{presence.dart, remote_cursors.dart}
```

---

### 6. WS-8.2 — Responsive / adaptive layouts

**Owning TRD:** 2C §2 (GridConfig/DeviceClass). **PRD:** D4-13. **ADR:** **0034 (new)**.

#### 6.1 The decision (ADR-0034)
**Adaptive layout is opt-in: an authored base layout + explicit adaptation rules — never silent auto-reflow, and never the default.**
- ADR-0017 (per-device-class authored layouts, no auto-reflow) **remains the default** because silent reflow of a dense neon UI breaks ugly. Adaptive mode is an **opt-in** for users who accept some compromise for breadth.
- An adaptive profile has one **authored base** (for a primary device class) plus **adaptation rules** (e.g. "on a smaller class, drop the chart widgets and stack the gauges 2-wide"; "on a larger class, expand the grid and add the process table"). Rules are explicit and authored, not inferred — the author stays in control.
- The engine applies the rules to derive a per-class layout from the base; the result is a normal layout document (so rendering, op-log, live reflection are all unchanged).

#### 6.2 Technical spec
- Adaptation rules are a declarative transform over the document tree (show/hide widgets by tag, re-flow placement within a target grid, swap widget variants). Authored in the designer's adaptive mode; previewed per target class.
- Derived layouts are cached as normal documents and can be hand-tweaked (the rule output is a starting point, not a lock).
- Falls back to per-class authoring (ADR-0017) for any class the author wants pixel-perfect — adaptive and authored coexist per profile.

#### 6.3 Code structure
```
engine/core/layout/adaptive/{rules.go, transform.go, derive.go}
client/lib/designer/adaptive/{rule_editor.dart, multi_class_preview.dart}
```

---

### 7. WS-8.3 — Cross-engine binding & switching

**Owning TRD:** 2E §3.3 (multi-trust). **PRD:** Doc 0 §12. **ADR:** **0035 (new)**.

#### 7.1 The decision (ADR-0035)
**A device may bind multiple engines and switch between them; engine context is always explicit and unambiguous.**
- The identity model already supports it (ADR-0008 §3.3: trust is a *set* keyed by engine UUID — a device can hold N trust records). Phase 8 builds the **UX and session management** for switching, not new identity.
- A device shows an **engine switcher**; one engine is active at a time per device (no merging of two engines' state — that would reintroduce the "which device/engine?" confusion the product exists to avoid). Switching tears down the current session and opens one to the selected engine.
- Each engine remains fully isolated and authoritative for itself (ADR-0002 unchanged); cross-engine is *switching*, not *federation*.

#### 7.2 Technical spec
- The connection manager (2A) already resolves per engine UUID; cross-engine is a client-side selection among bound engines + a session swap. Remote (P7) means the bound engines may be LAN or remote — the endpoint abstraction handles both.
- Clear labeling: the active engine's name is always visible (the same "no confusion" discipline as device targeting in the designer).

#### 7.3 Code structure
```
client/lib/net/engine_registry.dart engine_switcher.dart   // bound engines, active selection
client/lib/app/active_engine_indicator.dart
```

---

### 8. WS-8.4 — Team sharing

**Owning TRD:** P7 account overlay (ADR-0031), cloud blind store. **PRD:** D16-04.

#### 8.1 Capability detail
- An account can **share artifacts** — layouts, flows, and (verified) plugins — with team members: a curated, permissioned distribution beyond the public marketplace.
- Reuses Phase-2 export + Phase-7 client-side-encrypted blind cloud storage; sharing is granting team accounts access to an encrypted artifact.
- Shared flows carry their permission gates (e.g. ADR-0024 network) — a recipient must still review/grant; shared plugins carry their signing/trust tier (ADR-0027).

#### 8.2 Technical spec
- Team = an account grouping (cloud-side); artifacts shared to a team are listed in members' clients for import (the Phase-2 import path + dependency check).
- No new local mechanism — sharing is a cloud distribution layer over existing export/import/permission/signing.

#### 8.3 Code structure
```
cloud/api/teams.go sharing.go
client/lib/cloud/team_share_ui.dart
```

---

### 9. End-to-end realized journeys (Phase 8)

**Two streamers co-design a deck.** Jordan and a co-host both open the same "Stream" profile; they place and wire widgets concurrently, see each other's cursors, and the deck converges with no lock contention — then both their tablets reflect the merged result live.

**One layout, many screens (opt-in).** A user opts a profile into adaptive mode, authors the base for their 10" tablet, and adds rules so a phone gets a stacked subset and a desktop gets an expanded grid — reviewing each in multi-class preview, hand-tweaking the phone variant.

**One phone, two PCs.** A user's phone is bound to both their desktop and laptop engines; the engine switcher flips between them, the active engine always labeled — no confusion about which machine a tap controls.

**Team rollout.** A team lead shares a standardized "ops" layout + a set of flows with the team; members import them (dependency-checked), review flow network permissions, and deploy to their own devices.

### 10. Code structure (additions)

```
engine/core/layout/
  collab/{convergence,version_vector,presence}.go
  adaptive/{rules,transform,derive}.go
client/lib/
  designer/collab/{presence,remote_cursors}.dart
  designer/adaptive/{rule_editor,multi_class_preview}.dart
  net/{engine_registry,engine_switcher}.dart
  app/active_engine_indicator.dart
  cloud/team_share_ui.dart
cloud/api/{teams,sharing}.go
```
> Once again the additions are mostly *new modules at the edges*; the op-log, document model, identity, sessions, and engine authority are unchanged. The single-writer lock's removal (8.1) is the only "replacement," and it was pre-planned as a V1 simplification.

### 11. Test plan

| Layer | Scope | Pass criteria |
|-------|-------|---------------|
| Collaboration | concurrent ops from N authors converge; offline edit + rejoin merge; flows too | consistent convergence; no lost edits |
| Adaptive | base + rules derive per-class layouts; opt-in only; per-class authoring still available | correct derivation; ADR-0017 default intact |
| Cross-engine | bind 2 engines; switch; active label correct; no state bleed | isolated switching; no confusion |
| Team sharing | share→import with dependency + permission + signing checks | gated import correct |
| Regression | single-author editing, per-class layouts, single-engine, local-only | no regression for users who use none of P8 |
| Seam audit | confirm no foundational rewrite was needed for any candidate | each rides its named seam |

### 12. Milestones & sequencing

> Sequenced per greenlit candidate; each independently shippable.

| Milestone | Candidate | Gate |
|-----------|-----------|------|
| **M8.A** | Collaboration | concurrent convergence on op-log; presence/cursors |
| **M8.B** | Adaptive layouts | opt-in base+rules; multi-class preview; default unchanged |
| **M8.C** | Cross-engine | multi-bind + switch + unambiguous active-engine UX |
| **M8.D** | Team sharing | account-based share/import with gates |

### 13. Risks & mitigations

| Risk | Prob | Impact | Mitigation |
|------|------|--------|-----------|
| OT/CRDT complexity | Med | Med | Op model is already discrete/versioned/invertible; spike to choose OT vs CRDT; CRDT for offline tolerance |
| Adaptive reflow still looks bad | Med | Med | Opt-in only; explicit authored rules (not inference); per-class authoring remains default (ADR-0017) |
| Cross-engine confusion (the thing we exist to avoid) | Med | High | One active engine at a time; always-visible active-engine label; no federation/merging |
| Team sharing leaks secrets/over-shares | Low | High | Reuse no-secret export; client-side encryption; recipients re-grant permissions; signed plugins |
| Scope creep (candidates treated as committed) | Med | Med | Candidate caveat (§2); prioritize by signal; each independently shippable |

### 14. Acceptance criteria (traced)

| AC | Criterion | Trace |
|----|-----------|-------|
| P8-AC-01 | Multiple authors edit the same profile/flow concurrently and converge consistently on the existing op-log — no new sync substrate. | ADR-0012/0033, M8.A |
| P8-AC-02 | The single-writer lock is replaced by convergence with no change to the document model or Layout-channel reflection. | 2C §4.3, M8.A |
| P8-AC-03 | Adaptive layout is opt-in: an authored base + explicit rules derive per-class layouts; per-class authoring (ADR-0017) remains the default and coexists. | D4-13/ADR-0034, M8.B |
| P8-AC-04 | A device binds multiple engines and switches between them with one active engine at a time and an always-visible active-engine label. | ADR-0008/0035, M8.C |
| P8-AC-05 | Cross-engine is switching, not federation; engine isolation/authority is unchanged. | ADR-0002, M8.C |
| P8-AC-06 | An account shares layouts/flows/plugins with a team; recipients import via the existing path with dependency, permission, and signing gates. | D16-04, M8.D |
| P8-AC-07 | Each Phase-8 candidate rides a seam named in Doc 0 §12 with no foundational rewrite. | Doc 0 §12, all |
| P8-AC-08 | Users who adopt none of Phase 8 see no regression. | all, regression |

---
*End of Phase 8 Deep Dive (Draft v0.1). New decisions ADR-0033/0034/0035 appended to the Decision Log. This completes the per-phase deep dives (Phases 1–8). The documentation set is now end-to-end complete and ready to compile into a single navigable deliverable.*

---
