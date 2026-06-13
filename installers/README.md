# CyberDeck — native installers (PROJ-190 / 191 / 192)

**One combined installer per desktop OS.** Each packages the release bundle from
`task dist:<os>` — the engine + all five bundled plugins **and the Flutter desktop
client** — into a single artifact, and registers the engine as a background service
so the deck stays reachable after the UI closes (**P1-AC-01**). The client is
**mandatory**: packaging fails if the client bundle is missing, so a user can never
install one piece without the other. Each uninstalls cleanly (**P1-AC-15**).

> The engine is a desktop daemon and cannot run on Android — the Android build is a
> separate remote-client APK that pairs with a PC's engine over LAN. These combined
> installers are desktop-only.

| OS | Dir | Single artifact | Installs | Service manager | Status |
|----|-----|-----------------|----------|-----------------|--------|
| Windows | [`windows/`](windows/) | Inno Setup `.exe` | engine + plugins + client | SCM (`CyberDeck`) | script validated; build needs Inno Setup |
| macOS | [`macos/`](macos/) | `.pkg` (+ notarize) | engine + `/Applications/CyberDeck.app` | launchd LaunchAgent | documented-manual (macOS-only tools) |
| Linux | [`linux/`](linux/) | **AppImage** (single file) | engine + client (AppRun starts both) | systemd (optional) | documented-manual (Linux-only tools) |

> Linux ships a **single self-contained AppImage** (the "one file, can't get it
> wrong" format). The older `.deb`/`.rpm` scripts (`nfpm.yaml`, `build-packages.sh`)
> are deprecated and no longer part of the release pipeline.

Service registration is **single-sourced in the engine**: every installer calls the
engine's own `cyberdeck --service install` / `--service uninstall`
(`engine/internal/service/`), so the SCM service / launchd plist / systemd unit
definitions never drift from the installers. See each OS dir's `README.md` for build
steps, install/uninstall notes, and signing/notarization.

## Honest build status

The Go engine + all five plugins **cross-compile cleanly** for every target via
`task dist:windows|macos|linux` (verified). The **Flutter desktop client is a native
build** (Flutter desktop only builds on its own OS): the Windows client builds + is
bundled locally; the macOS/Linux clients build on the `macos-latest`/`ubuntu-latest`
runners in `.github/workflows/installers.yml`. The OS-native packaging tools
(`ISCC.exe`, `pkgbuild`/`notarytool`, `appimagetool`) are **not present on the Windows
dev host**, so the macOS/Linux installers are **authored + structure-validated here
but compiled in CI / on the matching OS**. Each `dist:<os>` + installer step **fails
if the client bundle is absent**, guaranteeing every artifact contains engine +
client together.
