# CyberDeck — TRD 2E: Security & Identity

**Subsystem TRD · Document 2E** · Version 0.1 (Draft) · June 2026
Inherits conventions from TRD Master §6. Governing ADRs: **0008, 0009, 0016** (also 0005 for the privileged channel, 0006 for plugin permissions).

## Contents
1. Scope & responsibilities
2. Identity model & key management
3. Pairing handshake (wire sequence)
4. Session security
5. Permission model
6. Audit log
7. Secret storage (per-OS)
8. Threat model
9. Normative requirements

---

## 1. Scope & responsibilities

This subsystem owns: device/engine **identity** (keypairs + UUIDs), **pairing** (trust establishment), **session crypto** (handshake → keys; the byte-level transport framing is 2A), the **permission model** the engine enforces on every action, the **audit log**, and **secret storage** for integration credentials. It does **not** own discovery (2A), the action registry (2B), or plugin sandboxing internals (2F) — but it defines the permission contract those enforce.

## 2. Identity model & key management (ADR-0008)

### 2.1 Identities
Two identity kinds, structurally identical:
- **Engine identity** — one per engine install. `{ uuid, ed25519_keypair, label, created_at }`.
- **Device identity** — one per client device (and the Desktop UI is itself a local device identity). Same shape.

Generated **once at first launch**, before and independent of any account (ADR-0016). The UUID is a random 128-bit value; the keypair is Ed25519 (signing/verification) with an X25519 key derived for ECDH session-key agreement.

### 2.2 Storage of one's own keys
The private key never leaves the device and is stored in the OS secure store (§7). The UUID + public key + label are stored in SQLite (engine side) / platform secure prefs (client side). Loss of the private key = identity reset (re-pair required); documented, not recoverable by design (no key escrow in V1).

### 2.3 The trust table (engine side, SQLite — see 2B schema)
Pairing writes a **trust record** per known device:
```
devices
-------
uuid            TEXT PK
label           TEXT
public_key      BLOB        -- the device's Ed25519 public key (the identity anchor)
device_class    TEXT
permissions     TEXT(json)  -- §5
locator_hints   TEXT(json)  -- {lastIp, hostname} — hints only, never identity
revoked         INTEGER     -- 0/1
paired_at       INTEGER
last_seen       INTEGER
```
Trust = "I hold your public key and have marked you paired." IP/MAC are never consulted for trust decisions.

## 3. Pairing handshake (ADR-0008, ADR-0009)

Pairing must: prove the device possesses its private key, prove the engine is the intended one (anti-MITM), and authorize the device (anti-rogue). Three entry methods feed one handshake.

### 3.1 Entry methods
| Method | Carries | Anti-rogue control | Anti-MITM control |
|--------|---------|--------------------|-------------------|
| **QR** (primary) | engine addr(s), port, **short-lived single-use pairing token**, engine pubkey **fingerprint** | token | fingerprint match |
| **Manual** | user-typed addr + port | **PIN** shown on engine, entered on device | fingerprint shown for visual confirm |
| **mDNS-initiated** | discovered addr + fingerprint (TXT) | falls back to PIN/token approval on engine | fingerprint from TXT |

The pairing token and PIN are issued by the engine and surfaced **only via the privileged local control channel** (ADR-0005) — i.e. on the host's own Desktop UI/tray. A LAN client can never mint its own authorization.

### 3.2 Handshake sequence
```
Device                                Engine
  │  (has: engine addr, token|PIN, engine fingerprint)
  │ ── ClientHello ─────────────────►  { device_uuid, device_pubkey,
  │                                       proto_v, token|pin_ref }
  │                                     · validate token (single-use, unexpired)
  │                                       OR await local PIN approval
  │ ◄── ServerHello ───────────────── { engine_uuid, engine_pubkey, nonce_e }
  │   · verify engine_pubkey fingerprint == expected (from QR/TXT/visual)
  │ ── KeyConfirm ──────────────────► { nonce_d,
  │                                       sig_d = Sign(privD, nonce_e‖nonce_d) }
  │                                     · verify sig_d with device_pubkey
  │                                       (proves device holds its private key)
  │ ◄── PairResult ────────────────── { sig_e = Sign(privE, nonce_d‖nonce_e),
  │                                       assigned_class?, default_perms }
  │   · verify sig_e  (proves engine holds its private key)
  │                                     · write trust record (§2.3)
  │  ── both derive session keys (ECDH over X25519) ──►  Session (§4)
```
On success both sides persist the trust relationship; subsequent connects skip token/PIN and go straight to a mutually-authenticated session (§4) using stored public keys.

### 3.3 Re-pair / multi-engine
A device may hold trust records for **multiple engines** (ADR-future cross-engine seam): trust is a set, keyed by engine UUID. Re-pairing an existing device refreshes its record; it does not duplicate identity.

## 4. Session security (ADR-0009)

- **Every session is encrypted and authenticated**, including on LAN. No plaintext mode exists.
- **Key agreement**: ECDH (X25519) using the paired long-term keys + per-session ephemeral keys → forward-secret session keys. (Exact suite — e.g. an established AEAD like ChaCha20-Poly1305 — fixed in the 2A wire spec; this subsystem mandates *that* it is authenticated + forward-secret, 2A mandates *how* it's framed.)
- **Mutual authentication**: each side proves possession of the long-term private key whose public half is in the other's trust table. A device whose public key isn't a (non-revoked) trust record is rejected at handshake.
- **Reconnect** reuses the trust record (no re-pair) but performs a fresh ephemeral key agreement (forward secrecy per session).
- **Privileged local control channel** (loopback, ADR-0005): authenticated as the local engine identity; bound to loopback only; carries service lifecycle + pairing approval + audit access. A network endpoint can never be routed to it.

## 5. Permission model

### 5.1 Shape (stored per device, §2.3 `permissions`)
```jsonc
{
  "allowPowerActions": false,
  "allowedCategories": ["media", "home", "notifications"],   // action categories
  "deniedActions": ["system.killprocess"],                    // explicit denies override category allow
  "allowEditTrigger": true                                    // may put its session into edit/preview mode
}
```

### 5.2 Enforcement points
Permissions are enforced **at the engine, on every interaction event** (TRD Master DF-B) — never trusted to the client/layout. The check order:
```
1. Session authenticated & device not revoked?      → else reject
2. Target action's category ∈ allowedCategories?    → else reject
3. Action ∉ deniedActions?                           → else reject
4. Action is destructive & allowPowerActions==false? → reject
5. Plugin providing the action has its own perms?    → host enforces (2F)
→ execute, then audit (§6)
```
A layout containing a forbidden action simply produces rejected taps on that device — the layout need not be device-specific for safety; the engine is the gate.

### 5.3 Revocation
Setting `revoked=1` causes the device's key to be rejected at the next handshake and any live session to be torn down. Instant, no key rotation needed (the device's own key is simply no longer trusted).

## 6. Audit log (ADR-0014)

Append-only; the durable record of who did what. Schema (2B owns the DB; this subsystem owns semantics):
```
audit_log
---------
id            INTEGER PK
ts            INTEGER         -- epoch ms UTC
actor         TEXT            -- device uuid | "local-ui" | "system" | "flow:<id>"
event_type    TEXT            -- action.executed | action.rejected | device.paired
                              --  | device.revoked | flow.run | flow.failed
                              --  | permission.denied | session.opened | session.closed
resource_type TEXT            -- action | flow | device | session
resource_id   TEXT
payload_json  TEXT            -- type-specific detail; secrets redacted
```
- **Every executed and every rejected action is logged** (FR-4.4) with actor + resource.
- Secrets/tokens are **never** written (redacted `[REDACTED]`).
- Searchable via SQL; an audit-search/export UI is Phase 6 (D14-08) but the data is captured from V1.

## 7. Secret storage (per-OS)

Integration credentials (e.g. a Home Assistant token, Phase 4) and the local private keys live in the **OS secure store**, never in `config.json`, SQLite, or logs:

| OS | Mechanism |
|----|-----------|
| Windows | Windows Credential Manager (DPAPI-backed) |
| macOS | Keychain Services |
| Linux | Secret Service API (libsecret / GNOME Keyring / KWallet); documented fallback to an encrypted file with a clear group-policy note where no keyring exists |

Fallback (headless Linux with no Secret Service) uses an encrypted local file keyed by a machine-bound secret, with an explicit security caveat in operator docs. Never silent plaintext.

## 8. Threat model

| Threat | Vector | Mitigation |
|--------|--------|------------|
| LAN sniffing | Shared Wi-Fi | All traffic encrypted (ADR-0009) |
| MITM during pairing | Spoofed engine | Fingerprint verification (QR/TXT/visual) before key confirm |
| Rogue device pairing | Attacker on LAN attempts pair | Single-use short-lived token / local PIN approval via privileged channel |
| Replay | Captured handshake re-sent | Per-session nonces + ephemeral keys; signatures bind both nonces |
| Compromised device | Stolen paired tablet | Per-device permissions limit blast radius; instant revocation |
| Malicious flow content | Shared/imported flow | Sandboxed expressions, no eval; side effects only via permission-gated actions (ADR-0013) |
| Privilege escalation from LAN | Client tries host control | Privileged control = loopback-only, never network-routable (ADR-0005) |
| Credential theft | Reading config/logs | Secrets only in OS secure store; redacted in logs |
| Data exfiltration | Plugin phones home | Out-of-process perms + no-exfiltration policy; HTTPS-only integrations; (sandbox/signing Phase 6) |
| Key loss | Lost private key | Re-pair required; documented; no escrow (reduces attack surface) |

Out of scope for V1 threat model (revisit with remote phase): relay-server compromise, NAT-traversal abuse, multi-tenant isolation.

## 9. Normative requirements

| ID | Requirement | Trace |
|----|-------------|-------|
| TE-ID-1 | Each device/engine SHALL generate an Ed25519 keypair + 128-bit UUID at first launch, independent of any account. | ADR-0008/0016, FR-2.1 |
| TE-ID-2 | Private keys SHALL be stored in the OS secure store and SHALL NOT leave the device. | ADR-0008 |
| TE-ID-3 | Trust SHALL be the stored public-key relationship; IP/MAC SHALL be locator hints only. | ADR-0008, FR-2.4 |
| TE-PAIR-1 | Pairing SHALL prove device key possession, verify engine fingerprint, and authorize via single-use token or local PIN. | FR-2.3 |
| TE-PAIR-2 | Pairing tokens/PINs SHALL be issued only via the privileged local control channel. | ADR-0005, FR-2.6 |
| TE-PAIR-3 | Pairing tokens SHALL be single-use and time-limited. | §3.1 |
| TE-SEC-1 | All sessions SHALL be encrypted, authenticated, and forward-secret, including on LAN. | ADR-0009, FR-5.1, NFR-11 |
| TE-SEC-2 | A device whose public key is absent or revoked SHALL be rejected at handshake. | §4, FR-4.3 |
| TE-SEC-3 | The privileged control channel SHALL bind to loopback only and SHALL NOT be network-routable. | ADR-0005 |
| TE-PERM-1 | The engine SHALL enforce per-device permissions on every interaction event, regardless of layout content. | FR-4.1/4.2 |
| TE-PERM-2 | Destructive actions SHALL be denied to devices without `allowPowerActions`. | FR-4.1 |
| TE-PERM-3 | Revocation SHALL reject the device at next handshake and tear down live sessions. | FR-4.3 |
| TE-AUD-1 | Every executed and rejected action SHALL be appended to the audit log with actor, type, resource, timestamp. | FR-4.4, ADR-0014 |
| TE-AUD-2 | Secrets/tokens SHALL never be written to the audit log or any log. | §6/§7 |
| TE-STO-1 | Integration credentials SHALL be stored in the OS secure store, never in config files, SQLite, or logs. | §7 |

---
*End of TRD 2E (Draft v0.1). Wire-level framing/crypto suite specifics are fixed in 2A §4. Plugin permission enforcement detail is in 2F.*
