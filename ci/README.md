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
| `ide` | ubuntu | `pnpm lint` (eslint + boundary rules) · `pnpm typecheck` · `pnpm test` (vitest + RTL) · `pnpm run test:boundaries` · `pnpm build` · `pnpm size` (≤ 350 KB gz shell entry, CD-105) |

### Go: every workspace module, not just the engine

The Go side is a `go.work` workspace — the `engine` module plus one module per
first-party plugin (`telemetry`, `power`, `volume`, `launchers`, **`notifications`**),
each its own module + process binary. So the `engine` and `engine-cross` jobs do
**not** run from a single `engine/` dir; they loop over **every** workspace module and
run the gates inside each one:

```
for mod in engine plugins/telemetry plugins/power plugins/volume plugins/launchers plugins/notifications; do
  ( cd "$mod" && go vet ./... && golangci-lint run && go test -race ./... && go build ./... )
done
```

This guarantees a plugin (including `plugins/notifications`) can never go un-vetted,
un-linted, un-tested, or un-built. When a new plugin is added to `go.work`, add it to
the `mod` list in both Go jobs and to the `cache-dependency-path` go.sum globs.

Pinned versions: Go is read from `engine/go.mod` (`go-version-file`); golangci-lint
`v2.12.2`; Flutter `3.44.1` (stable). Module caches key off every module's `go.sum`;
the Flutter pub cache is enabled for speed.

## Run the gates locally (mirror CI)

Go — run inside **each** workspace module (CI loops over all of them):
```bash
for mod in engine plugins/telemetry plugins/power plugins/volume plugins/launchers plugins/notifications; do
  ( cd "$mod" \
    && go vet ./... \
    && golangci-lint run \
    && go test -race ./... \   # -race needs cgo: a C compiler (gcc/clang) must be present
    && go build ./... )
done
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
  `engine (build + test) (macos-latest)`, `client (analyze + test + build)`,
  `ide (lint + type + test + build + budget)`.
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

The point of the ruleset is that a red required check **blocks merge**. Prove it once
without ever breaking `master` — do it all on a throwaway branch behind a PR:

```bash
git switch -c ci/redgate-proof

# Break exactly one gate. Pick one — e.g. a guaranteed-failing engine test in a
# plugin (covers the "plugins are gated too" claim):
cat >> plugins/notifications/redgate_test.go <<'EOF'
package main
import "testing"
func TestRedGateProof(t *testing.T) { t.Fatal("intentional red-gate proof") }
EOF

git add plugins/notifications/redgate_test.go
git commit -m "test: deliberate red gate (PROJ-102 proof, will revert)"
git push -u origin ci/redgate-proof
gh pr create --fill
```

Then confirm, on the PR:

1. The `engine (lint + test -race, linux)` check goes **red** (the plugin loop fails
   on `notifications`).
2. The **Merge** button is disabled — "Required statuses must pass before merging".
3. Admin **bypass** still lets the owner merge if forced (that's the `bypass_actors`
   entry) — but don't; the goal is to observe the block.

Revert cleanly (nothing lands on `master`):

```bash
git switch master
git branch -D ci/redgate-proof
gh pr close ci/redgate-proof --delete-branch
```

> Do **not** push the break to `master`. The whole procedure lives on a side branch
> behind a PR; closing the PR + deleting the branch removes every trace.
