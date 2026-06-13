# CyberDeck — Linux installer (single AppImage)

Linux ships as **one self-contained AppImage** — the "one file, can't get it wrong"
format. It bundles the engine + the five plugins **and the Flutter desktop client**;
`AppRun` starts the engine in the background then launches the client, so you can
never run the client without its engine.

| Format | Tool | Contains | Engine lifecycle |
|--------|------|----------|------------------|
| **AppImage** (primary) | [appimagetool](https://github.com/AppImage/appimagetool) | engine + plugins + desktop client | `AppRun` starts the engine + client together; `--service install` optionally registers a systemd *user* unit for boot persistence |

> **Deprecated:** the older `.deb`/`.rpm` path (`nfpm.yaml`, `build-packages.sh`,
> `scripts/`) shipped an **engine-only** system package and is no longer part of the
> release pipeline (`.github/workflows/installers.yml` builds only the AppImage).
> The files are retained for reference but unmaintained.

> **Status: documented-manual.** The engine + plugins cross-compile here
> (`task dist:linux`); the Flutter Linux client and `appimagetool` run on the
> `ubuntu-latest` CI runner (`installers.yml`), not on this Windows dev host. The
> AppDir staging + AppRun are structure-validated here.

## Build

```sh
task dist:linux        # → dist/linux/cyberdeck + plugins/* + client/ (client built on Linux)
# download appimagetool from its releases page and put it on PATH, then:
installers/linux/appimage/build-appimage.sh 1.0.0
# → installers/linux/Output/CyberDeck-1.0.0-x86_64.AppImage
```

The build **fails** if `dist/linux/client/cyberdeck_client` is missing — every
artifact must contain both engine and client.

## Files

| File | Purpose |
|------|---------|
| `appimage/AppRun` | Entrypoint — starts the bundled engine (background) then the desktop client; `--service`/`--engine` pass-throughs. |
| `appimage/cyberdeck.desktop` | AppImage desktop entry (GUI app). |
| `appimage/cyberdeck.png` | Placeholder icon (replace with branded art before release). |
| `appimage/build-appimage.sh` | Stages the AppDir (engine + plugins + client) and runs appimagetool. |
| `nfpm.yaml`, `build-packages.sh`, `scripts/` | **Deprecated** engine-only `.deb`/`.rpm` definitions (unmaintained). |

## Install / run (end-user)

```sh
chmod +x CyberDeck-1.0.0-x86_64.AppImage
./CyberDeck-1.0.0-x86_64.AppImage                        # starts engine + opens the desktop client
./CyberDeck-1.0.0-x86_64.AppImage --service install      # optional: systemd user unit (boot persistence)
./CyberDeck-1.0.0-x86_64.AppImage --engine               # engine only (console; prints pairing QR)
```

Per-user data (`~/.config/CyberDeck` — decks, pairings, database) is left in place;
delete it manually for a full wipe.
