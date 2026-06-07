# CyberDeck — TRD 2A: Transport & Connectivity

**Subsystem TRD · Document 2A** · Version 0.1 (Draft) · June 2026
Inherits TRD Master §6. Governing ADRs: **0009, 0010, 0011, 0015** (pairing/crypto semantics in 2E).

## Contents
1. Scope & responsibilities
2. Endpoint abstraction (LAN now → relay later)
3. Discovery
4. Connection lifecycle & state machine
5. Wire protocol (framing, envelope, crypto suite)
6. The three channels
7. Resilience (heartbeat, reconnect, degradation, resync)
8. Multi-session fan-out
9. Normative requirements

---

## 1. Scope & responsibilities

Owns: how bytes move between engine and devices (and engine↔Desktop UI over loopback). Discovery, the endpoint abstraction, connection lifecycle, wire framing, the crypto suite (the *how* behind 2E's mandates), the three logical channels, and resilience. Does **not** own trust decisions (2E) or message *semantics* (2B/2C/2D); it carries their payloads.

## 2. Endpoint abstraction (ADR-0010 — the forward-compat seam)

All addressing flows through a single interface:
```go
type TransportEndpoint interface {
    Dial(ctx) (Conn, error)      // open a raw transport connection
    Describe() EndpointInfo       // kind, address(es), reachability
}
type ConnectionManager interface {
    Resolve(deviceUUID) ([]TransportEndpoint, error) // ordered candidates
    Open(deviceUUID) (Session, error)                // resolve → dial → handshake → session
}
```
**V1**: `Resolve` returns `LanEndpoint`s (direct sockets) built from locator hints + discovery. **Remote phase**: adds `RelayEndpoint`; `Resolve` may return it as an additional candidate. **Nothing above `ConnectionManager`** (sessions, channels, engine, document model) knows the endpoint kind. This is the seam that makes remote additive, not a rewrite.

Endpoint **candidate ordering** (V1): last-known direct IP → mDNS-resolved address → active-scan result. (Remote phase appends relay as a lower-priority candidate so LAN stays preferred when both are reachable.)

## 3. Discovery (FR-2.2, FR-2.5)

| Mechanism | Role | Detail |
|-----------|------|--------|
| **mDNS / DNS-SD** | Primary zero-config | Engine advertises `_cyberdeck._tcp.local`, TXT = `{name, uuid, ver, fp}` (fp = engine pubkey fingerprint, used for anti-MITM at pair). Clients browse to find hosts. |
| **QR** | Fast trusted pair | Encodes candidate addrs + port + token + fp (2E §3). |
| **Manual** | Multicast-blocked nets | User types addr:port; PIN confirms (2E). |
| **Active scan** | Relocate known device | If last IP fails and mDNS silent, bounded subnet sweep attempting handshake; **UUID in the handshake confirms identity** (not IP). Rate-limited, opt-in, bounded to the local subnet. |

Enterprise reality: mDNS is often blocked or VLAN-isolated, so manual + active-scan fallbacks are **required**, not optional (a documented incumbent failure mode).

## 4. Connection lifecycle & state machine

```
        ┌─────────┐  discover/known        ┌────────────┐
        │  IDLE   │ ─────────────────────► │ RESOLVING  │
        └─────────┘                        └─────┬──────┘
             ▲                                    │ endpoint chosen
             │ give up (user)                     ▼
        ┌────┴────────┐   backoff expired   ┌────────────┐
        │ DISCONNECTED│ ◄────────────────── │  DIALING   │
        └────┬────────┘                     └─────┬──────┘
             │                                    │ tcp ok
             │ reconnect                           ▼
             │                              ┌────────────┐  not trusted/ revoked
             │                              │ HANDSHAKE  │ ───────────────► FAIL→DISCONNECTED
             │                              └─────┬──────┘
             │                                    │ session keys (2E)
             │                                    ▼
             │  drop / heartbeat-miss      ┌────────────┐
             └──────────────────────────── │ CONNECTED  │ (runtime or edit mode)
                                            └────────────┘
```
On drop from `CONNECTED`: → `RESOLVING` (reconnect path) with exponential backoff; if direct fails → mDNS rediscovery → active scan; on success a fresh forward-secret session is established (2E §4). UI reflects each state via the connection badge.

## 5. Wire protocol

### 5.1 Framing
- Transport: TCP (LAN). One **length-prefixed** frame per message: `uint32 length ‖ ciphertext`. (Length-prefix chosen over newline-delimited so binary-safe ciphertext needs no escaping; the JSON payload lives *inside* the encrypted frame.)
- After handshake, every frame's payload is AEAD-encrypted with the session key.

### 5.2 Envelope (TRD Master §6.3, JSON for V1 — ADR-0015)
Decrypted payload is the shared envelope:
```jsonc
{ "v":1, "ch":"state|layout|preview|control", "type":"…", "seq":10432, "ts":1719000000, "payload":{…} }
```
`seq` is **per-channel monotonic**, enabling gap detection (§7.4). The `Serializer` abstraction wraps encode/decode so a future binary codec (MessagePack/CBOR) can replace JSON **per channel** — realistically only the State channel ever would (ADR-0015).

### 5.3 Crypto suite (the *how* for 2E §4)
- Handshake key agreement: **X25519 ECDH** (paired long-term keys + per-session ephemerals) → forward-secret shared secret → HKDF → directional AEAD keys.
- Record encryption: an established **AEAD** (e.g. ChaCha20-Poly1305) with per-direction nonce counters.
- Mutual auth: Ed25519 signatures over handshake nonces (2E §3.2).
- Loopback (Desktop UI): same suite; the privileged control channel additionally restricted to loopback bind (2E §4).

## 6. The three channels (ADR-0011)

One session multiplexes three logical channels (the `ch` field); they differ by cadence and durability, not by socket.

| Channel | Dir | Payload (owned by) | Cadence | Durability | Backpressure policy |
|---------|-----|--------------------|---------|-----------|---------------------|
| **State** | E→C | delta state updates (2B) | 0.5–10s/state | ephemeral | coalesce: newest value wins; drop stale |
| **Layout** | E↔C | versioned ops (2C) down; interaction/action events (2B/2C) up | on edit / on tap | durable, ordered | never dropped; ordered delivery; gap→resync |
| **Preview** | E→C | throttled drag ghosts (2C) | 30–60 Hz | never persisted | drop-on-overflow; latest-only |
| **Control** | UI↔E | service lifecycle, pairing approval, audit (2E) | rare | n/a | loopback-only |

Rationale: a per-second CPU update (State, droppable) must never block or pollute a layout op (Layout, durable, ordered). Coalescing State means a slow client gets the *latest* value, not a backlog.

## 7. Resilience (the #1 incumbent pain — directly targeted)

### 7.1 Heartbeat / keepalive (FR-5.2)
Bidirectional heartbeat at a fixed interval keeps the session warm and detects silent death. The engine treats a device as alive across OS sleep windows by tolerating heartbeat gaps up to a grace bound before declaring drop — avoiding the spurious disconnects that plague the incumbents.

### 7.2 Reconnect (FR-5.3)
Exponential backoff (capped) on the reconnect loop: direct last-IP → mDNS rediscovery → active scan. Each attempt re-runs the full lifecycle (§4). Target: reconnect < 5s under normal LAN conditions (NFR-05).

### 7.3 Graceful degradation (FR-5.4)
On drop, the client does **not** freeze or lie: bound widgets render their **last value dimmed** with a **connection badge** (`connected` / `degraded` / `disconnected`), and any capability that was `unavailable` stays `--`. No false "live" data.

### 7.4 Versioned resync (FR-5.5, ADR-0012)
Each channel carries `seq`; the Layout channel additionally carries the document version. A client detecting a `seq` gap (missed messages during a blip) **requests a full document resync at the current version** rather than attempting to replay missing ops. The engine, being the single source of truth (ADR-0002), answers authoritatively. State channel needs no resync (next tick supersedes).

## 8. Multi-session fan-out (NFR-10)

The engine maintains an **independent session per device** (per-session goroutines in Go — ADR-0005). State deltas are computed once and fanned out to each session's State channel filtered by that session's **subscriptions** (a client only receives states its current layout binds). Layout ops are fanned out only to sessions whose device is assigned the edited profile and in edit/preview mode. Target: ≥8 concurrent sessions with no degradation (NFR-10); the per-session model scales linearly with cores.

Subscription model: on layout assignment/op, the client's set of bound state IDs is known to the engine; the engine sends deltas only for subscribed states (reinforcing the ~80% idle-traffic reduction from delta broadcast).

## 9. Normative requirements

| ID | Requirement | Trace |
|----|-------------|-------|
| TA-EP-1 | All addressing SHALL flow through `TransportEndpoint`/`ConnectionManager`; no component above it SHALL know the endpoint kind. | ADR-0010 |
| TA-EP-2 | V1 endpoints SHALL resolve to direct LAN sockets; a relay endpoint type SHALL be addable without changes above the ConnectionManager. | ADR-0010 |
| TA-DISC-1 | The engine SHALL advertise via mDNS with name/uuid/version/fingerprint TXT records. | FR-2.2 |
| TA-DISC-2 | Manual and active-scan fallbacks SHALL exist for multicast-blocked networks; active scan SHALL confirm identity by UUID. | FR-2.5 |
| TA-WIRE-1 | Messages SHALL be length-prefixed frames; post-handshake payloads SHALL be AEAD-encrypted. | ADR-0009 |
| TA-WIRE-2 | All messages SHALL use the shared envelope with per-channel monotonic `seq`. | Master §6.3, ADR-0012 |
| TA-WIRE-3 | Encode/decode SHALL go through the `Serializer` abstraction (JSON in V1) to allow a per-channel binary codec later. | ADR-0015 |
| TA-CRYP-1 | Sessions SHALL be forward-secret via per-session ephemeral X25519 agreement. | ADR-0009, 2E TE-SEC-1 |
| TA-CH-1 | The session SHALL multiplex State, Layout, Preview channels (+ Control on loopback). | ADR-0011 |
| TA-CH-2 | State channel SHALL coalesce (latest-wins, droppable); Layout channel SHALL be ordered and lossless. | ADR-0011 |
| TA-CH-3 | Preview messages SHALL be droppable and SHALL NOT be persisted. | ADR-0011 |
| TA-RES-1 | The transport SHALL maintain heartbeat tolerant of OS-sleep gaps within a grace bound. | FR-5.2 |
| TA-RES-2 | On drop, reconnect SHALL use backoff → mDNS → active scan; target <5s on LAN. | FR-5.3, NFR-05 |
| TA-RES-3 | On disconnect, the client SHALL show last value dimmed + connection badge; never frozen/false live data. | FR-5.4 |
| TA-RES-4 | A client detecting a Layout `seq` gap SHALL request a full document resync. | FR-5.5, ADR-0012 |
| TA-FAN-1 | The engine SHALL maintain an isolated session per device and fan out deltas filtered by subscription. | FR-3.1, NFR-10 |

---
*End of TRD 2A (Draft v0.1). Crypto suite specifics (exact KDF/AEAD params) and relay-endpoint wire details to be deepened on review or at the remote phase.*
