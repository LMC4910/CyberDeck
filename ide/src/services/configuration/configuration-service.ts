// ConfigurationService (CD-117). The layered config store + deep-merge engine
// implementing shared/schemas/config/MERGE_AND_MIGRATION.md (CD-109):
// precedence defaults ← application ← user ← workspace ← runtime, scalar/object/
// array merge rules, $unset delete markers, and precise SettingsChanged deltas.
// Nothing in the app reads config JSON directly — everything goes through get().
// Persistence, schema validation and migration are layered on in CD-118; this
// class is pure in-memory merge + watch. SettingsChanged is surfaced via watch()/
// onChange(); the CD-120 EventBus bridge re-emits these as bus events.

export type ConfigLayer = 'defaults' | 'application' | 'user' | 'workspace' | 'runtime'

/** Precedence order — later layers win. */
export const CONFIG_LAYERS: readonly ConfigLayer[] = [
  'defaults',
  'application',
  'user',
  'workspace',
  'runtime',
]

export type ConfigObject = { [key: string]: unknown }

/** Delete marker: a higher layer removes a lower layer's key (null is a value). */
export interface UnsetMarker {
  $unset: true
}
export const UNSET: UnsetMarker = { $unset: true }

function isUnset(v: unknown): v is UnsetMarker {
  return isPlainObject(v) && (v as ConfigObject).$unset === true
}

/** Matches the SettingsChanged delta shape (events/settings-changed.schema.json). */
export interface SettingsDelta {
  area: string
  path: string
  value?: unknown
  previous?: unknown
  layer: ConfigLayer
  revision: number
}

type Watcher = { prefix: string; cb: (delta: SettingsDelta) => void }

export interface ConfigurationOptions {
  layers?: Partial<Record<ConfigLayer, ConfigObject>>
  /** Maps a config path to its area id (for the delta). Default: first segment. */
  areaResolver?: (path: string) => string
}

export class ConfigurationService {
  private readonly layers: Record<ConfigLayer, ConfigObject>
  private merged: ConfigObject
  private readonly watchers = new Set<Watcher>()
  private readonly revisions = new Map<string, number>()
  private readonly areaOf: (path: string) => string

  constructor(options: ConfigurationOptions = {}) {
    this.layers = {
      defaults: clone(options.layers?.defaults ?? {}),
      application: clone(options.layers?.application ?? {}),
      user: clone(options.layers?.user ?? {}),
      workspace: clone(options.layers?.workspace ?? {}),
      runtime: clone(options.layers?.runtime ?? {}),
    }
    this.areaOf = options.areaResolver ?? ((path) => path.split('.')[0] ?? '')
    this.merged = this.computeMerged()
  }

  /** Read a value by dot-path from the merged view (undefined if absent). */
  get<T = unknown>(path: string): T | undefined {
    return getByPath(this.merged, path) as T | undefined
  }

  /** The full merged view (a copy — callers can't mutate internal state). */
  getAll(): ConfigObject {
    return clone(this.merged)
  }

  /** The raw document for one layer (a copy). */
  getLayer(layer: ConfigLayer): ConfigObject {
    return clone(this.layers[layer])
  }

  /** Write a value into a layer (default `user`), recompute, emit deltas. */
  set(path: string, value: unknown, layer: ConfigLayer = 'user'): SettingsDelta[] {
    setByPath(this.layers[layer], path, clone(value))
    return this.recompute(layer)
  }

  /** Write an $unset marker into a layer so it masks lower layers. */
  unset(path: string, layer: ConfigLayer = 'user'): SettingsDelta[] {
    setByPath(this.layers[layer], path, { ...UNSET })
    return this.recompute(layer)
  }

  /** Replace a whole layer document (e.g. after a persisted load), emit deltas. */
  setLayer(layer: ConfigLayer, doc: ConfigObject): SettingsDelta[] {
    this.layers[layer] = clone(doc)
    return this.recompute(layer)
  }

  /**
   * Watch a path (or path prefix). Fires for the exact path and any descendant,
   * e.g. watch('features') fires for 'features.devTools'. Returns an unsubscribe.
   */
  watch(path: string, cb: (delta: SettingsDelta) => void): () => void {
    const watcher: Watcher = { prefix: path, cb }
    this.watchers.add(watcher)
    return () => this.watchers.delete(watcher)
  }

  /** Watch every delta. Returns an unsubscribe. */
  onChange(cb: (delta: SettingsDelta) => void): () => void {
    return this.watch('', cb)
  }

  private recompute(layer: ConfigLayer): SettingsDelta[] {
    const before = this.merged
    const after = this.computeMerged()
    this.merged = after
    const deltas: SettingsDelta[] = []
    for (const change of diff(before, after)) {
      const area = this.areaOf(change.path)
      const revision = (this.revisions.get(area) ?? 0) + 1
      this.revisions.set(area, revision)
      const delta: SettingsDelta = { area, path: change.path, layer, revision }
      if ('value' in change) delta.value = change.value
      if ('previous' in change) delta.previous = change.previous
      deltas.push(delta)
    }
    for (const delta of deltas) this.notify(delta)
    return deltas
  }

  private notify(delta: SettingsDelta): void {
    for (const w of this.watchers) {
      if (w.prefix === '' || delta.path === w.prefix || delta.path.startsWith(w.prefix + '.')) {
        w.cb(delta)
      }
    }
  }

  private computeMerged(): ConfigObject {
    let out: ConfigObject = {}
    for (const layer of CONFIG_LAYERS) {
      out = mergeInto(out, this.layers[layer])
    }
    return out
  }
}

// ---- merge (CD-109 §2) -----------------------------------------------------

/** Deep-merge `over` onto `base` per the spec. Returns a new object. */
function mergeInto(base: ConfigObject, over: ConfigObject): ConfigObject {
  const out: ConfigObject = clone(base)
  for (const [key, ov] of Object.entries(over)) {
    if (isUnset(ov)) {
      delete out[key] // $unset removes the key from the merged view
      continue
    }
    const bv = out[key]
    if (isPlainObject(bv) && isPlainObject(ov)) {
      out[key] = mergeInto(bv, ov) // object → deep merge
    } else {
      out[key] = clone(ov) // scalar / array / type-conflict → atomic replace
    }
  }
  return out
}

// ---- delta diff (CD-109 §3) ------------------------------------------------

type Change =
  | { path: string; value: unknown; previous: unknown }
  | { path: string; value: unknown } // added
  | { path: string; previous: unknown } // removed

// Walk two merged trees; emit one change per changed leaf path. Objects are
// descended; arrays are compared whole (array replacement → a single delta).
function diff(before: unknown, after: unknown, path = ''): Change[] {
  if (isPlainObject(before) && isPlainObject(after)) {
    const changes: Change[] = []
    const keys = new Set([...Object.keys(before), ...Object.keys(after)])
    for (const key of keys) {
      const p = path ? `${path}.${key}` : key
      const hasB = key in before
      const hasA = key in after
      if (hasB && hasA) {
        changes.push(...diff(before[key], after[key], p))
      } else if (hasA) {
        changes.push(...added(after[key], p))
      } else {
        changes.push(...removed(before[key], p))
      }
    }
    return changes
  }
  if (equals(before, after)) return []
  return [{ path, value: after, previous: before }]
}

// A newly-added subtree emits a delta at each leaf (so watchers on leaf paths fire).
function added(value: unknown, path: string): Change[] {
  if (isPlainObject(value)) {
    return Object.entries(value).flatMap(([k, v]) => added(v, `${path}.${k}`))
  }
  return [{ path, value }]
}
function removed(previous: unknown, path: string): Change[] {
  if (isPlainObject(previous)) {
    return Object.entries(previous).flatMap(([k, v]) => removed(v, `${path}.${k}`))
  }
  return [{ path, previous }]
}

// ---- utilities -------------------------------------------------------------

function isPlainObject(v: unknown): v is ConfigObject {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function equals(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== typeof b) return false
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
    return a.every((x, i) => equals(x, b[i]))
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const ak = Object.keys(a)
    const bk = Object.keys(b)
    if (ak.length !== bk.length) return false
    return ak.every((k) => k in b && equals(a[k], b[k]))
  }
  return false
}

function getByPath(obj: ConfigObject, path: string): unknown {
  if (path === '') return obj
  let cur: unknown = obj
  for (const seg of path.split('.')) {
    if (!isPlainObject(cur)) return undefined
    cur = cur[seg]
  }
  return cur
}

function setByPath(obj: ConfigObject, path: string, value: unknown): void {
  const segs = path.split('.')
  let cur: ConfigObject = obj
  for (let i = 0; i < segs.length - 1; i++) {
    const seg = segs[i]!
    const next = cur[seg]
    if (!isPlainObject(next)) cur[seg] = {}
    cur = cur[seg] as ConfigObject
  }
  cur[segs[segs.length - 1]!] = value
}

function clone<T>(v: T): T {
  return structuredClone(v)
}
