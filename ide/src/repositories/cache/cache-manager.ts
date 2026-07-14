// CacheManager (CD-129). LRU keyed by (repo, query-hash) with a TTL backstop, an
// event-driven precise invalidation map (one event → one entry), SWR mode for
// catalog reads, and hit/miss counters exposed to the telemetry tap. Repositories
// read through this; the EventBus drives invalidation (VariableChanged → evict the
// variables entries, etc.).

export interface CacheEntry<T> {
  value: T
  expiresAt: number
  /** Tags this entry is invalidated by (event-driven precise invalidation). */
  tags: string[]
  stale: boolean
  /** Stale-while-revalidate eligible. */
  swr: boolean
}

export interface SetOptions {
  ttlMs?: number
  /** Invalidation tags, e.g. ['variables', 'variables:sys.cpu.load']. */
  tags?: string[]
  /** Stale-while-revalidate: a get after expiry returns the stale value once. */
  swr?: boolean
}

export interface CacheStats {
  hits: number
  misses: number
  size: number
  evictions: number
}

export interface CacheManagerOptions {
  /** Max entries before LRU eviction. Default 200. */
  maxEntries?: number
  /** Default TTL (ms) when set() omits one. Default 30_000. */
  defaultTtlMs?: number
  now?: () => number
  /** Telemetry tap for hit/miss/evict. */
  onStat?: (event: 'hit' | 'miss' | 'evict', key: string) => void
}

export class CacheManager {
  private readonly entries = new Map<string, CacheEntry<unknown>>()
  private readonly tagIndex = new Map<string, Set<string>>() // tag → keys
  private readonly maxEntries: number
  private readonly defaultTtlMs: number
  private readonly now: () => number
  private readonly onStat?: CacheManagerOptions['onStat']
  private hits = 0
  private misses = 0
  private evictions = 0

  constructor(options: CacheManagerOptions = {}) {
    this.maxEntries = options.maxEntries ?? 200
    this.defaultTtlMs = options.defaultTtlMs ?? 30_000
    this.now = options.now ?? (() => Date.now())
    this.onStat = options.onStat
  }

  /** Stable cache key from a repo name + query params. */
  static keyFor(repo: string, query: unknown): string {
    return `${repo}:${stableStringify(query)}`
  }

  get<T>(key: string): T | undefined {
    const entry = this.entries.get(key) as CacheEntry<T> | undefined
    if (!entry) {
      this.miss(key)
      return undefined
    }
    const expired = this.now() >= entry.expiresAt
    if (expired && !entry.swr) {
      this.delete(key)
      this.miss(key)
      return undefined
    }
    if (expired) {
      // SWR: hand back the stale value once, mark it stale for the caller to revalidate.
      entry.stale = true
    }
    // LRU touch: re-insert to mark most-recently-used.
    this.entries.delete(key)
    this.entries.set(key, entry)
    this.hit(key)
    return entry.value
  }

  /** Whether the last get returned a stale (SWR) value. */
  isStale(key: string): boolean {
    return this.entries.get(key)?.stale ?? false
  }

  set<T>(key: string, value: T, options: SetOptions = {}): void {
    const ttl = options.ttlMs ?? this.defaultTtlMs
    const entry: CacheEntry<T> = {
      value,
      expiresAt: this.now() + ttl,
      tags: options.tags ?? [],
      stale: false,
      swr: options.swr ?? false,
    }
    this.delete(key) // clear any prior tag index
    this.entries.set(key, entry)
    for (const tag of entry.tags) {
      const set = this.tagIndex.get(tag) ?? new Set<string>()
      set.add(key)
      this.tagIndex.set(tag, set)
    }
    this.evictIfNeeded()
  }

  invalidate(key: string): void {
    this.delete(key)
  }

  /** Event-driven precise invalidation: evict every entry carrying `tag`. */
  invalidateByTag(tag: string): number {
    const keys = this.tagIndex.get(tag)
    if (!keys) return 0
    let n = 0
    for (const key of [...keys]) {
      this.delete(key)
      n++
    }
    return n
  }

  clear(): void {
    this.entries.clear()
    this.tagIndex.clear()
  }

  get stats(): CacheStats {
    return { hits: this.hits, misses: this.misses, size: this.entries.size, evictions: this.evictions }
  }

  private delete(key: string): void {
    const entry = this.entries.get(key)
    if (!entry) return
    this.entries.delete(key)
    for (const tag of entry.tags) {
      const set = this.tagIndex.get(tag)
      set?.delete(key)
      if (set && set.size === 0) this.tagIndex.delete(tag)
    }
  }

  private evictIfNeeded(): void {
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value as string | undefined
      if (oldest === undefined) break
      this.delete(oldest)
      this.evictions++
      this.onStat?.('evict', oldest)
    }
  }

  private hit(key: string): void {
    this.hits++
    this.onStat?.('hit', key)
  }
  private miss(key: string): void {
    this.misses++
    this.onStat?.('miss', key)
  }
}

// Deterministic stringify (sorted keys) so equal queries hash equally.
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`
}
