# CyberDeck — Linux installers (.deb / .rpm / AppImage)

Three delivery formats for Linux:

| Format | Tool | Installs to | Service |
|--------|------|-------------|---------|
| `.deb` / `.rpm` | [nfpm](https://nfpm.goreleaser.com) | `/opt/cyberdeck` | systemd, auto-registered on install (**P1-AC-01**) |
| AppImage | [appimagetool](https://github.com/AppImage/appimagetool) | none (portable) | manual (`--service install` from the AppImage) |

All package the engine + the five bundled plugins from `task dist:linux`
(linux/amd64). The `.deb`/`.rpm` register the engine as a system-wide systemd
service on install and stop + remove it on uninstall (**P1-AC-15**).

> **Status: documented-manual.** The engine + plugins are **cross-compiled** here
> (`task dist:linux`), but `nfpm`/`appimagetool` are not present on this Windows
> build host, so the package builds + their install/uninstall runtime were **not
> executed** here. Run the build scripts below on Linux. The maintainer scripts and
> configs are syntax-validated.

## Prerequisites

```sh
task dist:linux        # → dist/linux/cyberdeck + dist/linux/plugins/*
# .deb/.rpm:
go install github.com/goreleaser/nfpm/v2/cmd/nfpm@latest
# AppImage:
# download appimagetool from its releases page and put it on PATH
```

## Build

```sh
# .deb + .rpm → installers/linux/Output/
installers/linux/build-packages.sh 1.0.0

# AppImage → installers/linux/Output/
installers/linux/appimage/build-appimage.sh 1.0.0
```

## Files

| File | Purpose |
|------|---------|
| `nfpm.yaml` | deb/rpm package definition (contents, metadata, maintainer scripts). |
| `build-packages.sh` | Builds both `.deb` and `.rpm` with nfpm. |
| `scripts/postinstall.sh` | Runs `cyberdeck --service install` → writes + enables the systemd unit. |
| `scripts/preremove.sh` | Runs `cyberdeck --service uninstall` before files are removed. |
| `scripts/postremove.sh` | Belt-and-suspenders: removes any stale unit + `daemon-reload`. |
| `appimage/AppRun` | AppImage entrypoint — launches `cyberdeck --console` with bundled plugins. |
| `appimage/cyberdeck.desktop` | AppImage desktop entry. |
| `appimage/cyberdeck.png` | Placeholder icon (replace with branded art before release). |
| `appimage/build-appimage.sh` | Stages the AppDir and runs appimagetool. |

## Install / uninstall (end-user)

### Debian/Ubuntu (`.deb`)

```sh
sudo apt install ./cyberdeck_1.0.0_amd64.deb     # registers + starts the service
sudo apt remove cyberdeck                         # stops + removes the service + tree
```

### Fedora/RHEL/openSUSE (`.rpm`)

```sh
sudo dnf install ./cyberdeck-1.0.0.x86_64.rpm     # registers + starts the service
sudo dnf remove cyberdeck                          # stops + removes the service + tree
```

After install, check the service with `systemctl status cyberdeck`.

### AppImage (portable, no install)

```sh
chmod +x CyberDeck-1.0.0-x86_64.AppImage
./CyberDeck-1.0.0-x86_64.AppImage                  # runs the engine (console; prints pairing QR)
sudo ./CyberDeck-1.0.0-x86_64.AppImage --service install   # optional: register systemd
```

The package formats leave per-user data (`~/.config/CyberDeck` — decks, pairings,
database) in place on uninstall; delete it manually for a full wipe.
