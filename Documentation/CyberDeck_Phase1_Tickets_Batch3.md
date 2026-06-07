# CyberDeck — Phase 1 · Ticket Breakdown (Batch 3)

**Execution-system Document 4 of N** · Version 0.1 (Draft) · June 2026 · `com.shishir.cyberdeck`
Default assignee: **Claude**

> Full implementation-ready tickets for **EPIC-5 (Plugin Host & First-Party Capabilities / WS-5)** and **EPIC-8 (Client Runtime & Widget Vocabulary / WS-8)**. EPIC-5 turns the engine into a live data source (telemetry, power, volume, launchers, notifications — all out-of-process plugins); EPIC-8 renders that on devices. Together they realize Milestones M3 (live telemetry on a phone) and M4 (actions & permissions). Conventions inherited from Batch 1 Part B.
>
> Grounded in TRD 2F (plugin host), 2G (PAL/capabilities/provider chains), 2C §7 (client rendering), 2A (client transport), and the ADR log.

---

# EPIC-5 — Plugin Host & First-Party Capabilities (WS-5)

> The one-execution-model epic (ADR-0006): first-party capabilities run out-of-process on the same contract third-party will. The host (PROJ-130/131/132/133) + the PAL provider-chain framework (PROJ-170) come first; then the five first-party plugins.

---

## PROJ-130 — Plugin host: launch / supervise / IPC

**Summary:** The in-engine plugin host that launches a plugin process and speaks the IPC contract to it.

**Objective:** Implement 2F §4/§5 launch + IPC: spawn a plugin process with a handshake handle, exchange JSON-envelope messages over loopback/stdio, capture logs.

**Context:** TRD 2F §4/§5 / ADR-0006. All capabilities are out-of-process plugins; first-party launch at boot. IPC uses the shared envelope with `ch:"plugin"` (Master §6.3) — same serializer discipline as the network transport, but host↔plugin and same-machine.

**Technical Requirements:**
- `Host.Launch(manifest)`: spawn the plugin binary with its working dir + an IPC endpoint (loopback socket or stdio pipes).
- IPC message types (2F §5.2): `init` (host→plugin: config slice + granted perms), `register`, `stateUpdate`, `event`, `invokeAction`/`actionResult`, `queryCapability`/`capabilityResult`, `heartbeat`, `log`.
- Capture plugin stdout/stderr to per-plugin log files; structured `log` messages routed to the engine logger (secrets pre-redacted by the plugin; host asserts redaction).
- Liveness via IPC heartbeat.

**Acceptance Criteria:**
- Host launches a sample plugin, completes `init`, receives `register`, and exchanges a `stateUpdate`.
- Heartbeat detects a hung plugin.
- Plugin logs captured; no secret leakage (PROJ-115 guard).
- Unit/integration tests with a test plugin binary: launch, init, stateUpdate, heartbeat.

**Implementation Notes:** Depends on the state store (PROJ-160, for `stateUpdate` → `Set`) and config (PROJ-103, for the config slice). Keep the IPC codec reusing the `Serializer` (PROJ-141) where practical. A small **test plugin** fixture is part of the deliverable (used by many EPIC-5 tickets).

**Testing Requirements:** Integration: launch real test plugin; init/register/stateUpdate/heartbeat; log capture.

**Deliverables:** `engine/pluginhost/{host.go,ipc.go,supervise.go}`, `plugins/_testplugin/` fixture, tests.

**Dependencies:** PROJ-160, PROJ-103. **Effort:** 3 pts (~4h), medium-high.

**Agent Instructions:** Implement launch + IPC message loop + log capture + heartbeat against a test plugin fixture; test the message exchange.

**Expected Files:** `engine/pluginhost/{host,ipc,supervise}.go`, `plugins/_testplugin/*`, tests.

**Validation Commands:**
```bash
cd engine && go vet ./... && golangci-lint run && go test -race ./pluginhost/... && go build ./...
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## PROJ-131 — Plugin host: restart / fault policy

**Summary:** Crash isolation — restart a crashed plugin with backoff; fault it after repeated failure; the engine always survives.

**Objective:** Implement 2F §4/§6: supervision lifecycle (READY→RESTARTING→FAULTED), with faulted plugins keeping their registry contributions while their states read `--`. **AC P1-AC-13.**

**Context:** TRD 2F §4/§6 / NFR-07. A faulted plugin must not break layouts that bind its states — they degrade to `--` (ties to the PAL unavailable contract, 2G).

**Technical Requirements:**
- Detect plugin exit/crash (process + heartbeat); restart with capped backoff; after N failures → `FAULTED`.
- On fault: keep the plugin's contributions registered (so layouts don't break); set its states to `unavailable` (`--`).
- The engine never crashes due to a plugin (verified by induced panic).

**Acceptance Criteria:**
- A crashing plugin is restarted; repeated crashes → faulted.
- Engine survives an induced plugin panic (**AC P1-AC-13**).
- Faulted plugin's bound states read `--`; layouts intact.
- Integration tests: crash→restart; repeated→faulted; engine-survives-panic; states→`--`.

**Implementation Notes:** Coordinate with the state store (set states unavailable) and registry (keep contributions). Resource limits/throttle are a later hardening detail (Phase 6) — basic restart/fault here.

**Testing Requirements:** Integration: induced crash/panic; restart; fault; state degradation.

**Deliverables:** `engine/pluginhost/lifecycle.go`, tests (with a crashing test-plugin mode).

**Dependencies:** PROJ-130. **Effort:** 2 pts (~3h), medium.

**Agent Instructions:** Implement restart/backoff/fault + state degradation; add a crashing mode to the test plugin; test all paths.

**Expected Files:** `engine/pluginhost/lifecycle.go`, tests.

**Validation Commands:**
```bash
cd engine && go vet ./... && golangci-lint run && go test -race ./pluginhost/... && go build ./...
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## PROJ-132 — Plugin manifest validation + registry merge

**Summary:** Validate a plugin manifest, check apiVersion, and merge its contributions into the global registries.

**Objective:** Implement 2F §3 + the merge into 2B registries (PROJ-161): manifest schema check, apiVersion gate, contribution merge, collision rejection.

**Context:** TRD 2F §3 / Master §6.4. Manifest declares contributions (states/actions/events/capabilities/widgets/flow-nodes) + required permissions + apiVersion.

**Technical Requirements:**
- Parse + validate `plugin.manifest.json` against the manifest schema.
- Refuse incompatible `apiVersion` major (Master §6.4) with a diagnostic.
- Merge `contributes` into the action/widget/flow-node registries (PROJ-161); reject ID collisions.
- Record declared permissions for enforcement (PROJ-133).

**Acceptance Criteria:**
- Valid manifest merges; contributions appear in registries + auto-surface to the designer (backing AC P1-AC-10).
- Incompatible apiVersion refused.
- Colliding contribution ID rejected with a diagnostic.
- Unit tests: valid merge, apiVersion refusal, collision, malformed manifest.

**Implementation Notes:** Depends on registries (PROJ-161). The manifest schema lives in `shared/schemas/`. First-party manifests use this exact path (dogfooding).

**Testing Requirements:** Unit: valid/apiVersion/collision/malformed.

**Deliverables:** `engine/pluginhost/manifest.go`, `shared/schemas/plugin_manifest.schema.json`, tests.

**Dependencies:** PROJ-130, PROJ-161. **Effort:** 2 pts (~3h), medium.

**Agent Instructions:** Implement manifest validation + apiVersion gate + registry merge + collision handling; test all cases.

**Expected Files:** `engine/pluginhost/manifest.go`, `shared/schemas/plugin_manifest.schema.json`, tests.

**Validation Commands:**
```bash
cd engine && go vet ./... && golangci-lint run && go test ./pluginhost/... && go build ./...
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## PROJ-133 — Permission enforcement at the IPC boundary

**Summary:** Enforce a plugin's declared permissions at the host IPC boundary — it may only publish declared states and access declared resources.

**Objective:** Implement 2F §7: the plugin→capability gate (distinct from the device→action gate in PROJ-125).

**Context:** TRD 2F §7. Two gates total: device→action (2E/PROJ-125) before `invokeAction` is dispatched; plugin→capability (here) at the IPC boundary.

**Technical Requirements:**
- On `stateUpdate`: reject states the plugin didn't declare.
- On capability/network/filesystem access: enforce the manifest's declared level (network none/localhost/outbound; filesystem none/own-dir).
- Log denials (audit) — a plugin attempting un-granted access is recorded.

**Acceptance Criteria:**
- A plugin publishing an undeclared state is rejected.
- Resource access beyond declared level is denied + audited.
- Unit/integration: undeclared-state reject; over-access deny; audit on denial.

**Implementation Notes:** V1 enforces at the IPC boundary (declared-vs-actual). OS-level sandboxing is Phase 6 (ADR-0028) — not here. Coordinate denial audit with PROJ-127.

**Testing Requirements:** Integration: undeclared state; over-access; denial audit.

**Deliverables:** `engine/pluginhost/permissions.go`, tests.

**Dependencies:** PROJ-132, PROJ-125. **Effort:** 2 pts (~3h), medium.

**Agent Instructions:** Implement boundary enforcement + denial audit; test reject/deny/audit.

**Expected Files:** `engine/pluginhost/permissions.go`, tests.

**Validation Commands:**
```bash
cd engine && go vet ./... && golangci-lint run && go test ./pluginhost/... && go build ./...
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## PROJ-170 — PAL capability interfaces + provider-chain framework

**Summary:** The PAL capability-interface pattern and the probe→bind→degrade provider-chain framework.

**Objective:** Implement 2G §3/§4 / ADR-0007: capability interfaces with `(value, ok)` returns and an ordered-provider framework that binds the highest-available provider and degrades to `unavailable` gracefully. **AC P1-AC-05.**

**Context:** TRD 2G / ADR-0007. PAL = which provider answers + priority; plugin host = execution/isolation. A provider lives inside a plugin process.

**Technical Requirements:**
- Capability interface convention: methods return `(value, ok)`; `ok=false` = unavailable.
- Provider-chain framework: declare ordered providers; `probe()` each (cheap, side-effect-free); bind first available; expose one interface upward; re-probe on fault.
- `unavailable` is a normal return — bound states read `--`; no error/panic.

**Acceptance Criteria:**
- A capability with multiple providers binds the highest available; with none → unavailable (no crash) (**AC P1-AC-05**).
- A provider fault triggers re-probe → rebind or unavailable.
- Unit tests: bind order, unavailable degradation, re-probe-on-fault (with fake providers).

**Implementation Notes:** This framework is consumed by every capability plugin (telemetry/power/etc.). Keep it generic; the FPS chain (Phase 3) is the canonical multi-provider example, but telemetry/GPU use it now.

**Testing Requirements:** Unit: bind priority; all-unavailable; re-probe; fake-provider matrix.

**Deliverables:** `engine/pal/{capability.go,chain.go}` (+ interface stubs `telemetry.go,power.go,...`), tests.

**Dependencies:** PROJ-160. **Effort:** 3 pts (~4h), medium.

**Agent Instructions:** Implement the capability/`(value,ok)` convention + provider-chain probe/bind/degrade/re-probe; test with fake providers.

**Expected Files:** `engine/pal/*`, tests.

**Validation Commands:**
```bash
cd engine && go vet ./... && golangci-lint run && go test ./pal/... && go build ./...
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## PROJ-171 — 1P plugin: telemetry (CPU / RAM / network / disk / uptime)

**Summary:** The core telemetry plugin publishing CPU/RAM/network/disk/uptime states at the specified cadences, with threshold events.

**Objective:** A first-party out-of-process plugin (gopsutil provider) implementing the `Telemetry` capability and publishing `system.*` states. **AC P1-AC-04.**

**Context:** TRD 2G §6 / Doc 0 §14 cadences (CPU/RAM 1s, storage 10s, uptime 60s) / FR-6. Threshold events (CPU>85, RAM>90) emitted to the event bus.

**Technical Requirements:**
- Provider: gopsutil for CPU load, RAM used/avail/percent, net up/down, disk used/free, uptime. (GPU is PROJ-172.)
- Publish typed `system.*` states (numbers, not formatted strings — ADR-0019) at the documented cadences; series buffers for sparkline-able metrics.
- Emit threshold events (`threshold.cpu_temp`, `ram.high_usage`) per Doc 0 thresholds.
- Manifest declares the states/events/capability + `telemetry.read` permission.

**Acceptance Criteria:**
- All listed `system.*` states publish at correct cadences; values match Task Manager CPU% within ±1% (**AC P1-AC-04**).
- Threshold events fire at the configured thresholds.
- Plugin runs out-of-process via the host (PROJ-130); a crash is isolated (PROJ-131).
- Unit tests (formatters/providers) + integration (plugin→host→state store).

**Implementation Notes:** CPU *temperature* may be partial cross-platform — degrade to unavailable where unreadable (provider chain). Keep polling efficient (idle-CPU NFR). Cadences from config (PROJ-103).

**Testing Requirements:** Unit: value mapping, cadence, threshold logic. Integration: end-to-end publish to the state store.

**Deliverables:** `plugins/telemetry/{main.go,manifest.json,providers/gopsutil.go}`, tests.

**Dependencies:** PROJ-170, PROJ-132. **Effort:** 3 pts (~4h), medium.

**Agent Instructions:** Implement the telemetry plugin + gopsutil provider + manifest; publish states + threshold events; test accuracy/cadence + integration.

**Expected Files:** `plugins/telemetry/*`, tests.

**Validation Commands:**
```bash
cd engine && go vet ./... && go test ./... && go build ./...
cd plugins/telemetry && go test ./... && go build .
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## PROJ-172 — 1P plugin: GPU telemetry provider chain

**Summary:** GPU load/temp/VRAM via a provider chain (GPUtil → AMD/OHM → vendor → unavailable).

**Objective:** Add GPU telemetry to the telemetry capability via the provider-chain framework; degrade cleanly on unsupported hardware/OS.

**Context:** TRD 2G §6 / PRD D8-11 (GPU telemetry provider chain). NVAPI/ADL reliable for GPU load/temp (unlike per-app FPS).

**Technical Requirements:**
- Provider chain for GPU: GPUtil → OpenHardwareMonitor/AMD → vendor (NVAPI/ADL) → unavailable.
- Publish `system.gpu.{load,temp,vram.used,vram.total}` (typed).
- GPU temp threshold event (>88) per Doc 0.

**Acceptance Criteria:**
- GPU states publish where a provider is available; degrade to `--` where none (no crash).
- Threshold event fires at >88°C.
- Unit tests (provider selection) + integration (publish).

**Implementation Notes:** Part of the telemetry plugin (same process) or a sibling provider set — keep it within the telemetry plugin for cohesion. "partial" coverage on macOS/Linux is acceptable (degrade).

**Testing Requirements:** Unit: provider selection/fallback. Integration: publish + threshold.

**Deliverables:** `plugins/telemetry/providers/{gputil.go,amd.go,vendor.go}`, tests.

**Dependencies:** PROJ-171. **Effort:** 3 pts (~4h), medium.

**Agent Instructions:** Implement the GPU provider chain within the telemetry plugin; publish states + threshold; test selection/fallback.

**Expected Files:** `plugins/telemetry/providers/{gputil,amd,vendor}.go`, tests.

**Validation Commands:**
```bash
cd plugins/telemetry && go vet ./... && go test ./... && go build .
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## PROJ-173 — 1P plugin: power (shutdown / restart / sleep / hibernate / lock / logoff)

**Summary:** The power-actions plugin implementing the six power actions with destructive flags and an unsaved-work warning.

**Objective:** A first-party `Power` capability plugin registering `system.{shutdown,restart,sleep,hibernate,lock,logoff}` actions. **AC P1-AC-06.**

**Context:** TRD 2G / PRD D9-01 / FR-7.5. Destructive actions (shutdown/restart/hibernate/logoff) carry the `destructive` flag → 2-tap confirmation on the client (PROJ-187) + permission gating (PROJ-125). Unsaved-work warning before power actions.

**Technical Requirements:**
- Per-OS power commands behind the `Power` interface (provider per OS).
- Register six actions; mark destructive ones; `delay` param where applicable.
- Unsaved-work detection → warn (best-effort; degrade where undetectable).
- Manifest declares the actions + a power capability/permission.

**Acceptance Criteria:**
- Each action executes on each OS (or degrades cleanly if unavailable).
- Destructive actions are flagged so the client requires 2-tap (**AC P1-AC-06**) and the permission gate applies (**AC P1-AC-07** path).
- Unsaved-work warning surfaces where detectable.
- Unit tests (command construction) + integration (action dispatch via host).

**Implementation Notes:** Actual restart/shutdown in tests must be mocked (don't power off CI). Use the elevated flag where the OS needs it (the elevated-gating decision ADR-0023 is Phase 3; in P1 these run within the engine's privilege).

**Testing Requirements:** Unit: per-OS command construction (mocked). Integration: dispatch + destructive-flag propagation.

**Deliverables:** `plugins/power/{main.go,manifest.json,power_{windows,darwin,linux}.go}`, tests.

**Dependencies:** PROJ-170, PROJ-132. **Effort:** 3 pts (~4h), medium.

**Agent Instructions:** Implement the power plugin + per-OS providers (mockable) + manifest with destructive flags; test command construction + dispatch.

**Expected Files:** `plugins/power/*`, tests.

**Validation Commands:**
```bash
cd plugins/power && go vet ./... && go test ./... && go build .
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## PROJ-174 — 1P plugin: volume (system master)

**Summary:** System master volume get/set per OS.

**Objective:** A first-party plugin exposing `media.volume.system` state + `media.volume.set{level}` action.

**Context:** PRD D9-03 / D10 (mixer is Phase 2). V1 = system master only.

**Technical Requirements:**
- Per-OS master volume read/write (Core Audio/pycaw-equivalent on Windows, CoreAudio on macOS, Pulse/PipeWire on Linux) behind a capability.
- Publish `media.volume.system` (0–100); action `media.volume.set{level 0–100}` (range-validated by registry).

**Acceptance Criteria:**
- Volume reads + sets on each OS (or degrades).
- `level` range-validated (clamp/reject per schema).
- Unit (mocked) + integration (set→read round-trip).

**Implementation Notes:** Per-app mixer is Phase 2 (PROJ-2.x); keep this to master volume.

**Testing Requirements:** Unit: command construction (mocked). Integration: set→read.

**Deliverables:** `plugins/volume/{main.go,manifest.json,volume_{windows,darwin,linux}.go}`, tests.

**Dependencies:** PROJ-170, PROJ-132. **Effort:** 2 pts (~3h), low-medium.

**Agent Instructions:** Implement master-volume plugin per OS + manifest; test set/read.

**Expected Files:** `plugins/volume/*`, tests.

**Validation Commands:**
```bash
cd plugins/volume && go vet ./... && go test ./... && go build .
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## PROJ-175 — 1P plugin: launchers + system-tool launch

**Summary:** Launch apps (Steam/Epic/Chrome/Discord/custom) and system tools (Task Manager, Control Panel, etc.).

**Objective:** A first-party plugin registering `gaming.launch.*` / app-launch and `system.open.*` actions; toast on not-found.

**Context:** PRD D9-02/D9-06. V1 launch buttons (game-cover grid is Phase 3).

**Technical Requirements:**
- Launch known apps by per-OS mechanism (Steam URI, exe path, etc.); a generic "launch custom path/URI" action.
- System-tool launch (Task Manager, Control Panel, Device Manager, etc.).
- Not-found → toast (an action result the client surfaces).

**Acceptance Criteria:**
- Known apps + system tools launch where present; not-found → toast.
- Custom launch action works with a user-provided path/URI.
- Unit (command construction, mocked) + integration (dispatch + not-found result).

**Implementation Notes:** No filesystem permission beyond launching; declare appropriately. Avoid shell injection — validate/escape launch inputs (SR-005 carried).

**Testing Requirements:** Unit: command construction + input validation (no injection). Integration: dispatch + not-found.

**Deliverables:** `plugins/launchers/{main.go,manifest.json,launch_{windows,darwin,linux}.go}`, tests.

**Dependencies:** PROJ-132. **Effort:** 2 pts (~3h), low-medium.

**Agent Instructions:** Implement launchers + system-tool launch + input validation + manifest; test construction/validation/dispatch.

**Expected Files:** `plugins/launchers/*`, tests.

**Validation Commands:**
```bash
cd plugins/launchers && go vet ./... && go test ./... && go build .
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## PROJ-176 — 1P plugin: notification count

**Summary:** Unread notification count from the OS action center (count only in V1).

**Objective:** A first-party `Notifications` capability publishing `notification.count` from the OS action center. Backs the dashboard badge (**AC P1-AC-08** badge portion).

**Context:** PRD D13-01. Full aggregation/feed is Phase 5; V1 = count badge.

**Technical Requirements:**
- Per-OS notification listener (WinRT UserNotificationListener on Windows; degrade on macOS/Linux where restricted).
- Publish `notification.count` (number); update on add/clear.
- No credential storage (reads OS action center only — SR-003 carried).

**Acceptance Criteria:**
- `notification.count` reflects OS action-center unread (**AC P1-AC-08** badge).
- Degrades to unavailable where OS access is blocked (no crash).
- Unit (count logic) + integration (listener→state, where testable; documented manual otherwise).

**Implementation Notes:** OS notification access often needs a permission grant — document the step; degrade if denied.

**Testing Requirements:** Unit: count update logic. Integration/manual: listener→count where the OS allows.

**Deliverables:** `plugins/notifications/{main.go,manifest.json,listener_{windows,darwin,linux}.go}`, tests.

**Dependencies:** PROJ-170, PROJ-132. **Effort:** 2 pts (~3h), medium.

**Agent Instructions:** Implement the count-only notifications plugin + per-OS listener + manifest; test count logic + integration where possible.

**Expected Files:** `plugins/notifications/*`, tests.

**Validation Commands:**
```bash
cd plugins/notifications && go vet ./... && go test ./... && go build .
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

# EPIC-8 — Client Runtime & Widget Vocabulary (WS-8)

> Flutter. PROJ-180 (connection + pairing) and PROJ-181 (renderer) are the spine; the widgets and gestures hang off PROJ-181.

---

## PROJ-180 — Client connection manager + pairing UI (QR scan)

**Summary:** The client-side connection manager (discover/pair/reconnect/demux) and the pairing UI with QR scan + fingerprint verify.

**Objective:** Implement the client half of 2A + the pairing UI: discover engines (mDNS), scan QR, run the client handshake, verify the engine fingerprint, maintain the session. **AC P1-AC-02/03.**

**Context:** TRD 2A (client) / 2E §3 (client handshake). The engine half is PROJ-123/147; this is the Flutter client.

**Technical Requirements:**
- Client `ConnectionManager`: resolve (mDNS list + manual + scan), dial, run handshake, hold session, demux channels.
- Pairing UI: list discovered engines; **scan QR** (camera) → parse payload → connect → verify engine fingerprint → complete handshake.
- Manual pairing UI (addr + PIN) path.
- Reconnect integration (PROJ-146).

**Acceptance Criteria:**
- QR pair completes; wrong fingerprint / bad token rejected with a clear message (**AC P1-AC-02**).
- Session traffic is encrypted (the client never sends plaintext) (**AC P1-AC-03** client side).
- Manual + reconnect paths work.
- Widget/integration tests: pairing flow (mock engine), fingerprint mismatch, reconnect.

**Implementation Notes:** Depends on engine discovery (PROJ-147) + pairing (PROJ-123) for integration; can develop against a mock engine first. Camera/QR permission handled per platform.

**Testing Requirements:** Widget/integration: pair (mock), mismatch reject, manual, reconnect.

**Deliverables:** `client/lib/net/{connection_manager,channels,demux}.dart`, `client/lib/app/pairing.dart`, tests.

**Dependencies:** PROJ-147, PROJ-123. **Effort:** 3 pts (~4h), medium-high.

**Agent Instructions:** Implement the client connection manager + QR/manual pairing + fingerprint verify against a mock engine, then integrate; test pair/mismatch/reconnect.

**Expected Files:** `client/lib/net/*`, `client/lib/app/pairing.dart`, tests.

**Validation Commands:**
```bash
cd client && dart analyze && flutter test && flutter build <host-os-desktop>
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## PROJ-181 — Renderer registry + layout interpreter

**Summary:** The client renderer registry (widgetType→native builder) and the layout interpreter that builds/diffs the widget tree from the layout doc + ops.

**Objective:** Implement 2C §7: build the tree once from a layout doc; apply ops with targeted repaint; subscribe widgets to bound states; unknown type → safe placeholder.

**Context:** TRD 2C §7 / ADR-0003. The client is a deterministic renderer of the engine-defined layout (host authority). Same registry is reused by the Designer canvas (PROJ-210).

**Technical Requirements:**
- Renderer registry: `widgetType → builder`. Built-in types registered (filled by PROJ-182…186).
- Layout interpreter: parse layout doc → build widget tree; apply a layout op → diff + rebuild only affected nodes.
- Per-widget state subscription (drives the engine subscription set via the bound states).
- Unknown widget type → placeholder (never crash).

**Acceptance Criteria:**
- A layout doc renders to a widget tree; an op rebuilds only the affected widget (targeted repaint).
- Unknown type renders a placeholder.
- State update repaints only subscribed widgets.
- Widget tests: build-from-doc, op-apply targeted repaint, unknown-type placeholder, subscription repaint.

**Implementation Notes:** Keep builders pure functions of (descriptor, boundState). The descriptor-interpreter for *plugin* widgets is Phase 6 (ADR-0029); V1 uses hardcoded built-in builders.

**Testing Requirements:** Widget: build, targeted repaint, placeholder, subscription.

**Deliverables:** `client/lib/render/{registry,interpreter,repaint}.dart`, tests.

**Dependencies:** PROJ-180, PROJ-161. **Effort:** 3 pts (~4h), medium-high.

**Agent Instructions:** Implement registry + interpreter + targeted repaint + placeholder; test all four behaviors.

**Expected Files:** `client/lib/render/{registry,interpreter,repaint}.dart`, tests.

**Validation Commands:**
```bash
cd client && dart analyze && flutter test
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## PROJ-182 — Widget: button + toggle

**Summary:** Button and toggle widgets with gesture + state binding.

**Objective:** Two core widgets rendering + handling their gesture slots, bound to state where applicable, with an immediate pressed-state.

**Context:** TRD 2C §3 widget model. Button = action trigger; toggle = boolean-state-bound on/off.

**Technical Requirements:**
- Button: renders label/icon; tap (and other mapped slots) emit interaction events (PROJ-187); pressed-state ≤100ms.
- Toggle: bound to a boolean state; reflects on/off; tap toggles via mapped action.
- Both honor `valueRules` styling.

**Acceptance Criteria:**
- Button shows pressed-state ≤100ms and emits its tap-slot event.
- Toggle reflects its bound boolean state and toggles.
- Widget tests: render, pressed-state timing, toggle reflect.

**Implementation Notes:** Register builders into the registry (PROJ-181). Gesture wiring via PROJ-187; if not yet done, wire tap directly and extend.

**Testing Requirements:** Widget: render + interaction + state reflect.

**Deliverables:** `client/lib/render/widgets/{button,toggle}.dart`, tests.

**Dependencies:** PROJ-181. **Effort:** 2 pts (~3h), low-medium.

**Agent Instructions:** Implement button + toggle builders + tests; register in the renderer registry.

**Expected Files:** `client/lib/render/widgets/{button,toggle}.dart`, tests.

**Validation Commands:**
```bash
cd client && dart analyze && flutter test
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## PROJ-183 — Widget: slider + label + image

**Summary:** Slider (dragValue), label (text/state), and image/icon widgets.

**Objective:** Three core widgets: a slider emitting a continuous value via its dragValue slot; a label binding a state/text; an image/icon.

**Context:** TRD 2C §3. Slider drives e.g. `media.volume.set{level}` via the dragValue slot.

**Technical Requirements:**
- Slider: bound min/max; drag emits `dragValue` with the level param; reflects bound state.
- Label: renders static text or a bound state value with unit formatting (presentation-side, ADR-0019).
- Image: renders a static asset/icon (album-art asset-fetch is Phase 2).

**Acceptance Criteria:**
- Slider drag emits level within range; reflects bound state.
- Label formats a bound numeric state with unit (e.g. "42.0 °C").
- Image renders.
- Widget tests for each.

**Implementation Notes:** Unit formatting lives in the widget/style, not the state value (typed states, ADR-0019).

**Testing Requirements:** Widget: slider drag/range; label formatting; image render.

**Deliverables:** `client/lib/render/widgets/{slider,label,image}.dart`, tests.

**Dependencies:** PROJ-181. **Effort:** 2 pts (~3h), low-medium.

**Agent Instructions:** Implement slider/label/image builders + tests; register.

**Expected Files:** `client/lib/render/widgets/{slider,label,image}.dart`, tests.

**Validation Commands:**
```bash
cd client && dart analyze && flutter test
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## PROJ-184 — Widget: circular gauge + linear gauge/bar

**Summary:** Circular gauge and linear gauge/bar bound to scalar states, with client-side `valueRules`.

**Objective:** The headline telemetry widgets — render a scalar state as a gauge with conditional styling (e.g. red ≥85°C) evaluated client-side. **AC P1-AC-04** render.

**Context:** TRD 2C §3 / Design system. Custom-painted for the neon look; 60 FPS.

**Technical Requirements:**
- Circular gauge: bind scalar; arc + value; optional inline sparkline; `valueRules` styling client-side.
- Linear gauge/bar: bind scalar/percent; fill + value.
- Native custom painters (no heavy chart lib); 60 FPS under telemetry updates.

**Acceptance Criteria:**
- Gauges render bound telemetry and update on delta at 60 FPS (**AC P1-AC-04** render; NFR-03).
- `valueRules` change styling at thresholds with zero round-trip (client-side).
- Widget tests: render, value update, valueRules threshold styling.

**Implementation Notes:** These prove the "live data as first-class widgets" pillar. Reuse the theme tokens (PROJ-189).

**Testing Requirements:** Widget: render, update-on-delta, valueRules.

**Deliverables:** `client/lib/render/widgets/{gauge_circular,gauge_linear}.dart`, tests.

**Dependencies:** PROJ-181. **Effort:** 3 pts (~4h), medium.

**Agent Instructions:** Implement the two gauges as custom painters + valueRules + tests; register.

**Expected Files:** `client/lib/render/widgets/{gauge_circular,gauge_linear}.dart`, tests.

**Validation Commands:**
```bash
cd client && dart analyze && flutter test
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## PROJ-185 — Widget: sparkline (series state)

**Summary:** A sparkline widget rendering a `series` state's ring buffer, appending on each delta.

**Objective:** Render a rolling mini-chart from a series state at 60 FPS with no extra traffic (the series rides the state).

**Context:** TRD 2C §7 / 2B series states. The ring buffer is already transmitted as state; the widget renders + appends.

**Technical Requirements:**
- Bind a `series` state; render the buffer as a sparkline; append the latest sample on each delta.
- Custom painter; 60 FPS.

**Acceptance Criteria:**
- Sparkline renders the series and updates smoothly on delta (no extra traffic).
- Widget tests: render buffer; append-on-delta.

**Implementation Notes:** Series buffers are in-memory engine-side (PROJ-160) and transmitted as state; the widget never requests extra data.

**Testing Requirements:** Widget: render + append.

**Deliverables:** `client/lib/render/widgets/sparkline.dart`, tests.

**Dependencies:** PROJ-181, PROJ-160. **Effort:** 2 pts (~3h), low-medium.

**Agent Instructions:** Implement the sparkline painter + append-on-delta + tests; register.

**Expected Files:** `client/lib/render/widgets/sparkline.dart`, tests.

**Validation Commands:**
```bash
cd client && dart analyze && flutter test
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## PROJ-186 — Widget: media card (basic) + page-nav

**Summary:** A basic now-playing media card and a page/profile navigation widget.

**Objective:** Two widgets: a basic media card (track/artist + play/pause/next) bound to V1 media states; a page-nav widget that switches page/profile within the session.

**Context:** TRD 2C §7. Full media card (album art via asset fetch, progress, mixer) is Phase 2; V1 = basic metadata + controls. Page-nav uses the `navigate` interaction target.

**Technical Requirements:**
- Media card (basic): bind `media.track/artist/playing`; play/pause/next via mapped actions.
- Page-nav widget: tap → `navigate` to a page/profile in the session.

**Acceptance Criteria:**
- Media card shows track/artist + play/pause/next works (basic).
- Page-nav switches page/profile (session reflects).
- Widget tests for both.

**Implementation Notes:** Album-art asset fetch + progress are explicitly Phase 2 — keep this basic. Navigate handled by the session (PROJ-163).

**Testing Requirements:** Widget: media card controls; page-nav switch.

**Deliverables:** `client/lib/render/widgets/{media_card,page_nav}.dart`, tests.

**Dependencies:** PROJ-181. **Effort:** 2 pts (~3h), low-medium.

**Agent Instructions:** Implement basic media card + page-nav + tests; register.

**Expected Files:** `client/lib/render/widgets/{media_card,page_nav}.dart`, tests.

**Validation Commands:**
```bash
cd client && dart analyze && flutter test
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## PROJ-187 — Gesture capture (all slots) + 2-tap confirm

**Summary:** Map device gestures to interaction-slot events for all slots, with 2-tap confirmation for destructive actions.

**Objective:** Implement 2C §3 interaction + IDP confirmation gating: tap/double/long/pressDown/pressUp/dragValue/swipe → slot events; destructive actions require a 2-tap confirm card. **AC P1-AC-06.**

**Context:** TRD 2C §3 / IDP-03. The full slot model exists in the widget model (V1); the designer UI for some slots is Phase 2, but the *client capture* of all slots is V1.

**Technical Requirements:**
- Gesture detector mapping all slots to upstream interaction events with the slot id.
- Pressed-state visual ≤100ms (IDP-04).
- Destructive action (flagged in registry) → 2-tap confirmation card; second tap executes.

**Acceptance Criteria:**
- Each gesture slot emits the correct interaction event.
- Destructive action shows a 2-tap confirm; second tap executes (**AC P1-AC-06**).
- Pressed-state ≤100ms.
- Widget tests: per-slot dispatch; confirm flow; pressed-state timing.

**Implementation Notes:** Confirmation reads the action's `destructive` flag (registry). pressDown/pressUp paired affordance (push-to-talk) — designer UI for these is Phase 2 but capture works now.

**Testing Requirements:** Widget: slot dispatch; 2-tap confirm; pressed-state.

**Deliverables:** `client/lib/gestures/{capture,slots,confirm}.dart`, tests.

**Dependencies:** PROJ-181. **Effort:** 3 pts (~4h), medium.

**Agent Instructions:** Implement gesture capture for all slots + 2-tap confirm + pressed-state; test dispatch/confirm/timing.

**Expected Files:** `client/lib/gestures/*`, tests.

**Validation Commands:**
```bash
cd client && dart analyze && flutter test
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## PROJ-188 — Degradation UI (dimmed last value + connection badge)

**Summary:** On disconnect, render bound widgets' last value dimmed with a connection badge; `--` for unavailable capabilities.

**Objective:** Implement 2A §7.3 / FR-5.4 client-side. **AC P1-AC-12.** Never freeze or fabricate live data.

**Context:** TRD 2A §7.3. The connection badge shows connected/degraded/disconnected; degraded widgets dim their last value.

**Technical Requirements:**
- Connection badge component (3 states) driven by the connection manager (PROJ-180).
- On disconnect: bound widgets render last value dimmed; capability-unavailable states show `--`.
- On reconnect (PROJ-146): clear degradation, resume live.

**Acceptance Criteria:**
- Disconnect → dimmed last value + badge; unavailable → `--`; no frozen/false live data.
- Reconnect restores live (**AC P1-AC-12** with PROJ-146).
- Widget/integration tests: disconnect rendering; reconnect clear.

**Implementation Notes:** Coordinate with reconnect (PROJ-146) and the renderer (PROJ-181).

**Testing Requirements:** Widget/integration: degraded rendering; reconnect clear.

**Deliverables:** `client/lib/app/connection_badge.dart`, `client/lib/render/degradation.dart`, tests.

**Dependencies:** PROJ-180, PROJ-181. **Effort:** 2 pts (~3h), low-medium.

**Agent Instructions:** Implement badge + degraded rendering + reconnect clear; test.

**Expected Files:** `client/lib/app/connection_badge.dart`, `client/lib/render/degradation.dart`, tests.

**Validation Commands:**
```bash
cd client && dart analyze && flutter test
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## PROJ-189 — Theme tokens (neon palette/typography/spacing) + accessibility

**Summary:** Apply the design-system tokens across the client and enforce WCAG AA contrast + 48×48 touch targets.

**Objective:** Implement Doc 0 Design System (Part 4) tokens + accessibility (Doc 0 §9). **AC P1-AC-16.**

**Context:** Design system carried from the scrapped docs (neon palette, typography, spacing, component tokens). Colour never the sole indicator (icon+text accompany).

**Technical Requirements:**
- Token definitions (palette/typography/spacing/component tokens per Doc 0 Part 4).
- Apply across widgets; enforce min 48×48 touch targets; text contrast ≥4.5:1 (AA).
- Colour-plus-icon/text for state (never colour alone).

**Acceptance Criteria:**
- Tokens applied; contrast meets AA (automated contrast check); touch targets ≥48×48 (**AC P1-AC-16**).
- State indicators use colour + icon/text.
- Tests: contrast check; touch-target check.

**Implementation Notes:** Centralize tokens in `client/lib/theme/tokens.dart`; widgets consume them (refactor PROJ-182…186 to use tokens). An automated contrast test guards regressions.

**Testing Requirements:** Unit/widget: contrast ratios; touch-target sizes.

**Deliverables:** `client/lib/theme/tokens.dart`, contrast/target tests.

**Dependencies:** PROJ-181. **Effort:** 2 pts (~3h), low-medium.

**Agent Instructions:** Define + apply tokens; add contrast + touch-target tests; ensure colour-plus-icon.

**Expected Files:** `client/lib/theme/tokens.dart`, tests.

**Validation Commands:**
```bash
cd client && dart analyze && flutter test
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## Batch 3 — dependency-correct execution order (within these two epics)

```
EPIC-5 (engine/plugins):
PROJ-130 (host) ─► PROJ-131 (fault) ; PROJ-130 ─► PROJ-132 (manifest/merge) [needs PROJ-161]
PROJ-132 ─► PROJ-133 (perm boundary) [needs PROJ-125]
PROJ-170 (PAL chain) ─► PROJ-171 (telemetry) ─► PROJ-172 (GPU)
PROJ-170 + PROJ-132 ─► PROJ-173 (power), PROJ-174 (volume), PROJ-176 (notif count)
PROJ-132 ─► PROJ-175 (launchers)

EPIC-8 (client):
PROJ-180 (conn+pairing) ─► PROJ-181 (renderer) ─► PROJ-182,183,184,185,186 (widgets)
PROJ-181 ─► PROJ-187 (gestures+confirm), PROJ-189 (theme/a11y)
PROJ-180+PROJ-181 ─► PROJ-188 (degradation)
```

**Cross-epic dependencies:** EPIC-5 host needs PROJ-160 (state) + PROJ-103 (config) + PROJ-161 (registries, for merge) + PROJ-125 (perms, for boundary). EPIC-8 needs PROJ-147+PROJ-123 (discovery+pairing) and PROJ-161 (registries, for the interpreter). The **M3 "live telemetry on a phone" gate** = PROJ-171 + PROJ-150 (fan-out, Batch 2) + PROJ-184 (gauge) all Done. The **M4 "actions & permissions" gate** = PROJ-173/174/175 + PROJ-125 + PROJ-187 Done.

---

*End of Batch 3 (EPIC-5 + EPIC-8 full tickets). Next: Batch 4 — EPIC-7 (Flow core) + EPIC-9 (Designer) + EPIC-10 (Hardening). Then the synthesis docs: Dependency Graph → Execution Plan → Progress Dashboard → Claude Agent Instructions.*
