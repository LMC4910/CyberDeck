# CyberDeck First-Party Plugins

Each capability is an **out-of-process plugin** built as its own Go binary (ADR-0006) and
supervised by the engine's plugin host (PROJ-130/131). A plugin speaks a small newline-JSON
IPC contract over stdio (`init` → `register` its actions/states → publish `stateUpdate`s and
handle `invokeAction`), and a crashing or hung plugin is isolated and restarted — it must
never take down the engine (NFR-07).

The engine launches a bundled plugin from `plugins/<name>/<name>[.exe]` next to the
executable. `task dist:engine` builds the engine + all four shipped plugins into `run/`.

## Shipped plugins

| Dir | Plugin | Contributes | Dry-run env |
|-----|--------|-------------|-------------|
| `telemetry/` | System telemetry | `system.*` states — CPU / RAM / net delta / disk / uptime (gopsutil) | — |
| `power/`     | Power actions | `system.shutdown` · `restart` · `sleep` · `hibernate` · `lock` · `logoff` (destructive ones flagged for 2-tap confirm) | `CYBERDECK_POWER_DRYRUN=1` |
| `volume/`    | System volume | `system.volume` / `system.muted` states; actions `volume.set` · `volume.mute` | `CYBERDECK_VOLUME_DRYRUN=1` |
| `launchers/` | Launchers | actions `launch.app` (start/open/xdg-open) · `launch.url` | `CYBERDECK_LAUNCH_DRYRUN=1` |

Actions are **dry-run by default** for safety; the engine passes the dry-run env unless it
was started with `--power-live`. The action catalogue the engine authorizes + routes is in
`engine/cmd/cyberdeck/main.go` (`builtinLookup`); a full manifest→registry merge is a
strengthening follow-up.

## Planned (not yet shipped)

| Dir | Plugin | Ticket |
|-----|--------|--------|
| `telemetry/` (GPU chain) | GPU telemetry provider chain | PROJ-172 |
| `notifications/` | Notification count | PROJ-176 |
| `media/` | Media card | Phase 2 |
| `fps/` | FPS / frame telemetry | Phase 2 |

## Authoring a plugin

Use an existing plugin as a template — `power/` is the clearest for actions, `telemetry/`
for published state. A new plugin module joins the Go workspace via the root `go.work`. See
[`CONTRIBUTING.md`](../CONTRIBUTING.md#authoring-a-plugin) for the workflow.
