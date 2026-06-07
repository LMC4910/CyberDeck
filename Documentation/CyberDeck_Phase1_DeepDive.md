# CyberDeck — Phase 1 (Foundation) Deep Dive

**Document 3 of the CyberDeck Enterprise Documentation Set · Per-Phase Deep Dive**
Version 0.1 (Draft) · June 2026 · Codebase ID: `com.shishir.cyberdeck`

> Implementation-depth specification for **Phase 1 (Foundation / V1)**. Authority chain: Foundation (Doc 0) → PRD (Doc 1) → TRD Master + subsystem TRDs (2/2A–2G) + ADR Log (2-ADR) → **this**. Where this doc cites a structure or rule, the owning TRD is the source of truth; here we specify *what is built in Phase 1, in what order, how the pieces connect, and how we prove it's done.*

## Contents
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

## 1. Phase intent & definition of done

**Intent.** Deliver a secure, multi-device, single-engine control surface that a user can install, pair devices to over LAN, author layouts for on the desktop with live reflection, run live telemetry and core actions through, and automate with the flow-engine core — *and* whose internal seams (registries, op-log, endpoint abstraction, flow executor, plugin host, security model) are complete enough that Phases 2–8 attach without re-architecture.

**Definition of done (phase-level).** Phase 1 is complete when:
- All Phase-1 functional requirements (PRD FR-1…FR-11 V1 scope) are implemented and pass automated tests.
- All Phase-1 acceptance criteria (§18) are verified.
- NFR budgets hold on reference hardware: engine < 150 MB RAM steady, < 2% idle CPU, tap-to-feedback < 100 ms, op→reflection < 200 ms, 60 FPS client render, reconnect < 5 s, ≥ 8 concurrent sessions.
- The installer for each desktop OS deploys engine-service + Desktop UI + bundled first-party plugins; the engine starts on boot and survives UI close.
- Soak test (8 h) passes (RSS growth < 5 MB/h; no plugin-induced engine crash).

## 2. Scope: in / out

### In scope (Phase 1)
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

### Out of scope (later phases — seams built, capability deferred)
Album art / progress / mixer (P2) · auto app-focus profile switching (P2, *rule field + hook built*) · gaming optimization & FPS (P3) · visual flow builder UI & schedule triggers (P3, *model built*) · smart home (P4) · full notification aggregation & cameras (P5) · plugin SDK / third-party loading / signing / sandboxing (P6, *contract built & used by 1P*) · remote/relay (P7, *endpoint seam built*) · accounts/cloud (P7) · collaborative editing & adaptive layouts (P8, *op-log & DeviceClass built*).

## 3. Workstream map & dependency order

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

## 4. WS-1 — Engine bootstrap, service lifecycle & packaging

**Owning TRD:** 2B §7, TRD Master §3. **ADRs:** 0005.

### 4.1 Functional flow
```
Installer → registers engine as OS service + drops Desktop UI + bundled 1P plugins
OS boot → service manager starts engine
  engine: load config.json → open/migrate SQLite (WS-2) → init core (WS-6)
        → start plugin host (WS-5) → start transport (WS-4) → mDNS advertise
        → READY
User opens Desktop UI → connects over loopback (data + privileged control)
User closes Desktop UI window → engine keeps running (service)
```

### 4.2 Capability detail
- **Service registration** per OS: Windows Service (or startup-registered tray process), launchd LaunchAgent/Daemon, systemd user service.
- **Tray presence**: status (connected/degraded/error), reopen UI, pause/quit engine, "show pairing QR."
- **Start-on-boot** default on; user-toggleable.
- **Single-instance** guard (one engine per host); second launch focuses the UI.

### 4.3 Technical spec
- Engine entrypoint parses service-mode vs foreground (`cyberdeck --service` / `--console`).
- Graceful shutdown handler: stop accepting sessions → flush durable writes → SIGTERM plugins (grace) → close SQLite.
- Config schema (`config.json`, non-secret) carried from Doc 0 §16 (intervals, thresholds, HA URL placeholder, display prefs); read at startup (hot-reload deferred, Doc 0 §12).

### 4.4 Code structure
```
engine/cmd/cyberdeck/main.go          // flag parse, service vs console
engine/internal/lifecycle/            // boot sequence, shutdown, single-instance
engine/internal/service/{windows,darwin,linux}.go   // service registration glue
engine/internal/config/               // config.json load + schema + defaults
client/lib/tray/                      // tray UI (desktop only)
installers/{windows,macos,linux}/     // packaging scripts
```

### 4.5 Data flow
Config + SQLite handle injected into core init; no runtime data flow of its own beyond lifecycle signals.

---

## 5. WS-2 — Persistence & core data layer

**Owning TRD:** 2B §6. **ADRs:** 0014.

### 5.1 Capability detail
- Single SQLite file; the 9 tables of 2B §6 (`documents, registry_items, variables, workflows, devices, accounts, audit_log, meta`).
- Forward-only migrations keyed by `meta.schema_version`.
- Repository layer: typed Go accessors per table; transactions for multi-row writes; the audit log is append-only (insert-only API, no update/delete).

### 5.2 Technical spec
- Use a single writer connection + a read pool (SQLite WAL mode) to keep telemetry-adjacent reads (e.g. `var.*`) non-blocking.
- All `*_json` columns validated against the owning subsystem's schema on write.
- Secrets are **never** written here (2E §7); a lint/test asserts no secret-typed field reaches a repo.

### 5.3 Code structure
```
engine/core/persistence/
  db.go            // open, WAL, migrate
  migrations/      // 0001_init.sql, …
  repo_documents.go  repo_registry.go  repo_variables.go
  repo_workflows.go  repo_devices.go   repo_audit.go  repo_meta.go
```

### 5.4 Data flow
Write path from WS-3 (devices, audit), WS-6 (registry_items, variables), WS-9 (documents), WS-7 (workflows, variables, audit). Read path on boot (rehydrate registries/documents/devices) and on demand.

---

## 6. WS-3 — Security & identity

**Owning TRD:** 2E. **ADRs:** 0008, 0009, 0016.

### 6.1 Functional flow (pairing — happy path, QR)
```
Desktop UI (privileged control) → engine: "issue pairing token" → token+fp shown as QR
Phone scans QR → ClientHello(uuid,pubkey,token) → engine validates token
  → ServerHello(engine uuid,pubkey,nonce) → phone verifies fingerprint
  → KeyConfirm(sig) → engine verifies → PairResult(sig) → phone verifies
  → trust records written both sides → session keys derived → CONNECTED
```

### 6.2 Capability detail
- Identity: Ed25519 keypair + 128-bit UUID generated at first launch, stored in OS secure store (private) + SQLite/secure-prefs (public/uuid/label). Account-independent (ADR-0016).
- Pairing: QR (token+fingerprint), manual (addr + PIN), mDNS-initiated (TXT fingerprint → token/PIN approval). Token single-use, time-limited, issued only over privileged control channel.
- Permissions: per-device `{allowPowerActions, allowedCategories, deniedActions, allowEditTrigger}`; enforced engine-side on every interaction (5-step order, 2E §5.2).
- Revocation: `revoked=1` → reject at handshake + tear down live session.
- Audit: append every executed/rejected action + pairing/revoke/session/flow events.

### 6.3 Technical spec
- Crypto suite per 2A §5.3 (X25519 ECDH + HKDF + ChaCha20-Poly1305 AEAD; Ed25519 sigs over nonces). Forward secrecy via per-session ephemerals.
- Secret storage providers per OS (2E §7) behind a `SecretStore` interface (a PAL-style capability — note it's a host concern, bundled, not a downloadable plugin).
- Permission check is a pure function `authorize(session, actionDescriptor) → allow|reason`; unit-tested exhaustively.

### 6.4 Code structure
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

### 6.5 Data flow
Pairing writes `devices`; every action (WS-6/WS-7) calls `authorize()` then `audit.append()`. Secrets flow only to/from the OS secure store, never SQLite/logs.

---

## 7. WS-4 — Transport & connectivity

**Owning TRD:** 2A. **ADRs:** 0009, 0010, 0011, 0015.

### 7.1 Capability detail
- `TransportEndpoint`/`ConnectionManager` with V1 `LanEndpoint` only (relay seam reserved).
- Discovery: mDNS advertise/browse; manual; bounded active scan (UUID-confirmed).
- Three channels (State/Layout/Preview) + loopback Control; per-channel backpressure (State coalesces; Layout ordered-lossless; Preview drop-on-overflow).
- Resilience: sleep-tolerant heartbeat; reconnect backoff→mDNS→scan (<5 s); dimmed-last-value degradation; versioned resync.
- Multi-session fan-out with per-session subscription filtering.

### 7.2 Technical spec
- TCP, length-prefixed encrypted frames; shared JSON envelope (Master §6.3) through the `Serializer` abstraction (binary deferred).
- Per-session goroutine set: reader, writer, heartbeat, channel demux. Cancellation via context on drop/shutdown.
- mDNS via a maintained Zeroconf library; active scan rate-limited to local subnet, opt-in.

### 7.3 Code structure
```
engine/core/transport/
  endpoint.go connmgr.go        // abstraction (LAN now)
  discovery_mdns.go discovery_scan.go
  session.go channels.go heartbeat.go reconnect.go
  framing.go serializer.go      // length-prefix + JSON serializer seam
client/lib/net/
  connection_manager.dart channels.dart heartbeat.dart discovery.dart resync.dart
```

### 7.4 Data flow
Instantiates TRD Master DF-A/B/C over the wire: State deltas down (filtered by subscription), interaction events up, ops down + interaction up on Layout, ghosts on Preview, control on loopback.

---

## 8. WS-5 — Plugin host & first-party capability plugins

**Owning TRD:** 2F (host), 2G (capabilities). **ADRs:** 0006, 0007.

### 8.1 Capability detail
- **Plugin host** in the engine: launch/supervise/restart bundled 1P plugins; IPC (loopback/stdio, JSON envelope `ch:"plugin"`); permission enforcement at the boundary; fault handling (faulted plugin keeps contributions; states→`--`).
- **First-party plugins (Phase 1):**
  - `telemetry` — CPU/GPU/RAM/storage/network/uptime; provider chains (gopsutil → OS-native; GPU: GPUtil → OHM/AMD → vendor → unavailable). Emits threshold events.
  - `power` — shutdown/restart/sleep/hibernate/lock/logoff; destructive flags; unsaved-work warning.
  - `volume` — system master volume get/set.
  - `launchers` — Steam/Epic/Chrome/Discord/custom launch; system-tool launch (Task Manager, etc.).
  - `notifications` — unread count from OS action center (count only in P1; full feed P5).

### 8.2 Technical spec
- Each plugin = separate Go binary + manifest (2F §3). Manifests declare `contributes` (states/actions/events/capabilities) merged into registries (WS-6) and required permissions.
- Capability interfaces (2G §3) with `(value, ok)` returns; provider probe→bind→degrade at host start; re-probe on fault.
- Telemetry cadences per Doc 0 §14 (CPU/GPU/RAM 1 s, storage 10 s, uptime 60 s) — each provider a goroutine in the plugin, publishing via `stateUpdate` IPC.

### 8.3 Code structure
```
engine/pluginhost/  host.go supervise.go ipc.go permissions.go lifecycle.go
engine/pal/         telemetry.go fps.go media.go power.go notifications.go  // interfaces + chain framework
plugins/telemetry/  main.go manifest.json providers/{gopsutil.go,gputil.go,amd.go,vendor.go}
plugins/power/      main.go manifest.json power_{windows,darwin,linux}.go
plugins/volume/     main.go manifest.json
plugins/launchers/  main.go manifest.json
plugins/notifications/ main.go manifest.json listener_{windows,darwin,linux}.go
```

### 8.4 Data flow
Provider → plugin `stateUpdate` → host → StateStore.Set (WS-6) → delta → fan-out (WS-4). Action: engine `invokeAction` (post-authorize) → plugin → external OS API → `actionResult` → audit.

---

## 9. WS-6 — State store, registries & event bus

**Owning TRD:** 2B §2–§5. **ADRs:** 0019, 0006.

### 9.1 Capability detail
- Typed state store with delta suppression + series ring buffers (in-memory); subscription filtering.
- Three registries (action/widget/flow-node), schema-driven, plugin-populated; queryable for the Designer.
- Event bus (state.changed, threshold.crossed, device.*, plugin.*, session.*, flow.*).
- Session/profile model with the activation-rule field + evaluation hook (auto-switch deferred).

### 9.2 Technical spec
- `StateStore.Set` does change detection, ring-buffer push, dirty-marking, event emission, fan-out enqueue.
- Registry merge validates schema-of-schemas; rejects ID collisions; persists `registry_items`.
- `var.*` are states backed by the `variables` table (durable) and bindable.

### 9.3 Code structure
```
engine/core/state/    store.go state.go ringbuffer.go subscriptions.go delta.go
engine/core/registry/ actions.go widgets.go flownodes.go merge.go query.go
engine/core/eventbus/ bus.go topics.go
engine/core/session/  session.go profile.go activation.go mode.go
shared/schemas/       action.schema.json widget.schema.json flownode.schema.json state.descriptor.json
```

### 9.4 Data flow
Central hub of DF-A (state→fan-out) and the resolution point for DF-B (interaction→action/flow). Registries feed the Designer (DF-C authoring).

---

## 10. WS-7 — Flow engine core

**Owning TRD:** 2D. **ADRs:** 0013, 0019.

### 10.1 Capability detail
- Flow model + host-side async executor; V1 node set (action/if/setVar/wait/loop/navigate/random/subflow/stop); sandboxed expression language; global `var.*` + local scope; triggers manual/event/stateChange (schedule field reserved); cancellation; failure handling; audit.

### 10.2 Technical spec
- Executor = step loop over the node graph in a run context (run-id, local scope, triggering device, cancel handle). `action` nodes await IPC result; `wait` reschedules without holding a thread; `loop` iteration-capped; run wall-clock budget.
- Expression engine: lexer→parser→AST→bounded evaluator; tokens resolve typed values from the state store; unavailable→safe value + availability flag; **no eval/IO/host calls** (security boundary, 2E TB-5).
- `stateChange` triggers edge-triggered + debounced via event bus.

### 10.3 Code structure
```
engine/core/flow/
  model.go executor.go runcontext.go
  nodes/{action.go,if.go,setvar.go,wait.go,loop.go,navigate.go,random.go,subflow.go,stop.go}
  expr/{lexer.go,parser.go,ast.go,eval.go}
  triggers.go scope.go
```

### 10.4 Data flow
Trigger (event bus / interaction) → executor → `action` nodes via WS-6 action path (authorize+audit) → state changes ripple back via DF-A. `setVar` writes `variables` (WS-2) + state store (WS-6).

---

## 11. WS-8 — Client runtime & widget vocabulary

**Owning TRD:** 2C §7, 2A (client side). **ADRs:** 0003, 0004.

### 11.1 Capability detail
- Connection manager (pairing UI, reconnect, channel demux, resync).
- Renderer registry: `widgetType → native Flutter builder`. **V1 widgets:** button, toggle, slider, label, image, circular gauge, linear gauge/bar, sparkline, media card (basic), page-nav.
- Layout interpreter: build tree from doc; apply ops (diff/targeted repaint); subscribe per-widget to bound states.
- Full gesture capture (tap/double/long/down/up/drag/swipe); maps to interaction-slot events upstream.
- Degradation UI: dimmed last value + connection badge; `--` for unavailable; placeholder for unknown widget type.
- Runtime vs edit/preview mode handling.

### 11.2 Technical spec
- Widget builders are pure functions of `(descriptor, boundState)`; no business logic; `valueRules` evaluated client-side per state update for zero-latency conditional styling (60 FPS budget).
- Pressed-state visual ≤100 ms; result reflected when state returns (≤500 ms).
- 2-tap confirmation UI for destructive actions.

### 11.3 Code structure
```
client/lib/
  net/ (WS-4 client)
  render/registry.dart widgets/{button,toggle,slider,label,image,gauge_circular,gauge_linear,sparkline,media_card,page_nav}.dart
  render/value_rules.dart interpreter.dart repaint.dart
  gestures/capture.dart slots.dart confirm.dart
  app/shell.dart pairing.dart connection_badge.dart
  theme/tokens.dart   // neon palette/typography/spacing (Doc 0 design system)
```

### 11.4 Data flow
Receives DF-A state deltas → targeted repaint; emits DF-B interaction events on tap; in edit mode receives DF-C ops + preview ghosts.

---

## 12. WS-9 — Designer (desktop)

**Owning TRD:** 2C §8. **ADRs:** 0012, 0017, 0018, 0006.

### 12.1 Capability detail
- WYSIWYG grid canvas (renders as target device class via the same renderer registry as the client).
- Drag-drop placement (snap-to-grid, no overlap); move/resize with live preview ghosts.
- Schema-driven inspector: appearance binding (states filtered by `acceptsStateKinds`), per-gesture interaction mapping with **auto-generated param editors from action schemas**, style + `valueRules`, type config.
- Op-log sync: emits versioned ops; live reflection to bound devices in edit/preview mode.
- Undo/redo via op inverses; profile create/assign/activate; explicit device targeting; grid config (no caps).

### 12.2 Technical spec
- Canvas emits ops on commit; drag emits throttled ghosts on Preview; drop commits one durable op.
- Inspector reads registry schemas (WS-6) → renders editors generically (int→slider, choice→dropdown, entity→picker stub for P1). **Zero per-action UI code** — proves the designer↔ecosystem unification.
- Undo stack per document/edit-session; single-writer edit lock.

### 12.3 Code structure
```
client/lib/designer/   // compiled for desktop targets only (ADR-0018)
  canvas.dart palette.dart inspector/{appearance.dart,interaction.dart,style.dart,config.dart}
  op_emitter.dart undo.dart device_target.dart grid_config.dart profile_manager.dart
  schema_form.dart      // auto-generates editors from registry schemas
```

### 12.4 Data flow
Reads registries (DF-C); emits ops → engine layout store (authoritative, vN+1, persisted WS-2) → broadcast → devices repaint. The headline live-reflection loop.

---

## 13. End-to-end realized journeys (Phase 1)

**J0 First-run & pair (PRD Journey 0).** Install → engine service starts → Desktop UI shows QR → phone scans → handshake (WS-3) → device record + session (WS-4) → assign starter layout → renders. No account.

**J1 Author with live reflection (PRD Journey 1).** Designer targets the iPad → set grid → drag CPU gauge → `AddWidget` op → iPad (edit/preview) shows it instantly → bind `system.cpu.temp` → map `tap→media.play`, `longPress→flow` via schema inspector → done → iPad → runtime mode.

**J2 Gaming-start core (PRD Journey 2, P1 portion).** Gaming layout loads <1 s with live thermals; game tile launches via `launchers`; "Competitive" profile is present (full optimization is P3).

**J3 Notification badge (PRD Journey 3, P1 portion).** Badge reflects OS action-center unread count (full feed/triage P5).

**J4 Build a flow (PRD Journey 4, P1 model/manual).** Author "Cooling Guard" as a flow doc (no visual builder yet — authored via the flow data model/JSON or a minimal P1 form); trigger `stateChange system.cpu.temp > 85`; nodes set Silent profile + notify + dim (smart-home action stubbed/deferred to P4, but the flow runs its available actions). Engine arms the trigger and runs host-side on the crossing.

**J6 Second device, different permissions (PRD Journey 6).** Pair a kitchen tablet; deny power actions + limit categories; assign kitchen layout; engine rejects any forbidden tap regardless of layout.

> J5 (smart home), J7 (remote) are out of Phase 1 (seams only).

---

## 14. Consolidated code structure

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

## 15. Test plan

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

## 16. Milestones & sequencing

| Milestone | Content | Gate |
|-----------|---------|------|
| **M1 Engine skeleton** | WS-1 + WS-2: service boots, SQLite migrates, tray shows status | engine runs as service, survives UI close |
| **M2 Secure session** | WS-3 + WS-4: pair a device, encrypted session, heartbeat/reconnect | phone pairs via QR; reconnect <5 s |
| **M3 Live telemetry** | WS-5 + WS-6: telemetry plugin publishes; client renders a gauge | CPU gauge live on phone; delta broadcast verified |
| **M4 Actions & permissions** | power/volume/launchers; authorize+audit; 2-tap confirm | forbidden device tap rejected + audited |
| **M5 Flows** | WS-7: model + executor + triggers; a stateChange flow runs | Cooling-Guard-style flow fires host-side |
| **M6 Designer** | WS-9: drag-drop, schema inspector, op-log live reflection, undo | drag gauge on PC → appears on tablet <200 ms |
| **M7 Harden** | soak, all ACs, installers for 3 OSes, security tests | Definition of Done (§1) met |

## 17. Risks & mitigations

| Risk | Prob | Impact | Mitigation |
|------|------|--------|-----------|
| mDNS blocked on enterprise/VLAN LANs | Med | Med | Manual + active-scan fallbacks are P1, not optional (2A §3) |
| Per-OS secret store gaps (headless Linux) | Med | Med | Documented encrypted-file fallback + operator note (2E §7) |
| GPU telemetry coverage varies (AMD/Intel) | Med | Med | Provider chain degrades to `unavailable` cleanly (2G) |
| OOP plugin IPC overhead vs NFR budget | Low | Med | Coalesced stateUpdate; delta-only; soak test gates early |
| Designer live-reflection latency >200 ms | Low | Med | Targeted repaint + throttled preview; measured at M6 |
| Crypto suite mis-implementation | Low | High | Use vetted libraries; security test suite; external review before P7 remote |
| Flutter desktop packaging friction (notarization, Linux variants) | Med | Low | `flutter_distributor` + per-OS scripts validated at M7 |

## 18. Acceptance criteria (traced)

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
