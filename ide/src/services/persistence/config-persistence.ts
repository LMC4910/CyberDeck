// ConfigPersistence (CD-118): loads persisted config layers (validate + migrate
// on read, fall back to defaults on corruption with a notice) and writes them
// back write-behind (debounced) with a flush-on-quit. Sits between the storage
// adapter and ConfigurationService; the app wires flush() to window unload /
// Tauri quit.
import type { ConfigObject } from '@/services/configuration'
import { applyMigrations, MigrationError, type Migration } from './migration'
import type { StorageAdapter } from './storage-adapter'

export interface ValidationResult {
  ok: boolean
  errors?: string[]
}

export interface LayerPersistenceSpec {
  /** Storage key for this layer document. */
  key: string
  /** Version the app expects after migration. */
  currentVersion: number
  migrations?: Migration[]
  /** Schema validator (e.g. ajv-backed); omit to skip validation. */
  validate?: (doc: unknown) => ValidationResult
}

export interface ConfigNotice {
  level: 'warn' | 'error'
  code: 'corrupt-json' | 'migration-failed' | 'schema-invalid'
  key: string
  message: string
}

export interface ConfigPersistenceOptions {
  adapter: StorageAdapter
  /** Notified when a layer is dropped (corrupt/invalid) so the UI can surface it. */
  onNotice?: (notice: ConfigNotice) => void
  /** Write-behind debounce window (ms). Default 400. */
  debounceMs?: number
  /** Injectable timer (tests). Returns a cancel fn. Default setTimeout-based. */
  scheduler?: (fn: () => void, ms: number) => () => void
}

const defaultScheduler = (fn: () => void, ms: number): (() => void) => {
  const h = setTimeout(fn, ms)
  return () => clearTimeout(h)
}

export class ConfigPersistence {
  private readonly adapter: StorageAdapter
  private readonly onNotice?: (n: ConfigNotice) => void
  private readonly debounceMs: number
  private readonly scheduler: (fn: () => void, ms: number) => () => void
  private readonly pending = new Map<string, { doc: ConfigObject; cancel: () => void }>()

  constructor(options: ConfigPersistenceOptions) {
    this.adapter = options.adapter
    this.onNotice = options.onNotice
    this.debounceMs = options.debounceMs ?? 400
    this.scheduler = options.scheduler ?? defaultScheduler
  }

  /**
   * Load a persisted layer. Returns the document, or `null` when nothing is
   * stored (use defaults) or the stored value is corrupt/invalid — in the latter
   * case a notice is emitted so boot continues with defaults instead of crashing.
   */
  load(spec: LayerPersistenceSpec): ConfigObject | null {
    const raw = this.adapter.get(spec.key)
    if (raw == null) return null // nothing stored — not a corruption

    let doc: unknown
    try {
      doc = JSON.parse(raw)
    } catch {
      this.notice('corrupt-json', spec.key, `could not parse stored JSON for "${spec.key}"`)
      return null
    }

    try {
      doc = applyMigrations(doc, spec.migrations ?? [], spec.currentVersion)
    } catch (err) {
      const message = err instanceof MigrationError ? err.message : String(err)
      this.notice('migration-failed', spec.key, message)
      return null
    }

    if (spec.validate) {
      const result = spec.validate(doc)
      if (!result.ok) {
        this.notice(
          'schema-invalid',
          spec.key,
          `stored "${spec.key}" failed validation: ${result.errors?.join('; ') ?? 'unknown'}`,
        )
        return null
      }
    }

    return doc as ConfigObject
  }

  /** Queue a write-behind save (debounced per key). */
  schedule(key: string, doc: ConfigObject): void {
    this.pending.get(key)?.cancel()
    // Register the entry BEFORE scheduling so a synchronous scheduler (tests)
    // finds it when writeNow fires; a no-op cancel is replaced right after.
    const entry = { doc, cancel: () => {} }
    this.pending.set(key, entry)
    entry.cancel = this.scheduler(() => this.writeNow(key), this.debounceMs)
  }

  /** Flush all pending writes immediately (wire to unload / quit). */
  flush(): void {
    for (const key of [...this.pending.keys()]) this.writeNow(key)
  }

  private writeNow(key: string): void {
    const entry = this.pending.get(key)
    if (!entry) return
    entry.cancel()
    this.pending.delete(key)
    this.adapter.set(key, JSON.stringify(entry.doc))
  }

  private notice(code: ConfigNotice['code'], key: string, message: string): void {
    this.onNotice?.({ level: 'warn', code, key, message })
  }
}
