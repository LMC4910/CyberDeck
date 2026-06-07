# ADR-0001 (impl) — SQLite driver: pure-Go `modernc.org/sqlite`

**Status:** Accepted · **Date:** 2026-06-07 · **Ticket:** PROJ-110
**Context doc:** TRD 2B §6 / architecture ADR-0014 (single embedded SQLite store).

## Context

PROJ-110 requires a maintained SQLite driver, pinned, with the trade-off recorded
here. CyberDeck must build and ship on Windows, macOS, and Linux (Phase-1 exit
builds the engine green on all three). The build/dev environment for this work has
**no C toolchain** available.

## Decision

Use **`modernc.org/sqlite`** — a pure-Go SQLite (CGo-free).

## Consequences

**Positive**
- No CGo ⇒ no C compiler dependency; `go build`/`go test` and cross-compilation
  work everywhere with the Go toolchain alone. This directly unblocks the
  three-OS build requirement and CI (PROJ-102) without per-runner C setup.
- Single static binary; simpler installers (EPIC-1).
- `database/sql`-compatible; WAL + pragmas supported via DSN `_pragma=` params.

**Negative / trade-offs**
- Pure-Go SQLite is somewhat slower than the CGo `mattn/go-sqlite3` under heavy
  write load. Acceptable: CyberDeck persists only durable data (profiles, registry,
  variables, devices, audit) — live state and series ring buffers are in-memory
  (ADR-0014, TB-ST-3), so the hot path never touches SQLite.
- Tracks upstream SQLite via a transpilation; pinned in `go.mod` for reproducibility.

## Configuration

Opened in **WAL** mode with a serialized writer (`SetMaxOpenConns(1)`) and a
separate reader pool so `var.*`/audit reads never block the writer. Per-connection
pragmas (`busy_timeout`, `foreign_keys`, `synchronous=NORMAL`) ride the DSN so every
pooled connection inherits them.
