; CyberDeck — Windows installer (Inno Setup 6).
;
; Packages the release bundle produced by `task dist:windows`:
;   dist\windows\cyberdeck.exe
;   dist\windows\plugins\<name>\<name>.exe   (telemetry, power, volume, launchers, notifications)
;   dist\windows\client\                      (Flutter Windows desktop runner, REQUIRED)
;
; into a per-machine install under {autopf}\CyberDeck and registers the engine as
; an auto-start Windows SCM service (P1-AC-01) by invoking the engine's own
; `--service install` / `--service uninstall` (engine/internal/service/windows.go).
; Uninstall stops + removes the service and deletes the install tree (P1-AC-15).
;
; Build (from the repo root, after `task dist:windows`):
;   "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" installers\windows\cyberdeck.iss
; Optionally override the version:
;   ISCC.exe /DMyAppVersion=1.0.0 installers\windows\cyberdeck.iss
;
; Output: installers\windows\Output\CyberDeck-Setup-<version>.exe

#ifndef MyAppVersion
  #define MyAppVersion "0.0.0-dev"
#endif

#define MyAppName "CyberDeck"
#define MyAppPublisher "CyberDeck"
#define MyAppURL "https://github.com/shishir/cyberdeck"
#define MyAppExeName "cyberdeck.exe"
#define MyClientExeName "cyberdeck_client.exe"
; DistDir is the staged release bundle (relative to this .iss file → repo root\dist\windows).
#define DistDir "..\..\dist\windows"

; A CyberDeck installer must ALWAYS contain BOTH the engine and the desktop client —
; shipping one without the other is the exact failure this guard prevents. Fail the
; build loudly if the Flutter client runner is missing from the bundle (run
; `task dist:windows`, which builds the client, before packaging).
#if !FileExists(AddBackslash(DistDir) + "client\\" + MyClientExeName)
  #error CyberDeck client runner not found in dist\windows\client. Run `task dist:windows` (it builds the Flutter Windows client) before packaging — the installer must bundle engine + client together.
#endif

[Setup]
; A stable AppId keeps upgrades/uninstall correct across versions — do not change it.
AppId={{8E5C2C2E-3C7A-4E2B-9F4D-CYBERDECK0001}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
; Per-machine install (Program Files) so the SCM service can resolve the engine path.
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=Output
OutputBaseFilename=CyberDeck-Setup-{#MyAppVersion}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
UninstallDisplayName={#MyAppName}
UninstallDisplayIcon={app}\{#MyAppExeName}

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "installservice"; Description: "Run the CyberDeck engine as a background service (keeps the deck reachable after the UI closes)"; GroupDescription: "Background service:"

[Files]
; Engine + bundled plugins. The engine resolves its plugins from a "plugins"
; directory next to the executable (engine defaultPluginsDir), so the tree layout
; below must be preserved.
Source: "{#DistDir}\{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#DistDir}\plugins\*"; DestDir: "{app}\plugins"; Flags: ignoreversion recursesubdirs createallsubdirs
; Flutter Windows desktop client — MANDATORY. The compile-time guard above ensures
; this is present, so engine and client always install together as one product.
Source: "{#DistDir}\client\*"; DestDir: "{app}\client"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\client\{#MyClientExeName}"; WorkingDir: "{app}\client"
Name: "{group}\{#MyAppName} Engine (console)"; Filename: "{app}\{#MyAppExeName}"; Parameters: "--console"; WorkingDir: "{app}"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\client\{#MyClientExeName}"; WorkingDir: "{app}\client"; Tasks: desktopicon

[Run]
; Register + start the engine as an SCM service via the engine's own installer.
; runascurrentuser is omitted so it runs elevated (the installer is already admin).
Filename: "{app}\{#MyAppExeName}"; Parameters: "--service install"; StatusMsg: "Registering the CyberDeck background service..."; Flags: runhidden waituntilterminated; Tasks: installservice
; Offer to launch the client after install.
Filename: "{app}\client\{#MyClientExeName}"; Description: "{cm:LaunchProgram,{#MyAppName}}"; WorkingDir: "{app}\client"; Flags: nowait postinstall skipifsilent

[UninstallRun]
; Stop + remove the SCM service BEFORE the files are deleted (clean uninstall, P1-AC-15).
Filename: "{app}\{#MyAppExeName}"; Parameters: "--service uninstall"; RunOnceId: "RemoveService"; Flags: runhidden waituntilterminated

[UninstallDelete]
; Remove the install tree (the engine's per-user data dir under %AppData%\CyberDeck
; is intentionally left in place — it holds the user's decks/pairings).
Type: filesandordirs; Name: "{app}\plugins"
Type: filesandordirs; Name: "{app}\client"
