import { describe, expect, it, vi } from 'vitest'
import { CacheManager } from '@/repositories/cache'

describe('CacheManager — key + basic hit/miss', () => {
  it('keyFor is stable regardless of query key order', () => {
    const a = CacheManager.keyFor('variables', { scope: 'sys', sort: { field: 'name' } })
    const b = CacheManager.keyFor('variables', { sort: { field: 'name' }, scope: 'sys' })
    expect(a).toBe(b)
  })

  it('counts hits and misses', () => {
    const c = new CacheManager({ now: () => 0 })
    expect(c.get('k')).toBeUndefined() // miss
    c.set('k', 1)
    expect(c.get('k')).toBe(1) // hit
    expect(c.stats).toMatchObject({ hits: 1, misses: 1, size: 1 })
  })
})

describe('CacheManager — TTL backstop', () => {
  it('expires an entry past its TTL (counts as a miss)', () => {
    let t = 0
    const c = new CacheManager({ now: () => t })
    c.set('k', 'v', { ttlMs: 100 })
    t = 50
    expect(c.get('k')).toBe('v')
    t = 150
    expect(c.get('k')).toBeUndefined()
    expect(c.stats.misses).toBe(1)
  })
})

describe('CacheManager — SWR', () => {
  it('returns the stale value once past TTL when swr is set, flagged stale', () => {
    let t = 0
    const c = new CacheManager({ now: () => t })
    c.set('cat', 'manifest', { ttlMs: 100, swr: true })
    t = 200
    expect(c.get('cat')).toBe('manifest') // stale but returned
    expect(c.isStale('cat')).toBe(true)
  })

  it('a non-swr entry does NOT return stale', () => {
    let t = 0
    const c = new CacheManager({ now: () => t })
    c.set('cat', 'x', { ttlMs: 100 })
    t = 200
    expect(c.get('cat')).toBeUndefined()
  })
})

describe('CacheManager — event-driven precise invalidation', () => {
  it('one tag invalidation evicts exactly one entry', () => {
    const c = new CacheManager({ now: () => 0 })
    c.set('v:cpu', 1, { tags: ['variables', 'variables:cpu'] })
    c.set('v:gpu', 2, { tags: ['variables', 'variables:gpu'] })
    const n = c.invalidateByTag('variables:cpu') // precise: only cpu
    expect(n).toBe(1)
    expect(c.get('v:cpu')).toBeUndefined()
    expect(c.get('v:gpu')).toBe(2)
  })

  it('a broad tag invalidates all entries carrying it', () => {
    const c = new CacheManager({ now: () => 0 })
    c.set('v:cpu', 1, { tags: ['variables'] })
    c.set('v:gpu', 2, { tags: ['variables'] })
    expect(c.invalidateByTag('variables')).toBe(2)
  })
})

describe('CacheManager — bounded memory (LRU)', () => {
  it('never exceeds maxEntries; evicts least-recently-used', () => {
    const c = new CacheManager({ maxEntries: 2, now: () => 0 })
    c.set('a', 1)
    c.set('b', 2)
    c.get('a') // touch a → b becomes LRU
    c.set('c', 3) // evicts b
    expect(c.stats.size).toBe(2)
    expect(c.get('b')).toBeUndefined()
    expect(c.get('a')).toBe(1)
    expect(c.get('c')).toBe(3)
    expect(c.stats.evictions).toBe(1)
  })

  it('stays bounded under many inserts', () => {
    const c = new CacheManager({ maxEntries: 50, now: () => 0 })
    for (let i = 0; i < 1000; i++) c.set(`k${i}`, i)
    expect(c.stats.size).toBe(50)
  })
})

describe('CacheManager — telemetry tap', () => {
  it('reports hit/miss/evict to onStat', () => {
    const onStat = vi.fn()
    const c = new CacheManager({ maxEntries: 1, now: () => 0, onStat })
    c.get('x') // miss
    c.set('x', 1)
    c.get('x') // hit
    c.set('y', 2) // evict x
    const events = onStat.mock.calls.map((c) => c[0])
    expect(events).toContain('miss')
    expect(events).toContain('hit')
    expect(events).toContain('evict')
  })
})
