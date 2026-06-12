# CyberDeck — native installers (PROJ-190 / 191 / 192)

Per-OS installers that package the release bundle from `task dist:<os>` (the engine
+ all five bundled plugins, + the desktop client where it can be built natively) and
register the engine as a background service so the deck stays reachable after the UI
closes (**P1-AC-01**). Each uninstalls cleanly — stopping + removing the service and
deleting the install tree (**P1-AC-15**).

| OS | Dir | Format | Service manager | Status |
|----|-----|--------|-----------------|--------|
| Windows | [`windows/`](windows/) | Inno Setup `.exe` | SCM (`CyberDeck`) | script validated; build needs Inno Setup |
| macOS | [`macos/`](macos/) | `.pkg` (+ notarize) | launchd LaunchAgent | documented-manual (macOS-only tools) |
| Linux | [`linux/`](linux/) | `.deb` / `.rpm` / AppImage | systemd | documented-manual (Linux-only tools) |

Service registration is **single-sourced in the engine**: every installer calls the
engine's own `cyberdeck --service install` / `--service uninstall`
(`engine/internal/service/`), so the SCM service / launchd plist / systemd unit
definitions never drift from the installers. See each OS dir's `README.md` for build
steps, install/uninstall notes, and signing/notarization.

## Honest build status

The Go engine + all five plugins **cross-compile cleanly** for every target via
`task dist:windows|macos|linux` (verified). The OS-native packaging tools
(`ISCC.exe`, `pkgbuild`/`notarytool`, `nfpm`/`appimagetool`) are **not present on the
Windows build host**, so the installers were **authored + syntax/structure-validated
here but not compiled/run**. Build them on the matching OS (or via the
`.github/workflows/installers.yml` matrix) per the per-OS READMEs.
