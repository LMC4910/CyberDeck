# CyberDeck — TRD 2B: Engine Core

**Subsystem TRD · Document 2B** · Version 0.1 (Draft) · June 2026
Inherits TRD Master §6. Governing ADRs: **0002, 0005, 0014, 0019** (registries also feed 2C/2D/2F).

## Contents
1. Scope & responsibilities
2. State store
3. Registries (action / widget-type / flow-node)
4. Event bus
5. Session & profile model
6. Persistence (SQLite schema)
7. Service lifecycle & supervision
8. Normative requirements

---

## 1. Scope & responsibilities

The engine core is **deliberately small** (ADR-0006): it owns the **state store**, the **registries**, the **event bus**, the **session/profile model**, **persistence (SQLite)**, and **service lifecycle** — plus it *hosts* (but does not implement) transport (2A), security (2E), flow engine (2D), layout store (2C), and the plugin host (2F). It contains **no capability-specific business logic**; all capabilities are plugins (ADR-0006).

## 2. State store (ADR-0019)

### 2.1 Model
The authoritative, in-memory registry of all current state values.
```go
type State struct {
    ID        string      // "system.cpu.temp"
    Kind      StateKind   // scalar | text | boolean | enum | series
    ValueType string      // number | string | bool
    Unit      string      // presentation hint only ("°C")
    Value     any         // TYPED native value (42.0), not "42.0 °C"  (ADR-0019)
    Series    *RingBuffer // non-nil for Kind==series (in-memory, e.g. 60 samples)
    UpdatedAt int64
    Source    string      // "plugin:core.telemetry"
}
```
**Typed values, not formatted strings** (ADR-0019) — so the flow engine can evaluate `system.cpu.temp > 85` numerically and a gauge can use the raw number; units/precision are applied at render time from widget style.

### 2.2 Update path & delta computation (feeds 2A State channel)
```
provider (plugin) → host IPC → StateStore.Set(id, value)
  → if value unchanged: no-op (delta suppression)
  → else: update value+UpdatedAt; if series: push to ring buffer
       → mark dirty
       → emit to event bus (threshold checks, flow stateChange triggers)
       → enqueue delta for fan-out (2A): only dirty states, only to subscribers
```
**Delta broadcasting** (only changed states) and **per-session subscription filtering** together produce the ~80% idle-traffic reduction. Series ring buffers live **only in memory** and are never persisted (ADR-0014).

### 2.3 Subscriptions
Each session declares the set of state IDs its current layout binds (derived by 2C from the layout doc). The store fans a delta to a session only if that state ∈ its subscription set.

### 2.4 Variables as states (`var.*`)
User variables (2D) are first-class states under the `var.` namespace — durable (SQLite, §6), typed, and **bindable by widgets** like any other state. A flow writing `var.mic_muted` updates the state store, which fans out and triggers any watchers, exactly like telemetry.

## 3. Registries (schema-driven — the keystone)

Three parallel registries; all schema-driven, all populated by plugins (first-party and third-party identically — ADR-0006). The **designer reads these schemas to auto-generate its UI** (2C); this is what unifies the plugin ecosystem and the designer.

### 3.1 Action registry
```jsonc
{ "id":"media.volume.set", "label":"Set System Volume", "category":"media",
  "source":"plugin:core.media",
  "params":[ {"name":"level","type":"int","min":0,"max":100,"required":true} ],
  "confirmation":false, "destructive":false }
```
Param types (V1): `int, float, string, bool, choice, color, entity, file, folder, duration`. `category` + `destructive` feed the permission model (2E §5). Numeric `min/max` are validated by the engine on action receipt (clamp or reject per schema).

### 3.2 Widget-type registry
```jsonc
{ "type":"gauge.circular", "label":"Circular Gauge", "source":"builtin",
  "acceptsStateKinds":["scalar"],
  "configSchema":[ {"name":"min","type":"float","default":0}, {"name":"max","type":"float","default":100},
                   {"name":"unit","type":"string","default":""}, {"name":"sparkline","type":"bool","default":false} ],
  "gestures":["tap","longPress"] }
```
`acceptsStateKinds` lets the designer offer only compatible states when binding. `gestures` declares which interaction slots the type exposes.

### 3.3 Flow-node registry (feeds 2D)
Core nodes are registered like actions; plugins may add nodes later (Phase 6). Each declares its kind, params schema, and execution contract handle.

### 3.4 Registration & merge
Plugins declare contributions in their manifest (2F). The host validates against the schema-of-schemas and merges into the global registries; ID collisions are rejected with a diagnostic. Registries are queryable (e.g. "all actions in category media", "all widgets accepting scalar states") — backing the designer's pickers.

## 4. Event bus

Internal pub/sub decoupling producers (state changes, plugin events, lifecycle) from consumers (flow triggers, threshold alerts, audit, fan-out).
- **Events**: `state.changed`, `threshold.crossed` (cpu/gpu/ram), `device.*`, `plugin.*`, `session.*`, `flow.*`.
- The **flow engine subscribes** for `event` and `stateChange` triggers (2D §triggers); the **audit log subscribes** for governance; **fan-out** subscribes for client delivery.
- In-process, ordered per topic, non-blocking (slow consumers get a bounded queue; overflow policy logged).

## 5. Session & profile model (ADR-0002)

### 5.1 Sessions
One **session per connected device** (created by 2A post-handshake, identity from 2E). Holds: device UUID, permissions snapshot, active profile, subscription set, mode (`runtime` | `edit/preview`). **Isolated** — two sessions never share mutable state, which is what guarantees "no confusion which device" and lets two tablets show different profiles simultaneously (FR-3.1/3.2).

### 5.2 Profiles & activation
A **profile** is a named set of pages with an optional **activation rule**. V1 stores the rule and provides the **evaluation hook**; the consumer that auto-switches on app focus is Phase 2 (foundation seam per Doc 0 §12).
```jsonc
{ "id":"profile_game", "label":"Gaming",
  "activationRule": { "kind":"appFocus", "match":"Cyberpunk2077.exe" },  // evaluated, not yet auto-applied in V1
  "pages":[ "page_dash", "page_stats" ] }
```
A session has one active profile at a time; `navigate` (widget or flow) switches page/profile within the session.

## 6. Persistence — SQLite schema (ADR-0014)

Single embedded SQLite file; durable data only (live state is in-memory, §2). Append-only audit log. Tables:

```sql
-- documents: profiles, pages, widgets serialized as the layout doc tree (2C owns shape)
documents(
  id TEXT PRIMARY KEY, kind TEXT,            -- 'profile' | 'page'
  device_class TEXT, version INTEGER,         -- monotonic doc version (2C/ADR-0012)
  body_json TEXT, updated_at INTEGER );

-- registry_items: merged registry contributions (action/widget/flow-node)
registry_items(
  id TEXT PRIMARY KEY, kind TEXT,             -- 'action'|'widget'|'flownode'
  source TEXT, schema_json TEXT, version INTEGER );

-- variables: var.* — typed, durable
variables(
  name TEXT PRIMARY KEY, value_type TEXT, value_json TEXT, updated_at INTEGER );

-- workflows: flows (2D owns shape)
workflows(
  id TEXT PRIMARY KEY, label TEXT, version INTEGER, body_json TEXT, updated_at INTEGER );

-- devices: trust + permissions (2E owns semantics)
devices(
  uuid TEXT PRIMARY KEY, label TEXT, public_key BLOB, device_class TEXT,
  permissions_json TEXT, locator_hints_json TEXT, revoked INTEGER, paired_at INTEGER, last_seen INTEGER );

-- accounts: optional cloud overlay (Phase 7); references device UUIDs, never owns identity (ADR-0016)
accounts(
  id TEXT PRIMARY KEY, email TEXT, tier TEXT, created_at INTEGER );

-- audit_log: append-only (2E §6 owns semantics)
audit_log(
  id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER, actor TEXT,
  event_type TEXT, resource_type TEXT, resource_id TEXT, payload_json TEXT );

-- meta: schema/config versioning for migrations
meta( key TEXT PRIMARY KEY, value TEXT );
```
- `body_json`/`schema_json`/`*_json` hold the typed structures the owning subsystems define; SQLite gives indexing, transactions, and the history queries the audit log needs (ADR-0014).
- **Migrations** run on startup keyed by `meta.schema_version`; forward-only with documented steps (Master §6.4).
- Secrets are **never** here (2E §7).

## 7. Service lifecycle & supervision (ADR-0005)

### 7.1 Boot
```
OS service start → load config.json + open SQLite (migrate if needed)
  → init core (state store, registries, event bus, session mgr)
  → start plugin host → launch bundled first-party plugins (2F)
     → plugins register contributions → registries populated
  → start transport (2A): bind LAN listener + loopback control + mDNS advertise
  → ready (state broadcast begins as sessions connect)
```
Target: connect-ready quickly; first-state-broadcast within a few seconds of a session opening (carried perf goal).

### 7.2 Run / shutdown
- The engine runs headless as a service, **independent of the Desktop UI** (closing the UI does not stop it — ADR-0005).
- Graceful shutdown: stop accepting sessions → flush durable writes → stop plugins (SIGTERM then kill) → close SQLite.
- Crash of the **engine** → OS service manager restarts it; clients see disconnect → reconnect (2A §7). Crash of a **plugin** → host restarts that plugin only; engine unaffected (2F).

### 7.3 Config
`config.json` (non-secret) holds intervals, thresholds, HA base URL, display prefs (schema in Doc 0 §16 carried). Hot-reload via file watcher is a later nicety (Doc 0 §12); V1 reads at startup.

## 8. Normative requirements

| ID | Requirement | Trace |
|----|-------------|-------|
| TB-ST-1 | State values SHALL be stored typed; display formatting SHALL be a render-time concern. | ADR-0019, FR-6.1/6.4 |
| TB-ST-2 | Only changed states SHALL be enqueued for fan-out (delta). | FR-6.2 |
| TB-ST-3 | Series/ring-buffer state SHALL be in-memory only and SHALL NOT be persisted. | ADR-0014, FR-6.5 |
| TB-ST-4 | A delta SHALL be sent to a session only if the state is in that session's subscription set. | FR-3.1 |
| TB-VAR-1 | `var.*` SHALL be typed, durable (SQLite), and bindable as states. | ADR-0014, FR-10.4 |
| TB-REG-1 | Actions, widget types, and flow nodes SHALL be schema-declared and plugin-populated via one registration path (first-party = third-party). | ADR-0006, FR-7.1/9.1 |
| TB-REG-2 | The registries SHALL be queryable to drive the designer's auto-generated UI. | FR-7.2 |
| TB-REG-3 | ID collisions on registration SHALL be rejected with a diagnostic. | §3.4 |
| TB-SES-1 | The engine SHALL maintain one isolated session per device, each with its own profile/subscriptions/permissions/mode. | ADR-0002, FR-3.1/3.3 |
| TB-SES-2 | Multiple sessions SHALL be able to display different profiles simultaneously without interference. | FR-3.2 |
| TB-PRF-1 | Profiles SHALL carry an activation rule field with an engine evaluation hook in V1 (auto-switch consumer deferred). | Doc 0 §12, FR-3 |
| TB-PER-1 | All durable data SHALL be in one SQLite store; the audit log SHALL be append-only. | ADR-0014 |
| TB-PER-2 | Schema migrations SHALL run on startup keyed by a stored schema version. | Master §6.4 |
| TB-PER-3 | Secrets SHALL NOT be stored in SQLite or config files. | 2E §7 |
| TB-LIF-1 | The engine SHALL run as a background service independent of the Desktop UI and restart on crash via the OS service manager. | ADR-0005, FR-1.1/1.2 |
| TB-LIF-2 | A plugin crash SHALL NOT crash the engine. | NFR-07, ADR-0006 |

---
*End of TRD 2B (Draft v0.1). Layout doc `body_json` shape is 2C; flow `body_json` shape is 2D; plugin registration/IPC is 2F.*
