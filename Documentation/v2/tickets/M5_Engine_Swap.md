# M5 — Engine Swap (CD-501…519)

**Gate:** flip `runtime.gateway=engine` → the same IDE runs live: real telemetry variables in Vars, flows deployed + executed by `core/flow`, runtime log streaming from the engine bus, layouts pushed to a paired device. Contract suite green on **both** gateways. Interop v2 green.
**Entry:** CD-425 passed (lane rule: CD-501…513 may start once CD-407/409 landed). **Exit:** CD-519 recorded.
**Language note:** CD-501…513 are Go tickets in `engine/`; CD-514+ are IDE/QA tickets.

## Board

- [ ] CD-501 Go type generation from schemas
- [ ] CD-502 Control-plane listener + local authz
- [ ] CD-503 Envelope + route dispatch
- [ ] CD-504 Subscription frames + backpressure
- [ ] CD-505 Project document repo v2 + routes
- [ ] CD-506 Engine publish/flatten (conformance)
- [ ] CD-507 Registry manifest v2 + routes
- [ ] CD-508 Variables v2 + computed + subscribe bridge
- [ ] CD-509 Flow node catalog v2 + deploy/arm
- [ ] CD-510 Flow run traces stream
- [ ] CD-511 Runtime log/perf streaming + event bridge
- [ ] CD-512 Device layout push v2 + assignment + assets
- [ ] CD-513 Plugin manifest v2 + integration-pair convention
- [ ] CD-514 EngineGateway (IDE) + flip + fallback
- [ ] CD-515 Contract suite dual-gateway in CI
- [ ] CD-516 Interop suite v2
- [ ] CD-517 Security: non-exposure + authz tests
- [ ] CD-518 IDE test-run on engine traces
- [ ] CD-519 **M5 gate review — THE SWAP**

---

### CD-501 · Go type generation from schemas ∥
**BP:** CON-E03-T02 · **Hat:** BE · **P:** P0 · **Est:** S · **Deps:** CD-115
**Do:** Execute the codegen decision (spiked in CD-115 era): `shared/schemas/` → Go structs for config areas, manifests, docs, envelope, routes; wire into `task gen:types`; CI drift gate extended to Go.
**AC:**
- [ ] engine imports generated contract types only (no hand-written duplicates)
- [ ] drift gate fails on stale Go types

### CD-502 · Control-plane listener + local authz
**BP:** ENG-E01-T01 / SEC-E01 · **Hat:** BE+SEC · **P:** P0 · **Est:** M · **Deps:** CD-501
**Do:** New localhost WS listener (127.0.0.1 bind only), **separate channel/port from the device data plane** (QoS isolation); local privileged auth reusing `core/security` identity (console-channel precedent); session lifecycle (attach/resume on engine restart).
**AC:**
- [ ] refuses non-loopback connections (test binds external iface)
- [ ] unauthorized client rejected + audited; IDE session resumes after engine restart

### CD-503 · Envelope + route dispatch
**BP:** ENG-E01-T02 · **Hat:** BE · **P:** P0 · **Est:** M · **Deps:** CD-502
**Do:** Envelope codec (CD-113) on the existing serializer; route dispatcher validated against the route registry (unknown/malformed → coded errors); handler scaffold per route group returning NotImplemented until filled.
**AC:**
- [ ] registry-driven dispatch test: every CD-114 route reaches a handler stub
- [ ] malformed envelope fuzz test → coded errors, no panics

### CD-504 · Subscription frames + backpressure
**BP:** ENG-E01-T03 · **Hat:** BE · **P:** P0 · **Est:** M · **Deps:** CD-503
**Do:** Subscribe/unsubscribe frames; per-subscription bounded queues with drop+flag overflow (mirror `eventbus` semantics); resume-from-sequence on reconnect.
**AC:**
- [ ] slow-consumer test: producer never blocks; overflow flagged to client
- [ ] reconnect resumes without missed frames (sequence test)

### CD-505 · Project document repo v2 + routes
**BP:** ENG-E02-T01/T02 · **Hat:** BE · **P:** P0 · **Est:** M · **Deps:** CD-503
**Do:** `cyberdeck.project` persistence on `core/persistence` (documents repo v2, versioned migration); routes: list/get/create/update/delete/open/recents; `ProjectOpened` on the engine bus.
**AC:**
- [ ] IDE-authored fixture doc round-trips through the engine byte-stable
- [ ] migration test (doc v1→v2) green; SQLite migration committed

### CD-506 · Engine publish/flatten (conformance)
**BP:** ENG-E02-T03 / Q2 · **Hat:** BE · **P:** P0 · **Est:** M · **Deps:** CD-505, CD-416
**Do:** Port the CD-416 flatten to Go; publish route producing per-device `cyberdeck.layout`; **golden conformance**: engine output must byte-match the TS lib goldens.
**AC:**
- [ ] all CD-416 golden fixtures match exactly in CI
- [ ] publish stores layouts + emits event

### CD-507 · Registry manifest v2 + routes ∥
**BP:** ENG-E03 · **Hat:** BE · **P:** P0 · **Est:** M · **Deps:** CD-503, CD-110
**Do:** Extend `core/registry` descriptors to manifest v2 (per CD-110 mapping note: permissions, dataProvider, refresh, caching, lifecycle); manifests route with pagination; plugin-contributed widget manifests validated on plugin start.
**AC:**
- [ ] existing first-party descriptors migrate + validate
- [ ] IDE Insert browser lists engine-served manifests post-swap

### CD-508 · Variables v2 + computed + subscribe bridge
**BP:** ENG-E04 · **Hat:** BE · **P:** P0 · **Est:** M · **Deps:** CD-504
**Do:** Extend `core/state`/`core/vars` to the 13 value types; computed/expression vars evaluated with `flow/expr` (shared conformance corpus with CD-323); query route (scope/filter/sort/page); `VariableChanged` → subscription frames.
**AC:**
- [ ] conformance corpus green on engine side
- [ ] live telemetry plugin vars stream to a subscribed client (test)

### CD-509 · Flow node catalog v2 + deploy/arm
**BP:** ENG-E05-T01/T02 · **Hat:** BE · **P:** P0 · **Est:** L · **Deps:** CD-503, CD-112
**Do:** Implement the Q3 node cut in `core/flow/nodes`: Triggers (state/schedule/event), Logic (existing + expression/function), Data (math/text/datetime), Actions (profile/notify/navigate/plugin-action), Integrations (HTTP, MQTT publish; OBS/Spotify arrive at M6), Structure (subflow exists). Deploy/arm/disarm routes: validate (`flow/validate`) → store → arm triggers.
**AC:**
- [ ] fixture flow from the IDE deploys + executes on a real trigger (integration test)
- [ ] invalid flow rejected with positioned errors the IDE can display

### CD-510 · Flow run traces stream ∥
**BP:** ENG-E05-T03 · **Hat:** BE · **P:** P1 · **Est:** S · **Deps:** CD-509, CD-504
**Do:** Per-run trace events (node enter/exit, branch, timing, error) on a trace subscription topic.
**AC:**
- [ ] trace sequence for a fixture run matches execution order (test)

### CD-511 · Runtime log/perf streaming + event bridge
**BP:** ENG-E06 · **Hat:** BE · **P:** P0 · **Est:** M · **Deps:** CD-504
**Do:** Structured runtime log stream (level/source/message); perf counters (CPU/mem/loop timings); bridge engine bus topics → the 13 IDE catalog events per the CD-114 map.
**AC:**
- [ ] IDE Runtime workspace renders live engine log post-swap
- [ ] every mapped topic arrives as its IDE event (bridge test)

### CD-512 · Device layout push v2 + assignment + assets
**BP:** ENG-E07 · **Hat:** BE · **P:** P0 · **Est:** M · **Deps:** CD-506
**Do:** Extend the data-plane protocol: push `cyberdeck.layout` v2 (protocol version negotiated in handshake — old clients get the legacy path); per-device assignment store + routes; chunked asset transfer with hashes.
**AC:**
- [ ] existing client still works (legacy path test) — no regression in `task interop`
- [ ] v2 push delivers doc + assets to a test client; re-push on publish

### CD-513 · Plugin manifest v2 + integration-pair convention ∥
**BP:** ENG-E08 · **Hat:** BE · **P:** P1 · **Est:** S · **Deps:** CD-507
**Do:** Align `plugin_manifest.schema.json` with manifest v2; document + implement the integration-pair convention (engine plugin + IDE extension under one package ID); pluginhost loads v2 manifests.
**AC:**
- [ ] existing 5 bundled plugins load under v2 manifests

### CD-514 · EngineGateway (IDE) + flip + fallback
**BP:** IDE-E03-F03-T04 completion · **Hat:** FE · **P:** P0 · **Est:** M · **Deps:** CD-503, CD-128
**Do:** EngineGateway implementing the same gateway interface over the control-plane WS (envelope, subscriptions→bus); `runtime.gateway` flip; engine-offline detection → status chip + graceful fallback (cache/mock per config); reconnect with resume.
**AC:**
- [ ] flip requires zero widget/store changes (diff proof)
- [ ] kill engine mid-session → banner + recovery on restart (E2E)

### CD-515 · Contract suite dual-gateway in CI
**BP:** QA-E02 completion · **Hat:** QA · **P:** P0 · **Est:** S · **Deps:** CD-514, CD-135, CD-503…512
**Do:** CI job boots the engine and runs the generated contract suite against it; matrix: mock + engine both required.
**AC:**
- [ ] 100 % routes pass on both gateways; divergence fails CI naming the route

### CD-516 · Interop suite v2
**BP:** QA-E03 · **Hat:** QA · **P:** P0 · **Est:** M · **Deps:** CD-512, CD-514
**Do:** Extend `task interop`: pair → IDE (headless control-plane client) creates project → publishes → engine pushes to real client stack → interaction dispatch → revoke. Keep the existing v1 assertions.
**AC:**
- [ ] full authoring→device round-trip automated + green in nightly CI

### CD-517 · Security: non-exposure + authz tests ∥
**BP:** SEC-E01 · **Hat:** SEC+QA · **P:** P0 · **Est:** S · **Deps:** CD-502
**Do:** Automated checks: loopback-only bind, unauthorized-client rejection + audit entry, privileged-op authz matrix (revoke/grant/deploy), envelope fuzz corpus in CI.
**AC:**
- [ ] all four checks in CI; STRIDE notes for the control plane filed for CD-803

### CD-518 · IDE test-run on engine traces ∥
**BP:** IDE-E16-S02-T03 · **Hat:** FE · **P:** P1 · **Est:** S · **Deps:** CD-510, CD-414
**Do:** Swap the test-run adapter: when gateway=engine, visualize real trace events instead of the local simulator (simulator remains for mock mode).
**AC:**
- [ ] same visual language both modes; engine timings displayed

### CD-519 · **M5 gate review — THE SWAP**
**BP:** Blueprint M5 gate · **Hat:** PM+QA · **P:** P0 · **Est:** S · **Deps:** CD-501…518
**Do:** Live demo, recorded: flip config → real vars/flows/log/devices; dual-gateway CI green; regression: mock mode still fully works.
**AC:**
- [ ] swap demo checklist complete (vars tick real telemetry · flow deploys + fires · log streams · layout lands on device)
- [ ] contract dual-gateway + interop v2 + non-exposure suites all green
- [ ] mock mode regression: M4 gate journey still green
