import { describe, it, expect } from 'vitest'
import { IdAllocator, isStableId, ID_PREFIX } from './id'

describe('isStableId', () => {
  it('accepts schema-shaped ids', () => {
    expect(isStableId('w_9f3ka01')).toBe(true)
    expect(isStableId('page_home01')).toBe(true)
    expect(isStableId('cmp_statcard1')).toBe(true)
  })
  it('rejects name-derived or malformed keys', () => {
    expect(isStableId('CPU Load')).toBe(false)
    expect(isStableId('w_abc')).toBe(false) // body too short
    expect(isStableId('_abc123')).toBe(false) // no prefix
    expect(isStableId('1w_abc123')).toBe(false) // prefix must start alpha
    expect(isStableId(42)).toBe(false)
  })
})

describe('IdAllocator', () => {
  it('mints unique, schema-valid ids for every prefix', () => {
    const alloc = new IdAllocator()
    const seen = new Set<string>()
    for (const prefix of Object.values(ID_PREFIX)) {
      for (let i = 0; i < 200; i++) {
        const id = alloc.next(prefix)
        expect(isStableId(id)).toBe(true)
        expect(id.startsWith(prefix + '_')).toBe(true)
        expect(seen.has(id)).toBe(false)
        seen.add(id)
      }
    }
  })

  it('never reissues a reserved id (deletion never frees ids)', () => {
    // Force a colliding random source, then confirm reservation blocks reuse.
    let calls = 0
    const random = () => {
      calls++
      // first two calls collide, third differs
      return calls < 3 ? 0.5 : 0.6
    }
    const alloc = new IdAllocator(random)
    const a = alloc.next('w')
    const b = alloc.next('w')
    expect(a).not.toBe(b)
  })

  it('honors a seeded issued set from a restored document', () => {
    const alloc = new IdAllocator(undefined, ['w_seed01'])
    expect(alloc.has('w_seed01')).toBe(true)
  })

  it('rejects invalid prefixes', () => {
    const alloc = new IdAllocator()
    expect(() => alloc.next('W')).toThrow()
    expect(() => alloc.next('1x')).toThrow()
  })
})
