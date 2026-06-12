# CyberDeck Client + Designer

The Flutter device runtime for CyberDeck: it pairs with the [host engine](../engine), renders
the layout, and captures gestures. The **desktop build also hosts the Designer** for authoring
layouts that reflect live onto paired devices.

See the repo [README](../README.md) for the product overview and the
[RUNNING guide](../docs/RUNNING.md) for the full hands-on walkthrough.

## Two ways to run

- **Demo Mode** — the client runs **standalone** (no engine, no network) with three seed
  decks (System Monitor / Media / Smart Home) and a live mock-telemetry ticker. The fastest
  way to see the whole experience, including the Designer.
- **Live Engine** — pair with the running Go engine over the LAN (QR scan on Android, paste
  the payload on desktop) for a real, end-to-end-encrypted CPU/RAM/disk deck with
  permissioned actions.

The two are swapped behind a single **`DeckSource`** seam (`lib/data/deck_source.dart`):
`MockDeckSource` powers Demo Mode, `EngineDeckSource` powers the live link. The same
renderer, gestures, and Designer run on top of either.

## Supported targets

| Target | Status |
|--------|--------|
| Windows desktop | ✅ builds + runs (Designer enabled) |
| Android | ✅ builds + runs |
| iOS | ✅ code-ready — build on a Mac with Xcode |
| Linux / macOS desktop | ⚠️ not scaffolded — `flutter create --platforms=linux,macos .` to add |

## Layout

```
lib/
  app/        landing → deck list → deck view, and the pairing flow
  data/       DeckSource seam: mock (Demo Mode), engine-backed (live), seed decks
  net/        crypto, framing, encrypted session, channels, pairing, connection manager
  render/     renderer registry + layout interpreter + widgets (gauges, button, slider, …)
  gestures/   gesture capture (all slots) + 2-tap confirm for destructive actions
  designer/   desktop WYSIWYG editor (select / drag / schema inspector / add / remove)
```

## Develop

```sh
flutter pub get

# Run (choose Demo Mode or Connect from the landing screen)
flutter run -d windows            # or: flutter run -d <android-device-id>

# Gates (mirror CI)
dart analyze
flutter test                      # widget journey + real Dart↔Go interop test

# Build
flutter build windows             # needs the VS "Desktop development with C++" workload
flutter build apk                 # Android (or: flutter build appbundle)
flutter build ipa                 # iOS — macOS only
```

Key dependencies: `cryptography` (session crypto mirroring the engine), `multicast_dns`
(mDNS discovery), `mobile_scanner` (QR pairing on Android).
