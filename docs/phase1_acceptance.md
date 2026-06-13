# CyberDeck — Phase 1 Acceptance (PROJ-303)

**Status: Phase 1 complete — all 80 tickets Done.** This document is the final acceptance pass: it traces every Phase-1 acceptance criterion (P1-AC-01…16) to the ticket(s) that satisfy it and the test(s) that prove it, then records the Definition-of-Done sign-off. Items that cannot be machine-verified on the Windows development host (macOS/Linux runtime, installer notarization, the full 8-hour soak) are explicitly flagged **documented-manual** rather than claimed.

Verification snapshot (2026-06-13, Windows 11, Go 1.26.4, Flutter 3.44.1):
- `task lint` → 0 issues (go vet + golangci-lint 2.12.2 across all 6 Go modules + `dart analyze`; 5 info-level `prefer_initializing_formals` hints in `lib/tray`, non-fatal).
- `task test` → engine `go test -race ./...` green (incl. `engine/test/security`, `engine/test/soak`), all 5 plugin modules green, `flutter test` 190 passing.
- engine cross-compiles clean for `darwin/arm64` and `linux/amd64`.
- `task interop` → J0/J1/J2/J6 + reconnect/revoke robustness all green against the real engine.

## Traceability matrix (P1-AC-01 … P1-AC-16)

| AC | Criterion (abridged) | Ticket(s) | Backing test / evidence | Status |
|----|----------------------|-----------|--------------------------|--------|
| P1-AC-01 | Engine installs as a service, starts on boot, survives Desktop-UI close | 105, 106/107/108 | `engine/internal/service/{windows,darwin,linux}.go` + `service_test.go`; `cmd/cyberdeck` `TestRunServiceModeSelected`. Windows SCM path verified; launchd/systemd cross-compiled | ✅ (mac/linux boot **documented-manual**) |
| P1-AC-02 | Phone pairs via QR (token+fingerprint); rogue token & wrong fingerprint rejected | 123, 124, 180 | `core/security/pairing_test.go` (bad-token/forged-sig/fingerprint-mismatch); client pairing tests; interop **J0** | ✅ |
| P1-AC-03 | All session traffic is ciphertext on the wire (capture-verified) | 142, 300 | `engine/test/security/sniff_test.go`; `core/transport` encrypted-session no-plaintext test | ✅ |
| P1-AC-04 | CPU/GPU/RAM/storage/network telemetry renders live within cadence | 171, 172, 184 | `plugins/telemetry/publisher_test.go` (+ GPU `providers/gpu_test.go`); interop live telemetry | ✅ (Task-Manager ±1% parity **documented-manual**) |
| P1-AC-05 | A bound gauge shows `--` when its provider is unavailable; UI never crashes | 170, 172, 184 | `engine/pal/chain_test.go` (all-unavailable degrade); `providers/gpu_test.go` (GPU-less host no-panic); client `gauge_test.dart` | ✅ |
| P1-AC-06 | Restart shows a 2-tap confirmation; second tap restarts | 173, 187 | client `confirm.dart` tests + `widget_test.dart` "destructive action requires a second confirming tap"; power `destructive` flag | ✅ |
| P1-AC-07 | A device denied power actions cannot restart even via a layout containing it; attempt is audited | 125, 133, 127 | interop **J6** (restricted device DENIED + AUDITED); `core/security` authorize + audit tests | ✅ |
| P1-AC-08 | A `stateChange` flow fires host-side on threshold crossing; failures logged, engine survives | 202, 203, 204 | `core/flow/triggers_test.go` (edge/debounce), `core/flow/nodes` action-deny/dispatch-fail tests | ✅ |
| P1-AC-09 | Dragging a widget reflects on a bound device in <200 ms; undo reverts on both | 212, 213, 215 | interop **J1** (<200 ms reflect); `core/layout/undo_test.go` (inverse round-trip); client `designer_undo_test.dart` | ✅ |
| P1-AC-10 | Inspector edits any registered action's params via auto-generated editors, no per-action UI code | 214 | client `inspector_test.go` (new choice-action → dropdown → `SetConfig`, zero inspector code) | ✅ |
| P1-AC-11 | Two devices show different profiles simultaneously without interference | 150, 216 | `core/transport` fan-out two-profile isolation test; `designer_profiles_test.dart` | ✅ |
| P1-AC-12 | On disconnect, widgets dim to last value with a badge; reconnect <5 s restores live | 146, 188 | client `degradation_test.dart` (dim + badge + reconnect→live); engine reconnect tests | ✅ |
| P1-AC-13 | A plugin crash leaves the engine running; its states read `--` until restart | 131 | `pluginhost` supervisor test (induced panic → engine survives, faulted states unavailable) | ✅ |
| P1-AC-14 | Engine <150 MB RAM and <2% idle CPU after 8 h with ≥8 sessions | 301 | `engine/test/soak/*` harness — short variant asserts RSS-growth/idle-CPU thresholds with ≥8 sessions and passes | ✅ (full **8 h** run **documented-manual/scheduled**) |
| P1-AC-15 | Native installers produce a working install — **one combined installer per desktop OS** bundling engine + plugins + desktop client (client mandatory) | 190, 191, 192 | `installers/windows/cyberdeck.iss` (single `.exe`, validated); `installers/macos/build-pkg.sh` (single `.pkg` → engine + `/Applications/CyberDeck.app`); `installers/linux/appimage/` (single AppImage; `AppRun` starts engine + client) | ⚠️ Windows `.exe` validated; **mac/linux build + notarize = documented-manual (built in CI)** |
| P1-AC-16 | All text meets WCAG 2.1 AA (4.5:1) on the dark theme; touch targets ≥48×48 | 189 | client `theme_tokens_test.dart` (contrast-ratio + 48×48 target checks) | ✅ |

## Definition of Done — sign-off

- [x] Every P1-AC maps to a passing test or an explicitly flagged documented-manual item.
- [x] `task lint` clean (go vet + golangci-lint 2.12.2 + dart analyze); 0 errors/warnings.
- [x] `task test` green — engine `-race` across all packages + 5 plugin modules + `flutter test` (190).
- [x] Engine cross-compiles for `darwin/arm64` and `linux/amd64`.
- [x] `task interop` green — real Dart↔Go E2E (J0/J1/J2/J6 + reconnect/revoke).
- [x] No P0 or P1 ticket left un-Done (80/80).
- [x] CHANGELOG updated.

## Documented-manual items (require real hardware / external infra)

These are intentionally not executed on the Windows dev host; they are configured, cross-compiled where applicable, and listed here for completion on target platforms:

1. **macOS / Linux service boot** (P1-AC-01) — launchd/systemd units cross-compile and install logic is unit-tested; boot-survives-UI-close confirmed on Windows, pending a Mac/Linux box.
2. **Telemetry parity ±1% vs Task Manager** (P1-AC-04) — requires a manual side-by-side reading.
3. **Full 8-hour soak** (P1-AC-14) — the harness runs an env-gated 8 h mode; CI/dev runs the short variant which asserts the same RSS/CPU thresholds.
4. **macOS/Linux installer build + notarization** (P1-AC-15) — Inno Setup (Windows) validated; `.dmg`/`.pkg` notarization and `.deb`/`.rpm`/`.AppImage` packaging run on their native toolchains.
