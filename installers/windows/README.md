# CyberDeck — Windows installer (Inno Setup)

`cyberdeck.iss` builds a self-contained Windows setup `.exe` that installs the
engine + all five bundled plugins **and the Flutter desktop client** (one product,
never one without the other) and registers the engine as an auto-start **Windows SCM
service** so the deck stays reachable after the UI is closed (**P1-AC-01**). Uninstall
stops + removes the service and deletes the install tree (**P1-AC-15**). The client is
**mandatory** — a compile-time `#error` guard fails packaging if the client bundle is
missing from `dist\windows\client\`.

## Prerequisites

- **Inno Setup 6** — <https://jrsoftware.org/isdl.php> (provides `ISCC.exe`).
- The staged release bundle in `dist\windows\` from the repo root:

  ```powershell
  task dist:windows   # engine + 5 plugins + Flutter Windows client (Flutter required)
  ```

  This produces `dist\windows\cyberdeck.exe`, `dist\windows\plugins\<name>\<name>.exe`,
  and `dist\windows\client\cyberdeck_client.exe` (all required by the installer).

## Build the installer

From the repo root, after `task dist:windows`:

```powershell
& "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" /DMyAppVersion=1.0.0 installers\windows\cyberdeck.iss
```

`MyAppVersion` is optional (defaults to `0.0.0-dev`); pass the engine version you
built. Output: `installers\windows\Output\CyberDeck-Setup-<version>.exe`.

## What the installer does

- Installs to `%ProgramFiles%\CyberDeck` (per-machine, requires admin — the SCM
  service needs a stable absolute engine path).
- Preserves the `cyberdeck.exe` + `plugins\<name>\<name>.exe` layout the engine
  expects (`defaultPluginsDir` resolves `plugins\` next to the executable).
- Bundles the Flutter client under `client\` (mandatory) and creates the Start-menu
  + optional desktop shortcuts pointing at `client\cyberdeck_client.exe`.
- With the **Background service** task checked (default), runs
  `cyberdeck.exe --service install`, which registers the auto-start `CyberDeck` SCM
  service via `engine/internal/service/windows.go` and starts it.

## Install / uninstall (end-user)

- **Install** — run `CyberDeck-Setup-<version>.exe` and accept the elevation prompt.
- **Uninstall** — *Settings → Apps → CyberDeck → Uninstall* (or
  `%ProgramFiles%\CyberDeck\unins000.exe`). The uninstaller runs
  `cyberdeck.exe --service uninstall` **before** deleting files, so the SCM service
  is stopped and removed, then the install tree is removed.

The engine's per-user data (`%AppData%\CyberDeck` — decks, pairings, database) is
intentionally **left in place** on uninstall so a reinstall keeps the user's setup.
Delete that folder manually for a full wipe.

## Manual service control (no installer)

The same registration is available from the engine directly (run elevated):

```powershell
cyberdeck.exe --service install      # register + start the CyberDeck SCM service
cyberdeck.exe --service uninstall    # stop + remove it
```

## Validation status

The script is structurally validated (sections, preprocessor directives, `[Code]`
Pascal, and every `{#...}` constant defined). `ISCC.exe` was **not** available on
this build host, so the compile + the produced setup were **not** executed here —
run the build command above on a host with Inno Setup 6 to produce the installer.
