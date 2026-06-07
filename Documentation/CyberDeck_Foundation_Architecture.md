# CyberDeck — Foundation & Architecture Document

**Document 0 of the CyberDeck Enterprise Documentation Set**
Version 0.4 (Draft) · June 2026 · Product Owner: Shishir · Codebase ID: `com.shishir.cyberdeck`

---

## 0. How to read this document set

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

## 1. Product definition

### 1.1 What CyberDeck is

CyberDeck is a **cross-platform control-surface platform**. A long-running **engine** on a host computer exposes that computer's capabilities — system telemetry, media, power, gaming optimization, smart-home control, notifications, and arbitrary user-defined automations — as a set of **actions** and live **states**. One or more **client devices** (phones, tablets, desktops) connect to the engine and render **layouts**: grids of widgets that display state and trigger actions.

It is the conceptual successor to the scrapped Touch Portal plugin approach, but instead of skinning someone else's host, CyberDeck owns the entire stack: its own engine, its own transport, its own clients, its own layout language, and its own plugin SDK.

### 1.2 What makes it different (the thesis)

Three capabilities, none of which the incumbents (Stream Deck, Touch Portal) deliver together, define the product:

1. **Live data as first-class widgets.** Circular gauges, sparklines, charts, and media cards bound to real-time engine state — not static button images rendered by plugins.
2. **A real automation engine.** A full conditional flow/macro engine with branching, variables, loops, and waits — authored visually on the desktop, executed on the engine.
3. **A real-time visual designer with instant device reflection.** Layouts are authored on the desktop against the exact target device class, and edits propagate live to bound devices via an operation-log sync model.

All three sit on a security-first, multi-device, LAN-now/remote-ready foundation.

### 1.3 Platform targets

| Component | Platforms |
|-----------|-----------|
| **Engine (host)** | Windows 10/11, macOS (Apple Silicon + Intel), Linux (x86-64, ARM64) |
| **Client (control surface)** | Android, iOS/iPadOS, Windows, macOS, Linux |
| **Designer (authoring)** | Desktop only — bundled into the desktop client/engine app (Windows, macOS, Linux) |

A single machine typically runs **engine + desktop client + designer** in one application bundle; phones and tablets run the **client** only.

### 1.4 Scope guardrails

- **LAN-only at launch.** All transport is local-network. Remote access is a defined future phase, and the architecture reserves the seam for it (Section 10) — but no cloud component ships in V1.
- **Desktop-only authoring.** Clients never edit layouts. They render and interact. This is a permanent product decision, not a phase limitation.
- **Per-device-class authored layouts.** A layout is designed against a specific grid/orientation profile and assigned to devices of that class. No automatic reflow across form factors in V1 (responsive adaptation is a possible later enhancement, Section 12).

---

## 2. Architectural philosophy

### 2.1 The host-authority model

The engine is the **single source of truth**. It owns all state, all layout documents, all action execution, and all flow execution. Clients are **deterministic renderers of engine-defined UI** plus **input forwarders**. A client holds no business logic it could disagree with the engine about.

This is what guarantees the "no confusion which device" requirement: there is exactly one authority, and every device is a named, isolated session against it.

### 2.2 The hybrid rendering choice

Rejected: **pixel streaming** (engine renders UI, ships frames) — laggy, heavy, fails the latency budget.

Chosen: **declarative layout + native rendering.** The engine ships a *layout document* (a structured description: "a CPU gauge bound to state X at grid cell 3,4, neon-cyan, tap → action Y"). The client owns a **native widget toolkit** and renders that description with native performance. The engine controls layout, bindings, and behavior; the client controls pixels.

This single choice is what makes responsiveness, the live designer, and the plugin-driven widget vocabulary all possible at once.

### 2.3 The four layers

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

## 3. The core domain model

This is the heart of the document. These structures are shared vocabulary across engine, transport, and clients, and they are the contract that the PRD/TRD elaborate and that plugins extend.

### 3.1 The document tree

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

### 3.2 The widget model

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

### 3.3 The state model

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

### 3.4 The action registry

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

### 3.5 The widget type registry

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

### 3.6 Variables (engine-scoped values)

Beyond OS-sourced states, the engine maintains **user variables** — named values the flow engine reads/writes (counters, toggles, last-used scene, etc.). Touch Portal calls these "Values." They are typed, persisted, namespaced under `var.*`, and are first-class state sources (a widget can bind to `var.mic_muted`). They exist in V1 because the flow engine (Section 6) is V1.

---

## 4. Device identity, discovery, pairing & security

This is built **fully** in V1 — security is not a later hardening pass, because identity and crypto cannot be retrofitted without breaking every paired device.

### 4.1 Identity (not IP, not MAC)

The hard rule, established during design: **bind the trust relationship, not the network address.** Modern iOS/Android randomize MAC per network and DHCP rotates IPs, so both are unreliable as identity.

- On first launch, **each device and the engine generate a long-lived keypair** (Ed25519) and a stable **UUID**.
- Pairing establishes **mutual trust**: each side stores the other's public key + UUID + human label + device class.
- IP/MAC are stored only as **locator hints** to find a known device; they are never identity.
- **Identity is account-independent.** The keypair/UUID exists from first launch whether or not an account is ever created. An account (a later, optional overlay for cloud features) *references* device identities for sync/backup — it never *owns* or *gates* them. This is the architectural guarantee behind "install, run, use forever, no account" (Section 11.0 licensing): if identity required an account, the local-first promise would break and licensing would contaminate the identity layer.

### 4.2 Discovery

| Mechanism | Use | Notes |
|-----------|-----|-------|
| **mDNS / DNS-SD** | Zero-config discovery on LAN | Engine advertises `_cyberdeck._tcp.local` with TXT records `{name, uuid, version, fingerprint}`. Primary happy path. |
| **QR pairing** | Fast trusted pairing | Engine displays QR encoding `{candidate addresses, port, short-lived pairing token, engine public-key fingerprint}`. Client scans → connects → key exchange. |
| **Manual entry** | Fallback when multicast blocked | User types IP/hostname; a PIN shown on the engine confirms (Plex/Spotify-Connect model). |
| **Active scan** | Last-resort relocate | If a known device's last-known IP fails and mDNS is silent, an optional bounded subnet scan locates it by attempting handshake (UUID confirms identity). |

mDNS **must** have fallbacks because enterprise networks frequently block multicast or isolate clients across VLANs — a known failure mode of the incumbents.

### 4.3 Pairing handshake

```
1. Discover (mDNS) OR scan QR OR manual+PIN
2. Client → Engine: connect, present client public key + UUID + pairing token
3. Engine: validate token (short-lived, single-use), challenge-response over keypairs
4. Both sides verify the other's public-key fingerprint (blocks MITM)
5. Engine creates a Device record (4.4); both persist the trust
6. Session established (Section 5)
```

### 4.4 Device record & permissions

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

### 4.5 Crypto posture

- **All session traffic is encrypted and authenticated**, even on LAN. (Transport security TLS-style channel over the established keys; exact primitive specified in the TRD.)
- This is deliberately **built for remote from day one** even though traffic stays local: when the relay seam (Section 10) activates, identity, pairing, and encryption are unchanged — only the endpoint moves. Retrofitting E2E security onto an unencrypted LAN protocol later would be a rewrite.

### 4.6 "No confusion which device"

Every session is keyed by device UUID. The engine runs **independent sessions per device**, each with its own active profile, its own subscriptions, and its own permission set. Two tablets can show different profiles simultaneously with full isolation. The designer always names its target explicitly (Section 7.5).

---

## 5. Transport & real-time sync

### 5.1 Endpoint abstraction (the forward-compat seam)

All addressing goes through one abstraction: a **TransportEndpoint** resolved by a **ConnectionManager**. In V1 every endpoint resolves to a direct LAN socket. The remote phase (Section 10) adds a relay-backed endpoint type. **No engine or client code above the ConnectionManager knows or cares** which kind it is. This is the single most important forward-compatibility decision in the document.

### 5.2 Three logical channels

Sharing one secure session, but with different semantics:

| Channel | Direction | Payload | Cadence | Durability |
|---------|-----------|---------|---------|------------|
| **Layout** | Engine → Client | Structural layout operations (Section 5.4); client → engine action/interaction events | On edit / on tap | Durable, versioned |
| **State** | Engine → Client | Delta state updates (changed states only) | 0.5s–10s per state | Ephemeral |
| **Preview** | Designer → Engine → Client | Throttled ephemeral edit previews (live drag ghosting) | ~30–60 Hz, throttled | Never persisted |

Keeping these separate means a CPU value updating every second never touches the layout tree, and a live-drag preview never pollutes durable edit history.

### 5.3 Connection resilience (a direct answer to the #1 incumbent pain)

The single most common real-world complaint about Touch Portal / Stream Deck mobile is flaky LAN connections. V1 transport bakes in:

- **Heartbeat/keepalive** with a defined interval; the engine keeps sessions warm (no OS-sleep-induced drops).
- **Auto-reconnect with exponential backoff**, then mDNS re-discovery, then active scan.
- **Graceful degradation**: on disconnect, bound widgets render their last value dimmed with a `--` fallback and a clear per-device connection badge (connected / degraded / disconnected). No frozen or lying UI.
- **Versioned resync** (5.4): a client that missed messages requests a full document resync rather than replaying gaps.

### 5.4 The operation-log sync model (the live-designer engine)

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

### 5.5 Runtime vs edit mode

A device session is in one of two modes:

- **Runtime mode** — receives State updates only; renders the assigned layout for use.
- **Edit/preview mode** — additionally receives live Layout ops and Preview ghosts, so you can watch a tablet update as you design on the PC.

A device flips between modes on demand (e.g. when you start editing the profile it's showing).

---

## 6. The conditional flow / macro engine

Per decision, CyberDeck ships a **full** conditional flow/macro engine — matching and exceeding Touch Portal's Flows. It is a **V1 foundation system** (the data model, executor, and core node set), with the visual flow *builder UI* and richer node types layered over the same model in later passes.

### 6.1 What a flow is

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

### 6.2 Node types (V1 core set)

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

### 6.3 The expression language

Conditions and dynamic values use a small, sandboxed expression language:

- **Token interpolation**: `{state.id}`, `{var.name}` resolve to current values.
- **Operators**: comparison (`== != > < >= <=`), boolean (`&& || !`), arithmetic (`+ - * / %`), string concat.
- **No arbitrary code execution** — the language is deliberately not Turing-complete-via-eval; it's parsed to an AST and evaluated by the engine. This is a security boundary (a flow is shared content; it must not be able to run shell code except via explicitly-registered, permission-gated actions).

### 6.4 Triggers

Flows fire from: **manual** (a widget gesture), **event** (an engine event such as `cpu.high_temp`), **stateChange** (a watched state crossing a condition), or **schedule** (time/cron — a near-term trigger type, with the trigger field defined in V1). This makes the event architecture from the prior design (Section 8 of the old TRD) a *consumer* of the flow engine.

### 6.5 Execution semantics

- Flows execute on the engine (host authority), not the client. The client only *triggers*.
- Each flow run is an isolated context with its own local scope; global `var.*` persists.
- Long-running flows (waits, loops) run as supervised async tasks; a flow can be cancelled.
- Failures are logged with the node id; a flow can declare per-node failure behavior (continue / stop / branch).

### 6.6 Local vs global scope

Mirroring (and improving on) Touch Portal's local-states concept: a flow run has a **local scope** for transient values, and the engine has **global `var.*`**. This avoids the "create a global Value for every temporary calculation" clutter that the incumbents force.

---

## 7. The layout designer

Desktop-only authoring tool. It is a **reader of the registries** (3.4, 3.5) and an **emitter of operations** (5.4).

### 7.1 Canvas

A WYSIWYG grid canvas rendering the page exactly as the target device class will. Snap-to-grid placement; widgets occupy `(col,row,colSpan,rowSpan)`; **no overlap in V1** (collisions rejected or pushed) to avoid z-index complexity.

### 7.2 Drag-drop & mapping (the deep model)

- **Place**: drag a widget type from the palette onto a cell → emits `AddWidget`.
- **Move/Resize**: drag/handle → throttled `Preview` ghosts → `MoveWidget`/`ResizeWidget` on drop.
- **Bind appearance**: the inspector lists available states (filtered by the widget type's `acceptsStateKinds`); selecting one emits `SetBinding`.
- **Map interactions**: for each gesture slot the widget type exposes, pick a target (action / macro / flow / navigate). Choosing an action reveals an **auto-generated parameter editor** built from the action's param schema (3.4). → `SetInteraction`.
- **Style**: theme tokens, label, icon, conditional `valueRules`. → `SetStyle`.

Because the param editor is generated from schema, **every action — built-in or third-party plugin — is fully editable in the designer with no bespoke UI.**

### 7.3 Grid configuration

Fully customizable per page: columns, rows, gutter, margins, cell aspect, background. No button/row/column caps.

### 7.4 Live reflection

Any bound device in edit/preview mode shows edits instantly (5.4/5.5). The headline demo: drag a gauge on the PC, watch it appear on the tablet in real time.

### 7.5 Explicit device targeting

The designer always shows its target: *"Editing: Living Room iPad · UUID a3f… · 10×6 landscape."* Ops route only to that device's assigned layout/sessions.

---

## 8. Plugin architecture

### 8.1 What a plugin provides

A plugin is an out-of-process extension that may register any of: **state providers** (3.3), **actions** (3.4), **events**, **flow nodes** (6.2), and **widget types** (3.5). Built-in capabilities (telemetry, media, etc.) are implemented as **first-party plugins using the same contracts** — dogfooding the SDK guarantees it's real.

### 8.1 What a plugin provides

A plugin is an **out-of-process** extension that may register any of: **state providers** (3.3), **actions** (3.4), **events**, **flow nodes** (6.2), and **widget types** (3.5), and may implement **PAL capability interfaces** (provider-chain entries). **All capabilities outside the engine core are plugins**, first-party and third-party alike — telemetry, media, power, launchers, smart home, notifications, FPS. Implementing the first-party set on the same contract is not just dogfooding; per ADR-0006 it is the *only* execution model, so there is no second runtime to maintain.

### 8.2 Registration contract (foundation in V1)

The **registration contracts are defined and used in V1** by the first-party plugins. A plugin declares its registry contributions in a manifest; the host validates and merges them into the global registries. The designer surfaces them automatically. The **public SDK and third-party *loading*** are a later phase, but the contract they target is the one already in production use by first-party plugins on day one.

### 8.3 Isolation & security (one model, no exceptions)

**Every plugin runs out-of-process** — first-party included (ADR-0006). A misbehaving plugin can never take down the engine (directly addressing the incumbents' fragility). Plugins communicate with the host over a single local IPC contract, declare required **permissions** (capabilities + action categories), and the host enforces them uniformly. "First-party" vs "third-party" is **trust metadata** (affects signing/UX/permission defaults), **never a different lifecycle, IPC path, or isolation boundary.** Third-party **sandboxing and signing** harden this model in the SDK phase but do not introduce a separate one.

### 8.4 Why this unifies designer + ecosystem

The designer never hard-codes knowledge of any capability. It renders whatever the registries contain. Therefore the same machinery that lets the team add a new built-in action lets a third party ship one — and it shows up in the designer identically. The plugin ecosystem and the designer are **one schema-driven system viewed from two ends.**

---

## 9. Technology stack & rationale

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

### 9.1 Deployment & process model (two processes, one installer)

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

### 9.2 The local UI↔engine channel split

Because the Desktop UI sits on the same machine as the engine, it has two kinds of traffic:

1. **Data & designer traffic** — state subscriptions, layout ops, action triggers. Rides the **same secure protocol over loopback** that phones use. The Desktop UI is, for this traffic, just a privileged client that also happens to own the Designer. Uniform, reuses everything in Sections 3–6.
2. **Privileged local control** — start/stop/restart the engine service, change service-level config, **approve or reject device pairing requests**, view the audit log. This rides a **separate privileged local-only control channel** that only a same-machine UI may use.

The security consequence is deliberate: a remote phone can issue media/home/flow actions (subject to its permissions) but can **never** issue "stop the engine" or "approve this new device" — those are gated to the local privileged channel. This keeps the host-authority model honest.

### 9.3 Why Electron and Expo were rejected

| Tool | What it does well | Why rejected here |
|------|-------------------|-------------------|
| **Electron** (proposed for desktop) | Builds `.exe`/`.deb`/`.dmg` from web tech | A Chromium instance per window — heavy idle RAM/CPU for a 24/7 host, against the <150MB / <2% NFR. The systems work (mDNS, raw sockets, OS telemetry, plugin supervision) is Node's weak spot. Worst of all it would **split the client codebase** (Electron desktop + something-else mobile = two renderers, two widget toolkits, two layout interpreters), defeating the hybrid model. |
| **Expo / React Native** (proposed for mobile) | Native iOS/Android builds + OTA | Adopting it makes the client **React Native, not Flutter** — re-opening a locked decision. RN bridges to native views and animates via JS, the wrong engine for custom high-frequency gauge/sparkline/canvas drawing. Covers only 2 of 6 client targets; Flutter covers all 6 and builds the same native packages directly. |

**Net:** Flutter-everywhere + Go-engine gives every native installer you asked for (`.exe`, `.deb`, `.dmg`, `.apk`, `.ipa`) with **one** client renderer and a lean 24/7 background service — strictly better than Electron-desktop + Expo-mobile, which would give two renderers, two toolkits, and a heavier footprint.

### 9.4 Persistence model

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

### 9.5 Serialization

**JSON throughout V1.** No binary codec is built yet — building one now creates an observability problem (a failed automation should be inspectable as `{"workflow":"lights","step":5,"state":"failed"}` in a log, not `0x3A 0x9F …`) for a bandwidth saving the product won't notice on a LAN. The `Serializer` abstraction is in place from day one so a future codec slots in **per channel** — and realistically only the high-frequency State channel would ever warrant it; Layout ops and control messages stay JSON permanently.

---

## 10. LAN-now / remote-later seam

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

## 11. Phase map & roadmap

V1 is the **foundation release**: it must contain not just usable features but the *seams* (registries, op-log, endpoint abstraction, flow executor, security model) that every later phase plugs into. The principle, per your direction: **the foundation is built in V1; features evolve on top of it.**

### 11.0 Licensing principles (architectural, not commercial)

Stated here because the wrong licensing model contaminates the identity layer (Section 4.1). The governing rule: **identity ≠ licensing.**

- **Free = local-only, no account.** Install, pair devices over LAN, design layouts, run flows — forever, with no account and no activation. This is the default and it minimizes friction.
- **Account = optional overlay for cloud services only** (sync, backup, remote access, team sharing). Users readily pay for *services*; they resent paying because they own three devices.
- **Licensing attaches to the account, not to devices.** A paid user uses multiple personal devices freely.
- **Device-count restrictions and platform-locked purchases are explicit non-goals** — both are documented pain points of the incumbents and both force a licensing-first architecture.

The PRD will state this verbatim as a product principle. The only V1 architectural obligation is the one already met in 4.1: identity must not depend on an account existing.

### Phase 1 — Foundation (V1)
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

### Phase 2 — Media & richer interaction
Full media pipeline (album art, progress, multi-channel mixer), richer media widgets, expanded gesture-slot designer UI, app-focus **automatic profile switching** (consuming the activation rule built in V1).

### Phase 3 — Gaming & automation depth
FPS display, game profiles, RAM cleaner, network boost; **visual flow builder UI** over the V1 flow model; **schedule triggers**; richer flow nodes.

### Phase 4 — Smart home
Home Assistant integration (REST + event bus), room/device/scene widgets, environment sensors, energy monitor — all as a first-party plugin proving the plugin contracts.

### Phase 5 — Notifications & cameras
Full notification aggregation pipeline (Discord/Windows/Streamlabs), filter/dismiss, priority; camera preview widgets.

### Phase 6 — Plugin SDK & ecosystem
Public SDK, third-party plugin loading, sandboxing/signing, plugin-provided **widget types** and **flow nodes**, a distribution/marketplace path. (Built on the V1 registry contracts.)

### Phase 7 — Remote access
Relay/rendezvous infrastructure, NAT traversal, remote endpoint type — slotted behind the V1 endpoint abstraction (Section 10).

### Phase 8+ — Advanced (candidates)
Collaborative multi-author editing (on the V1 op-log), responsive/adaptive layouts across device classes, AI-assisted contextual actions, cross-engine binding (one device → multiple engines).

> Durations and dependencies are deferred to the PRD/TRD and per-phase deep dives; this is the ordering and the layering, not the schedule.

---

## 12. Extension-seam index (the "future attaches here" contract)

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

## 13. Non-functional foundations (carried & upgraded from prior design)

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

## 14. Decisions

### Resolved

1. **Engine language → Go.** ✅ Compiled native background service per OS; cross-compiles to native installers cleanly, satisfying the native-installer requirement without favoring Rust. Goroutine model fits per-service/per-session work. (Section 9)
2. **Desktop shell → Flutter Desktop UI + Go engine as an installed background service.** ✅ Two processes, one installer (9.1). Closing the UI window leaves the engine running; the engine starts on boot. **Electron and Expo both rejected** (9.3) — Electron splits the client codebase and is too heavy for a 24/7 host; Expo would force the client to React Native, the wrong renderer for custom real-time drawing. Tauri/Rust also rejected (reintroduces a webview + second toolkit). Local UI↔engine traffic uses the loopback protocol plus a privileged local control channel (9.2).
3. **Persistence → SQLite as the single durable store; live state in-memory.** ✅ No KV/SQL split. Telemetry never hits the disk hot path; everything authored or audited is in SQLite; audit log is append-only with a `payload_json` escape hatch. (9.4)
4. **Wire serialization → JSON for V1**, behind a channel-level `Serializer` abstraction so a binary codec can later apply to only the State channel. ✅ (9.5)
5. **Licensing → identity ≠ licensing; local use is free and account-free; accounts gate cloud services only; device-count limits are a non-goal.** ✅ Architectural obligation (account-independent identity) met in 4.1; commercial detail lands in the PRD. (11.0)

### Still open

*None at the architecture level.* Remaining specifics (exact SQLite schema/migrations, exact transport wire framing, exact crypto primitives) are **TRD-level detail**, not foundation decisions — they elaborate locked choices rather than change them.

---

*End of Foundation & Architecture Document (Draft v0.1). Next pass: PRD (Document 1), then TRD (Document 2), then per-phase deep dives.*
