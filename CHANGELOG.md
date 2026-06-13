# Changelog

All notable changes to CyberDeck are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); versions track milestones.

## [Phase 1] — 2026-06-13

Phase 1 complete: **80/80 tickets, all 16 acceptance criteria met** (see
`docs/phase1_acceptance.md`). The product is a usable end-to-end cyberpunk command
deck — a Go engine paired with a Flutter client over an encrypted LAN link, with a
desktop Designer, first-party plugins, and link resilience.

### Added
- **Lifecycle & packaging:** CI gates across all workspace modules (`102`); per-OS
  service registration — Windows SCM / macOS launchd / Linux systemd (`106/107/108`);
  cross-compiled build artifacts + `dist:*` tasks; system-tray control app over the
  loopback channel (`109`); native installer configs — Inno Setup, `.deb`/`.rpm`/
  AppImage, `.dmg`/`.pkg` (`190/191/192`).
- **Transport:** loopback-only privileged control channel (`144`); manual + bounded
  active-scan discovery (`148`).
- **Plugins:** GPU telemetry provider chain (`172`); notification-count plugin (`176`).
- **Client widgets:** sparkline (`185`), media card + page-nav (`186`); theme tokens +
  WCAG-AA accessibility (`189`); degradation UI — dimmed last value + connection badge
  (`188`).
- **Designer:** undo/redo via op inverses (`215`); profile management + explicit device
  targeting (`216`); uncapped grid editor (`217`).
- **Hardening:** security suite — sniff / MITM / rogue / secret-leak (`300`);
  performance soak harness with short + 8 h variants (`301`); E2E journeys J0/J1/J2/J6
  (`302`); Phase-1 acceptance traceability (`303`).

### Notes
- macOS/Linux service boot, telemetry ±1% parity, the full 8-hour soak, and
  macOS/Linux installer build+notarization are validated as **documented-manual** —
  configured and cross-compiled here, to be exercised on target hardware.
