# CyberDeck Monorepo Structure

Authoritative layout for the CyberDeck Phase-1 host engine + client, per
**TRD Master §7.1** (`Documentation/CyberDeck_TRD_2_Master.md`). Created by
**PROJ-101**. The pre-existing Touch Portal / Node.js artifacts (`ui/`,
`scripts/`, `Touch Portal/`, `dist/`, `Reference Images/`, `ReferenceOutput/`)
belong to the earlier product direction and are left untouched.

```
CyberDeck/
├── engine/                  Go module — github.com/shishir/cyberdeck/engine
│   ├── cmd/cyberdeck/        service entrypoint (main.go)
│   ├── core/                 transport, state, registries, layout, flow, security, persistence
│   ├── pluginhost/           process supervision + IPC
│   ├── pal/                  capability interfaces + provider-chain framework
│   └── internal/             wire, serializer, config, lifecycle, secrets (engine-private)
├── plugins/                 Go — first-party, each its own process binary
│   ├── telemetry/  media/  power/  launchers/  notifications/  fps/
├── client/                  Flutter — shared client + desktop designer (PROJ-101 client half)
│   └── lib/{net,render,gestures,app,theme,tray,designer}/
├── shared/                  schemas: action/widget/flow-node/state descriptors + protocol envelope
│   └── schemas/
├── installers/              per-OS packaging (windows/ macos/ linux/)
├── docs/                    implementation-time engineering docs (ADRs, acceptance evidence)
├── Documentation/           authoritative product/architecture docs + Phase-1 execution system
├── Taskfile.yml             cross-platform task runner: lint | test | build
├── .editorconfig
└── STRUCTURE.md             this file
```

## Status (PROJ-101)

| Area | State |
|------|-------|
| `engine/` Go module | ✅ scaffolded — builds, `go test` green |
| `plugins/`, `installers/`, `docs/`, `shared/schemas/` | ✅ scaffolded (placeholders) |
| `Taskfile.yml`, `.editorconfig`, `.golangci.yml` | ✅ created |
| `client/` Flutter app | ✅ scaffolded (`flutter create`; `dart analyze` + `flutter test` + `flutter build windows` green) |

> The Designer lives in the client codebase but compiles/enables only for desktop
> targets (ADR-0018).
