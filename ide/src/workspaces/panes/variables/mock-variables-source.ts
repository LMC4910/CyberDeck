// In-memory VariablesSource (CD-401) — the mock "server" behind the port until the
// shell wires the VariablesRepository adapter (see variables-source.ts). It owns the
// data and implements the query semantics *itself*: the table sends {filter, sort,
// page, limit} and renders whatever page comes back, so nothing is filtered client
// side. Secrets are masked here, on the way out, exactly as the engine will mask
// them — `reveal()` is the only path to the real value (CD-402).
import type { VariableRecord, VariableScope, VariableType } from './variables-model'
import { isDerivedScope } from './variables-model'
import type {
  VariableDraft,
  VariableHistoryEntry,
  VariablePage,
  VariableQuery,
  VariableReference,
  VariablesSource,
} from './variables-source'

export class VariableNotFoundError extends Error {
  constructor(id: string) {
    super(`variable "${id}" not found`)
    this.name = 'VariableNotFoundError'
  }
}

export class ReadOnlyVariableError extends Error {
  constructor(id: string, reason: string) {
    super(`variable "${id}" is read-only: ${reason}`)
    this.name = 'ReadOnlyVariableError'
  }
}

export interface MockVariablesSourceOptions {
  /** Rows to serve. */
  seed?: VariableRecord[]
  /** References per variable id (inspector "used by"). */
  references?: Record<string, VariableReference[]>
  /**
   * Injected failure hook — return an Error to make that mutation reject. Drives
   * the optimistic-rollback tests (CD-402).
   */
  failWrite?: (id: string, value: unknown) => Error | undefined
}

export class MockVariablesSource implements VariablesSource {
  private readonly rows = new Map<string, VariableRecord>()
  private readonly refs: Record<string, VariableReference[]>
  private readonly writes = new Map<string, VariableHistoryEntry[]>()
  private readonly listeners = new Set<(e: { id: string; value: unknown }) => void>()
  private readonly failWrite?: (id: string, value: unknown) => Error | undefined
  /** Every query the source served — the AC's round-trip proof. */
  readonly queries: VariableQuery[] = []

  constructor(options: MockVariablesSourceOptions = {}) {
    for (const r of options.seed ?? defaultVariables()) this.rows.set(r.id, { ...r })
    this.refs = options.references ?? defaultReferences()
    this.failWrite = options.failWrite
  }

  async query(q: VariableQuery): Promise<VariablePage> {
    this.queries.push(q)
    let items = [...this.rows.values()]

    const { scope, plugin, search } = q.filter ?? {}
    if (scope) items = items.filter((v) => v.scope === scope)
    if (plugin) items = items.filter((v) => v.plugin === plugin)
    if (search) {
      const needle = search.trim().toLowerCase()
      if (needle) {
        items = items.filter(
          (v) => v.name.toLowerCase().includes(needle) || v.id.toLowerCase().includes(needle),
        )
      }
    }

    if (q.sort) {
      const { field, dir } = q.sort
      const mul = dir === 'desc' ? -1 : 1
      items = [...items].sort((a, b) => compare(a[field], b[field]) * mul)
    }

    const total = items.length
    const page = q.page ?? 1
    const limit = q.limit ?? 50
    const start = (page - 1) * limit
    return {
      items: items.slice(start, start + limit).map((v) => mask(v)),
      page,
      limit,
      total,
    }
  }

  async write(id: string, value: unknown): Promise<VariableRecord> {
    const existing = this.require(id)
    const failure = this.failWrite?.(id, value)
    if (failure) throw failure
    const next: VariableRecord = { ...existing, value, updatedAt: this.now() }
    this.rows.set(id, next)
    this.record(id, value, 'user')
    this.emit(id, value)
    return mask(next)
  }

  async create(draft: VariableDraft): Promise<VariableRecord> {
    if (this.rows.has(draft.id)) throw new Error(`variable "${draft.id}" already exists`)
    const row: VariableRecord = {
      id: draft.id,
      name: draft.name,
      scope: draft.scope,
      type: draft.type,
      value: draft.value,
      updatedAt: this.now(),
      ...(draft.description ? { description: draft.description } : {}),
      ...(draft.expr ? { expr: draft.expr } : {}),
      ...(draft.options ? { options: draft.options } : {}),
    }
    this.rows.set(row.id, row)
    this.record(row.id, row.value, 'user')
    return mask(row)
  }

  async remove(id: string): Promise<void> {
    this.require(id)
    this.rows.delete(id)
    this.writes.delete(id)
  }

  async reveal(id: string): Promise<unknown> {
    return this.require(id).value
  }

  async plugins(): Promise<string[]> {
    const ids = new Set<string>()
    for (const r of this.rows.values()) if (r.plugin) ids.add(r.plugin)
    return [...ids].sort()
  }

  async references(id: string): Promise<VariableReference[]> {
    return this.refs[id] ?? []
  }

  /** Every derived variable + its expression (CD-403). Never touches `queries`. */
  async derived(): Promise<VariableRecord[]> {
    return [...this.rows.values()].filter((r) => isDerivedScope(r.scope) && r.expr).map((r) => ({ ...r }))
  }

  /** Current values for a set of paths (CD-403). Never touches `queries`. */
  async values(ids: string[]): Promise<Record<string, unknown>> {
    const out: Record<string, unknown> = {}
    for (const id of ids) {
      const row = this.rows.get(id)
      if (row) out[id] = row.value
    }
    return out
  }

  async history(id: string): Promise<VariableHistoryEntry[]> {
    return [...(this.writes.get(id) ?? [])].reverse()
  }

  subscribe(handler: (e: { id: string; value: unknown }) => void): () => void {
    this.listeners.add(handler)
    return () => {
      this.listeners.delete(handler)
    }
  }

  /** Push a value from "the engine" (tests + the mock tick stream). */
  tick(id: string, value: unknown): void {
    const existing = this.rows.get(id)
    if (!existing) return
    this.rows.set(id, { ...existing, value, updatedAt: this.now() })
    this.record(id, value, 'engine')
    this.emit(id, value)
  }

  /** Unmasked read for tests/asserts — never used by the UI. */
  peek(id: string): VariableRecord | undefined {
    return this.rows.get(id)
  }

  size(): number {
    return this.rows.size
  }

  private require(id: string): VariableRecord {
    const row = this.rows.get(id)
    if (!row) throw new VariableNotFoundError(id)
    return row
  }

  private record(id: string, value: unknown, source: VariableHistoryEntry['source']): void {
    const list = this.writes.get(id) ?? []
    list.push({ ts: this.now(), value, source })
    // Keep the history bounded the way the engine's ring buffer does.
    if (list.length > 50) list.shift()
    this.writes.set(id, list)
  }

  private emit(id: string, value: unknown): void {
    for (const l of this.listeners) l({ id, value })
  }

  // Monotonic so history ordering is stable inside a test tick.
  private seq = 0
  private now(): number {
    return BASE_TS + this.seq++
  }
}

const BASE_TS = 1_760_000_000_000

/** Masked secrets carry no value until `reveal()` — nothing to leak into the DOM. */
function mask(v: VariableRecord): VariableRecord {
  return v.type === 'secret' ? { ...v, value: null } : { ...v }
}

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0
  if (a === null || a === undefined) return 1
  if (b === null || b === undefined) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b)
  return String(a).localeCompare(String(b))
}

/** The design's telemetry values + one row per scope, so the rail is never empty. */
export function defaultVariables(): VariableRecord[] {
  return [
    { id: 'sys.cpu.load', name: 'CPU Load', scope: 'system', type: 'percent', value: 37, updatedAt: BASE_TS },
    { id: 'sys.gpu.temp', name: 'GPU Temp', scope: 'system', type: 'number', value: 64, updatedAt: BASE_TS },
    { id: 'sys.fps', name: 'FPS', scope: 'system', type: 'number', value: 144, updatedAt: BASE_TS },
    { id: 'sys.ram', name: 'RAM', scope: 'system', type: 'percent', value: 62, updatedAt: BASE_TS },
    { id: 'net.ping', name: 'Ping', scope: 'system', type: 'duration', value: 18, updatedAt: BASE_TS },
    { id: 'net.throughput', name: 'Net Throughput', scope: 'system', type: 'series', value: [12, 18, 24], updatedAt: BASE_TS },
    { id: 'deck.accent', name: 'Accent Colour', scope: 'global', type: 'color', value: '#4c9aff', updatedAt: BASE_TS },
    { id: 'deck.title', name: 'Deck Title', scope: 'global', type: 'string', value: 'Battlestation', updatedAt: BASE_TS },
    { id: 'deck.mode', name: 'Deck Mode', scope: 'global', type: 'enum', value: 'gaming', options: ['gaming', 'work', 'idle'], updatedAt: BASE_TS },
    // An author-owned secret (engine secret store, not the project doc) — the one
    // secret in the set that is editable; env/plugin secrets are owned elsewhere.
    { id: 'deck.webhook', name: 'Webhook Token', scope: 'global', type: 'secret', value: 'whk-live-9f3a2b', updatedAt: BASE_TS },
    { id: 'page.home.visits', name: 'Home Visits', scope: 'page', type: 'number', value: 3, updatedAt: BASE_TS },
    { id: 'run.stream.live', name: 'Stream Live', scope: 'runtime', type: 'boolean', value: false, updatedAt: BASE_TS },
    { id: 'run.scene.last', name: 'Last Scene', scope: 'runtime', type: 'string', value: 'Starting Soon', updatedAt: BASE_TS },
    { id: 'calc.cpu.headroom', name: 'CPU Headroom', scope: 'computed', type: 'percent', value: 63, expr: '100 - sys.cpu.load', updatedAt: BASE_TS },
    { id: 'calc.thermal.alarm', name: 'Thermal Alarm', scope: 'expression', type: 'boolean', value: false, expr: 'sys.gpu.temp > 80', updatedAt: BASE_TS },
    { id: 'env.obs.host', name: 'OBS Host', scope: 'environment', type: 'string', value: 'localhost', updatedAt: BASE_TS },
    { id: 'env.obs.token', name: 'OBS Token', scope: 'environment', type: 'secret', value: 'hunter2-super-secret', updatedAt: BASE_TS },
    { id: 'plug.spotify.track', name: 'Spotify Track', scope: 'plugin', type: 'string', value: 'Untitled', plugin: 'spotify', updatedAt: BASE_TS },
    { id: 'plug.spotify.key', name: 'Spotify API Key', scope: 'plugin', type: 'secret', value: 'sk-live-abcdef', plugin: 'spotify', updatedAt: BASE_TS },
    { id: 'plug.obs.scene', name: 'OBS Scene', scope: 'plugin', type: 'string', value: 'Main', plugin: 'obs', updatedAt: BASE_TS },
  ]
}

/**
 * Where the default variables are used (CD-403 "used by"). Keyed by variable id →
 * the entities that bind it, each naming a workspace + target so a click can route
 * and select. Kept disjoint from the ids the mutation tests delete.
 */
export function defaultReferences(): Record<string, VariableReference[]> {
  return {
    'sys.cpu.load': [
      { workspace: 'deck-designer', targetId: 'w_cpu_gauge', label: 'CPU Gauge', kind: 'component', via: 'value' },
      { workspace: 'flows', targetId: 'flow_thermal', label: 'Thermal Guard', kind: 'flow', via: 'trigger' },
    ],
    'sys.gpu.temp': [
      { workspace: 'deck-designer', targetId: 'w_gpu_stat', label: 'GPU Stat', kind: 'component', via: 'value' },
    ],
    'sys.fps': [
      { workspace: 'deck-designer', targetId: 'w_fps_gauge', label: 'FPS Gauge', kind: 'component', via: 'value' },
    ],
    'deck.accent': [
      { workspace: 'deck-designer', targetId: 'page_home', label: 'Home', kind: 'page', via: 'accent' },
    ],
    'calc.cpu.headroom': [
      { workspace: 'deck-designer', targetId: 'w_headroom_bar', label: 'Headroom Bar', kind: 'component', via: 'value' },
    ],
  }
}

const FIXTURE_SCOPES: VariableScope[] = ['global', 'page', 'runtime', 'environment', 'plugin', 'system']
const FIXTURE_TYPES: VariableType[] = ['string', 'number', 'boolean', 'percent', 'color', 'duration']
const PLUGINS = ['spotify', 'obs', 'hue']

/**
 * `count` deterministic rows — the 10k fixture the virtualization AC scrolls
 * (CD-401). Deterministic so a test can assert an exact row at an exact index.
 */
export function makeVariableFixtures(count: number): VariableRecord[] {
  const rows: VariableRecord[] = []
  for (let i = 0; i < count; i++) {
    const scope = FIXTURE_SCOPES[i % FIXTURE_SCOPES.length]!
    const type = FIXTURE_TYPES[i % FIXTURE_TYPES.length]!
    const n = i.toString().padStart(5, '0')
    rows.push({
      id: `fx.${scope}.v${n}`,
      name: `Fixture ${n}`,
      scope,
      type,
      value: fixtureValue(type, i),
      updatedAt: BASE_TS + i,
      ...(scope === 'plugin' ? { plugin: PLUGINS[i % PLUGINS.length]! } : {}),
      ...(isDerivedScope(scope) ? { expr: '1 + 1' } : {}),
    })
  }
  return rows
}

function fixtureValue(type: VariableType, i: number): unknown {
  switch (type) {
    case 'number':
      return i
    case 'percent':
      return i % 101
    case 'boolean':
      return i % 2 === 0
    case 'color':
      return `#${(i % 4096).toString(16).padStart(3, '0')}fff`.slice(0, 7)
    case 'duration':
      return (i % 60) * 100
    default:
      return `value-${i}`
  }
}
