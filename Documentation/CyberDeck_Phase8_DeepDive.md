# CyberDeck — Phase 8 (Advanced) Deep Dive

**Document 10 of the CyberDeck Enterprise Documentation Set · Per-Phase Deep Dive**
Version 0.1 (Draft) · June 2026 · Codebase ID: `com.shishir.cyberdeck`

> Implementation-depth specification for **Phase 8 (Advanced)** — the candidate phase of capabilities that each layer onto a seam built much earlier: **collaborative multi-author editing** (on the op-log, ADR-0012), **responsive/adaptive layouts** (on the DeviceClass model, ADR-0017), **cross-engine binding** (on the multi-trust identity model, ADR-0008), and **team sharing** (on the account overlay, ADR-0031). These are explicitly *candidates* — prioritized by post-launch signal, not committed. New decisions: **ADR-0033 (CRDT/OT collaboration on the op-log)**, **ADR-0034 (adaptive layout model — opt-in, authored-base + rules)**, **ADR-0035 (cross-engine multi-bind & engine switching)**.

## Contents
1. Phase intent & definition of done
2. Scope: in / out (and the candidate caveat)
3. Seams consumed
4. Workstream map
5. WS-8.1 Collaborative multi-author editing
6. WS-8.2 Responsive / adaptive layouts
7. WS-8.3 Cross-engine binding & switching
8. WS-8.4 Team sharing
9. End-to-end realized journeys
10. Code structure (additions)
11. Test plan
12. Milestones & sequencing
13. Risks & mitigations
14. Acceptance criteria (traced)

---

## 1. Phase intent & definition of done

**Intent.** Deliver the "someday" capabilities the architecture deliberately left room for, each as a clean addition at a pre-built seam: real-time collaborative editing, layouts that adapt across device classes, a single device bound to multiple engines, and account-based team sharing. The intent is also to **prove the seams one final time** — if any of these needs a foundational rewrite, the foundation was wrong; the thesis is that none of them do.

**Definition of done (per candidate, if undertaken).**
- **Collaboration**: two authors edit the same profile concurrently with conflict-free convergence, on the existing op-log — no new sync substrate.
- **Adaptive layouts**: a user opts a profile into adaptive mode; one authored base layout adapts to other device classes via explicit rules — without breaking the per-device-class default (ADR-0017 stays the default).
- **Cross-engine**: a device bound to multiple engines switches between them with clear, unambiguous context — on the multi-trust identity model.
- **Team sharing**: an account can share layouts/flows/plugins with team members through the cloud overlay.

> Because Phase 8 is candidate-driven, "definition of done" is scoped to whichever candidates are greenlit; each is independently shippable.

## 2. Scope: in / out (and the candidate caveat)

### Candidates (each independent; prioritize by signal)
| Candidate | Seam it rides | PRD |
|-----------|---------------|-----|
| Collaborative multi-author editing | op-log + versioning (ADR-0012) | D4-12 |
| Responsive / adaptive layouts | DeviceClass model (ADR-0017) | D4-13 |
| Cross-engine binding & switching | multi-trust identity (ADR-0008) | Doc 0 §12 |
| Team sharing | account overlay (ADR-0031) | D16-04 |

### Explicitly not assumed
None of these is committed for a fixed date; they are sequenced after market signal. The value of documenting them now is to (a) confirm the seams hold and (b) prevent earlier phases from accidentally foreclosing them.

## 3. Seams consumed

| Seam | Phase-8 use |
|------|-------------|
| Operation log + monotonic versioning (ADR-0012) | the substrate for collaborative editing — CRDT/OT layers on it (ADR-0033) |
| Single-writer edit lock (2C §4.3) | replaced by multi-writer convergence (the lock was always a V1 simplification, not a wall) |
| DeviceClass + GridConfig (ADR-0017) | the base for adaptive rules (ADR-0034) |
| Multi-trust identity (ADR-0008 §3.3: a device holds N trust records) | cross-engine binding (ADR-0035) |
| Account overlay (ADR-0031) | team sharing |
| Flow-document op model (ADR-0022) | collaboration extends to flows too |
| Cloud blind-storage (ADR-0030/backup) | shared artifacts distributed via the same blind store |

Every candidate attaches at a seam named in Doc 0 §12 — the final validation of the foundation's extension-seam index.

## 4. Workstream map

```
WS-8.1 Collaboration (op-log → CRDT/OT) ─── independent
WS-8.2 Adaptive layouts (DeviceClass → rules) ─── independent
WS-8.3 Cross-engine binding (multi-trust → switch UX) ─── independent
WS-8.4 Team sharing (account → shared artifacts) ─── depends on P7 account
```
All four are independent (8.4 needs the P7 account); pick and sequence by signal.

---

## 5. WS-8.1 — Collaborative multi-author editing

**Owning TRD:** 2C §4 (op-log), 2D (flow op-model). **PRD:** D4-12. **ADR:** **0033 (new)**.

### 5.1 The decision (ADR-0033)
**Layer conflict-free convergence onto the existing op-log; do not replace it.**
- V1 used a **single-writer edit lock** (2C §4.3) as a deliberate simplification — *explicitly* so that collaboration could be added later without redesign. The op-log itself was always the collaboration substrate (ADR-0012).
- Phase 8 replaces the lock with **operational transformation or a CRDT** over the same operation set (AddWidget, MoveWidget, etc.). Operations are already discrete, versioned, and invertible — the prerequisites for OT/CRDT — so the change is a **convergence layer**, not a new model.
- Concurrent edits from multiple authors are transformed/merged to a consistent document; the merged ops broadcast on the **same Layout channel** to devices (live reflection unchanged).

### 5.2 Technical spec
- Each op carries author + a causal context (version vector or Lamport stamp); the convergence layer transforms concurrent ops to commute. Choice of OT vs CRDT is an implementation decision deferred to the candidate's design spike (both fit the op model; CRDT favored for offline-tolerant merge).
- Presence (who's editing what) and per-author cursors are additive UI over the same channel.
- Applies to **flows too** (ADR-0022's flow op-model is the same shape) — collaborative flow authoring falls out for free.

### 5.3 Code structure
```
engine/core/layout/collab/{convergence.go, version_vector.go, presence.go}
client/lib/designer/collab/{presence.dart, remote_cursors.dart}
```

---

## 6. WS-8.2 — Responsive / adaptive layouts

**Owning TRD:** 2C §2 (GridConfig/DeviceClass). **PRD:** D4-13. **ADR:** **0034 (new)**.

### 6.1 The decision (ADR-0034)
**Adaptive layout is opt-in: an authored base layout + explicit adaptation rules — never silent auto-reflow, and never the default.**
- ADR-0017 (per-device-class authored layouts, no auto-reflow) **remains the default** because silent reflow of a dense neon UI breaks ugly. Adaptive mode is an **opt-in** for users who accept some compromise for breadth.
- An adaptive profile has one **authored base** (for a primary device class) plus **adaptation rules** (e.g. "on a smaller class, drop the chart widgets and stack the gauges 2-wide"; "on a larger class, expand the grid and add the process table"). Rules are explicit and authored, not inferred — the author stays in control.
- The engine applies the rules to derive a per-class layout from the base; the result is a normal layout document (so rendering, op-log, live reflection are all unchanged).

### 6.2 Technical spec
- Adaptation rules are a declarative transform over the document tree (show/hide widgets by tag, re-flow placement within a target grid, swap widget variants). Authored in the designer's adaptive mode; previewed per target class.
- Derived layouts are cached as normal documents and can be hand-tweaked (the rule output is a starting point, not a lock).
- Falls back to per-class authoring (ADR-0017) for any class the author wants pixel-perfect — adaptive and authored coexist per profile.

### 6.3 Code structure
```
engine/core/layout/adaptive/{rules.go, transform.go, derive.go}
client/lib/designer/adaptive/{rule_editor.dart, multi_class_preview.dart}
```

---

## 7. WS-8.3 — Cross-engine binding & switching

**Owning TRD:** 2E §3.3 (multi-trust). **PRD:** Doc 0 §12. **ADR:** **0035 (new)**.

### 7.1 The decision (ADR-0035)
**A device may bind multiple engines and switch between them; engine context is always explicit and unambiguous.**
- The identity model already supports it (ADR-0008 §3.3: trust is a *set* keyed by engine UUID — a device can hold N trust records). Phase 8 builds the **UX and session management** for switching, not new identity.
- A device shows an **engine switcher**; one engine is active at a time per device (no merging of two engines' state — that would reintroduce the "which device/engine?" confusion the product exists to avoid). Switching tears down the current session and opens one to the selected engine.
- Each engine remains fully isolated and authoritative for itself (ADR-0002 unchanged); cross-engine is *switching*, not *federation*.

### 7.2 Technical spec
- The connection manager (2A) already resolves per engine UUID; cross-engine is a client-side selection among bound engines + a session swap. Remote (P7) means the bound engines may be LAN or remote — the endpoint abstraction handles both.
- Clear labeling: the active engine's name is always visible (the same "no confusion" discipline as device targeting in the designer).

### 7.3 Code structure
```
client/lib/net/engine_registry.dart engine_switcher.dart   // bound engines, active selection
client/lib/app/active_engine_indicator.dart
```

---

## 8. WS-8.4 — Team sharing

**Owning TRD:** P7 account overlay (ADR-0031), cloud blind store. **PRD:** D16-04.

### 8.1 Capability detail
- An account can **share artifacts** — layouts, flows, and (verified) plugins — with team members: a curated, permissioned distribution beyond the public marketplace.
- Reuses Phase-2 export + Phase-7 client-side-encrypted blind cloud storage; sharing is granting team accounts access to an encrypted artifact.
- Shared flows carry their permission gates (e.g. ADR-0024 network) — a recipient must still review/grant; shared plugins carry their signing/trust tier (ADR-0027).

### 8.2 Technical spec
- Team = an account grouping (cloud-side); artifacts shared to a team are listed in members' clients for import (the Phase-2 import path + dependency check).
- No new local mechanism — sharing is a cloud distribution layer over existing export/import/permission/signing.

### 8.3 Code structure
```
cloud/api/teams.go sharing.go
client/lib/cloud/team_share_ui.dart
```

---

## 9. End-to-end realized journeys (Phase 8)

**Two streamers co-design a deck.** Jordan and a co-host both open the same "Stream" profile; they place and wire widgets concurrently, see each other's cursors, and the deck converges with no lock contention — then both their tablets reflect the merged result live.

**One layout, many screens (opt-in).** A user opts a profile into adaptive mode, authors the base for their 10" tablet, and adds rules so a phone gets a stacked subset and a desktop gets an expanded grid — reviewing each in multi-class preview, hand-tweaking the phone variant.

**One phone, two PCs.** A user's phone is bound to both their desktop and laptop engines; the engine switcher flips between them, the active engine always labeled — no confusion about which machine a tap controls.

**Team rollout.** A team lead shares a standardized "ops" layout + a set of flows with the team; members import them (dependency-checked), review flow network permissions, and deploy to their own devices.

## 10. Code structure (additions)

```
engine/core/layout/
  collab/{convergence,version_vector,presence}.go
  adaptive/{rules,transform,derive}.go
client/lib/
  designer/collab/{presence,remote_cursors}.dart
  designer/adaptive/{rule_editor,multi_class_preview}.dart
  net/{engine_registry,engine_switcher}.dart
  app/active_engine_indicator.dart
  cloud/team_share_ui.dart
cloud/api/{teams,sharing}.go
```
> Once again the additions are mostly *new modules at the edges*; the op-log, document model, identity, sessions, and engine authority are unchanged. The single-writer lock's removal (8.1) is the only "replacement," and it was pre-planned as a V1 simplification.

## 11. Test plan

| Layer | Scope | Pass criteria |
|-------|-------|---------------|
| Collaboration | concurrent ops from N authors converge; offline edit + rejoin merge; flows too | consistent convergence; no lost edits |
| Adaptive | base + rules derive per-class layouts; opt-in only; per-class authoring still available | correct derivation; ADR-0017 default intact |
| Cross-engine | bind 2 engines; switch; active label correct; no state bleed | isolated switching; no confusion |
| Team sharing | share→import with dependency + permission + signing checks | gated import correct |
| Regression | single-author editing, per-class layouts, single-engine, local-only | no regression for users who use none of P8 |
| Seam audit | confirm no foundational rewrite was needed for any candidate | each rides its named seam |

## 12. Milestones & sequencing

> Sequenced per greenlit candidate; each independently shippable.

| Milestone | Candidate | Gate |
|-----------|-----------|------|
| **M8.A** | Collaboration | concurrent convergence on op-log; presence/cursors |
| **M8.B** | Adaptive layouts | opt-in base+rules; multi-class preview; default unchanged |
| **M8.C** | Cross-engine | multi-bind + switch + unambiguous active-engine UX |
| **M8.D** | Team sharing | account-based share/import with gates |

## 13. Risks & mitigations

| Risk | Prob | Impact | Mitigation |
|------|------|--------|-----------|
| OT/CRDT complexity | Med | Med | Op model is already discrete/versioned/invertible; spike to choose OT vs CRDT; CRDT for offline tolerance |
| Adaptive reflow still looks bad | Med | Med | Opt-in only; explicit authored rules (not inference); per-class authoring remains default (ADR-0017) |
| Cross-engine confusion (the thing we exist to avoid) | Med | High | One active engine at a time; always-visible active-engine label; no federation/merging |
| Team sharing leaks secrets/over-shares | Low | High | Reuse no-secret export; client-side encryption; recipients re-grant permissions; signed plugins |
| Scope creep (candidates treated as committed) | Med | Med | Candidate caveat (§2); prioritize by signal; each independently shippable |

## 14. Acceptance criteria (traced)

| AC | Criterion | Trace |
|----|-----------|-------|
| P8-AC-01 | Multiple authors edit the same profile/flow concurrently and converge consistently on the existing op-log — no new sync substrate. | ADR-0012/0033, M8.A |
| P8-AC-02 | The single-writer lock is replaced by convergence with no change to the document model or Layout-channel reflection. | 2C §4.3, M8.A |
| P8-AC-03 | Adaptive layout is opt-in: an authored base + explicit rules derive per-class layouts; per-class authoring (ADR-0017) remains the default and coexists. | D4-13/ADR-0034, M8.B |
| P8-AC-04 | A device binds multiple engines and switches between them with one active engine at a time and an always-visible active-engine label. | ADR-0008/0035, M8.C |
| P8-AC-05 | Cross-engine is switching, not federation; engine isolation/authority is unchanged. | ADR-0002, M8.C |
| P8-AC-06 | An account shares layouts/flows/plugins with a team; recipients import via the existing path with dependency, permission, and signing gates. | D16-04, M8.D |
| P8-AC-07 | Each Phase-8 candidate rides a seam named in Doc 0 §12 with no foundational rewrite. | Doc 0 §12, all |
| P8-AC-08 | Users who adopt none of Phase 8 see no regression. | all, regression |

---
*End of Phase 8 Deep Dive (Draft v0.1). New decisions ADR-0033/0034/0035 appended to the Decision Log. This completes the per-phase deep dives (Phases 1–8). The documentation set is now end-to-end complete and ready to compile into a single navigable deliverable.*
