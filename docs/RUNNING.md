# Running & testing CyberDeck

CyberDeck is a **native** product: a Flutter **client app** (Windows desktop +
Android; iOS is code-ready but needs a Mac to build) and a Go **desktop host
engine**. You can exercise the entire client experience two ways:

- **Demo Mode** — the client runs **standalone** with sample decks + live mock
  telemetry. Zero setup, no engine, no network. **Start here.**
- **Live Engine** — the client pairs with the running Go engine over the LAN.

## Prerequisites

- **Flutter** (stable) for the client; **Go** (1.25+) for the engine.
- Windows desktop client also needs the Visual Studio **“Desktop development with
  C++”** workload (for `flutter build windows`).

---

## A. Demo Mode (fastest — the full experience, no backend)

### Desktop (Windows)
```sh
cd client
flutter run -d windows      # or:  task run:client
```

### Android
```sh
cd client
flutter run -d <device-id>  # or:  flutter build apk  → install build/app/outputs/flutter-apk/app-debug.apk
```

In the app: tap **Enter Demo Mode** → pick a deck (System Monitor / Media / Smart
Home) → watch the gauges update live, toggle switches, drag the volume slider, tap
buttons (a destructive action like SLEEP asks for a confirming second tap). Tap the
**✎ edit** icon to open the **Designer**: select a widget, drag it on the grid, edit
its properties in the inspector, rename it, add (＋) or remove widgets, then **✓
save**. Everything works offline.

The same build is responsive — it adapts to phone, tablet, and desktop window sizes,
with touch and pointer input.

---

## B. Live Engine (pair the client with the real host)

### 1. Build + run the engine
```sh
task run:engine
# equivalently:
#   task dist:engine          # builds run/cyberdeck.exe + run/plugins/{telemetry,power,volume,launchers}/*
#   cd run && ./cyberdeck.exe --console
```
The engine prints a **pairing QR + payload** (addresses / port / token /
fingerprint) and launches the bundled plugins (telemetry, power, volume, launchers).
Power/volume/launch actions are **dry-run** by default — add `--power-live` to make
them real.

Console commands (the local privileged channel):
- **Enter** — print a fresh single-use pairing code.
- **`list`** — paired devices and which are currently `LIVE`.
- **`revoke <uuid>`** — revoke a device and drop its live session immediately.

### 2. Connect from the client
In the app tap **Connect to Engine**, then **Scan QR** (Android camera) or paste the
`payload:` JSON (desktop). On success the live deck appears with real CPU/RAM/disk
telemetry, a **volume slider + mute** (volume plugin) and an **Open GitHub** button
(launchers plugin); taps dispatch to the engine (logged as `audit interaction.executed …`).

The link self-heals: a heartbeat + watchdog detect a drop (wifi blip / sleep) and the
client **auto-reconnects without re-scanning** (it's a known device — no token
needed). Revoking it in the console (`revoke <uuid>`) is the kill switch.

### 3. Prove the live wire automatically
```sh
task interop
```
Spawns the engine and, with the real client networking stack, pairs → asserts the
layout snapshot + live telemetry + an interaction → **drops and reconnects
tokenless** → **revokes** and confirms the session drops and re-entry is refused.

---

## C. iOS

The client is plain Flutter (no Android-only code), so iOS is supported in
principle, but **iOS apps can only be built on macOS**. On this Windows host iOS is
out of scope; build/run it from a Mac with `flutter run -d <ios-device>` (Demo Mode
works the same; for Live Engine the device must share the LAN with the host).

---

## Tests

```sh
cd client && flutter analyze && flutter test     # 100+ tests, incl. the Demo journey
cd engine && go test ./...                        # engine
# live interop (needs the built engine):  task interop
```

## Troubleshooting

- **Android can’t reach the engine:** same Wi-Fi/LAN; check the host firewall isn’t
  blocking the engine port (default 8765).
- **“bad or expired token”:** tokens are single-use + short-lived — press Enter in
  the engine console for a fresh QR.
- **Fingerprint mismatch:** the engine identity is per-run in this build, so pair
  against the QR from the *current* engine process.
- Stuck? **Demo Mode** never needs the engine and always works.
