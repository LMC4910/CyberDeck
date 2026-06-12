# Contributing to CyberDeck

Thanks for your interest in CyberDeck! This guide covers the toolchain, the local quality
gates, the branch/PR workflow, and how to add a plugin. Keep changes small and focused, and
make sure the gates are green before opening a PR.

> **Licensing of contributions.** CyberDeck is source-available under the
> [PolyForm Noncommercial License 1.0.0](LICENSE). By submitting a contribution you agree
> that it is licensed under the same terms, and that the maintainer may also offer it under a
> separate commercial license (the project is dual-licensed — see [`LICENSE`](LICENSE)).

## Toolchain

| Tool | Version | For |
|------|---------|-----|
| [Go](https://go.dev/dl/) | 1.25+ | Engine + plugins |
| [Flutter](https://docs.flutter.dev/get-started/install) (+ Dart) | stable (3.44+) | Client + Designer |
| [Task](https://taskfile.dev) | 3.x | Cross-platform task runner |
| [golangci-lint](https://golangci-lint.run) | v2.x | Go linting |
| A C compiler (gcc/clang) | — | `go test -race` (the race detector needs cgo) |
| Visual Studio “Desktop development with C++” | — | `flutter build windows` |

The engine and the four plugins are tied together by `go.work` (Go workspace mode), so
`go build ./...` / `go test ./...` resolve cross-module without manual `replace` juggling.

## The four gates (run these locally — they mirror CI)

CI runs the same checks on every push and pull request (see [`ci/README.md`](ci/README.md)).
Run them before pushing:

```sh
task lint    # go vet + golangci-lint   ·   dart analyze
task test    # go test                  ·   flutter test
task build   # go build (engine)         ·   flutter build windows (client)
```

Or per component:

```sh
# Engine (from engine/)
go vet ./... && golangci-lint run && go test -race ./... && go build ./...

# Client (from client/)
dart analyze && flutter test && flutter build windows
```

`-race` needs a C compiler on PATH. On Windows without one, run `go test ./...` (no
`-race`); CI runs `-race` authoritatively on Linux. To exercise the real encrypted
Dart↔Go pairing path end-to-end, run `task interop`.

## Branch & PR workflow

The default branch (`master`) is protected by a GitHub ruleset (defined in
[`ci/branch-ruleset.json`](ci/branch-ruleset.json)). Direct pushes are blocked for
non-admins; changes land via pull request:

1. Branch off `master` (e.g. `feat/volume-osd`, `fix/reconnect-backoff`).
2. Make your change with tests; keep the four gates green.
3. Open a PR. Required status checks must pass and the branch must be up to date:
   - `engine (lint + test -race, linux)`
   - `engine (build + test) (windows-latest)`
   - `engine (build + test) (macos-latest)`
   - `client (analyze + test + build)`
4. Resolve review threads, then squash/rebase-merge (linear history is enforced — no merge
   commits, no force-pushes to `master`).

### Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org/) with the ticket id, as
in the existing history:

```
feat(plugins): volume OSD overlay (PROJ-174)
fix(client): bound reconnect backoff jitter (PROJ-146)
docs: build matrix for Linux/macOS hosts
test(engine): interop drop→reconnect→revoke
```

Scopes in use: `engine`, `client`, `plugins`, `ci`, `docs`, `test`.

## Authoring a plugin

A capability is an out-of-process binary that speaks newline-JSON IPC to the engine's
plugin host (it `init`s, `register`s its actions/states, then publishes state updates and
handles `invokeAction`). A crash is isolated and restarted — it never takes down the engine.

- Read [`plugins/README.md`](plugins/README.md) for the contract and the catalogue of the
  four shipped plugins.
- Use an existing plugin as a template — `plugins/power/` (actions) or `plugins/telemetry/`
  (published state) are the clearest starting points.
- A new plugin module joins the workspace via `go.work`; the engine launches a bundled
  plugin from `plugins/<name>/<name>[.exe]` next to the executable.

## Reporting issues

Open a GitHub issue with steps to reproduce, your OS + tool versions, and relevant engine
console / `flutter` logs. Security-sensitive reports: email
**shishirlamichhane718@gmail.com** rather than filing a public issue.
