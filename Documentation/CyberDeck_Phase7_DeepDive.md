# CyberDeck — Phase 7 (Remote Access) Deep Dive

**Document 9 of the CyberDeck Enterprise Documentation Set · Per-Phase Deep Dive**
Version 0.1 (Draft) · June 2026 · Codebase ID: `com.shishir.cyberdeck`

> Implementation-depth specification for **Phase 7 (Remote Access)**. This is the phase the whole architecture was built to make *additive*: activating the LAN-now/remote-later seam (ADR-0010) so a client outside the LAN can reach the engine — **without changing identity, crypto, sessions, or the document/state model** (ADR-0008/0009/0002). It also introduces the optional **account/cloud overlay** (ADR-0016) that gates remote and the hosted marketplace. New decisions: **ADR-0030 (relay/rendezvous architecture)**, **ADR-0031 (account overlay & licensing enforcement boundary)**, **ADR-0032 (remote security hardening & relay trust)**.

## Contents
1. Phase intent & definition of done
2. Scope: in / out
3. The seam this phase activates (and what must NOT change)
4. Workstream map
5. WS-7.1 Relay / rendezvous service
6. WS-7.2 Remote endpoint type & connection manager
7. WS-7.3 NAT traversal & path selection
8. WS-7.4 Account / cloud overlay
9. WS-7.5 Cloud backup & sync
10. WS-7.6 Remote security hardening
11. End-to-end realized journeys
12. Code structure (additions)
13. Test plan
14. Milestones & sequencing
15. Risks & mitigations
16. Acceptance criteria (traced)

---

## 1. Phase intent & definition of done

**Intent.** Let a user control their engine from outside the local network (e.g. home PC from the office) and back up/sync their configuration — by adding a relay-backed transport endpoint behind the Phase-1 `ConnectionManager` abstraction and an optional account overlay, **without touching the trust, crypto, session, or data model.** This phase proves ADR-0010's promise: remote is an *addition*, not a *rewrite*.

**Definition of done.**
- A paired client connects to its engine from outside the LAN; identity, encryption, and sessions behave identically to LAN (only the endpoint differs).
- The relay is a **blind transport** — it cannot read session contents (E2E encryption from ADR-0009 holds end-to-end through the relay).
- LAN remains preferred when both paths are reachable; remote is a fallback candidate.
- Account creation is optional and gates **only** cloud features (remote, backup, sync, hosted marketplace) — local use stays free and account-free (ADR-0016).
- Cloud backup/sync round-trips configuration (never secrets).
- All Phase-7 ACs verified; remote-specific threats mitigated; no regression to LAN behavior.

## 2. Scope: in / out

### In scope (Phase 7)
| Area | Included | PRD |
|------|----------|-----|
| Relay | rendezvous + relay transport (blind) | D3-09 |
| NAT | traversal + direct-vs-relay path selection | D3-10 |
| Endpoint | `RelayEndpoint` behind ConnectionManager (ADR-0010 realized) | — |
| Account | optional account overlay; licensing-gating | D16-01, D16-03 |
| Cloud | config backup & sync | D16-02 |
| Security | remote hardening, relay trust, abuse limits | — |
| Marketplace | hosted marketplace backend (straddles from P6) | D15-06 |

### Out of scope
Team sharing (P8) · collaboration/adaptive layouts (P8). Cross-engine binding is P8.

## 3. The seam this phase activates (and what must NOT change)

This phase is the explicit test of Doc 0 §10. The contract:

| Concern | Stays identical (built P1) | Phase 7 adds |
|---------|----------------------------|--------------|
| Identity | keypair + UUID (ADR-0008) | — |
| Encryption | E2E over session keys (ADR-0009) | E2E now traverses a relay; relay is blind |
| Sessions | per-device, isolated (ADR-0002) | — transport-agnostic, unchanged |
| Document/state model | unchanged | — |
| Addressing | `TransportEndpoint`/`ConnectionManager` (ADR-0010) | a `RelayEndpoint` implementation |
| Discovery | mDNS/QR/manual | + a rendezvous lookup for remote |
| Permissions/audit | per-device (2E) | unchanged (a remote device is still a device) |

**The rule (non-negotiable):** nothing above the `ConnectionManager` learns that a session is remote. If any engine/session/document code needs an `if remote` branch, the seam was wrong — and it wasn't (ADR-0010 was designed for exactly this).

## 4. Workstream map

```
WS-7.1 Relay/rendezvous service ─► WS-7.2 RelayEndpoint ─► WS-7.3 NAT/path selection
WS-7.4 Account overlay ─► WS-7.5 Backup/sync ; gates WS-7.1 (remote) + hosted marketplace
WS-7.6 Remote security hardening (cross-cutting, gates GA)
```

---

## 5. WS-7.1 — Relay / rendezvous service

**ADR:** **0030 (new)**. **PRD:** D3-09.

### 5.1 The decision (ADR-0030)
**A blind relay + rendezvous service; the cloud never sees plaintext.**
- **Rendezvous**: a lookup service where an engine (with an account, WS-7.4) registers its reachability; a remote client resolves its paired engine's current relay address by engine UUID. (Replaces mDNS, which is LAN-only, for the remote path.)
- **Relay**: forwards encrypted frames between client and engine when a direct path can't be established. The relay **only sees ciphertext** — the E2E session keys (ADR-0009) are negotiated end-to-end between the paired device and engine; the relay is a dumb pipe. It cannot read media, telemetry, actions, or anything.
- The relay/rendezvous is the **first and only cloud-hosted server component** in the product; it is deliberately minimal (transport only — no application logic, no plaintext).

### 5.2 Technical spec
- Engine registers with rendezvous on remote-enable: `{engine_uuid, account_id, relay_session_token}`; heartbeats to stay registered.
- A remote client authenticates to rendezvous via its account, requests its engine's relay path, and opens a relayed connection; the **CyberDeck handshake (2E §3) then runs end-to-end through the relay** exactly as on LAN — the relay never participates in key agreement.
- Relay enforces per-account rate/bandwidth limits (abuse control, WS-7.6).

### 5.3 Code structure
```
cloud/relay/          // the relay/rendezvous service (Go) — minimal, transport-only
  rendezvous.go register.go resolve.go
  relay.go forward.go   // ciphertext forwarding; no plaintext access
  limits.go             // per-account rate/bandwidth
engine/core/transport/relay_register.go   // engine registers/heartbeats when remote-enabled
```

---

## 6. WS-7.2 — Remote endpoint type & connection manager

**ADR:** 0010 (realized). 

### 6.1 Capability detail
- A new `RelayEndpoint` implements the Phase-1 `TransportEndpoint` interface. `ConnectionManager.Resolve(deviceUUID)` now may return, as ordered candidates: direct last-IP → mDNS (LAN) → **RelayEndpoint** (remote). LAN candidates rank above relay so **LAN is preferred** when both are reachable.
- Everything above the ConnectionManager (sessions, channels, document model, engine) is **untouched** — it dials an endpoint and runs the same handshake/session.

### 6.2 Technical spec
- `RelayEndpoint.Dial` resolves via rendezvous (WS-7.1) and opens a relayed connection; from the session's perspective it's just a `Conn`.
- The three channels (2A) ride the relayed connection identically; resilience (heartbeat/reconnect/resync) works unchanged — reconnect may now re-resolve via rendezvous as an additional candidate.
- Asset delivery (ADR-0021) and periodic frames (ADR-0026) work over relay transparently (they're request/response over the session).

### 6.3 Code structure
```
engine/core/transport/endpoint_relay.go   // RelayEndpoint (impl of TransportEndpoint)
engine/core/transport/connmgr.go           // (extended) relay as a lower-priority candidate
client/lib/net/connection_manager.dart      // (extended) remote candidate + rendezvous lookup
```

---

## 7. WS-7.3 — NAT traversal & path selection

**PRD:** D3-10.

### 7.1 Capability detail
- Attempt **direct peer-to-peer** first (hole-punching via the rendezvous as a signaling channel — STUN-like); fall back to **relay** when direct fails (symmetric NAT, restrictive firewalls).
- **Path selection** order: LAN direct → WAN direct (hole-punched) → relay. Always prefer the cheapest/lowest-latency reachable path; relay is the guaranteed-works fallback.

### 7.2 Technical spec
- Rendezvous doubles as the **signaling** channel for hole-punching (exchange candidate addresses); if direct succeeds, the relay is bypassed (lower latency, no relay bandwidth cost); if not, frames flow through the relay.
- Path can upgrade/downgrade mid-session (e.g. relay → direct once hole-punch succeeds) transparently to the session.

### 7.3 Code structure
```
engine/core/transport/nat/{holepunch.go, candidates.go, path_select.go}
client/lib/net/nat.dart
```

---

## 8. WS-7.4 — Account / cloud overlay

**ADR:** **0031 (new)**. **PRD:** D16-01/03.

### 8.1 The decision (ADR-0031)
**The account is an optional overlay that references device identities; it never owns them, and it gates cloud features only.**
- **Identity stays account-independent** (ADR-0008/0016): keypair+UUID exist from first launch. An account, when created, is a *separate* record that **references** the engine/device UUIDs for cloud services. Deleting the account does not delete identities or local function.
- **Licensing enforcement boundary**: licensing is checked **only at the cloud boundary** (rendezvous/relay/backup APIs), never in the local engine. Local control, designer, flows, plugins — all work with no account, no check, forever. A lapsed subscription disables *remote/backup/sync*; it never touches local use (ADR-0016).
- **Device-count is never enforced** — a paid account uses any number of personal devices (ADR-0016 restated as an enforcement rule).

### 8.2 Technical spec
- Account record (the `accounts` table reserved in 2B §6) links to engine/device UUIDs; auth via standard account credentials to the cloud APIs.
- The engine gains a thin "cloud client" that authenticates to rendezvous/backup; it is **inert without an account** and its absence changes nothing locally.
- Licensing tier (`accounts.tier`) gates which cloud APIs the account may call; enforced server-side at the cloud boundary.

### 8.3 Code structure
```
engine/core/cloud/account.go authclient.go   // optional; inert without account
cloud/api/{account,auth,licensing}.go         // cloud boundary; licensing enforced here ONLY
client/lib/cloud/account_ui.dart
```

---

## 9. WS-7.5 — Cloud backup & sync

**PRD:** D16-02.

### 9.1 Capability detail
- **Backup**: export the document set (profiles/pages/widgets), flows, variables, device labels, and config to the cloud — **never secrets** (2E §7; credentials are re-entered after restore, carried).
- **Sync**: keep configuration consistent across a user's engines (e.g. desktop + laptop) — last-write-wins per document with version (the op-log/versioning from ADR-0012 provides the version basis).

### 9.2 Technical spec
- Backup payload is the same serialized document set used by Phase-2 import/export (WS-2.7) — reused, not reinvented; encrypted client-side before upload (cloud stores ciphertext blobs — the backup server is as blind as the relay).
- Restore: download → decrypt → import (Phase-2 import path) → re-enter credentials.
- Sync conflicts: document version compare; last-write-wins with a surfaced "this was changed elsewhere" notice (full CRDT merge is P8 collaboration territory).

### 9.3 Code structure
```
engine/core/cloud/backup.go sync.go         // client-side encrypt; reuse layout portability
cloud/api/backup.go                          // blind blob store
```

---

## 10. WS-7.6 — Remote security hardening

**ADR:** **0032 (new)**. 

### 10.1 The decision (ADR-0032)
**Remote widens the attack surface; harden at the new edges without weakening the E2E core.**
- **Relay is blind** (ADR-0030): cannot read session contents; compromise of the relay leaks *traffic metadata at most*, never plaintext.
- **Rendezvous abuse control**: rate limits, account-scoped registration, and engine-side **explicit remote-enable** (remote is off by default; a user must turn it on per engine via the privileged local channel — a remote attacker cannot enable remote).
- **Remote device permissions unchanged**: a remote device is still a device with per-device permissions (2E §5) and full audit; remote does not grant extra capability. Users may set **stricter permissions for remote sessions** (e.g. deny power actions when off-LAN) — an optional per-device "remote profile."
- **Replay/abuse at the relay**: session-level nonces/forward-secrecy (2E/2A) already defeat replay; the relay adds connection-level rate limiting and anomaly logging.
- **Threat-model additions** (deferred from 2E §8): relay compromise (mitigated: blind), rendezvous compromise (mitigated: metadata only + abuse limits), credential stuffing on accounts (standard account-security controls), and remote DoS (rate/bandwidth limits).

### 10.2 Code structure
```
engine/core/transport/relay_register.go   // remote-enable gated to privileged local channel
engine/core/security/remote_perms.go       // optional stricter remote permission profile
cloud/relay/limits.go anomaly.go
```

---

## 11. End-to-end realized journeys (Phase 7)

**Control home PC from the office (PRD Journey 7, now real).** User enables remote on the home engine (privileged local action) + signs into an account → engine registers with rendezvous. From a phone on cellular, the client resolves the engine via rendezvous, hole-punches (or relays), runs the **same handshake and session** as on LAN, and controls the PC. Returning home, the client prefers the LAN path automatically.

**Blind relay.** Even when traffic flows through the relay, the relay operator sees only ciphertext — media, telemetry, and actions are unreadable (E2E from ADR-0009).

**Backup & restore.** A user backs up their configuration to the cloud (encrypted client-side); after reinstalling on a new PC, they restore the document set and flows, then re-enter integration credentials (never backed up).

**Lapsed subscription.** A user's subscription lapses → remote/backup stop working → **local use is completely unaffected** (no account check ever runs locally).

## 12. Code structure (additions)

```
cloud/                         // FIRST cloud component in the product
  relay/{rendezvous,register,resolve,relay,forward,limits,anomaly}.go
  api/{account,auth,licensing,backup}.go
engine/core/
  transport/{endpoint_relay.go, relay_register.go, nat/*}
  cloud/{account.go, authclient.go, backup.go, sync.go}
  security/remote_perms.go
client/lib/
  net/{connection_manager.dart(+relay), nat.dart}
  cloud/{account_ui.dart, backup_ui.dart}
```
> Note the engine-core additions are thin: a relay endpoint, a relay-register hook, NAT helpers, an inert-without-account cloud client. **Sessions, channels, documents, flows, permissions, audit — all unchanged.** ADR-0010 validated.

## 13. Test plan

| Layer | Scope | Pass criteria |
|-------|-------|---------------|
| Unit — endpoint | RelayEndpoint as a drop-in TransportEndpoint; candidate ordering (LAN>relay) | LAN preferred; relay fallback |
| Integration — relay blind | capture relay traffic | ciphertext only; no plaintext recoverable |
| Integration — handshake over relay | full 2E handshake through relay | identical session to LAN |
| Integration — NAT | direct hole-punch success + relay fallback; mid-session upgrade | path selection correct |
| Integration — no `if remote` | audit engine/session/document code for transport-kind branches | none exist (seam holds) |
| Integration — account optional | full local use with no account; remote/backup gated by account | local unaffected; cloud gated |
| Integration — backup/restore | round-trip config; secrets excluded; client-side encryption | restore works; no secrets in cloud |
| Integration — remote-enable gating | attempt remote-enable from a remote session | denied; only privileged local channel can enable |
| Security (red-team) | relay compromise, rendezvous abuse, credential stuffing, remote DoS | metadata-only leak; abuse limited; no plaintext |
| Regression — LAN | all prior phases on LAN | no regression |

## 14. Milestones & sequencing

| Milestone | Content | Gate |
|-----------|---------|------|
| **M7.1 Relay/rendezvous** | WS-7.1 | engine registers; client resolves; blind ciphertext forwarding |
| **M7.2 Remote endpoint** | WS-7.2 | handshake+session over relay identical to LAN; LAN preferred |
| **M7.3 NAT** | WS-7.3 | direct hole-punch + relay fallback + mid-session upgrade |
| **M7.4 Account + backup/sync** | WS-7.4 + WS-7.5 | optional account; remote/backup gated; config round-trips encrypted |
| **M7.5 Harden + hosted marketplace** | WS-7.6 (+P6 hosted marketplace) | red-team contained; remote off-by-default; no LAN regression |

## 15. Risks & mitigations

| Risk | Prob | Impact | Mitigation |
|------|------|--------|-----------|
| Any `if remote` creeping into core | Low | High | The seam (ADR-0010) forbids it; audited in tests; if found, fix the seam not the symptom |
| Relay sees plaintext | Low | Critical | E2E keys end-to-end (ADR-0009); relay is a ciphertext pipe; verified by capture test |
| Rendezvous/relay as a SPOF or abuse target | Med | Med | Minimal blind service; rate/bandwidth limits; anomaly logging; LAN works without it |
| Remote enabled by an attacker | Low | High | Remote-enable gated to the privileged local channel (off by default) |
| Subscription lapse breaks local use | Low | High | Licensing enforced only at the cloud boundary; local never checks (ADR-0031) |
| NAT traversal fails on hostile networks | Med | Low | Relay fallback guarantees connectivity (at a latency cost) |
| Cloud cost/scale of relaying media frames | Med | Med | Prefer direct path; relay bandwidth-limited; assets are pull-based and cached |

## 16. Acceptance criteria (traced)

| AC | Criterion | Trace |
|----|-----------|-------|
| P7-AC-01 | A paired client controls its engine from outside the LAN; identity, encryption, and sessions are identical to LAN. | ADR-0010, M7.2 |
| P7-AC-02 | The relay is blind: captured relay traffic is ciphertext only; no plaintext is recoverable. | ADR-0009/0030, M7.1 |
| P7-AC-03 | LAN is preferred when reachable; relay is a fallback; direct hole-punch is tried before relay. | ADR-0010, M7.2/7.3 |
| P7-AC-04 | No engine/session/document code branches on transport kind (no `if remote`). | ADR-0010, M7.2 |
| P7-AC-05 | Account creation is optional; local use (control/designer/flows/plugins) works fully with no account. | ADR-0016/0031, M7.4 |
| P7-AC-06 | Remote/backup/sync are gated by account+licensing at the cloud boundary only; a lapsed subscription never affects local use. | ADR-0031, M7.4 |
| P7-AC-07 | Device-count is never enforced; a paid account uses any number of personal devices. | ADR-0016, M7.4 |
| P7-AC-08 | Backup round-trips configuration encrypted client-side; secrets are excluded and re-entered on restore. | D16-02, M7.4 |
| P7-AC-09 | Remote is off by default and can only be enabled via the privileged local channel. | ADR-0032, M7.5 |
| P7-AC-10 | Remote sessions honor per-device permissions and audit; optional stricter remote permission profiles work. | 2E, ADR-0032, M7.5 |
| P7-AC-11 | All prior-phase LAN behavior is unchanged (no regression). | all, M7.5 |

---
*End of Phase 7 Deep Dive (Draft v0.1). New decisions ADR-0030/0031/0032 appended to the Decision Log. Next: Phase 8 (Advanced).*
