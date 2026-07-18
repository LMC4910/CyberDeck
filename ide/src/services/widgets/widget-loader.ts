// Widget loader (CD-419). Orchestrates: discover → validate (schema + permissions)
// → platform/version + dependency resolution → register. Every failure mode is
// surfaced as a notification and the offending manifest is skipped — the loader
// NEVER throws, so one bad manifest can't crash boot or the board. Discovery,
// validation and notification are injected ports (CD-118 idiom); assembly wires
// WidgetManifestsRepository → discover, the ajv validator → validate, and the
// NotificationService → notify.
import type { ManifestValidator } from './manifest-validator'
import { resolveDependencies } from './dependency-resolver'
import type { WidgetRegistry } from './widget-registry'
import type { WidgetManifest } from './types'

export type WidgetLoadNoticeCode =
  | 'discovery-failed'
  | 'schema-invalid'
  | 'duplicate-id'
  | 'platform-unsatisfied'
  | 'missing-dependency'
  | 'dependency-cycle'

export interface WidgetLoadNotice {
  level: 'warn' | 'error'
  code: WidgetLoadNoticeCode
  widgetId?: string
  message: string
}

export interface WidgetLoaderOptions {
  /** Discovery port — assembly wires WidgetManifestsRepository.query(). */
  discover: () => Promise<WidgetManifest[]> | WidgetManifest[]
  /** Schema + permission validator (injected ajv at assembly). */
  validate: ManifestValidator
  /** Registry that receives resolvable manifests (and emits WidgetLoaded). */
  registry: WidgetRegistry
  /** Notification port — a rejected manifest surfaces here, never a throw. */
  notify?: (notice: WidgetLoadNotice) => void
  /** Host platform version for `dependencies.platform` checks. Default 2.0.0. */
  platformVersion?: string
}

export interface WidgetLoadResult {
  registered: string[]
  rejected: Array<{ id: string; code: WidgetLoadNoticeCode; reason: string }>
}

export class WidgetLoader {
  private readonly opts: WidgetLoaderOptions
  private readonly platformVersion: string

  constructor(options: WidgetLoaderOptions) {
    this.opts = options
    this.platformVersion = options.platformVersion ?? '2.0.0'
  }

  /** Discover, validate, resolve and register. Resolves (never rejects) with a summary. */
  async load(): Promise<WidgetLoadResult> {
    const rejected: WidgetLoadResult['rejected'] = []
    const reject = (id: string, code: WidgetLoadNoticeCode, reason: string, level: 'warn' | 'error' = 'warn') => {
      rejected.push({ id, code, reason })
      this.opts.notify?.({ level, code, widgetId: id === '(unknown)' ? undefined : id, message: reason })
    }

    let discovered: WidgetManifest[]
    try {
      discovered = await this.opts.discover()
    } catch (err) {
      reject('(unknown)', 'discovery-failed', `widget discovery failed: ${String(err)}`, 'error')
      return { registered: [], rejected }
    }

    // 1. schema + permission validation, with dedupe of ids.
    const valid: WidgetManifest[] = []
    const seen = new Set<string>()
    for (const raw of discovered) {
      const result = this.opts.validate(raw)
      const id = idOf(raw)
      if (!result.valid) {
        reject(id, 'schema-invalid', `manifest "${id}" is invalid: ${result.errors.join('; ')}`)
        continue
      }
      const manifest = raw as WidgetManifest
      if (seen.has(manifest.id)) {
        reject(manifest.id, 'duplicate-id', `duplicate widget id "${manifest.id}" — keeping the first`)
        continue
      }
      seen.add(manifest.id)
      valid.push(manifest)
    }

    // 2. platform version gate.
    const platformOk: WidgetManifest[] = []
    for (const m of valid) {
      const range = m.dependencies?.platform
      if (range && !satisfiesPlatform(range, this.platformVersion)) {
        reject(
          m.id,
          'platform-unsatisfied',
          `widget "${m.id}" needs platform ${range} but host is ${this.platformVersion}`,
        )
        continue
      }
      platformOk.push(m)
    }

    // 3. dependency resolution (missing + cycles).
    const { order, missing, cycles } = resolveDependencies(platformOk)
    for (const m of missing) {
      reject(m.id, 'missing-dependency', `widget "${m.id}" depends on missing widget(s): ${m.missing.join(', ')}`)
    }
    for (const cycle of cycles) {
      const label = cycle.join(' → ')
      for (const id of cycle) {
        reject(id, 'dependency-cycle', `widget "${id}" is in a dependency cycle: ${label}`)
      }
    }

    // 4. register the resolvable set in dependency-first order.
    const registered: string[] = []
    for (const id of order) {
      const manifest = platformOk.find((m) => m.id === id)
      if (!manifest) continue
      this.opts.registry.register(manifest)
      registered.push(id)
    }

    return { registered, rejected }
  }
}

function idOf(raw: unknown): string {
  if (raw && typeof raw === 'object' && typeof (raw as { id?: unknown }).id === 'string') {
    return (raw as { id: string }).id
  }
  return '(unknown)'
}

/** Parse a dotted version into a numeric tuple (missing/blank parts → 0). */
function parseVersion(v: string): [number, number, number] {
  // `.split('-')[0]` is `string | undefined` under noUncheckedIndexedAccess; a
  // blank string parses to the [0,0,0] tuple, which is the intended default.
  const core = v.trim().replace(/^[v=]+/, '').split('-')[0] ?? ''
  const parts = core.split('.').map((n) => Number.parseInt(n, 10) || 0)
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0]
}

function cmp(a: [number, number, number], b: [number, number, number]): number {
  for (let i = 0; i < 3; i++) {
    const av = a[i] ?? 0
    const bv = b[i] ?? 0
    if (av !== bv) return av < bv ? -1 : 1
  }
  return 0
}

/**
 * Minimal range satisfaction for `dependencies.platform`. Supports `*`/empty (any),
 * exact `x.y[.z]`, and the comparators `>=`, `>`, `<=`, `<`. Enough for the manifest
 * vocabulary (e.g. ">=2.0"); a full semver range engine is not needed on mocks.
 */
export function satisfiesPlatform(range: string, version: string): boolean {
  const r = range.trim()
  if (r === '' || r === '*') return true
  const host = parseVersion(version)
  const m = /^(>=|>|<=|<)?\s*(.+)$/.exec(r)
  if (!m) return false
  const op = m[1] ?? '='
  const target = parseVersion(m[2] ?? '')
  const c = cmp(host, target)
  switch (op) {
    case '>=':
      return c >= 0
    case '>':
      return c > 0
    case '<=':
      return c <= 0
    case '<':
      return c < 0
    default:
      return c === 0
  }
}
