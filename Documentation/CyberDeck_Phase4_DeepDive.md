# CyberDeck — Phase 4 (Smart Home Integration) Deep Dive

**Document 6 of the CyberDeck Enterprise Documentation Set · Per-Phase Deep Dive**
Version 0.1 (Draft) · June 2026 · Codebase ID: `com.shishir.cyberdeck`

> Implementation-depth specification for **Phase 4 (Smart Home)**. This is the first integration with an **external, networked, credentialed third-party system** (Home Assistant), so it doubles as the real-world proof of the plugin contract (2F), the secret-storage model (2E §7), the `entity` param type (2B), and dynamic state creation. New decision: **ADR-0025 (external-integration connection lifecycle & entity mapping)**.

## Contents
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

## 1. Phase intent & definition of done

**Intent.** Let a user control their home (lights, plugs, switches, scenes, climate) and monitor it (environment sensors, energy) from any CyberDeck surface, integrated through **Home Assistant** as a first-party plugin that behaves exactly like any third-party integration would — validating that the plugin/PAL/secret/permission seams are real. The deeper payoff is that smart-home actions become available to the **flow engine** (Phase 3), enabling automations like "CPU hot → dim the office lights."

**Definition of done.**
- A user connects CyberDeck to their Home Assistant instance with a long-lived token stored in the OS secure store (never plaintext).
- HA entities (lights/switches/scenes/sensors/climate/cameras) are discovered and mapped to typed CyberDeck states/actions, created dynamically.
- Light toggle/brightness, device toggle, scene activation, and climate set-temp work within the latency budget, with the 3 s timeout → error-state behavior.
- Environment sensors and energy data render; cameras are reserved for Phase 5.
- Smart-home actions are usable as flow nodes (the "Good Morning"/"cooling" automations).
- Connection loss to HA degrades gracefully (entities show offline/`--`), and recovers.
- All Phase-4 ACs verified; secrets never leak; NFR budgets hold.

## 2. Scope: in / out

### In scope (Phase 4)
| Area | Included | PRD |
|------|----------|-----|
| Connection | HA REST + WebSocket event bus; token via secure store | D12-01 |
| Entities | discover + dynamic state mapping; offline detection | D12-01 |
| Control | light toggle/brightness; device/plug/switch toggle; scene activation; climate set-temp | D12-02/03/04/07 |
| Monitoring | room overview; environment sensors (temp/humidity/AQ); energy monitor | D12-05/06/08 |
| Widgets | room cards, device rows, scene cards, environment panel, energy widget | D12-* |
| Automation | smart-home actions as flow nodes/targets | D7 + D12 |
| Credentials | HA token in OS secure store (first real use of 2E §7) | D14-05 |

### Out of scope
Security camera previews (P5 — needs the asset/stream pipeline) · plugin SDK/third-party loading (P6, though this phase *uses* the same contract) · remote (P7).

## 3. Seams consumed

| Seam | Phase-4 use |
|------|-------------|
| Plugin contract (2F) | `smarthome` plugin — out-of-process, manifest-declared, **the first integration with `network: outbound` permission** |
| Secret store (2E §7) | HA long-lived token stored per-OS; first production use |
| `entity` param type (2B §3.1) | actions take HA entity IDs; the designer's **entity picker** (stubbed in P1) is now fully implemented |
| Dynamic state creation (2B) | HA entities → states created at runtime as they're discovered |
| Provider/degradation contract (2G/ADR-0007) | HA unreachable → entities `unavailable`/offline, no crash |
| Flow engine (2D) | smart-home actions become flow targets; events feed stateChange triggers |
| Asset delivery (ADR-0021) | reserved for camera thumbnails in P5 (not built here) |

## 4. Workstream map

```
WS-4.1 HA connection/creds ─► WS-4.2 Entity mapping ─► WS-4.3 Actions ─► WS-4.5 Widgets
                                          └──────────► WS-4.4 Sensors/energy ──┘
WS-4.6 Smart-home in flows (after 4.3) ─────────────────────────────────────────
```
Critical path: 4.1 → 4.2 → 4.3/4.4 → 4.5. WS-4.6 follows 4.3.

---

## 5. WS-4.1 — Home Assistant connection & credentials

**Owning TRD:** 2F (plugin, network perm), 2E §7 (secret). **PRD:** D12-01, D14-05. **ADR:** **0025 (new)**.

### 5.1 Functional flow
```
User opens Smart Home settings (Desktop UI, privileged) → enters HA base URL + long-lived token
  → token stored in OS secure store (NOT config.json/SQLite/logs)
  → smarthome plugin reads URL+token at startup → REST /api/ health check
  → opens WebSocket to HA event bus → subscribe state_changed
  → on success: connection state = connected; entities loaded (WS-4.2)
  → on failure/timeout: connection state = error; surfaced in UI; retry w/ backoff
```

### 5.2 External-integration connection lifecycle (ADR-0025)
HA is the template for all external integrations, so its lifecycle is specified as a reusable pattern:
- **Config**: non-secret (base URL) in `config.json`; **secret (token) in the OS secure store** (2E §7).
- **Connection capability**: a connected/degraded/error state per integration, mirroring the device-connection contract (2A §7.3) — entities follow the integration's connection health.
- **Dual transport**: REST for actions + initial state fetch; **WebSocket event bus** for real-time `state_changed` (push, not poll), with a **30 s REST poll fallback** if the WS is unavailable (carried from old design).
- **Timeout/degradation**: every HA call has a **3 s timeout → entity `error` state** (carried PF-007); the integration auto-reconnects with backoff; on disconnect entities go offline/`--`, never frozen/false.
- This pattern is **reused by any future integration** (the same connected/degraded/error + secret + timeout shape).

### 5.3 Code structure
```
plugins/smarthome/
  main.go manifest.json            // network: outbound; capabilities: homeassistant
  connection.go                    // REST client + WS event bus + health/backoff
  credentials.go                   // reads token via host secret-store API
```
Manifest declares `network: "outbound"` and the HA capability; the host grants it (first-party trusted; a third-party equivalent would prompt the user — 2F §7).

---

## 6. WS-4.2 — Entity model & dynamic state mapping

**Owning TRD:** 2B (dynamic states), 2G. **PRD:** D12-01. **ADR:** 0025.

### 6.1 Capability detail
- On connect, fetch `/api/states`; map each HA entity to a typed CyberDeck state under `home.*` / `environment.*`, **created dynamically** (2B): e.g. `light.living_room` → `home.light.living_room` (boolean on/off + a brightness scalar), `sensor.office_temp` → `environment.office_temp` (scalar °C).
- WS `state_changed` events update the mapped states in real time → DF-A to clients.
- Entity → state mapping table is maintained by the plugin; domains map to state kinds (light→boolean+scalar, switch→boolean, sensor→scalar/text, scene→action-only, climate→scalar+enum, camera→reserved P5).
- **Offline detection**: HA `unavailable` entity state → CyberDeck `device.offline` event + the mapped state reads `--`.

### 6.2 Technical spec
- Dynamic states are registered with descriptors so the **designer can bind to them** and the **entity picker** can list them.
- The mapping is **stable across reconnects** (keyed by HA entity_id) so layouts binding `home.light.living_room` survive HA restarts.
- Entity count can be large (Riley persona: 20+ devices); states are created lazily/bounded and only fanned out by subscription (2A) — a layout binding 6 entities doesn't pay for 200.

### 6.3 Code structure
```
plugins/smarthome/
  entities.go        // /api/states fetch, domain→state mapping, dynamic registration
  events.go          // WS state_changed → state updates; offline detection
  mapping.go         // domain → (state kind, action set)
```

---

## 7. WS-4.3 — Smart-home actions

**Owning TRD:** 2B (actions, `entity` param), 2D (flow targets). **PRD:** D12-02/03/04/07.

### 7.1 Capability detail
Actions (all take an `entity` param, validated against discovered entities; 3 s timeout → error):
- `home.light.toggle{entity}` / `home.light.brightness{entity, level 0–100}`
- `home.device.toggle{entity}` (switch/plug)
- `home.scene.activate{scene}` → HA `scene.turn_on`
- `home.climate.set_temp{entity, temp}` (validate 10–35 °C, carried)
- (camera view reserved P5)

### 7.2 Technical spec
- Action → HA REST `/api/services/{domain}/{service}` with entity data; await ≤3 s; on timeout set entity `error` state + toast; optimistic UI optional (reflect intended state immediately, reconcile on WS confirmation).
- The **`entity` param type** is now fully realized: the designer's inspector renders an **entity picker** populated from discovered entities (the P1 stub becomes real — proving the schema-driven inspector handles a domain-specific param type with zero designer special-casing beyond the picker widget).
- Brightness/temp validated by the engine against schema range before reaching the plugin (2B/2F).

### 7.3 Code structure
```
plugins/smarthome/ actions.go service_call.go
client/lib/designer/inspector/entity_picker.dart   // realizes the entity param editor
```

---

## 8. WS-4.4 — Environment sensors & energy

**PRD:** D12-06/08.

### 8.1 Capability detail
- **Environment**: temperature, humidity, air quality, CO2, noise — mapped sensor states (`environment.*`), updated via WS events (or 30 s poll fallback). Each can carry a `series` buffer for a sparkline.
- **Energy monitor**: total kWh, estimated cost, efficiency, a month bar — from HA energy entities where present; degrades to `unavailable` where the user hasn't configured HA energy.

### 8.2 Technical spec
- Sensor cadence governed by HA push; the 30 s REST fallback (carried) applies if WS is down.
- Energy aggregation reads HA's energy dashboard entities; if absent, the energy widget shows `unavailable` (provider/degradation contract).

---

## 9. WS-4.5 — Smart-home widgets

**Owning TRD:** 2C §7. **PRD:** D12-05/* .

New widget types: **room card** (name, device count, temp, quick toggles), **device row** (icon, name, toggle, brightness/level slider), **scene card** (name, action count, activate button), **environment panel** (temp/humidity/AQ + sparklines), **energy widget** (kWh dial + cost + month bar). All bind to the dynamically-mapped `home.*`/`environment.*` states and use existing widget primitives (toggle, slider, gauge, sparkline) plus a few composites.

```
client/lib/render/widgets/{room_card, device_row, scene_card, environment_panel, energy_widget}.dart
```

---

## 10. WS-4.6 — Smart-home in flows (the payoff)

**Owning TRD:** 2D. **PRD:** D7 × D12.

### 10.1 Capability detail
Because smart-home operations are **registered actions** (WS-4.3), they are **automatically available as flow `action` nodes** — no flow-engine change (the registry-driven design pays off again). This unlocks:
- **"Good Morning" scene flow** (PRD Journey 5): one flow → lights + coffee plug + climate set-temp (5 actions, 1 tap).
- **Cross-domain automation** (the headline): the Phase-3 "Cooling Guard" flow's deferred smart-home step now works — `if cpu.temp>85 → performance.set Silent → home.light.brightness{office,30}`.
- HA events (e.g. motion) feed the event bus → **stateChange/event flow triggers** (2D §6), enabling "on motion at front door, switch the wall tablet to the camera profile" (camera view itself is P5).

### 10.2 Technical spec
- No new flow machinery — smart-home actions appear in the visual flow builder's palette (Phase 3) automatically because they're registry entries. The `entity` param uses the same entity picker (WS-4.3) inside the flow builder's node inspector.
- HA-sourced events are normalized into the engine event bus so flow triggers treat them uniformly with system events.

---

## 11. End-to-end realized journeys (Phase 4)

**Morning routine (PRD Journey 5, now real).** Riley taps "Good Morning" on the wall tablet → a flow sets lights, coffee plug, and climate in one tap; the energy widget shows today vs yesterday.

**Cross-domain automation completes (from Phase 3).** "Cooling Guard" now dims the office lights when the CPU overheats — the smart-home action that was stubbed in Phase 3 is live.

**Riley's 20-device home.** Pairs a wall tablet; the smart-home page shows room cards and device rows for discovered entities; toggling a light reflects in <500 ms; unplugging HA shows entities offline, and they recover when HA returns.

## 12. Code structure (additions)

```
plugins/smarthome/   main.go manifest.json connection.go credentials.go
                     entities.go events.go mapping.go actions.go service_call.go energy.go
client/lib/
  designer/inspector/entity_picker.dart   // entity param editor (realizes P1 stub)
  render/widgets/{room_card, device_row, scene_card, environment_panel, energy_widget}.dart
shared/schemas/widgets/ (smart-home widgets)
```
> Note how small the engine-side footprint is: **almost everything is in the plugin**, with only a designer entity-picker widget added to the core client. This is the plugin architecture (ADR-0006) working as intended — a whole domain added as an out-of-process plugin with near-zero core change.

## 13. Test plan

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

## 14. Milestones & sequencing

| Milestone | Content | Gate |
|-----------|---------|------|
| **M4.1 Connected** | WS-4.1 | HA connects; token in secure store; health/error states |
| **M4.2 Entities live** | WS-4.2 | entities mapped, dynamic states, WS updates, offline detect |
| **M4.3 Control** | WS-4.3 + WS-4.4 | lights/devices/scenes/climate work ≤500 ms; sensors/energy render; entity picker real |
| **M4.4 Widgets** | WS-4.5 | room/device/scene/environment/energy widgets |
| **M4.5 Automation + harden** | WS-4.6 + ACs | smart-home in flows; cross-domain automation; secrets/degradation verified |

## 15. Risks & mitigations

| Risk | Prob | Impact | Mitigation |
|------|------|--------|-----------|
| HA API/version drift | Med | Med | Version-pin tested HA API; integration tests against an HA Docker; degrade on unknown entities |
| Token leakage | Low | High | Secret store only; redaction; outbound limited to configured host; security test |
| WS event bus instability | Med | Med | 30 s REST poll fallback; reconnect backoff |
| Large entity counts hurt budget | Med | Med | Subscription-filtered fan-out; lazy/bounded state creation |
| LAN latency to HA | Low | Med | 3 s timeout → error state; optimistic UI optional |
| Energy data absent on user's HA | Med | Low | Energy widget degrades to `unavailable` cleanly |

## 16. Acceptance criteria (traced)

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
