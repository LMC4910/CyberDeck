// MockApiGateway (CD-127). Implements the Gateway port fully in-memory: a router
// auto-derived from the generated route id set (unknown route → loud contract
// error), a FixtureDB with mock-side query semantics, and mutations that persist.
// Subscriptions are stubbed here and driven by the mock streams in CD-128.
import { ROUTE_IDS, type RouteId } from '@/shared/contract'
import type { StorageAdapter } from '@/services/persistence'
import type { Gateway, RequestOptions, RequestLogEntry } from '../gateway'
import { GatewayError } from '../middleware'
import { FixtureDB, type Doc } from './fixture-db'
import { defaultSeed, type SeedMap } from './seed'

export class ContractError extends Error {
  constructor(route: string) {
    super(`unknown route "${route}" — not in the contract route registry`)
    this.name = 'ContractError'
  }
}

const ROUTE_SET = new Set<string>(ROUTE_IDS)

// route id prefix → mock collection name
const COLLECTION: Record<string, string> = {
  projects: 'projects',
  variables: 'variables',
  flows: 'flows',
  widgets: 'widgetManifests',
  assets: 'assets',
  devices: 'devices',
  ai: 'aiThreads',
}

export interface MockGatewayOptions {
  storage?: StorageAdapter
  seed?: SeedMap
  /** Injected id generator for created docs (tests). */
  newId?: (prefix: string) => string
}

export class MockApiGateway implements Gateway {
  private readonly db: FixtureDB
  private readonly taps = new Set<(e: RequestLogEntry) => void>()
  private readonly newId: (prefix: string) => string
  private idSeq = 0

  constructor(options: MockGatewayOptions = {}) {
    this.db = new FixtureDB(options.storage)
    this.newId = options.newId ?? ((p) => `${p}_${(++this.idSeq).toString(36).padStart(6, '0')}`)
    const seed = options.seed ?? defaultSeed()
    for (const [collection, docs] of Object.entries(seed)) this.db.seed(collection, docs)
  }

  async request<T>(route: RouteId | string, options: RequestOptions = {}): Promise<T> {
    const startedAt = 0
    if (!ROUTE_SET.has(route)) {
      this.emit({ route, startedAt, ok: false, error: 'unknown route' })
      throw new ContractError(route)
    }
    try {
      const result = this.handle(route, options)
      this.emit({ route, params: options.params, startedAt, ok: true })
      return result as T
    } catch (err) {
      this.emit({ route, startedAt, ok: false, error: String(err) })
      throw err
    }
  }

  // Subscriptions are wired to real mock streams in CD-128; here they no-op.
  subscribe<T>(route: RouteId | string, _params: unknown, _handler: (e: T) => void): () => void {
    if (!ROUTE_SET.has(route)) throw new ContractError(route)
    return () => {}
  }

  tap(fn: (entry: RequestLogEntry) => void): () => void {
    this.taps.add(fn)
    return () => this.taps.delete(fn)
  }

  private handle(route: string, options: RequestOptions): unknown {
    const [prefix, ...rest] = route.split('.')
    const op = rest[rest.length - 1]!
    const collection = COLLECTION[prefix!]
    const id = options.params?.id as string | undefined
    const body = options.body as Doc | undefined

    // Generic CRUD ops resolve against the collection.
    if (collection) {
      switch (op) {
        case 'list':
        case 'query':
        case 'manifests':
          return this.db.list(collection, options.params ?? {})
        case 'get':
          return this.requireDoc(collection, id)
        case 'create': {
          const doc = { ...(body ?? {}), id: body?.id ?? this.newId(prefix!.slice(0, 4)) } as Doc
          return this.db.put(collection, doc)
        }
        case 'update':
        case 'write': {
          const existing = this.requireDoc(collection, id)
          const merged = { ...existing, ...(body ?? {}), id: existing.id } as Doc
          return this.db.put(collection, merged)
        }
        case 'delete': {
          this.requireDoc(collection, id)
          this.db.delete(collection, id!)
          return undefined
        }
        // domain-specific ops: acknowledge with the current doc / a canned result.
        case 'open':
          return this.requireDoc(collection, id)
        case 'deploy':
        case 'arm':
        case 'assign':
        case 'revoke':
          return { ok: true }
        case 'suggest':
          return { suggestion: null } // AI stub (D7)
        default:
          break
      }
    }

    // Control routes with no collection (runtime.log, permissions.*, *.subscribe).
    if (op === 'subscribe' || prefix === 'runtime') return { stream: true }
    if (prefix === 'permissions') return op === 'list' ? { items: [] } : { ok: true }

    throw new GatewayError('not_implemented', `mock has no handler for ${route}`, false)
  }

  private requireDoc(collection: string, id: string | undefined): Doc {
    const doc = id ? this.db.get(collection, id) : undefined
    if (!doc) throw new GatewayError('not_found', `${collection} ${id ?? '?'} not found`, false)
    return doc
  }

  private emit(entry: RequestLogEntry): void {
    for (const tap of this.taps) tap(entry)
  }
}
