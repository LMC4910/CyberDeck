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

## Branch ruleset (default-branch protection)

The default branch (`master`) is protected by a GitHub **ruleset** whose definition
lives in `ci/branch-ruleset.json` (kept in-repo as IaC so it's reviewable +
re-appliable). It enforces, for everyone except a repository **admin** (bypass):

- **Require a pull request** to merge (0 required approvals — solo-friendly; stale
  reviews dismissed on push; review threads must be resolved).
- **Require the CI checks to pass** and the branch to be **up to date**:
  `engine (lint + test -race, linux)`, `engine (build + test) (windows-latest)`,
  `engine (build + test) (macos-latest)`, `client (analyze + test + build)`.
- **Linear history** (no merge commits), **no force-push** (`non_fast_forward`),
  **no branch deletion**.

> Rulesets/branch-protection on a **private** repo need GitHub Pro; this repo is
> **public**, so they're available on the free plan.

### Apply / update / inspect

```bash
# create (first time)
gh api --method POST repos/LMC4910/CyberDeck/rulesets --input ci/branch-ruleset.json

# update after editing the JSON (RULESET_ID from the list below)
gh api --method PUT repos/LMC4910/CyberDeck/rulesets/<RULESET_ID> --input ci/branch-ruleset.json

# list / inspect
gh api repos/LMC4910/CyberDeck/rulesets
gh api repos/LMC4910/CyberDeck/rulesets/<RULESET_ID>
```

### Prove a red gate blocks (one-time, satisfies PROJ-102 AC)

Open a PR that deliberately breaks a lint/test, confirm the CI fails and merge is
blocked, then revert. (CI is currently red — fix it so PRs can merge; the admin
bypass keeps the owner able to push in the meantime.)
