# CyberDeck — Architecture Decision Log

**Document 2-ADR of the CyberDeck Enterprise Documentation Set**
Version 0.5 (Draft) · June 2026 · Codebase ID: `com.shishir.cyberdeck`

> This log is **append-only**. ADRs are never deleted; a superseded ADR is marked `Superseded by ADR-XXXX` and kept. Every other document references decisions by ADR ID. Status values: `Accepted`, `Superseded`, `Proposed`, `Rejected`.
>
> Format per ADR: **Context** (the forces), **Decision** (what we chose), **Consequences** (what follows, good and bad), **Alternatives rejected** (and why).

## Index

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

## ADR-0001 — Own the full stack
**Status:** Accepted

**Context.** The original product was a Touch Portal plugin + page pack. That approach capped customization (someone else's host, someone else's page model, someone else's reliability) and could not deliver the live-data widgets, automation depth, or live designer the product needs. Stream Deck and Touch Portal hit the same ceiling; the products that broke past it (Macro Deck, Deckboard) all built their own engine + clients.

**Decision.** Build the entire stack: a host **engine**, a secure **transport**, native **clients**, a **layout language**, and a **plugin SDK**. Retain the prior work that is platform-independent (design system, personas, journeys, feature domains, state-naming conventions); replace only the delivery mechanism.

**Consequences.** Maximum flexibility and a real product moat (the layout language + registries). Much larger build than a plugin. Justifies the federated documentation effort.

**Alternatives rejected.** (a) Continue as a TP plugin — capped, the reason for the pivot. (b) Skin an existing open-source deck — inherits their model and limits.

---

## ADR-0002 — Host-authority model
**Status:** Accepted

**Context.** Multiple devices must show consistent, unambiguous state with no "which device is right?" confusion, and the system must be debuggable.

**Decision.** The engine is the **single source of truth** for all state, layouts, flows, and device records. Clients are deterministic renderers + input forwarders holding no authoritative business logic. Each device is a named, isolated **session** against the one authority.

**Consequences.** Eliminates client/server disagreement; makes resync trivial (ask the authority); enables per-session isolation and per-device permissions. Clients are "thin-ish" — they render and capture, they don't decide. Puts all execution load on the host (acceptable; the host is a real computer).

**Alternatives rejected.** Peer/distributed state — needless complexity for a single-host control surface and a source of the exact confusion we must avoid.

---

## ADR-0003 — Hybrid rendering
**Status:** Accepted

**Context.** Need Stream-Deck-class responsiveness, a gauge/sparkline-heavy UI, *and* the ability to change layouts without shipping app builds, *and* a live designer.

**Decision.** **Declarative layout + native client rendering.** The engine ships a structured layout *description* (widget, placement, binding, behavior); the client owns a **native widget toolkit** and renders it. Engine controls layout/bindings/behavior; client controls pixels.

**Consequences.** Native performance + remote-defined UI + the live designer all fall out of one choice. Requires a well-specified layout language and a client renderer registry (2C). Rejects pixel-streaming.

**Alternatives rejected.** (a) Pixel streaming — laggy, heavy, fails the <100ms budget. (b) Fully client-defined UI — loses central control and the live designer.

---

## ADR-0004 — Client framework = Flutter
**Status:** Accepted

**Context.** One control-surface codebase must run on Android, iOS/iPadOS, Windows, macOS, Linux, render custom real-time visuals (gauges, sparklines, waveforms, the designer canvas) at 60 FPS, and produce native installers for every desktop OS.

**Decision.** **Flutter** for client + Desktop UI + Designer. Its own rendering engine (Skia/Impeller) suits custom high-frequency drawing; it builds native packages for all six surfaces.

**Consequences.** One renderer, one widget toolkit, one layout interpreter everywhere. Native `.exe`/`.msi`, `.dmg`/`.pkg`, `.deb`/`.rpm`/`.AppImage`, `.apk`/`.aab`, `.ipa` via standard tooling.

**Alternatives rejected.** (a) **Electron** desktop — Chromium-per-window is too heavy for a 24/7 host (against <150MB/<2% NFR), weak at the systems work, and would *split the client codebase*. (b) **Expo/React Native** mobile — forces the client to RN (wrong engine for custom real-time drawing), covers only 2 of 6 targets. (c) .NET MAUI — no official Linux. (d) Compose Multiplatform — iOS still maturing.

---

## ADR-0005 — Engine = Go; two-process/one-installer
**Status:** Accepted

**Context.** The host needs a long-running background service: telemetry polling, per-session fan-out to N devices, flow execution, crypto, plugin supervision — at <150MB RAM / <2% idle CPU — that **keeps running when the UI window is closed** and **starts on boot**, while the user still needs a desktop UI to author in. Native installers required for every desktop OS.

**Decision.** Engine in **Go**, compiled to a native per-OS binary, installed as a **background service** (Windows Service / launchd / systemd). The **Flutter Desktop UI** (Designer + control view) is a *separate process* and a *client* of the engine. One installer drops both; closing the UI leaves the engine running; a tray presence manages it. Local UI↔engine uses the same loopback protocol as remote clients **plus a privileged local control channel** for service lifecycle and pairing approval.

**Consequences.** "Runs in background," "starts on startup," and "headless-capable" all derive from the engine being a standalone service rather than UI-embedded code. Go's goroutine model fits per-service/per-session concurrency. Removes the old Python/PyInstaller packaging pain.

**Alternatives rejected.** (a) **Rust + Tauri** — viable but Tauri reintroduces a webview renderer + second client toolkit (same flaw as Electron); Go cross-compiles to native binaries just as cleanly and builds faster. (b) Engine embedded in the UI process — breaks "runs when app closed."

---

## ADR-0006 — All capabilities are out-of-process plugins (including first-party)
**Status:** Accepted

**Context.** Plugins must be crash-isolated (incumbents are fragile). First-party capabilities (telemetry, media, power, etc.) could run in-process for simplicity while third-party run out-of-process — but that creates two execution models.

**Decision.** **All capabilities outside the engine core execute through the plugin host, out-of-process. First-party and third-party plugins share one lifecycle, IPC contract, permission model, and isolation boundary.** Whether a plugin ships from CyberDeck or a community author is **metadata, not architecture.** The engine core contains **no capability-specific business logic** — only transport, state store, flow engine, security, persistence, and registries (plus the plugin host).

**Consequences.** One runtime to build, test, debug, and secure. "Plugins are isolated" is true for the plugins that matter most. A first-party capability becoming community-extensible is a metadata change, not a rewrite. Every API change validates against one runtime. Cost: first-party capabilities pay IPC overhead from day one (acceptable; bounds the architecture honestly). The out-of-process host is therefore **P0/Phase 1**, not deferred.

**Alternatives rejected.** In-process first-party + out-of-process third-party — two lifecycles, two IPC assumptions, two debugging paths, two permission enforcements, and "architectural hypocrisy" (isolation false for core capabilities). Rejected.

---

## ADR-0007 — PAL ⊥ plugin host
**Status:** Accepted

**Context.** Two orthogonal concerns risk being conflated: *which implementation answers a capability* (and the fallback order) versus *how that code is executed and isolated*.

**Decision.** The **PAL** defines **capability interfaces and provider-priority chains** (e.g. `gaming.fps`: native → PresentMon → FrameView → RTSS → vendor APIs → unavailable). The **plugin host** defines **execution and isolation**. They compose: a capability provider is *both* a PAL provider-chain entry *and* code inside a plugin process. The host probes a capability's chain, binds the highest-available provider, and exposes one interface upward; absence of all providers reports **unavailable** (graceful, never a crash).

**Consequences.** No single external dependency (e.g. an FPS overlay tool) can block the system. Provider selection and process isolation evolve independently. Cross-platform "unavailable" (e.g. PresentMon is Windows-only) is a normal outcome, not a gap.

**Alternatives rejected.** Single hard-coded provider per capability (the old `FPS = RTSS` model) — a single point of failure and untestable across hardware.

---

## ADR-0008 — Identity = keypair + UUID, account-independent
**Status:** Accepted

**Context.** Devices must be unambiguously identifiable across IP/MAC churn (modern iOS/Android randomize MAC per network; DHCP rotates IPs), and local use must require no account.

**Decision.** On first launch each device and the engine generate an **Ed25519 keypair + stable UUID**. Pairing binds **mutual trust** (store the other's public key + UUID + label + class). IP/MAC are **locator hints only**, never identity. **Identity exists from first launch independent of any account.**

**Consequences.** Robust identity through network change; "no confusion which device" via UUID-keyed sessions; the architectural precondition for free, account-free local use (ADR-0016). Requires keypair generation/storage on every device (2E).

**Alternatives rejected.** (a) MAC binding — randomized, unreliable. (b) IP binding — rotates. (c) Account-derived identity — breaks local-first and contaminates identity with licensing.

---

## ADR-0009 — E2E encryption on all traffic, built for remote from day one
**Status:** Accepted

**Context.** Even LAN traffic can be sniffed (shared Wi-Fi, hostile networks). Retrofitting encryption later is a rewrite.

**Decision.** **All session traffic is encrypted and authenticated, including on LAN**, over the established device keys. The crypto and pairing are designed for remote from the start, so the future relay phase changes only the *endpoint*, not identity/crypto/sessions.

**Consequences.** Secure by default; remote is additive (ADR-0010). Slight per-message crypto cost (negligible on modern hardware). Exact primitives specified in 2E.

**Alternatives rejected.** Plaintext-on-LAN with encryption added for remote later — a protocol rewrite and a security hole in V1.

---

## ADR-0010 — Transport endpoint abstraction
**Status:** Accepted

**Context.** LAN-only now, remote later, without re-architecting.

**Decision.** All addressing goes through a **`TransportEndpoint`** resolved by a **`ConnectionManager`**. In V1 every endpoint resolves to a direct LAN socket. The remote phase adds a relay-backed endpoint type. **Nothing above the ConnectionManager** (engine, sessions, channels, document/state model) knows which kind it is.

**Consequences.** Remote access becomes a new endpoint implementation + relay infra, not a core change. Single most important forward-compat seam.

**Alternatives rejected.** Hard-coded LAN sockets throughout — would force a transport rewrite for remote.

---

## ADR-0011 — Three logical channels
**Status:** Accepted

**Context.** Structural layout edits, high-frequency telemetry, and live-drag previews have incompatible durability/cadence needs.

**Decision.** One secure session carries **three logical channels**: **Layout** (durable, versioned structural ops + action/interaction events), **State** (ephemeral delta state updates, 0.5–10s), **Preview** (ephemeral throttled edit previews, 30–60Hz, never persisted).

**Consequences.** A per-second CPU update never touches the layout tree; a live-drag preview never pollutes durable history. Clean separation enables a future binary codec on State only (ADR-0015).

**Alternatives rejected.** Single undifferentiated stream — couples cadences, risks desync, pollutes history.

---

## ADR-0012 — Operation-log layout sync
**Status:** Accepted

**Context.** Layout edits must reflect on devices instantly, support undo/redo, sync to many devices, and leave room for future collaboration.

**Decision.** Every edit is a **versioned operation** applied to the authoritative document and broadcast to subscribed sessions, which **repaint only affected widgets**. Each document has a **monotonic version**; clients track last-applied and request a full resync on a gap. V1 uses a single-writer edit lock.

**Consequences.** Instant reflection, undo/redo (op inverses), multi-device fan-out, and a collaboration substrate (ADR-future) all from one mechanism. Live drag = ephemeral Preview ghosts + one durable op on drop.

**Alternatives rejected.** (a) Full-document push per edit — wasteful, no granular repaint. (b) CRDT/OT in V1 — premature; the op-log supports adding it later.

---

## ADR-0013 — Full conditional flow/macro engine
**Status:** Accepted

**Context.** Incumbent logic is weak (Touch Portal needs nested IFs for a 3-state toggle; Stream Deck has only linear multi-actions). The "Builder" persona needs real branching, variables, loops.

**Decision.** Ship a **full conditional flow/macro engine**: a node graph (`action, if/else, setVar, wait, loop, navigate, random, subflow, stop`), a **sandboxed expression language** (interpolation + comparison + boolean + arithmetic, no arbitrary code execution), typed global `var.*` + per-run local scope, and triggers (`manual, event, stateChange`; `schedule` reserved). Flows execute **host-side**; clients only trigger. The data model + executor + core nodes are **V1**; the visual builder UI is a later phase over the same model.

**Consequences.** Differentiator vs incumbents; the event architecture becomes a *consumer* of the flow engine. Expression sandbox is a security boundary (flows are shareable content). Node palette extends via the same registry pattern (plugin nodes later).

**Alternatives rejected.** (a) Linear macros only — fails the Builder persona. (b) Embedding a general scripting language (Lua/JS) — security and sandboxing burden; the constrained expression language is safer and sufficient.

---

## ADR-0014 — Persistence = SQLite + in-memory
**Status:** Accepted

**Context.** Durable data (documents, registries, variables, audit log, workflows, devices, accounts) needs indexing/transactions/history queries; high-frequency telemetry must not hit disk.

**Decision.** **SQLite** is the single durable store (no KV/SQL split). **Live state** (telemetry, sparkline ring buffers) stays **in-memory** and never writes on the hot path; it crosses to SQLite only when durable (a flow writing `var.*`, or an audit event). Audit log is **append-only** with a flexible `payload_json` column.

**Consequences.** The inevitable history queries ("variables changed by workflow X in 7 days") are trivial SQL. Idle-CPU NFR protected (no per-tick disk write). Single embedded file, no server.

**Alternatives rejected.** (a) Embedded KV — hand-rolled indexes/queries as requirements evolve; the audit log is the deciding factor for SQL. (b) Persisting telemetry — blows the idle-CPU budget.

---

## ADR-0015 — Serialization = JSON for V1 behind an abstraction
**Status:** Accepted

**Context.** Need debuggability now; possible bandwidth optimization later.

**Decision.** **JSON throughout V1**, behind a channel-level **`Serializer`** abstraction (`Serializer → {Json, Binary}`). A future compact codec (MessagePack/CBOR/Protobuf) can apply to **only the State channel** without touching call sites.

**Consequences.** Failed automations are inspectable as readable JSON in logs; universal tooling. No premature binary-codec work. Binary deferred until profiling proves need (realistically only State channel would ever warrant it).

**Alternatives rejected.** Binary codec in V1 — creates an observability problem for a saving the product won't notice on LAN.

---

## ADR-0016 — Identity ≠ licensing
**Status:** Accepted

**Context.** Device-count/platform-locked licensing (the incumbent model) contaminates the identity layer and drives angry users + support burden.

**Decision.** **Local use is free and account-free, forever.** An **account is an optional overlay** required only for cloud services (sync, backup, remote, team). **Licensing attaches to the account, not devices**; a paid user uses multiple personal devices freely. **Device-count restrictions and platform-locked purchases are explicit non-goals.** Architecturally, identity (ADR-0008) must not depend on an account existing.

**Consequences.** Minimal friction; identity stays clean; cloud features have a natural paywall users accept. The only V1 obligation is account-independent identity (already met).

**Alternatives rejected.** Per-device or per-platform licensing — documented incumbent pain point; makes the architecture licensing-first.

---

## ADR-0017 — Per-device-class authored layouts
**Status:** Accepted

**Context.** A dense gauge/neon UI cannot auto-reflow gracefully across a phone, a 10" tablet, and an ultrawide.

**Decision.** Layouts are **authored against a specific device class** (grid/orientation/reference resolution) and assigned to devices of that class. **No automatic cross-form-factor reflow in V1.**

**Consequences.** No reflow-breakage; you design for the screen you target. Multiple device classes mean multiple authored layouts. Adaptive/responsive layouts remain a later candidate over the same `DeviceClass` model.

**Alternatives rejected.** Author-once-auto-reflow — much more "magic," much more breakage risk for this UI style.

---

## ADR-0018 — Desktop-only authoring (permanent)
**Status:** Accepted

**Context.** Authoring needs the precision of a large screen and pointer; on-device editing would double the input/UX surface and dilute focus.

**Decision.** **Authoring is desktop-only and permanent.** Clients render and interact; they never edit layouts.

**Consequences.** Clean client (no editor code paths); single authoring surface to polish. Designer always names its explicit target device. Not revisited as a phase.

**Alternatives rejected.** On-device editing — significant extra work, diluted product focus, and unnecessary given the desktop is always present (it hosts/accompanies the engine).

---

## ADR-0019 — Typed states; formatting is presentation
**Status:** Accepted

**Context.** The prior design stored everything as formatted strings ("42.0 °C"). The flow engine must compare values numerically (`cpu.temp > 85`).

**Decision.** States are **typed** (`scalar/number, text, boolean, enum, series`) and namespaced. **Display formatting (units, precision) is a presentation concern** held in the widget/style, not baked into the stored value.

**Consequences.** Flow conditions and gauges use the raw number; labels format for display. A real departure from the scrapped docs, captured deliberately.

**Alternatives rejected.** Formatted-string states — break numeric comparison in flows and conflate data with presentation.

---

## ADR-0020 — Federated TRD set + append-only ADR log
**Status:** Accepted

**Context.** A single TRD at the required depth would reach many hundreds of pages and become unnavigable; decisions accrue across subsystems and time.

**Decision.** A **federated TRD set**: a **TRD Master** (Document 2, cross-cutting architecture + conventions + ADR index) plus **subsystem TRDs** (2A Transport, 2B Engine Core, 2C Layout & Designer, 2D Flow Engine, 2E Security & Identity, 2F Plugin Architecture, 2G PAL). All decisions live in this **append-only ADR log** (2-ADR), referenced by ID from every document. Shared conventions (ID schemes, requirement grammar, message envelope, versioning) live in the Master and are inherited.

**Consequences.** Each subsystem doc stays navigable and independently ownable; the ADR log is the single decision registry; cross-references are stable by ID. Slight overhead maintaining the index and conventions front-matter.

**Alternatives rejected.** One monolithic TRD — unnavigable at the target depth.

---

## ADR-0021 — Binary asset delivery: content-addressed fetch + client cache
**Status:** Accepted (introduced Phase 2)

**Context.** Album art (and later game covers, camera thumbnails) is binary and must reach **remote clients that do not share the host filesystem**. The Phase-1 "local file URL" approach only works when client == host. Binary data must not ride the high-frequency JSON State channel (base64 per tick is wasteful and breaches budgets), and must not violate the three-channel model (ADR-0011).

**Decision.** **Content-addressed asset delivery with client-side caching.** The engine hashes each asset (e.g. SHA-256) and publishes a small **asset reference** as an ordinary state (`media.albumart.ref = "sha256:…"`). A client lacking the asset issues a typed **`assetRequest{ref}`** over the session; the engine replies with **`assetResponse{ref, mime, bytes}`** (length-framed binary, chunked if large). Clients cache by hash, so identical assets transfer **once per device, ever**. This is a request/response message pair over the existing session — **not** a new always-on channel — preserving ADR-0011.

**Consequences.** Art reaches remote phones; repeats are instant; metadata latency (NFR-04) is unaffected (metadata renders immediately, art progressively). The mechanism is capability-agnostic and is **reused by Phase 3 (game covers) and Phase 5 (camera thumbnails)** — built once. Asset bytes live in the host temp/asset cache (bounded LRU/TTL), not SQLite (binary, ephemeral, cheap to re-fetch).

**Alternatives rejected.** (a) Base64 art in State updates — wasteful, breaches budgets, pollutes the delta stream. (b) A separate persistent binary channel — over-engineered; request/response suffices and keeps the channel model intact. (c) Host-local file URLs — fail for remote/non-host clients (the whole problem).


---

## ADR-0022 — Flow-document op model (persist-and-rearm, no device broadcast)
**Status:** Accepted (introduced Phase 3)

**Context.** The layout designer edits via an op-log that **broadcasts to devices** for live reflection (ADR-0012). The Phase-3 visual flow builder needs undo/redo and versioning too — but **flows execute host-side and are never rendered on a device**, so live device broadcast is meaningless for them.

**Decision.** The flow builder edits the flow document with a **local op model** (`AddNode, RemoveNode, ConnectEdge, SetNodeParams, SetTrigger, …`) that has **inverses (undo/redo)** and **monotonic versioning** like the layout op-log, but **commits persist to `workflows` (2B) and re-arm triggers** instead of broadcasting on the Layout channel. Same op-model *shape*, different *delivery*: persist-and-rearm vs persist-and-broadcast.

**Consequences.** Consistent undo/redo and versioning across both authoring surfaces (layout + flow), with an honest reflection that flows are not a live device surface. The Phase-8 collaboration substrate (op-log) still applies to flows if ever wanted.

**Alternatives rejected.** (a) Reuse the broadcasting layout op-log verbatim — sends meaningless ops to devices. (b) No op model for flows (save whole document each edit) — loses cheap undo/redo and granular history.

---

## ADR-0023 — Elevated/privileged action gating with partial-success degradation
**Status:** Accepted (introduced Phase 3)

**Context.** Gaming/system actions (process priority of others, `EmptyWorkingSet`, power-plan changes, fan writes, kill process) require OS elevation. On locked-down/corporate machines elevation may be unavailable. The system must never crash or silently fail.

**Decision.** Extend the action registry descriptor with an **`elevated`** flag (alongside `destructive`). The engine service executes elevated actions **within the privilege level granted at install**. Where elevation is unavailable, an elevated action **executes the subset it can and reports partial success** — never a silent failure, never a crash. Every elevated action is **audited with its elevation outcome**.

**Consequences.** Honest behavior across privilege environments; corporate machines degrade gracefully. Game profiles apply as **transactional bundles** (each step has an undo closure; failure rolls back completed steps) and revert on profile switch/shutdown so the machine isn't left in an extreme state.

**Alternatives rejected.** (a) Require admin to run the engine — too heavy a demand for a control surface; breaks the low-friction promise. (b) Silently skip un-permitted steps — opaque and untrustworthy.

---

## ADR-0024 — Network flow node permission (off by default; imported flows inert)
**Status:** Accepted (introduced Phase 3)

**Context.** The Phase-3 `httpRequest` flow node can call arbitrary endpoints — an exfiltration/SSRF surface. Flows are **shareable content** (Phase-2 import; future marketplace), so a malicious shared flow could phone home if network access were implicit.

**Decision.** The `httpRequest` node requires an explicit **`flow.network` permission, off by default**, granted by a deliberate user action with a clear warning in the builder. An **imported** flow containing an `httpRequest` node is **inert until the user reviews and grants** network permission for it. HTTP nodes are **audited** (request host, not body; secrets redacted).

**Consequences.** Upholds the no-exfiltration product stance (2E TB-4/TB-5) while still offering the power of HTTP automation — explicitly, opt-in, user-authored. Marketplace flows (P6) inherit this gate automatically.

**Alternatives rejected.** (a) Implicit network access for http nodes — silent exfiltration risk on shared flows. (b) Banning the http node — removes a major automation capability the Builder persona wants.

---

## ADR-0025 — External-integration connection lifecycle & entity mapping pattern
**Status:** Accepted (introduced Phase 4)

**Context.** Home Assistant is the first integration with an **external, networked, credentialed third-party system**. Its connection handling, credential storage, real-time updates, and failure behavior will be repeated by every future integration, so the pattern should be specified once.

**Decision.** A reusable external-integration pattern: (1) **non-secret config** (base URL) in `config.json`, **secret (token) in the OS secure store** (2E §7), never plaintext; (2) a per-integration **connected/degraded/error** connection state mirroring the device-connection contract (2A §7.3), with entities following the integration's health; (3) **dual transport** — REST for actions/initial fetch + a **WebSocket/event push** for real-time updates, with a **timed REST poll fallback** when push is unavailable; (4) every external call has a **bounded timeout → error state** (no hangs); (5) external entities map to **dynamically-created typed states** keyed by a stable external ID so layouts survive reconnects; (6) the integration is an **out-of-process plugin** (ADR-0006) with `network: outbound` permission.

**Consequences.** Smart home (and every later integration) degrades gracefully, stores secrets safely, updates in real time, and survives restarts without breaking layouts. The whole smart-home domain is delivered with near-zero engine-core change — the plugin architecture validated on a real external system.

**Alternatives rejected.** (a) Poll-only (no event push) — laggy, wasteful. (b) Token in config/SQLite — violates 2E. (c) Building HA into the core — violates ADR-0006 and wouldn't generalize to other integrations.

---

## ADR-0026 — Periodic/streamed asset frames (refresh policy on ADR-0021)
**Status:** Accepted (introduced Phase 5)

**Context.** ADR-0021 handles *static* assets (album art: fetch once, cache by hash forever). Camera previews are *changing* images — a fresh frame every few seconds — which would either flood the session or pollute the static-asset cache with thousands of permanent single-use entries.

**Decision.** A **periodic-frame refresh policy layered on ADR-0021**: a camera tile binds a frame source with a configurable refresh interval; each refresh fetches a frame, hashes it, updates a `frame.ref` state, and the client pulls it via the existing `assetRequest` path. Frame cache is **short-TTL and tile-bounded** (latest 1–2 frames per tile, immediate eviction) — separate from the long-lived static-asset cache. Refresh runs **only while a tile is visible on a connected session** (subscription-gated), and frames degrade to a dimmed last frame + offline badge on failure.

**Consequences.** Camera previews reuse the asset transport without unbounded growth or static-cache pollution; off-screen cameras cost nothing; bandwidth is bounded by interval. Full live video (RTSP/HLS) playback remains deferred — this delivers periodic thumbnails only.

**Alternatives rejected.** (a) Treat each frame as a permanent static asset — unbounded cache growth. (b) Always-on frame push — wastes bandwidth on off-screen cameras. (c) A separate video channel — out of scope; thumbnails suffice for previews.

---

## ADR-0027 — Plugin signing & trust tiers
**Status:** Accepted (introduced Phase 6)

**Context.** Opening plugins to third parties (Phase 6) introduces untrusted code. First-party plugins shipped trusted-by-default since Phase 1; third-party needs verification without creating a second execution model (ADR-0006 forbids that).

**Decision.** **Trust tiers driven by signature, not by a binary first/third split.** First-party = signed by CyberDeck, installer-trusted. Verified third-party = signed by a registered developer key, signature-verified at install/update, permissions user-reviewed. Unverified/sideloaded = no recognized signature, explicit risk gate, strictest sandbox, no trusted permission defaults. Trust tier affects **permission defaults, sandbox tightness, and UX labeling only** — never the execution contract.

**Consequences.** Untrusted code is gated and confined without forking the architecture; "first-party = third-party, metadata differs" (ADR-0006) holds. Permission-changing updates force re-review; non-permission updates verify silently.

**Alternatives rejected.** (a) Trust all installed plugins equally — unsafe for sideloaded code. (b) A separate runtime for untrusted plugins — violates ADR-0006's one-model rule.

---

## ADR-0028 — Plugin sandboxing model
**Status:** Accepted (introduced Phase 6)

**Context.** Out-of-process isolation (ADR-0006) prevents a plugin crash from killing the engine, but does not by itself confine what a plugin *does* (filesystem, network, OS capabilities) — needed once third-party code runs.

**Decision.** **OS-level process confinement layered on out-of-process isolation, scaled by trust tier (ADR-0027)**, behind a single `PluginSandbox` interface implemented per OS (restricted tokens/job objects on Windows; sandbox profiles/entitlements on macOS; namespaces/seccomp/cgroups on Linux). Confinement: filesystem limited to the plugin's data dir + granted paths (never the SQLite/secret stores or other plugins' data); network denied unless declared+granted (ADR-0024 generalized); only declared+granted PAL capabilities; per-plugin CPU/RAM limits. Where OS sandboxing is unavailable, degrade to **isolation-only with a clear warning**. Sandbox denials are audited.

**Consequences.** A malicious/buggy plugin cannot crash the engine, exceed permissions, or exfiltrate; violations are recorded. Permission grants map to sandbox allowances. Provider-chain/degradation discipline (ADR-0007) applies to the sandbox capability itself.

**Alternatives rejected.** (a) Isolation-only (no confinement) — insufficient for untrusted code. (b) In-process sandboxing — impossible to confine safely; contradicts ADR-0006.

---

## ADR-0029 — Plugin-provided UI as portable descriptors
**Status:** Accepted (introduced Phase 6)

**Context.** Plugins are engine-side (Go, out-of-process) but need to contribute **client-side (Flutter) widgets**. Shipping third-party Flutter code into the client would be a code-execution surface on user devices — unacceptable.

**Decision.** **Plugin-provided UI is declarative data, not code.** A plugin registers a widget type as a **composition of built-in render primitives** (container, text, image/asset, gauge, sparkline, bar, icon, slider, toggle) plus a layout + binding spec referencing the plugin's states/actions. The trusted client renderer interprets the descriptor into a native tree; **no third-party code ever executes on a client device.** Bespoke custom-drawn widgets beyond primitive composition are out of scope; expanding the primitive vocabulary is the safe lever.

**Consequences.** Third parties create genuinely new widget *types* (novel compositions/bindings) with native performance and zero client-side code risk. `valueRules` and interaction slots work unchanged (already declarative). The client gains a descriptor interpreter alongside its hardcoded built-in builders.

**Alternatives rejected.** (a) Ship third-party UI code to clients — code-execution risk on user devices. (b) Server-rendered/pixel-streamed plugin widgets — laggy, contradicts ADR-0003. (c) No plugin widgets — cripples the ecosystem.

---

## ADR-0030 — Blind relay/rendezvous architecture
**Status:** Accepted (introduced Phase 7)

**Context.** Remote access (outside the LAN) needs a way to locate and reach an engine when mDNS (LAN-only) and direct connectivity (NAT/firewalls) don't apply — without the cloud ever seeing user data.

**Decision.** A **blind relay + rendezvous** service — the product's first and only cloud server, deliberately minimal. **Rendezvous**: engines register reachability by UUID; remote clients resolve their paired engine. **Relay**: forwards **ciphertext only** between client and engine; the E2E session keys (ADR-0009) are negotiated end-to-end through the relay, so the relay is a dumb pipe that cannot read media/telemetry/actions. The CyberDeck handshake (2E) runs end-to-end through the relay exactly as on LAN.

**Consequences.** Remote works through hostile NATs; a relay compromise leaks at most traffic metadata, never plaintext. The cloud component carries no application logic. Rendezvous also serves as the signaling channel for NAT hole-punching (direct preferred, relay fallback).

**Alternatives rejected.** (a) A smart relay that terminates encryption — would see plaintext; unacceptable. (b) Port-forwarding/DDNS only — fragile, user-hostile, fails on symmetric NAT. (c) No remote — fails a stated future requirement.

---

## ADR-0031 — Account overlay & licensing enforced only at the cloud boundary
**Status:** Accepted (introduced Phase 7)

**Context.** Remote/backup/sync need an account, but local use must stay free and account-free (ADR-0016), and licensing must never contaminate identity (ADR-0008).

**Decision.** The account is an **optional overlay** that **references** engine/device UUIDs for cloud services; it never owns identity, and deleting it doesn't affect local function. **Licensing is enforced only at the cloud boundary** (rendezvous/relay/backup APIs) — never in the local engine. A lapsed subscription disables remote/backup/sync and nothing else. **Device-count is never enforced**; a paid account uses any number of personal devices.

**Consequences.** Local-first promise intact (install, run, use forever, no account); cloud features have a natural, accepted paywall; identity stays clean. The engine's cloud client is inert without an account and changes nothing locally by its absence.

**Alternatives rejected.** (a) Account required for the app — breaks local-first. (b) Local licensing checks — contaminate identity, create the incumbent's pain. (c) Device-count limits — explicit non-goal (ADR-0016).

---

## ADR-0032 — Remote security hardening & relay trust
**Status:** Accepted (introduced Phase 7)

**Context.** Remote access widens the attack surface (relay, rendezvous, accounts, WAN exposure) beyond the V1 LAN threat model (2E §8 deferred these).

**Decision.** Harden at the new edges without weakening the E2E core: relay is **blind** (ADR-0030); **remote is off by default** and enable-able **only via the privileged local channel** (a remote attacker can't enable it); rendezvous has **rate/bandwidth limits + anomaly logging**; **remote devices remain ordinary permissioned/audited devices** (2E §5) with an **optional stricter remote permission profile** (e.g. deny power actions off-LAN); replay/abuse defeated by existing session nonces + forward secrecy plus connection-level limits. Threat-model additions: relay compromise (metadata only), rendezvous abuse (limited), credential stuffing (account controls), remote DoS (limits).

**Consequences.** Remote is safe-by-default and least-privilege; the E2E core is untouched. Users can be stricter for off-LAN sessions.

**Alternatives rejected.** (a) Remote on by default — dangerous. (b) Trusting the relay — contradicts ADR-0030. (c) Granting remote devices extra capability — violates the permission model.

---

## ADR-0033 — CRDT/OT collaboration layered on the op-log
**Status:** Accepted (introduced Phase 8, candidate)

**Context.** Real-time multi-author editing is a desired advanced capability. V1 used a single-writer edit lock (2C §4.3) — explicitly a simplification chosen so collaboration could be added later.

**Decision.** Layer **operational transformation or a CRDT** onto the **existing op-log** (ADR-0012). Operations are already discrete, versioned, and invertible — the prerequisites — so collaboration is a **convergence layer over the same operation set**, not a new sync model. Merged ops broadcast on the same Layout channel (live reflection unchanged); the approach extends to flows (ADR-0022's flow op-model). OT-vs-CRDT chosen at a design spike (CRDT favored for offline-tolerant merge).

**Consequences.** Collaborative editing without a foundational rewrite — the op-log's intended payoff. The single-writer lock is replaced (it was always a placeholder). Presence/cursors are additive UI.

**Alternatives rejected.** (a) A separate collaboration backend — wasteful; the op-log already fits. (b) Keep single-writer forever — forecloses a planned capability.

---

## ADR-0034 — Adaptive layouts: opt-in authored base + explicit rules
**Status:** Accepted (introduced Phase 8, candidate)

**Context.** Per-device-class authored layouts (ADR-0017) avoid ugly auto-reflow but require authoring per class. Some users want broader coverage from less authoring.

**Decision.** Adaptive layout is **opt-in and explicit**: one **authored base** layout plus **author-written adaptation rules** (show/hide by tag, re-flow within a target grid, swap widget variants) that **derive** per-class layouts (normal documents, so rendering/op-log/reflection are unchanged). **ADR-0017 remains the default**; adaptive and per-class authoring coexist per profile, and derived layouts can be hand-tweaked.

**Consequences.** Breadth for users who accept compromise, without imposing silent reflow on everyone or breaking the dense-UI default. Author stays in control (rules, not inference).

**Alternatives rejected.** (a) Silent auto-reflow as default — breaks dense neon UIs (the original rejection). (b) No adaptive option ever — leaves multi-form-factor users authoring everything by hand.

---

## ADR-0035 — Cross-engine multi-bind & switching (not federation)
**Status:** Accepted (introduced Phase 8, candidate)

**Context.** A user may own several engines (desktop + laptop) and want one device to reach all of them. The product's core value is "no confusion which device/engine."

**Decision.** A device may **bind multiple engines** (identity already supports it — trust is a set keyed by engine UUID, ADR-0008 §3.3) and **switch** between them, with **one active engine at a time** and an **always-visible active-engine label**. This is **switching, not federation** — engines are never merged; each stays isolated and authoritative (ADR-0002). Bound engines may be LAN or remote (the endpoint abstraction handles both).

**Consequences.** Multi-engine convenience without reintroducing ambiguity. Mostly client-side session management over existing identity/transport.

**Alternatives rejected.** (a) Federating/merging engine state — recreates the exact confusion the product exists to avoid. (b) One-engine-per-device only — needlessly limiting for multi-machine users.

---

*End of Architecture Decision Log (Draft v0.5). 35 decisions recorded. Append new ADRs here as decisions are made; update the index and any superseded statuses.*
