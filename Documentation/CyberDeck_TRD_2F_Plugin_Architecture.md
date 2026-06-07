# CyberDeck — TRD 2F: Plugin Architecture

**Subsystem TRD · Document 2F** · Version 0.1 (Draft) · June 2026
Inherits TRD Master §6. Governing ADRs: **0006, 0007** (registries in 2B; capability interfaces in 2G; permissions in 2E).

## Contents
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

## 1. Scope & responsibilities

Owns: the **plugin host** (a core subsystem — 2B), how plugin **processes** are launched/supervised/restarted, the **IPC contract** between host and plugins, the plugin **manifest**, and **permission enforcement** at the host boundary. Defines the contract that **all** capabilities implement (telemetry, media, power, launchers, notifications, FPS, smart home, third-party). Capability *interfaces and provider chains* are 2G; *what gets registered* (action/widget/flow-node schemas) is 2B; *trust metadata and signing policy* is 2E.

## 2. The one-model principle (ADR-0006)

**Every capability outside the engine core runs as an out-of-process plugin, and first-party plugins use the identical contract, lifecycle, IPC, permission model, and isolation as third-party plugins.** Whether a plugin ships from CyberDeck or a community author is **metadata, not architecture** (§8). Consequences that shape this whole document:
- One runtime to build, test, debug, secure.
- A misbehaving plugin can never crash the engine (NFR-07).
- A first-party capability becoming community-extensible is a metadata change, not a rewrite.
- The host exists and runs first-party plugins **in V1** (P0) — it is not deferred to the ecosystem phase.

## 3. Plugin anatomy & manifest

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

## 4. Plugin host & process supervision

The host (in the engine core) is responsible for the full process lifecycle:
- **Launch**: spawn each plugin process with its working dir and a handshake handle (a loopback IPC endpoint or stdio pipe — §5). Bundled first-party plugins launch at engine boot (2B §7.1); third-party plugins launch on enable (Phase 6).
- **Supervise**: monitor liveness via IPC heartbeat; capture stdout/stderr to per-plugin logs.
- **Restart policy**: on crash, restart with backoff up to a cap; on repeated failure, mark the plugin `faulted` and surface it (its states go `--`, its capabilities become `unavailable` per 2G). The **engine is never affected** (NFR-07).
- **Shutdown**: SIGTERM → grace period → kill; flush plugin logs.

Resource accounting per plugin (CPU/RAM) is tracked toward the engine's overall budget; a noisy plugin can be throttled or faulted (hardening detail Phase 6).

## 5. IPC contract

### 5.1 Transport
Local IPC over loopback (or stdio pipes), **JSON messages** (ADR-0015) using the shared envelope (Master §6.3) with `ch:"plugin"`. Not the network transport (2A) — this is host↔plugin, same-machine, but uses the same envelope/serializer discipline for consistency.

### 5.2 Message types
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

### 5.3 Contract guarantees
- Params on `invokeAction` are **already validated** by the engine against the action schema (2B §3.1) — the plugin may trust ranges/types but SHOULD still guard.
- A plugin SHALL NOT receive any state/credential it didn't request via permissions.
- Backpressure: `stateUpdate` is coalesced by the host into the store's delta path; a flooding plugin is rate-limited.

## 6. Lifecycle & state machine

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

## 7. Permissions & enforcement (with 2E)

- A plugin **declares** required permissions in its manifest (§3); the host **grants** them at load (first-party: defaults trusted; third-party: user-approved at install, Phase 6).
- The host **enforces** at the IPC boundary: a plugin can only publish states it declared, only expose actions it registered, and only access network/filesystem at its declared level.
- **Action-level** device permissions (which device may invoke which category) are enforced by the engine *before* `invokeAction` reaches the plugin (2E §5.2). So there are two gates: device→action (2E) and plugin→capability (here).
- All invocations are audited (2E §6).

## 8. First-party vs third-party — metadata only (ADR-0006)

`origin` and signing status affect **only**:
- **Permission defaults** — first-party bundled plugins are trusted by default; third-party require explicit user approval of their declared permissions.
- **Signing/verification** — third-party plugins are signature-verified (Phase 6); first-party are part of the signed installer.
- **UX/labeling** — provenance shown to the user.

They do **not** affect lifecycle, IPC, isolation, or registration. There is exactly one execution model (§2).

## 9. SDK & sandboxing (Phase 6 seam)

The V1 contract (manifest + IPC + permissions) **is** the SDK surface; Phase 6 publishes it, adds third-party **loading** (discover/install/enable), **signing/verification**, and **sandboxing** (tighter OS-level confinement of plugin processes — e.g. restricted tokens / sandbox profiles per OS). Because first-party already runs on this contract, the SDK is validated by construction (nothing first-party does is off-contract).

## 10. Normative requirements

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
