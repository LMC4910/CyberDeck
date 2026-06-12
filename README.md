# CyberDeck

> Turn any phone, tablet, or second screen into a live, **end-to-end-encrypted** control
> surface for your PC — real-time system telemetry, permissioned actions, and
> desktop-authored layouts that render natively on the paired device.

![status](https://img.shields.io/badge/status-Phase%201%20%E2%80%94%20usable%20end--to--end-brightgreen)
![license](https://img.shields.io/badge/license-PolyForm%20Noncommercial%201.0.0-blue)
![source](https://img.shields.io/badge/source-available-informational)
![engine](https://img.shields.io/badge/engine-Go%201.25%2B-00ADD8)
![client](https://img.shields.io/badge/client-Flutter%20stable-02569B)
![host%20OS](https://img.shields.io/badge/host-Windows%20%C2%B7%20macOS%20%C2%B7%20Linux-lightgrey)
![client%20targets](https://img.shields.io/badge/client-Windows%20%C2%B7%20Android%20%C2%B7%20iOS-lightgrey)

CyberDeck is **two programs working together over the LAN**:

1. **Host engine** (`engine/`, Go) — a headless background service that owns identity,
   trust, persistence, the typed state store, the encrypted transport/session layer, and
   an out-of-process plugin host. It runs independently of any UI window.
2. **Client + Designer** (`client/`, Flutter) — the device runtime that pairs with the
   engine, renders the layout, and captures gestures. The desktop build additionally hosts
   the **Designer** for authoring layouts that reflect live onto paired devices.

Capabilities (telemetry, power actions, volume, launchers, …) are **out-of-process
plugins** (`plugins/`) on a single contract — first-party and third-party alike — so a
crashing plugin can never take down the engine.

---

## What works today

CyberDeck is usable end-to-end right now — both standalone and against the live engine.

- **Demo Mode** — the client runs **standalone** (zero engine, zero network) with three
  seed decks (System Monitor / Media / Smart Home) and a live mock-telemetry ticker. The
  fastest way to see the whole experience.
- **Live, end-to-end-encrypted deck** — pair a device to the engine over the LAN and watch
  a real CPU / RAM / disk deck update ~2×/second, with permissioned controls.
  - Forward-secret session crypto: **X25519** key exchange · **Ed25519** identity ·
    **HKDF-SHA256** key derivation · **ChaCha20-Poly1305** AEAD, fresh keys per session.
  - **QR pairing** (scan on Android, paste on desktop) with **fingerprint verification**
    (anti-MITM). No plaintext ever touches the wire.
- **Permissioned actions + safety** — every action is authorized against the device's
  grants and audited; **destructive actions require a 2-tap confirm** on the device.
- **First-party plugins** (out-of-process, crash-isolated):
  **telemetry** (CPU/RAM/net/disk), **power** (shutdown/restart/sleep/hibernate/lock/log-off),
  **volume** (system master + mute), **launchers** (launch app / open URL).
- **The Designer** (desktop) — a WYSIWYG canvas that reuses the *same* client renderer,
  with select / drag-move, a **schema-driven inspector**, add / remove / rename, and
  **live reflection** onto paired devices.
- **Link resilience** — a heartbeat + watchdog detect drops (wifi blip / sleep) and the
  client **auto-reconnects without re-scanning** (known-device tokenless handshake);
  versioned **resync** on gaps; a **revocation** kill-switch drops a device instantly.
- **Typed state + flow engine** — state is stored typed (`42.0`, not `"42.0 °C"`);
  a sandboxed expression language + flow nodes (action/if/setVar/wait/loop/…) drive
  automations.

See [`docs/RUNNING.md`](docs/RUNNING.md) for the full hands-on walkthrough.

---

## Quick start

**Demo Mode (fastest — no backend):**

```sh
cd client
flutter run -d windows      # or: flutter run -d <android-device-id>
```

Tap **Enter Demo Mode** → pick a deck → watch the gauges, toggle switches, drag the
volume slider, tap the **✎** icon to open the Designer.

**Live engine (pair a device to your PC):**

```sh
task run:engine             # builds + runs the host engine; prints a pairing QR
# then, in the client, tap "Connect to Engine" and scan the QR (Android) or paste the payload (desktop)
```

---

## Build

CyberDeck has two independently built components. The **host engine** (Go) builds on
Windows, macOS, and Linux. The **client** (Flutter) builds for Windows desktop, Android,
and iOS today.

| Component | Windows | Linux | macOS | Android | iOS |
|-----------|:-------:|:-----:|:-----:|:-------:|:---:|
| **Host engine** (Go) | ✅ | ✅ | ✅ | — | — |
| **Client / Designer** (Flutter) | ✅ desktop | ⚠️ not scaffolded | ⚠️ not scaffolded | ✅ | ✅ (build on a Mac) |

> The **engine** is the PC host; phones/tablets/second screens run the **client**. There is
> no Linux/macOS *desktop client* yet — on a Linux or macOS host, run the engine there and
> connect from an Android (or Windows) client on the same LAN. To add a Linux/macOS desktop
> client later: `cd client && flutter create --platforms=linux,macos .`

### Prerequisites

| Tool | Version | For |
|------|---------|-----|
| [Go](https://go.dev/dl/) | 1.25+ | Engine + plugins |
| [Flutter](https://docs.flutter.dev/get-started/install) (+ Dart) | stable (3.44+) | Client + Designer |
| [Task](https://taskfile.dev) | 3.x | Cross-platform task runner (optional but convenient) |
| [golangci-lint](https://golangci-lint.run) | v2.x | Go linting |
| A C compiler (gcc/clang) | — | Only for `go test -race` (the race detector needs cgo) |
| Visual Studio “Desktop development with C++” | — | Only for `flutter build windows` |
| Android SDK / Xcode | — | Android / iOS client builds respectively |

### Host engine (Go) — Windows / Linux / macOS

The engine ships as one executable plus the four plugin binaries it launches. The engine
discovers plugins under `plugins/<name>/<name>[.exe]` next to itself.

**Windows** (or anywhere, via the task runner):

```sh
task dist:engine            # → run/cyberdeck.exe + run/plugins/{telemetry,power,volume,launchers}/*.exe
cd run && ./cyberdeck.exe --console
```

**Linux / macOS** (binaries have no `.exe` suffix — build them explicitly):

```sh
mkdir -p run/plugins/{telemetry,power,volume,launchers}
( cd engine            && go build -o ../run/cyberdeck ./cmd/cyberdeck )
( cd plugins/telemetry && go build -o ../../run/plugins/telemetry/telemetry . )
( cd plugins/power     && go build -o ../../run/plugins/power/power . )
( cd plugins/volume    && go build -o ../../run/plugins/volume/volume . )
( cd plugins/launchers && go build -o ../../run/plugins/launchers/launchers . )
cd run && ./cyberdeck --console
```

Useful engine flags: `--console` (foreground/dev), `--service` (OS service manager),
`--port <n>` (default `8765`), `--data <dir>`, `--plugins <dir>`, `--power-live` (actually
execute power/volume/launch actions — **dry-run by default for safety**), `--version`.

### Client (Flutter)

```sh
cd client
flutter pub get

# Windows desktop (needs the VS "Desktop development with C++" workload)
flutter build windows

# Android
flutter build apk          # or: flutter build appbundle   (for Play Store)

# iOS — must be built on macOS with Xcode
flutter build ipa
```

### Lint / test / build everything

```sh
task lint    # go vet + golangci-lint   ·   dart analyze
task test    # go test                  ·   flutter test
task build   # go build (engine)         ·   flutter build windows (client)
task interop # real Dart↔Go encrypted pairing test against the built engine
```

CI mirrors these gates on every push and pull request — see [`ci/README.md`](ci/README.md).

---

## Architecture at a glance

- **Engine-side authority** — the engine is the single source of truth for layout, state,
  and trust; the client renders and the Designer sends ops (ADR-0003).
- **Typed state, not strings** — values are stored typed so flows compare numerically and
  gauges use raw numbers; formatting happens at render time (ADR-0019).
- **Remote-ready transport seam** — all addressing flows through
  `TransportEndpoint`/`ConnectionManager`; nothing above it knows the endpoint kind, so a
  relay can be added later with no rewrite (ADR-0010).
- **Security first** — every device is identified (Ed25519), trusted, encrypted, and
  permissioned; secrets live only in the OS keystore, never in SQLite/config/logs.
- **What you design is what the device shows** — the Designer canvas reuses the client
  renderer rather than forking it.

```
engine/     Go host engine (cmd/, core/, pluginhost/, pal/, internal/)
client/     Flutter client + desktop Designer (lib/{net,render,gestures,app,data,designer,theme})
plugins/    First-party plugins, each its own process binary
shared/     JSON schemas (action / widget / flow-node / state descriptors + protocol envelope)
docs/       Engineering docs (ADRs, RUNNING.md, acceptance evidence)
Documentation/  Authoritative product + architecture docs and the Phase-1 execution system
```

See [`STRUCTURE.md`](STRUCTURE.md) for the full monorepo layout.

## Plugins

Each capability is a separate process binary speaking a small newline-JSON IPC contract to
the engine's supervising **plugin host**; a fault is isolated and restarted, never crashing
the engine. The bundled four are described in [`plugins/README.md`](plugins/README.md),
which also points at an existing plugin as a template for authoring your own.

## Security model

- **Identity** — the engine and every client hold an Ed25519 keypair; a device is known by
  the SHA-256 **fingerprint** of its public key.
- **Pairing** — a single-use, short-lived token + a mutual handshake establish trust; the
  client verifies the engine fingerprint to defeat MITM.
- **Encryption** — forward-secret per-session keys (X25519 → HKDF → ChaCha20-Poly1305);
  the wire carries only ciphertext.
- **Authorization** — every action is checked against the device's permission grants and
  written to an append-only audit log; destructive actions also require a device-side
  2-tap confirm.
- **Secrets** — kept in the per-OS keystore (with an encrypted-file fallback), never in the
  database, config, or logs.

## Status & roadmap

Phase 1 (the engine + client foundation) is **~71% complete and usable end-to-end**. Live
progress against all 80 tickets — snapshot, epic rollup, milestone tracker, and velocity
log — is in
[`Documentation/CyberDeck_Phase1_Progress_Dashboard.md`](Documentation/CyberDeck_Phase1_Progress_Dashboard.md).

Remaining toward Phase-1 exit: OS installers + tray app, manual/active discovery + reconnect
polish, the degradation UI, more first-party plugins (GPU / notifications / media), extra
widgets (sparkline / media card), Designer extras (undo-redo, profile management, grid
editor), and the hardening + acceptance suite (security/perf/E2E).

## Contributing

Contributions are welcome — see [`CONTRIBUTING.md`](CONTRIBUTING.md) for the toolchain, the
four local gates, the branch/PR flow under the default-branch ruleset, and how to author a
plugin. The default branch is protected; all changes land via PR with green CI
([`ci/README.md`](ci/README.md)).

## License

CyberDeck is **source-available** under the **PolyForm Noncommercial License 1.0.0** — free
to use, modify, and share for **personal and other noncommercial** purposes. **Any
organizational or commercial use requires a separate commercial license.** See
[`LICENSE`](LICENSE), and contact **shishirlamichhane718@gmail.com** for commercial /
organizational licensing.

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
| `CyberDeck_Phase1_*` | The Phase-1 execution system: deep dive, dependency graph & execution plan, ticket batches, kanban board, **progress dashboard**. |
| `CyberDeck_Phase2…8_DeepDive.md` | Forward-looking per-phase deep dives. |
