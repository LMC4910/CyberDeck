import { describe, expect, it, vi } from 'vitest'
import {
  ConfigurationService,
  UNSET,
  type ConfigObject,
  type SettingsDelta,
} from '@/services/configuration'

describe('ConfigurationService — precedence (CD-109 §1)', () => {
  it('later layers win for scalars (defaults ← app ← user ← workspace ← runtime)', () => {
    const c = new ConfigurationService({
      layers: {
        defaults: { density: 'comfortable' },
        application: { density: 'compact' },
        user: { density: 'spacious' },
      },
    })
    expect(c.get('density')).toBe('spacious')
    c.set('density', 'compact', 'workspace')
    expect(c.get('density')).toBe('compact')
    c.set('density', 'comfortable', 'runtime')
    expect(c.get('density')).toBe('comfortable')
  })

  it('property: the merged value equals the highest-priority layer that defines the key', () => {
    const layerOrder = ['defaults', 'application', 'user', 'workspace', 'runtime'] as const
    // For every subset of layers that define `k`, the merged value is the last one.
    for (let mask = 1; mask < 1 << layerOrder.length; mask++) {
      const layers: Record<string, { k: number }> = {}
      let expected = -1
      layerOrder.forEach((layer, i) => {
        if (mask & (1 << i)) {
          layers[layer] = { k: i }
          expected = i
        }
      })
      const c = new ConfigurationService({ layers })
      expect(c.get('k')).toBe(expected)
    }
  })
})

describe('ConfigurationService — merge edge cases (CD-109 §4)', () => {
  const merged = (base: ConfigObject, over: ConfigObject) =>
    new ConfigurationService({ layers: { defaults: base, user: over } }).getAll()

  it('object over object deep-merges (case 4)', () => {
    expect(merged({ o: { a: 1, b: 2 } }, { o: { b: 9, c: 3 } })).toEqual({
      o: { a: 1, b: 9, c: 3 },
    })
  })

  it('array over array replaces atomically (case 5)', () => {
    expect(merged({ a: [1, 2, 3] }, { a: [9] })).toEqual({ a: [9] })
  })

  it('object under scalar replaces the whole subtree (case 3)', () => {
    expect(merged({ x: { a: 1 } }, { x: 5 })).toEqual({ x: 5 })
  })

  it('null is a value, not a delete (case 8)', () => {
    expect(merged({ x: 1 }, { x: null })).toEqual({ x: null })
  })

  it('$unset removes the key from the merged view (case 9)', () => {
    expect(merged({ theme: { mode: 'dark' } }, { theme: UNSET })).toEqual({})
  })

  it('$unset over an absent key is a no-op (case 10)', () => {
    expect(merged({ a: 1 }, { missing: UNSET })).toEqual({ a: 1 })
  })
})

describe('ConfigurationService — watch + deltas (CD-109 §3)', () => {
  it('watch fires a precise delta for the exact path', () => {
    const c = new ConfigurationService({ layers: { defaults: { features: { devTools: false } } } })
    const seen: SettingsDelta[] = []
    c.watch('features.devTools', (d) => seen.push(d))
    c.set('features.devTools', true, 'user')
    expect(seen).toHaveLength(1)
    expect(seen[0]).toMatchObject({
      path: 'features.devTools',
      value: true,
      previous: false,
      layer: 'user',
      area: 'features',
    })
  })

  it('watch on a prefix fires for descendants but not siblings', () => {
    const c = new ConfigurationService({ layers: { defaults: { features: { a: 1 }, theme: { m: 'd' } } } })
    const featureHits: string[] = []
    c.watch('features', (d) => featureHits.push(d.path))
    c.set('features.b', 2, 'user')
    c.set('theme.m', 'l', 'user')
    expect(featureHits).toEqual(['features.b'])
  })

  it('no delta when the effective value is unchanged (shadowed write)', () => {
    const c = new ConfigurationService({
      layers: { defaults: { x: 1 }, runtime: { x: 99 } },
    })
    const cb = vi.fn()
    c.onChange(cb)
    // writing user.x is shadowed by runtime.x → merged view unchanged → no delta
    c.set('x', 50, 'user')
    expect(cb).not.toHaveBeenCalled()
  })

  it('array replacement emits a single delta at the array path', () => {
    const c = new ConfigurationService({ layers: { defaults: { list: [1, 2] } } })
    const seen: SettingsDelta[] = []
    c.onChange((d) => seen.push(d))
    c.set('list', [3, 4, 5], 'user')
    expect(seen).toHaveLength(1)
    expect(seen[0]?.path).toBe('list')
    expect(seen[0]?.value).toEqual([3, 4, 5])
  })

  it('revisions are monotonic per area', () => {
    const c = new ConfigurationService({ layers: { defaults: { features: { a: 1 } } } })
    const revs: number[] = []
    c.onChange((d) => revs.push(d.revision))
    c.set('features.a', 2, 'user')
    c.set('features.a', 3, 'user')
    expect(revs).toEqual([1, 2])
  })

  it('unsubscribe stops delivery', () => {
    const c = new ConfigurationService()
    const cb = vi.fn()
    const off = c.watch('x', cb)
    off()
    c.set('x', 1)
    expect(cb).not.toHaveBeenCalled()
  })
})

describe('ConfigurationService — isolation', () => {
  it('getAll returns a copy that cannot mutate internal state', () => {
    const c = new ConfigurationService({ layers: { defaults: { a: { b: 1 } } } })
    const snap = c.getAll() as { a: { b: number } }
    snap.a.b = 999
    expect(c.get('a.b')).toBe(1)
  })
})
