# CyberDeck First-Party Plugins

Each first-party capability is an **out-of-process plugin** built as its own Go
binary (ADR-0006) and supervised by the engine's plugin host (PROJ-130/131). A
crashing plugin must never take down the engine (NFR-07).

Planned binaries (EPIC-5):

| Dir | Plugin | Ticket |
|-----|--------|--------|
| `telemetry/`     | CPU/RAM/net/disk + GPU telemetry providers | PROJ-171/172 |
| `media/`         | Media card (basic)                          | PROJ-186 (client) / Phase 2 |
| `power/`         | Power actions                               | PROJ-173 |
| `launchers/`     | Launchers + system tools                    | PROJ-175 |
| `notifications/` | Notification count                          | PROJ-176 |
| `fps/`           | FPS / frame telemetry                       | Phase 2 |

These directories are scaffolded empty by PROJ-101; their `main` packages are
implemented by the EPIC-5 tickets.
