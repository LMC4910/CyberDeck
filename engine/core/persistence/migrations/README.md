# Schema migrations

Forward-only SQL migrations applied on startup by the runner in `../migrate.go`,
keyed by `meta.schema_version` (ADR-0014, TB-PER-2).

**Naming:** `NNNN_description.sql` — a zero-padded numeric version prefix, then an
underscore, then a short description. Versions are applied in ascending order;
each runs in its own transaction and bumps `meta.schema_version` to `NNNN`.

The runner ignores non-`.sql` files (like this README). The nine durable tables
land in `0001_init.sql` (PROJ-111); PROJ-110 ships only the runner + harness.
