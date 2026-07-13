# CyberDeck IDE

React + TypeScript + Vite app; ships in a Tauri shell (M6). Runs fully featured on the MockApiGateway — the Go engine is a deployment-time swap, never a code dependency.

## Layout (`src/`)

| Folder | Layer | Holds |
|---|---|---|
| `shared/` | Shared | IDE-internal types/utils; generated contract types land here |
| `platform/` | Platform kernel | BootManager, ServiceContainer, EventBus, Command Registry |
| `services/` | Services | single-responsibility platform services, resolved by interface |
| `repositories/` | Data access | per-domain repositories + gateway (Mock \| Engine) — the only layer that talks to the gateway |
| `stores/` | State | domain stores; UI subscribes, never mutates directly |
| `workspaces/<name>/` | Feature | one folder per workspace (deck-designer, flows, …) |
| `widgets/<id>/` | Feature | self-contained widget modules loaded from manifests |
| `extensions/<id>/` | Feature | sandboxed extension host code |
| `src/*` (root files) | App shell | `main.tsx`, `App.tsx` |

## Allowed-dependency matrix

Enforced by `eslint-plugin-boundaries` (`boundaries/dependencies` rule in `eslint.config.js`). **Default is deny** — an import pair not listed here fails lint. Cross-feature imports (workspace→workspace, widget→widget, …) are always denied; features communicate via stores/events.

| From ↓ may import → | shared | platform | services | repositories | stores | workspaces | widgets |
|---|---|---|---|---|---|---|---|
| **shared** | — | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ |
| **platform** | ✔ | — | ✖ | ✖ | ✖ | ✖ | ✖ |
| **services** | ✔ | ✔ | — | ✖ | ✖ | ✖ | ✖ |
| **repositories** | ✔ | ✔ | ✔ | — | ✖ | ✖ | ✖ |
| **stores** | ✔ | ✔ | ✔ | ✔ | — | ✖ | ✖ |
| **workspaces/<n>** | ✔ | ✔ | ✔ | ✖ | ✔ | ✖ | ✖ |
| **widgets/<id>** | ✔ | ✔ | ✔ | ✖ | ✔ | ✖ | ✖ |
| **extensions/<id>** | ✔ | ✔ | ✖ | ✖ | ✖ | ✖ | ✖ |
| **app shell** | ✔ | ✔ | ✔ | ✖ | ✔ | ✔ | ✖ |

The rule is proven by committed fixtures: `src/workspaces/__fixture-b__` imports from `__fixture-a__`, and `pnpm test:boundaries` asserts lint reports it (fixtures are excluded from the plain `pnpm lint` run).

## Scripts

`pnpm dev` · `pnpm build` (tsc + vite) · `pnpm typecheck` · `pnpm lint` · `pnpm test:boundaries`

Toolchain pinned: Node 20.19.x / pnpm 10.34.x (`engines`, `packageManager`, root `.tool-versions`). Path alias: `@/* → src/*`.
