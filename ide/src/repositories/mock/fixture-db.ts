// Fixture DB (CD-127). In-memory collections with mock-side pagination/filter/
// sort and optional persistence through an injected StorageAdapter (memory or
// browser-backed). Seeded from design values; mutations persist per-collection.
import type { StorageAdapter } from '@/services/persistence'
import type { Page, QueryParams } from '../repository-base'

export type Doc = Record<string, unknown> & { id: string }

const STORAGE_PREFIX = 'cdk-mock-'

export class FixtureDB {
  private readonly collections = new Map<string, Map<string, Doc>>()
  private readonly storage?: StorageAdapter

  constructor(storage?: StorageAdapter) {
    this.storage = storage
  }

  /** Seed a collection (only if not already loaded from storage). */
  seed(collection: string, docs: Doc[]): void {
    if (this.collections.has(collection)) return
    const loaded = this.loadFromStorage(collection)
    const map = new Map<string, Doc>()
    for (const d of loaded ?? docs) map.set(d.id, d)
    this.collections.set(collection, map)
  }

  private map(collection: string): Map<string, Doc> {
    const m = this.collections.get(collection)
    if (!m) {
      const created = new Map<string, Doc>()
      this.collections.set(collection, created)
      return created
    }
    return m
  }

  list(collection: string, params: QueryParams = {}): Page<Doc> {
    let items = [...this.map(collection).values()]

    // filter: every key/value must match (shallow equality).
    if (params.filter) {
      const entries = Object.entries(params.filter)
      items = items.filter((doc) => entries.every(([k, v]) => doc[k] === v))
    }
    // sort
    if (params.sort) {
      const { field, dir = 'asc' } = params.sort
      const mul = dir === 'desc' ? -1 : 1
      items = [...items].sort((a, b) => compare(a[field], b[field]) * mul)
    }
    const total = items.length
    const page = params.page ?? 1
    const limit = params.limit ?? 50
    const start = (page - 1) * limit
    return { items: items.slice(start, start + limit), page, limit, total }
  }

  get(collection: string, id: string): Doc | undefined {
    return this.map(collection).get(id)
  }

  put(collection: string, doc: Doc): Doc {
    this.map(collection).set(doc.id, doc)
    this.persist(collection)
    return doc
  }

  delete(collection: string, id: string): boolean {
    const ok = this.map(collection).delete(id)
    if (ok) this.persist(collection)
    return ok
  }

  count(collection: string): number {
    return this.map(collection).size
  }

  private persist(collection: string): void {
    if (!this.storage) return
    const docs = [...this.map(collection).values()]
    this.storage.set(STORAGE_PREFIX + collection, JSON.stringify(docs))
  }

  private loadFromStorage(collection: string): Doc[] | undefined {
    if (!this.storage) return undefined
    const raw = this.storage.get(STORAGE_PREFIX + collection)
    if (!raw) return undefined
    try {
      return JSON.parse(raw) as Doc[]
    } catch {
      return undefined
    }
  }
}

function compare(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b))
}
