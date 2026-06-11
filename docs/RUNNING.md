# Running CyberDeck (first testable slice — "Living Deck")

This is the quickstart for the first usable end-to-end build: a Windows host engine
that a Flutter client (Windows desktop **or** Android) pairs with over the LAN to
show a live system deck (CPU / RAM / disk gauges + power buttons) and trigger power
actions.

> Scope of this slice: a built-in default deck, QR pairing, in-memory identities
> (you re-pair each launch). The live desktop **designer**, secure persistent
> identity, and auto-reconnect are deliberate follow-ups.

## Prerequisites

- **Go** (1.25+) and **Flutter** (stable) on PATH.
- Windows desktop client also needs the **Visual Studio “Desktop development with
  C++”** workload (for `flutter build windows`).
- The engine machine and the device must be on the **same LAN**.

## 1. Build + run the engine (Windows)

From the repo root:

```sh
# build the engine and the two bundled plugins into a run/ layout
mkdir -p run/plugins/telemetry run/plugins/power
( cd engine            && go build -o ../run/cyberdeck.exe ./cmd/cyberdeck )
( cd plugins/telemetry && go build -o ../../run/plugins/telemetry/telemetry.exe . )
( cd plugins/power     && go build -o ../../run/plugins/power/power.exe . )

# run it (console mode). Power actions are DRY-RUN by default (safe to test).
cd run
./cyberdeck.exe --console
```

The engine boots and prints a **pairing QR + payload** to the console, e.g.:

```
=== CyberDeck pairing — scan on Android, or paste on desktop ===
   <a QR code>
payload: {"addresses":["192.168.1.6"],"port":8765,"token":"…","fp":"…"}
```

- The engine listens on **:8765** (override with `--port`).
- The plugin binaries are auto-discovered next to the engine exe (or pass
  `--plugins <dir>`). A missing plugin is skipped (telemetry missing → no live
  values; power missing → buttons fail).
- **Press Enter** in the engine console to print a fresh pairing code (each token is
  single-use, so you need a new one per device / per re-pair).
- **`--power-live`** makes power actions actually execute (default is dry-run). The
  device still requires a 2-tap confirm for destructive actions regardless.

## 2. Run the client

### Windows desktop (fastest to iterate)

```sh
cd client
flutter run -d windows
```

On the **Pair with engine** screen, click **Scan QR** → paste the `payload:` JSON
from the engine console → **Pair**. The deck appears.

### Android (over the LAN)

```sh
cd client
flutter run -d <device-id>      # or: flutter build apk  → install the APK
```

Tap **Scan QR** and point the camera at the QR in the engine console. (Grant the
camera permission on first run.)

## 3. Use it

- The deck shows **live CPU / RAM / disk** gauges (updating ~2×/sec) and an uptime
  label.
- Tap **LOCK** / **SLEEP** to trigger those actions; **RESTART** / **SHUTDOWN** are
  destructive and require a **second confirming tap** within 3 seconds.
- With the engine in dry-run (default) nothing actually happens to the machine — the
  engine logs `audit interaction.executed …`. Run the engine with `--power-live` to
  execute for real.

## Troubleshooting

- **Device can’t connect:** confirm both are on the same network and the engine’s
  printed address is reachable; check a host firewall isn’t blocking port 8765.
- **“bad or expired token”:** tokens are single-use and short-lived — press Enter in
  the engine console for a fresh QR and pair again.
- **Fingerprint mismatch:** the engine identity is regenerated each run in this
  slice, so always pair against the QR from the *current* engine process.
- **mDNS list stays empty:** that’s fine — QR/paste pairing doesn’t need discovery
  (the payload already carries the address).
