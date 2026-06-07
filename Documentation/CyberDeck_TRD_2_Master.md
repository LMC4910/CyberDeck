# CyberDeck — TRD Master (Document 2)

**Technical Requirements Document — Master**
Version 0.1 (Draft) · June 2026 · Codebase ID: `com.shishir.cyberdeck`

> The hub of the federated TRD set. This document holds **cross-cutting architecture and shared conventions**; subsystem depth lives in 2A–2G. Authority chain: Foundation (Doc 0) → PRD (Doc 1) → **TRD Master (this)** → subsystem TRD → per-phase deep dive. All decisions are recorded in the **ADR Log (2-ADR)** and referenced here by ID.

## Contents
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

## 1. System context

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

## 2. Component architecture

### 2.1 Engine core (small by mandate — ADR-0006, ADR-0002)
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

### 2.2 Capability plugins (all out-of-process — ADR-0006)
First-party and third-party alike. Each may contribute state providers, actions, events, flow nodes, widget types, and PAL capability implementations (provider chains — ADR-0007). Detailed in 2F (host/IPC/lifecycle) and 2G (capability interfaces/providers).

### 2.3 Clients (Flutter — ADR-0004)
| Client subsystem | Responsibility |
|------------------|----------------|
| Connection manager | Endpoint resolution, pairing, reconnect, channel demux |
| Widget renderer registry | `widgetType → native builder` |
| Layout interpreter | Builds/diffs the widget tree from the layout doc + ops |
| State subscriber | Per-widget subscriptions; targeted repaint |
| Gesture capture | Maps device gestures to interaction-slot events |
| **Designer** *(desktop only — ADR-0018)* | Canvas, op emitter, schema-driven inspector, undo/redo |

## 3. Process & deployment model (ADR-0005)

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

## 4. Trust boundaries & security architecture (overview)

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

## 5. Cross-cutting data-flow overview

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

## 6. Shared conventions (inherited by all subsystem docs)

### 6.1 Identifier schemes
- **State IDs**: `category.subcategory.field` (e.g. `system.cpu.temp`), engine-namespaced as `com.shishir.cyberdeck.<id>` on the wire.
- **Variables**: `var.<name>`.
- **Action IDs / widget types / flow-node kinds**: dotted, registry-unique (`media.volume.set`, `gauge.circular`, `if`).
- **Requirement IDs**: `FR-<n.m>` (PRD), `NFR-<nn>`, subsystem-local `T<letter>-<area>-<n>` (e.g. `TA-PAIR-3` in 2A).
- **ADR refs**: `ADR-####`.

### 6.2 Requirement grammar
SHALL = mandatory; SHOULD = recommended; MAY = optional. Each subsystem TRD lists normative requirements with stable IDs and traces each to a PRD FR/NFR and/or ADR.

### 6.3 Message envelope (all channels, JSON for V1 — ADR-0015)
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

### 6.4 Versioning
- **Protocol version** (`v`) negotiated at session start; engine supports a documented window of client versions.
- **Document version**: monotonic per layout document (ADR-0012).
- **Config/schema version**: stored; migrations run on engine startup.
- **Plugin API version**: declared in plugin manifest; host refuses incompatible majors.

### 6.5 Time, units, formatting
- All timestamps are epoch-millis UTC on the wire.
- State values are **typed and unit-bare** (ADR-0019); units/precision are applied at render time from widget style.

### 6.6 Error & degradation conventions
- Capability **unavailable** (no provider bound) is a first-class, non-error state → `--` in UI (ADR-0007).
- Disconnected session → last value dimmed + connection badge (NFR via FR-5.4).
- Plugin crash → host restarts per policy; dependent states go `--` until re-bound (2F).

## 7. Coding standards & repository structure

### 7.1 Repository layout (monorepo)
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

### 7.2 Standards
- **Go**: standard `gofmt`/`vet`/`golangci-lint`; context-based cancellation for all long-running tasks (flows, polls, sessions); no global mutable state outside the state store; every goroutine owned and cancellable.
- **Flutter/Dart**: `dart format`/`analyze`; widget renderers are pure functions of (descriptor, state); no business logic in widgets; no `localStorage`-style hidden state — all state from the engine or local UI state.
- **Schemas** in `shared/` are the single source of truth; engine and client generate/validate against them (no divergent hand-written copies).
- **Tests**: unit (per subsystem), integration (mock-session transport, mock plugin host), soak (8h memory/CPU), visual regression (designer/client). Detailed per phase.

## 8. Cross-cutting NFR allocation

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

## 9. ADR index & subsystem map

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
