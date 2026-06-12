# CyberDeck — macOS installer (.pkg)

Builds a flat `.pkg` that installs the engine + all five bundled plugins under
`/usr/local/cyberdeck` and registers the engine as a per-user **launchd
LaunchAgent** (`io.cyberdeck.cyberdeck`, `RunAtLoad` + `KeepAlive`) so the deck
stays reachable after the UI closes (**P1-AC-01**). A bundled `uninstall.sh`
unregisters the agent and removes the tree (**P1-AC-15**).

> **Status: documented-manual.** `pkgbuild`/`productbuild`/`notarytool` are
> macOS-only, so the engine + plugins are **cross-compiled** here (`task dist:macos`,
> darwin/arm64) but the `.pkg` build, signing, notarization, and runtime were **not
> executed** on this Windows host. Run the steps below on a Mac.

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
# 1. Cross-compile (works on any host) or build natively on the Mac:
task dist:macos                     # → dist/macos/cyberdeck + dist/macos/plugins/*

# 2. (Optional) build the Flutter client natively so it's bundled into /Applications:
( cd client && flutter build macos ) \
  && cp -R client/build/macos/Build/Products/Release/cyberdeck_client.app dist/macos/CyberDeck.app

# 3. Build the .pkg (optionally sign):
SIGN_IDENTITY="Developer ID Installer: Your Name (TEAMID)" \
  installers/macos/build-pkg.sh 1.0.0

# 4. (Optional) notarize + staple for distribution:
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
