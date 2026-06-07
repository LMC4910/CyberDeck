# CyberDeck

A cross-platform command center that turns a phone, tablet, or second screen into a
live, **end-to-end-encrypted** control surface for your PC — real-time system
telemetry, permissioned actions, and desktop-authored layouts that render natively
on the paired device.

CyberDeck is two programs working together over the LAN:

1. **Host engine** (`engine/`, Go) — a headless background service that owns identity,
   trust, persistence, the typed state store, the transport/session layer, and an
   out-of-process plugin host. It runs independently of any UI window.
2. **Client + Designer** (`client/`, Flutter) — the device runtime that pairs with the
   engine, renders the layout, and captures gestures; the desktop build additionally
   hosts the **Designer** for authoring layouts that reflect live onto paired devices.

Capabilities (telemetry, power actions, launchers, …) are **out-of-process plugins**
(`plugins/`) on a single contract — first-party and third-party alike — so a crashing
plugin can never take down the engine.

| Field | Value |
| --- | --- |
| Product | CyberDeck |
| Plugin ID | `com.shishir.cyberdeck` |
| Host engine | Go (module `github.com/shishir/cyberdeck/engine`) |
| Client / Designer | Flutter (Android / iOS / desktop) |
| Target host OS | Windows · macOS · Linux |
| Transport | Encrypted LAN (X25519 + AEAD), forward-secret per session |
| Status | **Phase 1 — Foundation (in progress)** |

## Architecture at a glance

- **Engine-side authority** — the engine is the single source of truth for layout,
  state, and trust; the client renders and the designer sends ops (ADR-0003).
- **Typed state, not strings** — state values are stored typed (`42.0`, not `"42.0 °C"`)
  so flows compare numerically and gauges use raw numbers; formatting is render-time
  (ADR-0019).
- **Remote-ready transport seam** — all addressing flows through
  `TransportEndpoint`/`ConnectionManager`; nothing above it knows the endpoint kind, so
  a relay can be added later with no rewrite (ADR-0010).
- **Security first** — every device is identified (Ed25519), trusted, encrypted, and
  permissioned; secrets live only in the OS keystore, never in SQLite/config/logs.
- **What you design is what the device shows** — the designer canvas reuses the client
  renderer rather than forking it.

See [`STRUCTURE.md`](STRUCTURE.md) for the full monorepo layout (per
`Documentation/CyberDeck_TRD_2_Master.md` §7.1).

```
engine/     Go host engine (cmd/, core/, pluginhost/, pal/, internal/)
client/     Flutter client + desktop Designer (lib/{net,render,gestures,app,theme,tray,designer})
plugins/    First-party plugins, each its own process binary
shared/     JSON schemas (action / widget / flow-node / state descriptors + protocol envelope)
installers/ Per-OS packaging
docs/       Implementation-time engineering docs (ADRs, acceptance evidence)
```

## Documentation

The authoritative product and architecture documentation lives in
[`Documentation/`](Documentation/):

| Doc | Contents |
| --- | --- |
| `CyberDeck_PRD.md` | Product requirements: vision, personas, journeys, FRs/NFRs, acceptance criteria. |
| `CyberDeck_Foundation_Architecture.md` | Layered architecture and the system foundation. |
| `CyberDeck_Complete_Documentation.md` | The consolidated architecture, ADRs, and subsystem TRDs. |
| `CyberDeck_TRD_2_Master.md` + `CyberDeck_TRD_2A…2G_*.md` | Subsystem technical reference designs (transport, engine core, layout/designer, flow engine, security/identity, plugin architecture, PAL). |
| `CyberDeck_TRD_2ADR_Decision_Log.md` | Architecture Decision Records. |
| `CyberDeck_Phase1_*` | The Phase-1 execution system: deep dive, dependency graph & execution plan, ticket batches 1–4, kanban board, **progress dashboard**, and the agent operating instructions. |
| `CyberDeck_Phase2…8_DeepDive.md` | Forward-looking per-phase deep dives. |

> **Note on `Touch Portal/`:** that folder holds the project's *original* Touch
> Portal / Node.js product direction and its reference UI. It is retained for
> history; the current architecture is the Go engine + Flutter client described above.

## Development

### Prerequisites

| Tool | Version used | Purpose |
| --- | --- | --- |
| Go | 1.25+ (developed on 1.26) | Engine + plugins |
| Flutter (+ Dart) | stable (3.44+) | Client + Designer |
| [Task](https://taskfile.dev) | 3.x | Cross-platform task runner (`Taskfile.yml`) |
| golangci-lint | v2.x | Go linting |
| A C compiler (gcc/clang) | — | Only for `go test -race` (the race detector needs cgo) |
| Visual Studio “Desktop development with C++” | — | Only for `flutter build windows` |

### Build, lint, and test

From the repository root, the task runner fans out to both the engine and the client:

```bash
task lint    # go vet + golangci-lint  ·  dart analyze
task test    # go test                 ·  flutter test
task build   # go build                ·  flutter build (host desktop)
```

Or per component:

```bash
# Engine (from engine/)
go vet ./... && golangci-lint run && go test -race ./... && go build ./...

# Client (from client/)
dart analyze && flutter test && flutter build windows
```

CI mirrors these gates on every push/PR — see [`ci/README.md`](ci/README.md).

## Status — Phase 1 (Foundation)

Phase 1 stands up the engine + client foundation: identity, trust, crypto, encrypted
transport, persistence, the state store, the plugin host, the client renderer, and the
designer. Live progress against all 80 tickets is tracked in
[`Documentation/CyberDeck_Phase1_Progress_Dashboard.md`](Documentation/CyberDeck_Phase1_Progress_Dashboard.md).

Landed so far:

- **PROJ-101** — Go + Flutter monorepo scaffold and tooling.
- **PROJ-110** — SQLite persistence (pure-Go driver, WAL, forward-only migration runner).
- **PROJ-160** — Typed state store with delta suppression and in-memory series buffers.
- **PROJ-121** — Redaction-safe `Secret` type + per-OS SecretStore (with encrypted-file fallback).
- **PROJ-120** — Engine identity (Ed25519 keypair + UUID, account-independent).
- **PROJ-140** — Transport endpoint abstraction + ConnectionManager (the remote-ready seam).
- **PROJ-102** — CI gate workflows (authored; live run pending first push).

The engine builds and passes `go test -race ./...` clean; the client passes
`dart analyze`, `flutter test`, and `flutter build windows`.
