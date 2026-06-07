# CyberDeck CI

The CI workflow (`.github/workflows/ci.yml`) enforces the **four gates** —
lint, typecheck, test, build — for both the Go engine and the Flutter client on
every push and pull request (PROJ-102). It is the backstop that keeps the default
branch green; the per-ticket local validation below mirrors it.

## Jobs

| Job | Runner | Gates |
|-----|--------|-------|
| `engine` | ubuntu | `go vet` · `golangci-lint run` (v2.12.2) · `go test -race ./...` · `go build ./...` |
| `engine-cross` | windows, macos | `go build ./...` · `go test ./...` (proves the engine compiles + passes on all three desktop OSes) |
| `client` | ubuntu | `dart analyze` · `flutter test` · `flutter build bundle` |

Pinned versions: Go is read from `engine/go.mod` (`go-version-file`); golangci-lint
`v2.12.2`; Flutter `3.44.1` (stable). Module/pub caches are enabled for speed.

## Run the gates locally (mirror CI)

Engine (from `engine/`):
```bash
go vet ./...
golangci-lint run
go test -race ./...      # -race needs cgo: a C compiler (gcc/clang) must be present
go build ./...
```

Client (from `client/`):
```bash
dart analyze
flutter test
flutter build bundle
```

Or the whole monorepo via the task runner (repo root):
```bash
task lint && task test && task build
```

> Note on `-race` on Windows: the race detector requires cgo, so a MinGW gcc must
> be on `PATH` (this repo was developed with WinLibs gcc). Without a C compiler,
> run `go test ./...` (no `-race`) locally; CI runs `-race` on Linux authoritatively.

## Required follow-up to fully satisfy PROJ-102 (repo-owner actions)

The workflow file is complete and the gates pass locally, but two AC need actions
on the GitHub repo that can only be done by the repo owner:

1. **Push** the branch so GitHub Actions runs the workflow at least once and the
   checks register on the repo.
2. **Branch protection** — in *Settings → Branches → Add rule* for `master`:
   - Require status checks to pass before merging.
   - Select `engine`, `engine-cross (windows-latest)`, `engine-cross (macos-latest)`,
     and `client` as required checks.
   This is what makes a red gate **block merge** (the AC).
3. **Prove a red gate blocks** (one-time): open a PR that deliberately breaks a lint
   or test, confirm the workflow fails and merge is blocked, then revert.

Until these are done, PROJ-102 is "authored + locally validated; live-CI run and
branch protection pending" (tracked on the Progress Dashboard).
