// Config document migration (CD-118) — the single-hop registry convention from
// shared/schemas/config/MERGE_AND_MIGRATION.md §5. Each step migrates from one
// version to the next; steps run in sequence until the doc reaches the current
// version. A doc newer than the app is rejected (never down-migrated).

export interface Migration {
  /** Migrates a document from `from` to `from + 1`. */
  from: number
  /** Pure: must not mutate its input; must bump `version`. */
  migrate: (doc: unknown) => unknown
}

export class MigrationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MigrationError'
  }
}

function versionOf(doc: unknown): number {
  if (doc && typeof doc === 'object' && 'version' in doc) {
    const v = (doc as { version: unknown }).version
    if (typeof v === 'number') return v
  }
  return 0
}

/**
 * Run migrations to bring `doc` to `currentVersion`. Throws MigrationError if a
 * step is missing, a step fails to advance the version, or the doc is newer than
 * the app understands.
 */
export function applyMigrations(
  doc: unknown,
  migrations: readonly Migration[],
  currentVersion: number,
): unknown {
  let v = versionOf(doc)
  if (v > currentVersion) {
    throw new MigrationError(
      `document version ${v} is newer than the app (current ${currentVersion})`,
    )
  }
  let out = doc
  let guard = 0
  while (v < currentVersion) {
    const step = migrations.find((m) => m.from === v)
    if (!step) {
      throw new MigrationError(`no migration registered from version ${v}`)
    }
    out = step.migrate(out)
    const next = versionOf(out)
    if (next <= v) {
      throw new MigrationError(
        `migration from ${v} did not advance the version (got ${next})`,
      )
    }
    v = next
    if (++guard > migrations.length + currentVersion) {
      throw new MigrationError('migration loop detected')
    }
  }
  return out
}
