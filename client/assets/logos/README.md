# Launcher art (`assets/logos/`)

Launcher / shortcut widgets resolve their icon from this directory by name, e.g.
`assets/logos/spotify.png`. The lookup is **best-effort**: when the named asset
is absent, the widget paints a **procedural neon tile** instead (built in the
widget layer, Wave C2) — a cyan→purple gradient chip with the launcher's initial.
So you never have to ship art to get a usable deck; drop a PNG in here only when
you want a real logo.

## Naming

Use a lowercase, hyphen-free slug matching the launcher's `config.icon` (or its
label, lowercased) plus `.png`:

| Launcher        | Expected file            |
| --------------- | ------------------------ |
| Spotify         | `spotify.png`            |
| Netflix         | `netflix.png`            |
| Chrome          | `chrome.png`             |
| Discord         | `discord.png`            |
| Steam           | `steam.png`              |
| Visual Studio   | `vscode.png`             |
| Terminal        | `terminal.png`           |

## Art guidance

- Square, transparent-background PNG. **512×512** is plenty; the renderer scales.
- Keep the subject centred with a little breathing room — the card chrome adds
  its own padding and glow.
- High-contrast / neon-friendly artwork reads best on the deep-navy deck.

Files here are wired into the app via the `assets/logos/` entry in
`client/pubspec.yaml`.
