# CyberDeck — Phase 6 (Plugin SDK & Ecosystem) Deep Dive

**Document 8 of the CyberDeck Enterprise Documentation Set · Per-Phase Deep Dive**
Version 0.1 (Draft) · June 2026 · Codebase ID: `com.shishir.cyberdeck`

> Implementation-depth specification for **Phase 6**. Turns the V1 plugin *contract* (used internally by first-party plugins since Phase 1) into a **public, signed, sandboxed third-party surface** with discovery/installation, plugin-provided widget types and flow nodes, and a distribution/marketplace path. This is the phase that realizes ADR-0006's promise: "first-party = third-party, it's metadata not architecture." New decisions: **ADR-0027 (plugin signing & trust tiers)**, **ADR-0028 (plugin sandboxing model)**, **ADR-0029 (plugin-provided UI: widgets & nodes as portable descriptors + sandboxed render)**.

## Contents
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

## 1. Phase intent & definition of done

**Intent.** Open CyberDeck to third-party extension. Because first-party capabilities have run on the plugin contract since Phase 1 (ADR-0006), the *contract* is already proven; Phase 6 adds the **public-facing layer** around it: a documented SDK, packaging, discovery/install, **signing + trust tiers**, **sandboxing**, plugin-provided **widgets** and **flow nodes**, and a **marketplace** path. The hardening that first-party plugins didn't strictly need (untrusted code isolation, signature verification, permission review UX) is built here.

**Definition of done.**
- A third-party developer can build, package, sign, and publish a plugin using public docs/SDK, and a user can discover, install, permission-review, and run it.
- Third-party plugins run under the **same contract** as first-party but with **tighter sandboxing** and **mandatory signature verification**; an unsigned/untrusted plugin is gated.
- A third-party plugin can contribute **actions, states, events, flow nodes, and widget types**, all of which surface in the designer/flow-builder automatically (the schema-driven payoff).
- A malicious or buggy third-party plugin cannot crash the engine, exceed its declared permissions, or exfiltrate data.
- All Phase-6 ACs verified.

## 2. Scope: in / out

### In scope (Phase 6)
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

### Out of scope
Remote (P7) · collaboration/adaptive layouts (P8). Cloud-hosted marketplace backend depends on the P7 account/cloud overlay; Phase 6 can ship a **local/sideload + signed-registry** model first.

## 3. Seams consumed (the whole point)

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

## 4. Workstream map

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

## 5. WS-6.1 — Public SDK & plugin packaging

**Owning TRD:** 2F. **PRD:** D15-04.

### 5.1 Capability detail
- **SDK**: the documented manifest schema, IPC message contract (envelope, message types), capability interfaces (PAL), and registry-contribution schemas (action/widget/flow-node) — i.e. exactly what first-party plugins use (2F/2B/2G), now published with reference docs, language-agnostic protocol docs, and a Go reference library + at least one other-language example (since IPC is JSON over loopback, any language works).
- **Packaging**: a plugin package format (`.cyberdeck-plugin`) = the plugin binary(ies) per OS + manifest + signature + assets; install drops it into the plugins data folder (the engine's existing host launches it).

### 5.2 Technical spec
- The SDK is **versioned** (`apiVersion`, Master §6.4); the host refuses incompatible majors (2F TF-6) — already enforced for first-party, now the public compatibility guarantee.
- Reference SDK provides manifest scaffolding, IPC client, and typed helpers for `stateUpdate`/`invokeAction`/`registerContribution`.

### 5.3 Code structure
```
sdk/                      // public
  go/cyberdeck-plugin/    // Go reference library
  protocol/               // language-agnostic protocol + manifest schema docs
  samples/{hello-state, custom-action, custom-widget, custom-node}/
tools/packager/           // build .cyberdeck-plugin (+sign, WS-6.3)
```

---

## 6. WS-6.2 — Plugin discovery, install & lifecycle (third-party)

**Owning TRD:** 2F §6 (lifecycle), §9 (SDK seam). **PRD:** D15-05.

### 6.1 Functional flow
```
User browses marketplace / sideloads a .cyberdeck-plugin
  → install: verify signature (WS-6.3) → show declared permissions for review
  → user grants/denies permissions → host registers plugin (DISABLED)
  → user enables → host launches in sandbox (WS-6.4) → plugin registers contributions
  → contributions auto-surface in designer/flow-builder (schema-driven)
  → update: new version → re-verify signature → re-review only if permissions changed
  → disable/uninstall: stop process, keep/remove contributions (faulted-keeps vs uninstall-removes)
```

### 6.2 Capability detail
- Full third-party lifecycle on the Phase-1 state machine (2F §6: DISCOVERED→LAUNCHING→READY→…→DISABLED), now with **install/uninstall/update/enable/disable** user operations and the **permission-review gate**.
- **Disabled by default on install**; explicit enable required (no auto-run of freshly-installed third-party code).

### 6.3 Code structure
```
engine/pluginhost/ install.go update.go enable.go review.go   (third-party lifecycle ops)
client/lib/plugins/ browse.dart install.dart permission_review.dart manage.dart
```

---

## 7. WS-6.3 — Signing & trust tiers

**Owning TRD:** 2E, 2F §8. **PRD:** D14-07. **ADR:** **0027 (new)**.

### 7.1 The decision (ADR-0027)
**Trust tiers driven by signature, not by a binary first/third distinction.**
- **First-party**: signed by CyberDeck's key, part of the signed installer; trusted defaults.
- **Verified third-party**: signed by a developer key registered with the marketplace; signature verified at install + each update; permissions user-reviewed.
- **Unverified/sideloaded**: signature absent or unrecognized; install requires an explicit "I understand the risk" gate, runs with the **strictest sandbox** and **no trusted permission defaults** (everything must be explicitly granted).
- Trust tier affects **permission defaults, sandbox tightness, and UX labeling** — *never* the execution contract (consistent with ADR-0006: still one model, metadata differs).

### 7.2 Technical spec
- Signatures over the package (manifest + binaries + assets); developer keys registered/managed via the marketplace (WS-6.7). Verification at install and update.
- Revisions that change declared permissions force re-review; revisions that don't can update silently (still signature-verified).

### 7.3 Code structure
```
engine/core/security/plugin_signing.go   // verify package signatures, trust-tier resolution
tools/packager/sign.go
```

---

## 8. WS-6.4 — Sandboxing

**Owning TRD:** 2F §9. **PRD:** D14-07. **ADR:** **0028 (new)**.

### 8.1 The decision (ADR-0028)
**OS-level process confinement layered on the existing out-of-process isolation, scaled by trust tier.**
- Out-of-process isolation (ADR-0006) already prevents a plugin crash from taking the engine down. Sandboxing adds **confinement of what a plugin process can do**:
  - **Filesystem**: confined to the plugin's own data dir + explicitly-granted paths; no access to the SQLite store, secret store, or other plugins' data.
  - **Network**: denied unless the manifest declares (and the user grants) `network` (generalizing ADR-0024's flow-network gate to plugins); outbound only, to declared hosts where feasible.
  - **OS capabilities**: only the PAL capabilities the manifest declares and the host grants.
- Implemented per-OS with the available primitives (e.g. restricted tokens/job objects on Windows, sandbox profiles/entitlements on macOS, namespaces/seccomp/cgroups on Linux) behind a single `PluginSandbox` interface (PAL-style, provider-chained — degrades to "isolation-only" with a clear warning where OS sandboxing is unavailable).
- **Trust-tier scaling**: unverified plugins get the tightest profile; verified third-party a standard profile; first-party the installer-trusted profile.

### 8.2 Technical spec
- The host applies the sandbox profile at plugin launch; permission grants map to sandbox allowances (network grant → network namespace allowance, etc.).
- Resource limits (CPU/RAM) per plugin enforced; a plugin exceeding limits is throttled or faulted (2F §4).
- Audit: sandbox denials are logged (a plugin attempting un-granted access is recorded).

### 8.3 Code structure
```
engine/pluginhost/sandbox/{windows,darwin,linux}.go   // PluginSandbox per OS
engine/pluginhost/sandbox/sandbox.go                  // interface + trust-tier profiles
```

---

## 9. WS-6.5 — Plugin-provided widget types

**Owning TRD:** 2B §3.2 (widget registry), 2C §7 (renderer registry). **PRD:** D5-14. **ADR:** **0029 (new)**.

### 9.1 The challenge
Plugins (engine-side, Go, out-of-process) need to add **client-side (Flutter) widgets**. The plugin can't ship Flutter code into the client. So how does a third-party widget render?

### 9.2 The decision (ADR-0029)
**Plugin-provided UI is declarative, not code: a widget type is a portable descriptor composed from primitive render elements the client already knows, plus data bindings — never arbitrary executable UI code shipped to the client.**
- A plugin registers a widget type as a **composition of built-in render primitives** (containers, text, image/asset, gauge, sparkline, bar, icon, slider, toggle) with a **layout + binding spec** referencing the plugin's states and actions.
- The client renders it with its **existing native primitives** driven by the descriptor — so a third-party widget is *data*, interpreted by the trusted client renderer, not foreign code executing on the device.
- This keeps the client safe (no third-party code on user devices), preserves native performance, and still lets plugins create genuinely new widget *types* (novel compositions/bindings).
- Truly bespoke custom-drawn widgets (beyond composition of primitives) are **out of scope** for V-ecosystem; the primitive set is rich enough for the vast majority, and expanding the primitive vocabulary is a safer lever than shipping code.

### 9.3 Technical spec
- Widget descriptor schema extends the 2B widget-type registry: `renderTree` of primitives + `bindings` + `gestures`. The client's renderer registry gains a **descriptor interpreter** that builds a native tree from the descriptor (vs a hardcoded builder for built-in types).
- `valueRules` and interaction slots work identically (they're already declarative).

### 9.4 Code structure
```
shared/schemas/widget_descriptor.schema.json   // composition-of-primitives spec
client/lib/render/descriptor_interpreter.dart   // builds native tree from a plugin widget descriptor
engine/core/registry/widgets.go                 // accept plugin descriptors
```

---

## 10. WS-6.6 — Plugin-provided flow nodes

**Owning TRD:** 2D §9 (registry-dispatched executor), 2B §3.3. **PRD:** D7-12.

### 10.1 Capability detail
- A plugin registers a **flow node** (kind, param schema, an execution handle) into the flow-node registry; the executor **dispatches by kind** to the plugin over IPC (2D §9 was built for exactly this).
- The node appears in the visual flow builder's palette automatically (schema-driven), with auto-generated param editors.
- Node execution runs **in the plugin's sandbox** (WS-6.4); a node needing network requires the plugin's network grant (ADR-0024 generalized).

### 10.2 Technical spec
- Executor `dispatch(node)` for an unknown built-in kind routes to the registering plugin via an `invokeNode` IPC call (symmetric to `invokeAction`), awaiting a result that yields the next node + any local-scope writes.
- Failure/cancellation semantics identical to built-in nodes (2D §8) — a plugin node that throws fails the run safely, never crashes the engine.

### 10.3 Code structure
```
engine/core/flow/plugin_node.go     // invokeNode dispatch over IPC
engine/core/registry/flownodes.go   // accept plugin node registrations
```

---

## 11. WS-6.7 — Marketplace / distribution

**PRD:** D15-06.

### 11.1 Capability detail
- A **distribution path** for plugins (and, reusing Phase-2 export, **layouts** and flows): browse, install, update, rate.
- **Two delivery models**, sequenced: (a) **sideload + signed registry** (a signed index of verified plugins, installable without a cloud account) shippable in Phase 6; (b) **cloud-hosted marketplace** which depends on the Phase-7 account/cloud overlay — so the full hosted marketplace may straddle P6→P7.
- Developer key registration + signing (WS-6.3) underpins the verified tier.

### 11.2 Technical spec
- The client's plugin-browse UI talks to the registry (signed index for model (a); cloud API for model (b)). Installs always go through signature verification (WS-6.3) and permission review (WS-6.2).
- Marketplace flows containing `httpRequest` nodes inherit ADR-0024's gate automatically.

---

## 12. WS-6.8 — Hot-reload & developer experience

**PRD:** D1-11.

- **Config hot-reload** (deferred from V1, Doc 0 §12): a file-watcher reloads `config.json` without an engine restart.
- **Plugin dev loop**: a dev mode that reloads a plugin on rebuild (stop → relaunch in sandbox → re-register), so developers iterate fast. Dev mode relaxes signing (local unsigned dev plugins allowed under an explicit dev flag) but **never** relaxes sandboxing.

---

## 13. End-to-end realized journeys (Phase 6)

**Third-party developer ships a plugin.** A developer uses the SDK to build a "Philips Hue direct" plugin (states + actions + a custom room widget composed from primitives + a "set scene" flow node), packages and signs it, publishes to the registry. The plugin's actions/widget/node appear in another user's designer and flow builder automatically after install — zero CyberDeck code change.

**User installs and reviews.** A user browses the marketplace, installs the plugin, reviews its declared permissions (network to the Hue bridge, no filesystem), grants them, enables it; it runs sandboxed. A buggy update that crashes is restarted by the host and faulted without affecting the engine; a version that adds a new permission forces re-review.

**Untrusted sideload.** A user sideloads an unsigned plugin; the install warns and runs it in the strictest sandbox with no default permissions; an attempt to read outside its data dir is denied and audited.

## 14. Code structure (additions)

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

## 15. Test plan

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

## 16. Milestones & sequencing

| Milestone | Content | Gate |
|-----------|---------|------|
| **M6.1 SDK + packaging** | WS-6.1 | a sample third-party plugin builds, packages, installs |
| **M6.2 Trust + sandbox** | WS-6.3 + WS-6.4 | signature gating + per-tier sandbox enforced + audited |
| **M6.3 Lifecycle + review** | WS-6.2 | install/enable/update/disable + permission review |
| **M6.4 UI/automation extension** | WS-6.5 + WS-6.6 | plugin widget renders; plugin node runs; both auto-surface |
| **M6.5 Marketplace + DX + governance** | WS-6.7 + WS-6.8 + WS-6.9 | signed-registry install; hot-reload dev loop; audit search UI |
| **M6.6 Harden (red-team)** | ACs + security | malicious-plugin suite contained |

## 17. Risks & mitigations

| Risk | Prob | Impact | Mitigation |
|------|------|--------|-----------|
| Sandbox escape | Low | Critical | Per-OS confinement + least-privilege + red-team suite; out-of-process isolation as the floor; degrade to isolation-only with warning where OS sandbox unavailable |
| Malicious plugin exfiltration | Med | High | Network denied unless granted (ADR-0024 generalized); declared-host limits; audit |
| Plugin-widget code-injection attempt | Low | High | ADR-0029: widgets are descriptors interpreted by the trusted client, never foreign code |
| Permission-review fatigue (users click-through) | Med | Med | Minimal, clear, tier-scoped prompts; sensible defaults for verified; strict for unverified |
| apiVersion churn breaks ecosystem | Med | Med | Documented compatibility window; major-version refusal with diagnostic |
| Cloud marketplace depends on P7 | Med | Low | Ship signed-registry/sideload model (a) in P6; hosted model (b) straddles into P7 |

## 18. Acceptance criteria (traced)

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
