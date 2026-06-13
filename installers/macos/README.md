# CyberDeck — macOS installer (.pkg)

Builds a `.pkg` that installs the engine + all five bundled plugins under
`/usr/local/cyberdeck` **and the desktop client at `/Applications/CyberDeck.app`**
(one product, never one without the other) and registers the engine as a per-user
**launchd LaunchAgent** (`io.cyberdeck.cyberdeck`, `RunAtLoad` + `KeepAlive`) so the
deck stays reachable after the UI closes (**P1-AC-01**). A bundled `uninstall.sh`
unregisters the agent and removes both (**P1-AC-15**). The client is **mandatory** —
`build-pkg.sh` aborts if no `.app` is staged in `dist/macos/client/`.

> **Status: documented-manual.** `pkgbuild`/`productbuild`/`notarytool` and the
> Flutter macOS build are macOS-only. The engine + plugins **cross-compile** here
> (`task dist:macos`, darwin/arm64); the client + `.pkg` build on the `macos-latest`
> CI runner (`installers.yml`). Signing, notarization, and runtime are not executed
> on this Windows host. Run the steps below on a Mac for a local build.

## Files

| File | Purpose |
|------|---------|
| `build-pkg.sh` | Stages `dist/macos/` into a payload and builds `Output/CyberDeck-<ver>.pkg` via `pkgbuild` + `productbuild`. |
| `distribution.xml` | `productbuild` distribution (title, min macOS 12, arch, single choice). |
| `resources/` | Welcome + license HTML shown in the installer UI. |
| `scripts/postinstall` | Runs `cyberdeck --service install` as the console user → registers the launchd agent. |
| `scripts/uninstall.sh` | `cyberdeck --service uninstall` + removes `/usr/local/cyberdeck` and the receipt. |
| `notarize.sh` | Submits the signed `.pkg` to Apple's notary service and staples the ticket. |

## Build (on macOS)

```sh
# 1. Build the bundle ON a Mac — engine + plugins + the Flutter macOS client
#    (dist:macos runs dist:client:macos, which builds the .app into dist/macos/client/):
task dist:macos                     # → dist/macos/{cyberdeck, plugins/*, client/*.app}

# 2. Build the .pkg (optionally sign) — aborts if the client .app is missing:
SIGN_IDENTITY="Developer ID Installer: Your Name (TEAMID)" \
  installers/macos/build-pkg.sh 1.0.0

# 3. (Optional) notarize + staple for distribution:
installers/macos/notarize.sh Output/CyberDeck-1.0.0.pkg cyberdeck-notary
```

Output: `installers/macos/Output/CyberDeck-<version>.pkg`.

## Install / uninstall (end-user)

- **Install** — double-click the `.pkg` and follow the prompts (admin password
  required for `/usr/local`). The launchd agent is registered + loaded on install.
- **Uninstall** — `sudo /usr/local/cyberdeck/uninstall.sh` (or run
  `installers/macos/scripts/uninstall.sh` from a checkout). It stops + unloads the
  agent, deletes `/usr/local/cyberdeck` and `/Applications/CyberDeck.app`, and
  forgets the package receipt.

Per-user data (`~/Library/Application Support/CyberDeck`) is left in place; delete it
manually for a full wipe.

## Signing & notarization notes

- Sign the **binaries** (engine + each plugin) with a *Developer ID Application*
  cert and hardened runtime before packaging:
  `codesign --force --options runtime --timestamp --sign "Developer ID Application: …" dist/macos/cyberdeck dist/macos/plugins/*/*`.
- Sign the **installer** with a *Developer ID Installer* cert (`SIGN_IDENTITY`).
- Store a notary credential profile once with `xcrun notarytool store-credentials`,
  then run `notarize.sh`. Without notarization the `.pkg` still installs but triggers
  a Gatekeeper warning on first open.
