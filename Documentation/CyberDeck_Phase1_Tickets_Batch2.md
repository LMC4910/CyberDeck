# CyberDeck — Phase 1 · Ticket Breakdown (Batch 2)

**Execution-system Document 3 of N** · Version 0.1 (Draft) · June 2026 · `com.shishir.cyberdeck`
Default assignee: **Claude**

> Full implementation-ready tickets for **EPIC-4 (Transport & Connectivity / WS-4)** and **EPIC-6 (State Store, Registries & Event Bus / WS-6)**. These are the middle of the critical path: EPIC-6 is the data hub everything binds to, and EPIC-4 carries it to devices. Conventions (validation gates, completion checklist, branch/PR) are inherited from Batch 1 Part B.
>
> Grounded in TRD 2A (transport), 2B §2–§5 (state/registries/sessions), and the ADR log. One ticket here (PROJ-160) is Ready-now; the rest unblock as their deps land.

---

# EPIC-6 — State Store, Registries & Event Bus (WS-6)

> Built before most of EPIC-4's higher functions because transport fan-out (PROJ-150) and the plugin host both bind to the state store and registries. PROJ-160 is the single Ready-now ticket in this epic.

---

## PROJ-160 — Typed state model + state store core

**Summary:** The authoritative in-memory store of typed live state values, with delta suppression and series ring buffers.

**Objective:** A `state` package implementing the `State` model (2B §2.1), `Set` with change-detection + dirty-marking + event emission + fan-out enqueue, and in-memory series ring buffers.

**Context:** TRD 2B §2 / ADR-0019. **Typed values, not formatted strings** — so flows compare numerically and gauges use raw numbers. Series buffers are in-memory only, never persisted (ADR-0014).

**Technical Requirements:**
- `State{ID, Kind(scalar|text|boolean|enum|series), ValueType, Unit, Value any, Series *RingBuffer, UpdatedAt, Source}`.
- `Set(id, value)`: if unchanged → no-op (delta suppression); else update value+UpdatedAt, push to ring buffer if series, mark dirty, emit `state.changed` to the event bus (PROJ-162), enqueue delta for fan-out (PROJ-150).
- `RingBuffer` fixed-size (e.g. 60), in-memory.
- `Get(id)`, `Snapshot()`, and a dirty-set drain for the fan-out path.

**Acceptance Criteria:**
- Setting an unchanged value is a no-op (no event, no delta).
- Setting a changed value updates, marks dirty, emits, and (for series) appends to the ring buffer.
- Series buffers are never persisted (verified — no SQLite write path).
- Typed values preserved (a number stays a number).
- Unit tests: change-detection, series append/eviction, typed round-trip, dirty drain.

**Implementation Notes:** Event bus (PROJ-162) and fan-out (PROJ-150) may not exist yet — inject them as interfaces (no-op fakes in tests). Keep the store lock-efficient (it's on the telemetry hot path; protect the idle-CPU NFR).

**Testing Requirements:** Unit: delta suppression; series ring buffer; typed values; concurrent `Set` safety (race detector).

**Deliverables:** `engine/core/state/{store.go,state.go,ringbuffer.go,subscriptions.go,delta.go}`, tests.

**Dependencies:** none (Ready now). **Effort:** 3 pts (~4h), medium.

**Agent Instructions:** Implement the model + `Set` pipeline + ring buffer + dirty drain against event-bus/fan-out interfaces; test with race detector.

**Expected Files:** `engine/core/state/*`, tests.

**Validation Commands:**
```bash
cd engine && go vet ./... && golangci-lint run && go test -race ./core/state/... && go build ./...
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## PROJ-161 — Registries: action / widget / flow-node (schema-driven)

**Summary:** Three parallel schema-driven registries (action, widget-type, flow-node), populated by plugin manifests, queryable for the designer.

**Objective:** Implement 2B §3: register/validate/merge contributions, reject ID collisions, expose queries (by category, by accepted state kind, etc.).

**Context:** TRD 2B §3 / ADR-0006. **The keystone**: the designer reads these schemas to auto-generate its UI (PROJ-214). First-party and third-party register identically.

**Technical Requirements:**
- Three registries with descriptors per 2B §3.1/3.2/3.3 (action: id/label/category/params[type+min/max+choices]/destructive/elevated; widget: type/acceptsStateKinds/configSchema/gestures; flow-node: kind/params/exec-handle).
- `Merge(contributions)` validating against the schema-of-schemas; **reject ID collisions** with a diagnostic.
- Query API: `ActionsByCategory`, `WidgetsAcceptingKind`, `Action(id)`, etc.
- Persist merged items to `registry_items` (PROJ-112).

**Acceptance Criteria:**
- Valid contributions merge and are queryable.
- Duplicate ID rejected with a clear diagnostic.
- Param/config schemas validate (bad schema rejected).
- Queries back the designer's pickers (**AC P1-AC-10 backing**).
- Unit tests: merge, collision, query, bad-schema.

**Implementation Notes:** Define the JSON schemas in `shared/schemas/` (the placeholders from PROJ-101 become real here). Keep the registry the single source of truth; engine + client validate against these.

**Testing Requirements:** Unit: merge/collision/query/bad-schema; persistence round-trip.

**Deliverables:** `engine/core/registry/{actions.go,widgets.go,flownodes.go,merge.go,query.go}`, `shared/schemas/*`, tests.

**Dependencies:** PROJ-160, PROJ-112. **Effort:** 3 pts (~4h), medium.

**Agent Instructions:** Define schemas; implement the three registries + merge + query + persistence; test all paths.

**Expected Files:** `engine/core/registry/*`, `shared/schemas/*`, tests.

**Validation Commands:**
```bash
cd engine && go vet ./... && golangci-lint run && go test ./core/registry/... && go build ./...
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## PROJ-162 — Event bus

**Summary:** Internal pub/sub decoupling producers (state changes, plugin/lifecycle events) from consumers (flow triggers, audit, fan-out).

**Objective:** Implement 2B §4: topic-based, ordered per topic, non-blocking with bounded queues.

**Context:** TRD 2B §4. The flow engine subscribes for event/stateChange triggers; audit and fan-out subscribe too.

**Technical Requirements:**
- Topics: `state.changed`, `threshold.crossed`, `device.*`, `plugin.*`, `session.*`, `flow.*`.
- `Publish(topic, payload)`, `Subscribe(topic) <-chan Event`.
- Ordered per topic; bounded per-subscriber queue; overflow policy logged (slow consumer doesn't block producers).

**Acceptance Criteria:**
- Publish reaches all subscribers in order per topic.
- A slow/full subscriber doesn't block publishing (bounded queue + logged overflow).
- Unit tests: ordering, fan-out, slow-consumer isolation.

**Implementation Notes:** In-process only. Keep it allocation-light (hot path on state changes).

**Testing Requirements:** Unit: ordering, multi-subscriber, overflow; race detector.

**Deliverables:** `engine/core/eventbus/{bus.go,topics.go}`, tests.

**Dependencies:** PROJ-160. **Effort:** 2 pts (~3h), low-medium.

**Agent Instructions:** Implement bus + topics + bounded queues; test ordering/fan-out/overflow with race detector.

**Expected Files:** `engine/core/eventbus/*`, tests.

**Validation Commands:**
```bash
cd engine && go vet ./... && golangci-lint run && go test -race ./core/eventbus/... && go build ./...
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## PROJ-163 — Session/profile model + activation-rule field + hook

**Summary:** The per-device session and the profile model, including the activation-rule field and an inert evaluation hook.

**Objective:** Implement 2B §5: isolated session (uuid, permissions snapshot, active profile, subscription set, mode), and the profile struct with `activationRule` + a no-op-in-V1 evaluation hook.

**Context:** TRD 2B §5 / Doc 0 §12 seam. Sessions are isolated (the "no confusion which device" guarantee). The activation-rule field + hook are built now; the auto-switch *consumer* is Phase 2.

**Technical Requirements:**
- `Session{uuid, perms, activeProfile, subscriptions, mode(runtime|edit)}`; created post-handshake (by transport), torn down on drop/revoke.
- `Profile{id, label, activationRule?, pages[]}`; activationRule stored, with a `EvaluateActivation()` hook that is inert in V1 (returns no switch).
- Session manager: create/get/teardown by uuid; expose teardown for revocation (PROJ-126).

**Acceptance Criteria:**
- Sessions are isolated; two sessions hold independent active profiles/subscriptions (**AC P1-AC-11 backing**).
- Activation-rule field persists; the hook exists and is inert (no auto-switch in V1).
- Teardown works (used by revoke).
- Unit tests: isolation, teardown, activation-field round-trip, hook inert.

**Implementation Notes:** Subscription set is derived from the bound layout (designer/client); here just hold/expose it. Mode flips (runtime↔edit) used by the designer (PROJ-212).

**Testing Requirements:** Unit: session isolation; teardown; profile/activation round-trip; hook returns no-switch.

**Deliverables:** `engine/core/session/{session.go,profile.go,activation.go,mode.go}`, tests.

**Dependencies:** PROJ-160, PROJ-113. **Effort:** 3 pts (~4h), medium.

**Agent Instructions:** Implement session + profile + activation field/hook + manager; test isolation and inert hook.

**Expected Files:** `engine/core/session/*`, tests.

**Validation Commands:**
```bash
cd engine && go vet ./... && golangci-lint run && go test ./core/session/... && go build ./...
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## PROJ-164 — Variables (`var.*`) typed + durable + bindable

**Summary:** User variables under `var.*` — typed, persisted to SQLite, and bindable as states.

**Objective:** Implement 2B §2.4/§3.6: `var.*` values are first-class states backed by the `variables` table, readable/writable by flows, bindable by widgets.

**Context:** TRD 2B §2.4 / FR-10.4. A flow writing `var.mic_muted` updates the state store, fans out, and triggers watchers like telemetry.

**Technical Requirements:**
- `var.*` registered as states (PROJ-160) with `value_type`; durable via `repo_variables` (PROJ-112).
- `SetVar(name, value)` writes both SQLite (durable) and the state store (live + fan-out + trigger).
- Load `var.*` from SQLite at startup into the state store.

**Acceptance Criteria:**
- Setting a `var.*` persists and updates the live state (fan-out + event).
- Variables survive restart (durable).
- A widget can bind `var.*` like any state.
- Unit tests: set/persist/reload; fan-out on write; typed values.

**Implementation Notes:** Used heavily by the flow engine (PROJ-203 `setVar`). Keep write atomic (SQLite + store).

**Testing Requirements:** Unit: set/persist/reload; fan-out; type fidelity.

**Deliverables:** `engine/core/state/variables.go` (or `core/vars/`), tests.

**Dependencies:** PROJ-160, PROJ-112. **Effort:** 2 pts (~3h), low-medium.

**Agent Instructions:** Implement `var.*` as durable+live states; SetVar atomic; startup reload; tests.

**Expected Files:** `engine/core/state/variables.go`, tests.

**Validation Commands:**
```bash
cd engine && go vet ./... && go test ./core/state/... && go build ./...
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

# EPIC-4 — Transport & Connectivity (WS-4)

> PROJ-140 is Ready-now. The epic builds the secure session and the three channels, then resilience and multi-session fan-out.

---

## PROJ-140 — Endpoint abstraction + ConnectionManager

**Summary:** The `TransportEndpoint`/`ConnectionManager` interfaces with a LAN-only endpoint implementation — the remote-ready seam.

**Objective:** Implement 2A §2 / ADR-0010: all addressing flows through these interfaces; V1 resolves to direct LAN sockets; nothing above the ConnectionManager knows the endpoint kind.

**Context:** TRD 2A §2 / ADR-0010. This is the single most important forward-compat seam — Phase 7 adds a `RelayEndpoint` here with no change above it.

**Technical Requirements:**
- `TransportEndpoint{ Dial(ctx)(Conn,error); Describe() EndpointInfo }`.
- `ConnectionManager{ Resolve(uuid)([]TransportEndpoint,error); Open(uuid)(Session,error) }`.
- V1 `LanEndpoint` (direct socket). Candidate ordering: last-known IP → mDNS → active-scan.
- **No `if remote` anywhere above the ConnectionManager** (assert by design/test).

**Acceptance Criteria:**
- `LanEndpoint` dials a direct socket; `ConnectionManager.Open` resolves→dials→(handshake handed to PROJ-142).
- Candidate ordering correct.
- A code audit/test finds no transport-kind branch above the ConnectionManager.
- Unit tests: resolve ordering; endpoint dial (with a loopback test server).

**Implementation Notes:** Keep `Conn` a minimal byte-stream interface so relay slots in later. Don't implement crypto here (PROJ-142 wraps the session in AEAD via PROJ-122).

**Testing Requirements:** Unit: resolve ordering; dial against a local listener; interface conformance.

**Deliverables:** `engine/core/transport/{endpoint.go,connmgr.go,endpoint_lan.go}`, tests.

**Dependencies:** none (Ready now). **Effort:** 2 pts (~3h), low-medium.

**Agent Instructions:** Define the interfaces + LAN endpoint + candidate ordering; test resolve/dial; confirm no transport-kind branch leaks upward.

**Expected Files:** `engine/core/transport/{endpoint.go,connmgr.go,endpoint_lan.go}`, tests.

**Validation Commands:**
```bash
cd engine && go vet ./... && golangci-lint run && go test ./core/transport/... && go build ./...
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## PROJ-141 — Framing + Serializer seam (length-prefix + JSON)

**Summary:** Length-prefixed frame codec and the channel-level `Serializer` abstraction (JSON for V1).

**Objective:** Implement 2A §5.1/§5.2 / ADR-0015: length-prefixed frames carrying the shared envelope; encode/decode via a `Serializer` so a binary codec can swap in later per channel.

**Context:** TRD 2A §5 / Master §6.3. Encrypted payload is binary → length-prefix (not newline) so ciphertext needs no escaping; JSON envelope lives inside the (later-encrypted) frame.

**Technical Requirements:**
- Frame codec: `uint32 length ‖ payload`; read/write with bounds checks (max frame size).
- Envelope struct (Master §6.3): `{v, ch, type, seq, ts, payload}`; per-channel monotonic `seq`.
- `Serializer` interface with a `JsonSerializer` impl; encode/decode envelope.

**Acceptance Criteria:**
- Frames round-trip (incl. large payloads up to the cap; oversize rejected).
- Envelope round-trips via the Serializer; `seq` monotonic per channel.
- Swapping the Serializer impl needs no call-site change (proven by a fake binary serializer in test).
- Unit tests: framing, oversize, envelope, serializer-swap.

**Implementation Notes:** Encryption is applied by the session (PROJ-142), not here — but design the frame so the payload slot is the ciphertext later. Keep the codec allocation-conscious.

**Testing Requirements:** Unit: frame round-trip/oversize; envelope; serializer-swap.

**Deliverables:** `engine/core/transport/{framing.go,serializer.go,envelope.go}`, tests.

**Dependencies:** PROJ-140. **Effort:** 2 pts (~3h), low-medium.

**Agent Instructions:** Implement framing + envelope + Serializer + JSON impl; test round-trips and serializer-swap.

**Expected Files:** `engine/core/transport/{framing,serializer,envelope}.go`, tests.

**Validation Commands:**
```bash
cd engine && go vet ./... && golangci-lint run && go test ./core/transport/... && go build ./...
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## PROJ-142 — Session (reader/writer/demux) over encrypted conn

**Summary:** A per-session goroutine set (reader, writer, demux) over an AEAD-encrypted connection.

**Objective:** Wrap a `Conn` (PROJ-140) with the crypto suite (PROJ-122) and framing (PROJ-141) into an authenticated, encrypted, multiplexed `Session`; clean teardown on drop.

**Context:** TRD 2A §4/§5 / 2E §4. Post-handshake (PROJ-123) the session encrypts every frame; channels (PROJ-143) ride it.

**Technical Requirements:**
- After handshake hands over session keys, every frame's payload is AEAD-encrypted/decrypted (PROJ-122) with per-direction nonce counters.
- Reader/writer/demux goroutines with context cancellation; teardown on drop/error frees resources and signals the session manager.
- Expose channel send/receive (used by PROJ-143).

**Acceptance Criteria:**
- An encrypted session round-trips messages (plaintext never on the wire — verified by capture in a test).
- Drop/cancel tears down all goroutines (no leak — race + goroutine-leak test).
- Tampered frame → AEAD failure → session error.
- Unit/integration tests: encrypted round-trip, teardown/no-leak, tamper.

**Implementation Notes:** Depends on crypto (PROJ-122) and framing (PROJ-141). Keep nonce management strictly monotonic (no reuse). The handshake itself is PROJ-123; this consumes its derived keys.

**Testing Requirements:** Unit/integration: encrypted round-trip; goroutine-leak on teardown; tamper detection.

**Deliverables:** `engine/core/transport/session.go`, tests.

**Dependencies:** PROJ-141, PROJ-122. **Effort:** 3 pts (~4h), medium-high.

**Agent Instructions:** Implement the encrypted session + goroutines + teardown; test round-trip/leak/tamper with race detector.

**Expected Files:** `engine/core/transport/session.go`, tests.

**Validation Commands:**
```bash
cd engine && go vet ./... && golangci-lint run && go test -race ./core/transport/... && go build ./...
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## PROJ-143 — Three channels (State / Layout / Preview) + backpressure

**Summary:** Multiplex the State, Layout, and Preview channels over a session with their distinct backpressure policies.

**Objective:** Implement 2A §6 / ADR-0011: State coalesces (latest-wins, droppable); Layout is ordered/lossless; Preview drops-on-overflow.

**Context:** TRD 2A §6. Distinct cadence/durability per channel; the `ch` envelope field routes.

**Technical Requirements:**
- Channel demux on `ch`; per-channel queues with policy: State = coalesce by state-id (latest wins); Layout = ordered, lossless, no drop; Preview = bounded, drop-on-overflow latest-only.
- Send/receive APIs per channel for upstream consumers (fan-out PROJ-150, designer PROJ-212/213).

**Acceptance Criteria:**
- State: a backlog coalesces to the latest value per id (older dropped).
- Layout: ordered, no message dropped (gap → resync is PROJ-149).
- Preview: overflow drops oldest, keeps latest; never blocks.
- Unit tests: per-channel policy behavior.

**Implementation Notes:** Coalescing State by id is what protects a slow client from a backlog. Layout must never drop (correctness). Preview is pure UX nicety.

**Testing Requirements:** Unit: coalesce; ordered-lossless; drop-on-overflow.

**Deliverables:** `engine/core/transport/channels.go`, tests.

**Dependencies:** PROJ-142. **Effort:** 3 pts (~4h), medium.

**Agent Instructions:** Implement the three channels + policies over the session; test each policy precisely.

**Expected Files:** `engine/core/transport/channels.go`, tests.

**Validation Commands:**
```bash
cd engine && go vet ./... && golangci-lint run && go test -race ./core/transport/... && go build ./...
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## PROJ-144 — Loopback privileged control channel

**Summary:** A loopback-only privileged channel for service lifecycle, pairing approval, and audit access — never network-routable.

**Objective:** Implement 2E §4 / 9.2 / ADR-0005: a same-machine-only control surface a remote client can never reach.

**Context:** A remote phone can issue permitted actions but never "stop the engine" or "approve a device." Those go here, bound to loopback.

**Technical Requirements:**
- A control listener bound to loopback only (127.0.0.1 / unix socket); reject any non-loopback origin.
- Control messages: service lifecycle (pause/quit/status), pairing approval + token issuance (PROJ-124), audit read.
- Authenticated as the local engine identity.

**Acceptance Criteria:**
- Control channel accepts only loopback connections (non-loopback refused — tested).
- Lifecycle + pairing-approval + audit-read messages work.
- A LAN session cannot route to control operations (verified).
- Unit/integration tests: loopback-only; each control op; non-loopback refusal.

**Implementation Notes:** This is the channel the tray (PROJ-109) and token issuance (PROJ-124) use. Keep it strictly separate from the data session routing.

**Testing Requirements:** Integration: loopback accept / non-loopback reject; control ops dispatch.

**Deliverables:** `engine/core/transport/control_channel.go`, tests.

**Dependencies:** PROJ-142. **Effort:** 2 pts (~3h), medium.

**Agent Instructions:** Implement loopback-bound control channel + ops + origin check; test loopback-only enforcement.

**Expected Files:** `engine/core/transport/control_channel.go`, tests.

**Validation Commands:**
```bash
cd engine && go vet ./... && golangci-lint run && go test ./core/transport/... && go build ./...
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## PROJ-145 — Heartbeat / keepalive (sleep-tolerant)

**Summary:** Bidirectional heartbeat keeping sessions warm and detecting silent death, tolerant of OS-sleep gaps.

**Objective:** Implement 2A §7.1 / FR-5.2: heartbeat at a fixed interval with a grace bound across sleep before declaring a drop.

**Context:** TRD 2A §7.1. Directly targets the #1 incumbent pain (spurious disconnects). The engine keeps sessions warm.

**Technical Requirements:**
- Bidirectional heartbeat frames at a configured interval.
- Missed-heartbeat tolerance up to a grace bound (covers sleep) before declaring drop → triggers reconnect (PROJ-146) client-side / teardown engine-side.

**Acceptance Criteria:**
- Heartbeats flow both ways; a healthy session stays up.
- A gap within grace (simulated sleep) does NOT drop; a gap beyond grace declares drop.
- Unit tests: heartbeat cadence; within-grace tolerance; beyond-grace drop.

**Implementation Notes:** Tune interval/grace via config. Coordinate the drop signal with reconnect (PROJ-146) and session teardown (PROJ-142).

**Testing Requirements:** Unit: cadence; grace tolerance; drop trigger (with a fake clock).

**Deliverables:** `engine/core/transport/heartbeat.go`, tests.

**Dependencies:** PROJ-142. **Effort:** 2 pts (~3h), low-medium.

**Agent Instructions:** Implement heartbeat + grace + drop signal with an injectable clock; test all three behaviors.

**Expected Files:** `engine/core/transport/heartbeat.go`, tests.

**Validation Commands:**
```bash
cd engine && go vet ./... && go test ./core/transport/... && go build ./...
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## PROJ-146 — Reconnect (backoff → mDNS → scan)

**Summary:** Client reconnect loop with exponential backoff, then mDNS rediscovery, then bounded active scan; target <5s on LAN.

**Objective:** Implement 2A §7.2 / FR-5.3 / NFR-05. **AC P1-AC-12** (reconnect restores live data).

**Context:** TRD 2A §7.2. On drop (PROJ-145), re-run the lifecycle: direct last-IP → mDNS → scan, re-establishing a fresh forward-secret session.

**Technical Requirements:**
- Backoff loop (capped) trying direct last-IP first; then mDNS (PROJ-147); then active scan (PROJ-148).
- Fresh handshake on reconnect (forward secrecy per session).
- Reconnect target <5s under normal LAN.

**Acceptance Criteria:**
- After a drop, the client reconnects via the documented order.
- Reconnect <5s on LAN (measured).
- Live data resumes; degradation UI clears (**AC P1-AC-12**).
- Integration test: drop → reconnect timing + data resume.

**Implementation Notes:** Mostly client-side (Flutter) but the engine must accept the fresh session. Coordinate with degradation UI (PROJ-188).

**Testing Requirements:** Integration: induced drop → reconnect order + timing; data resume.

**Deliverables:** `client/lib/net/reconnect.dart` (+ engine accept path), tests.

**Dependencies:** PROJ-145, PROJ-147. **Effort:** 3 pts (~4h), medium.

**Agent Instructions:** Implement the reconnect loop + order + fresh handshake; measure <5s; test resume.

**Expected Files:** `client/lib/net/reconnect.dart`, tests.

**Validation Commands:**
```bash
cd client && dart analyze && flutter test
cd ../engine && go test ./core/transport/... && go build ./...
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## PROJ-147 — Discovery: mDNS advertise / browse

**Summary:** Engine advertises `_cyberdeck._tcp.local` with TXT (name/uuid/version/fingerprint); client browses.

**Objective:** Implement 2A §3 / FR-2.2: zero-config LAN discovery.

**Context:** TRD 2A §3. Primary happy path; TXT fingerprint feeds anti-MITM at pairing.

**Technical Requirements:**
- Engine: advertise the service with TXT records `{name, uuid, ver, fp}` (fp = engine pubkey fingerprint from PROJ-120).
- Client: browse and list discovered engines with their fingerprints.
- Maintained Zeroconf library both sides.

**Acceptance Criteria:**
- Engine is discoverable on the LAN; TXT records correct.
- Client lists discovered engines.
- Unit/integration: advertise+browse on a test network/loopback.

**Implementation Notes:** Enterprise nets often block mDNS — manual + scan (PROJ-148) are the required fallbacks. Don't make discovery a hard dependency for pairing (manual path must work without it).

**Testing Requirements:** Integration: advertise + browse round-trip; TXT correctness.

**Deliverables:** `engine/core/transport/discovery_mdns.go`, `client/lib/net/discovery.dart`, tests.

**Dependencies:** PROJ-141, PROJ-120. **Effort:** 3 pts (~4h), medium.

**Agent Instructions:** Implement advertise (engine) + browse (client) + TXT; test round-trip.

**Expected Files:** `engine/core/transport/discovery_mdns.go`, `client/lib/net/discovery.dart`, tests.

**Validation Commands:**
```bash
cd engine && go vet ./... && go test ./core/transport/... && go build ./...
cd ../client && dart analyze && flutter test
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## PROJ-148 — Discovery: manual + bounded active scan

**Summary:** Manual addr+PIN pairing and a bounded, UUID-confirmed active subnet scan for relocating a known device.

**Objective:** Implement 2A §3 / FR-2.5: fallbacks for multicast-blocked networks.

**Context:** TRD 2A §3. Manual: user types addr:port, PIN confirms (2E). Active scan: when last-IP fails and mDNS is silent, bounded subnet sweep, identity confirmed by UUID (not IP).

**Technical Requirements:**
- Manual entry path (client) → engine handshake with PIN approval (PROJ-123/124).
- Active scan: bounded to local subnet, rate-limited, opt-in; attempts handshake; **UUID in the handshake confirms identity**.

**Acceptance Criteria:**
- Manual addr+PIN pairs successfully.
- Active scan locates a known engine by UUID when IP changed; rate-limited and bounded.
- Unit/integration: manual pair; scan-relocate; rate-limit respected.

**Implementation Notes:** Scan must be conservative (rate-limited, subnet-bounded, opt-in) to avoid looking like network abuse.

**Testing Requirements:** Integration: manual pair; scan relocate by UUID; rate-limit.

**Deliverables:** `engine/core/transport/discovery_scan.go`, `client/lib/net/manual_pair.dart`, tests.

**Dependencies:** PROJ-147. **Effort:** 2 pts (~3h), medium.

**Agent Instructions:** Implement manual+PIN and bounded UUID-confirmed scan; test relocate + rate-limit.

**Expected Files:** `engine/core/transport/discovery_scan.go`, `client/lib/net/manual_pair.dart`, tests.

**Validation Commands:**
```bash
cd engine && go vet ./... && go test ./core/transport/... && go build ./...
cd ../client && dart analyze && flutter test
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## PROJ-149 — Versioned resync on gap

**Summary:** A client that detects a Layout-channel `seq`/version gap requests a full document resync rather than replaying gaps.

**Objective:** Implement 2A §7.4 / FR-5.5 / ADR-0012.

**Context:** TRD 2A §7.4. The engine is the single source of truth, so resync is a full-doc fetch at the current version. State channel needs no resync (next tick supersedes).

**Technical Requirements:**
- Client tracks last-applied Layout `seq`/doc version; on gap → `resyncRequest`.
- Engine replies with the full document at the current version; client replaces and resumes.

**Acceptance Criteria:**
- A simulated gap triggers a resync request; the client converges to the authoritative doc.
- State channel does not resync (verified).
- Unit/integration: induced gap → resync → convergence.

**Implementation Notes:** Coordinate with the op-log (PROJ-211) and fan-out (PROJ-150). Keep resync idempotent.

**Testing Requirements:** Integration: gap → resync → identical doc; no-resync on State gap.

**Deliverables:** `engine/core/transport/resync.go` (+ client `resync.dart`), tests.

**Dependencies:** PROJ-143. **Effort:** 2 pts (~3h), medium.

**Agent Instructions:** Implement gap detection + resync request/response + convergence; test.

**Expected Files:** `engine/core/transport/resync.go`, `client/lib/net/resync.dart`, tests.

**Validation Commands:**
```bash
cd engine && go vet ./... && go test ./core/transport/... && go build ./...
cd ../client && dart analyze && flutter test
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## PROJ-150 — Multi-session fan-out + subscription filtering

**Summary:** Per-device isolated sessions with delta fan-out filtered by each session's subscription set; ≥8 concurrent sessions.

**Objective:** Implement 2A §8 / FR-3.1 / NFR-10. **AC P1-AC-11** (two devices, different profiles, no interference).

**Context:** TRD 2A §8. State deltas computed once (PROJ-160) and fanned out per session, filtered to subscribed states; Layout ops fanned out only to sessions on the edited profile in edit/preview mode.

**Technical Requirements:**
- Session manager fan-out: drain the state store dirty-set → for each session send only subscribed-state deltas over its State channel.
- Layout-op fan-out to sessions whose device is assigned the edited profile + in edit/preview mode.
- Per-session goroutine isolation; target ≥8 sessions without degradation.

**Acceptance Criteria:**
- A state update reaches only sessions subscribed to it.
- Two sessions on different profiles don't interfere (**AC P1-AC-11**).
- ≥8 concurrent sessions sustained (load test; ties into PROJ-301 soak).
- Unit/integration: subscription filtering; isolation; 8-session fan-out.

**Implementation Notes:** This binds state store (PROJ-160) ↔ channels (PROJ-143) ↔ sessions (PROJ-163). Subscription sets come from bound layouts. Critical for the idle-traffic reduction.

**Testing Requirements:** Integration: subscription filter; multi-session isolation; 8-session fan-out perf smoke.

**Deliverables:** `engine/core/transport/fanout.go` (+ session-manager wiring), tests.

**Dependencies:** PROJ-143, PROJ-160. **Effort:** 3 pts (~4h), medium-high.

**Agent Instructions:** Implement fan-out + subscription filtering + per-session isolation; test filtering, isolation, and 8-session fan-out.

**Expected Files:** `engine/core/transport/fanout.go`, tests.

**Validation Commands:**
```bash
cd engine && go vet ./... && golangci-lint run && go test -race ./core/transport/... && go build ./...
```

**Completion Checklist:** `[ ] Code · [ ] Tests · [ ] Docs · [ ] Lint · [ ] Types · [ ] AC met · [ ] Status moved`

---

## Batch 2 — dependency-correct execution order (within these two epics)

```
Ready now:  PROJ-160 (state core)   PROJ-140 (endpoint abstraction)

EPIC-6:
PROJ-160 ─► PROJ-162 (event bus)
PROJ-160 ─► PROJ-161 (registries)        [also needs PROJ-112, EPIC-2]
PROJ-160 ─► PROJ-163 (session/profile)   [also needs PROJ-113, EPIC-2]
PROJ-160 ─► PROJ-164 (variables)         [also needs PROJ-112, EPIC-2]

EPIC-4:
PROJ-140 ─► PROJ-141 ─► PROJ-142 ─► PROJ-143 ─► PROJ-150  [150 also needs PROJ-160]
                          PROJ-142 ─► PROJ-144 (control channel)
                          PROJ-142 ─► PROJ-145 ─► PROJ-146  [146 also needs PROJ-147]
PROJ-141 ─► PROJ-147 ─► PROJ-148
PROJ-143 ─► PROJ-149
PROJ-142 also needs PROJ-122 (crypto, EPIC-3)
```

**Cross-epic dependencies to respect:** PROJ-142 needs PROJ-122 (crypto, EPIC-3); PROJ-161/163/164 need EPIC-2 repos (PROJ-112/113); PROJ-150 needs PROJ-160. PROJ-150 then unblocks PROJ-105 (lifecycle, EPIC-1) and the designer broadcast (PROJ-212, EPIC-9); PROJ-144 unblocks PROJ-124 (token issuance, EPIC-3) and the tray (PROJ-109, EPIC-1).

---

*End of Batch 2 (EPIC-4 + EPIC-6 full tickets). Next: Batch 3 — EPIC-5 (Plugin host + 1P capabilities) + EPIC-8 (Client runtime + widgets). Then Batch 4 — EPIC-7 (Flow) + EPIC-9 (Designer) + EPIC-10 (Hardening). Then Dependency Graph → Execution Plan → Progress Dashboard → Claude Agent Instructions.*
