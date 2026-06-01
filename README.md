# CyberDeck

A premium, cyberpunk-themed Touch Portal ecosystem that turns an Android/iOS tablet
into a full PC command center: live system telemetry, media control, gaming
optimization, smart-home control, and unified notifications — all behind a single
dark-neon interface.

CyberDeck ships as two things working together:

1. **A Touch Portal plugin** (`com.shishir.cyberdeck`) — a Node.js service that talks
   to Touch Portal over its plugin socket, exposing **states**, **actions**, **events**
   and **connectors**, and feeding live data into the UI.
2. **A custom Touch Portal UI** — a set of skinned Touch Portal pages whose tiles are
   rendered at runtime by the plugin as full-bleed graphics (gauges, album art,
   sparklines, charts), so the deck looks nothing like a default Touch Portal grid.

| Field | Value |
| --- | --- |
| Product | CyberDeck |
| Plugin ID | `com.shishir.cyberdeck` |
| Backend | Node.js 20 LTS |
| Touch Portal API | 12 (Touch Portal 4.5+) |
| Target host OS | Windows 10 20H2+ / Windows 11 |
| Touch Portal client | Android / iOS / desktop companion |
| Doc version | 1.0 (June 2026) |

## Documentation map

This repository's technical documentation lives in [`docs/`](docs/):

| Doc | Contents |
| --- | --- |
| [01 — Product Requirements](docs/01-product-requirements.md) | Vision, personas, journeys, feature breakdown, functional & non-functional requirements, acceptance criteria. |
| [02 — Technical Architecture](docs/02-technical-architecture.md) | Layered architecture, Node.js module structure, dependency map (Python→Node), data-source providers, telemetry/media/gaming/smart-home/notification pipelines. |
| [03 — Plugin API Specification](docs/03-plugin-api-spec.md) | The `entry.tp` manifest, every state/action/event/connector/setting, the Touch Portal socket protocol, and the `touchportal-api` Node SDK usage. |
| [04 — UI & Design System](docs/04-ui-and-design-system.md) | The tile-rendering pipeline, the seven page specifications, and the cyberpunk design tokens (color, type, components). |
| [05 — Operations & Roadmap](docs/05-operations-and-roadmap.md) | Configuration, secrets, logging, error handling, testing, packaging, deployment, and the phased delivery roadmap. |
| [06 — Project Execution Plan](docs/06-project-execution-plan.md) | Senior-PM delivery roadmap: the `.tpp`/`.tpz` split, per-phase tasks/effort/risks/acceptance, integration sequence diagrams, dependency matrix, testing, release gates, resourcing (RACI), milestones, and the risk register. |

## Repository layout (target)

```
CyberDeck/
├── entry.tp                 # Touch Portal plugin manifest (see doc 03)
├── package.json
├── src/
│   ├── main.js              # Bootstrap + touchportal-api connection
│   ├── core/                # State manager, event bus, tile renderer
│   ├── services/            # telemetry, media, gaming, smarthome, notifications, fans
│   ├── render/              # Canvas tile templates (gauges, sparklines, cards)
│   └── util/                # credentials, ring buffer, formatters, logger
├── pages/                   # Custom Touch Portal pages (.tml / exported .tpz)
├── assets/                  # Icons, backgrounds, fonts
├── config/                  # config.json (non-secret)
└── docs/                    # This documentation set
```

## Status

This is the **technical documentation phase**, and the documentation set (docs 01–06) is
now complete — including a senior-PM [project execution plan](docs/06-project-execution-plan.md)
that an engineering team can deliver from. No application code is included yet; these documents define the contract the
implementation must satisfy. The backend language is fixed to **Node.js**; the data-source
and rendering decisions in doc 02 and doc 04 are the authoritative reference for
implementation. The reference UI for all seven pages lives in
[`Reference Images`](../Reference%20Images).
