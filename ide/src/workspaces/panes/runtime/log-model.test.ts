import { describe, expect, it } from 'vitest'
import type { RuntimeLogEvent } from '@/shared/contract'
import {
  allLevels,
  eventsPerMinute,
  filterEntries,
  RATE_WINDOW_MS,
  sourcesOf,
  trimArrivals,
  UNKNOWN_SOURCE,
} from './log-model'

const e = (level: RuntimeLogEvent['level'], source?: string): RuntimeLogEvent => ({
  level,
  message: `${level} line`,
  ...(source ? { source } : {}),
})

describe('log filtering', () => {
  const entries = [e('debug', 'flow'), e('info', 'engine'), e('warn', 'flow'), e('error'), e('info', 'device')]

  it('filters by level', () => {
    const rows = filterEntries(entries, { levels: new Set(['warn', 'error']), source: null })
    expect(rows.map((r) => r.level)).toEqual(['warn', 'error'])
  })

  it('filters by source, and buckets unlabelled entries under "unknown"', () => {
    expect(filterEntries(entries, { levels: allLevels(), source: 'flow' })).toHaveLength(2)
    const unknown = filterEntries(entries, { levels: allLevels(), source: UNKNOWN_SOURCE })
    expect(unknown.map((r) => r.level)).toEqual(['error'])
  })

  it('combines level + source (both must match)', () => {
    const rows = filterEntries(entries, { levels: new Set(['warn']), source: 'flow' })
    expect(rows).toHaveLength(1)
    expect(filterEntries(entries, { levels: new Set(['warn']), source: 'engine' })).toHaveLength(0)
  })

  it('an empty level set hides everything (no accidental "all" fallback)', () => {
    expect(filterEntries(entries, { levels: new Set(), source: null })).toHaveLength(0)
  })

  it('lists the distinct sources present, sorted', () => {
    expect(sourcesOf(entries)).toEqual(['device', 'engine', 'flow', UNKNOWN_SOURCE])
  })
})

describe('events/min rate', () => {
  it('counts only arrivals inside the trailing window', () => {
    const now = 100_000
    const arrivals = [now - RATE_WINDOW_MS - 1, now - RATE_WINDOW_MS, now - 30_000, now - 1, now]
    // the two at/older than the cutoff are out; the boundary is exclusive
    expect(eventsPerMinute(arrivals, now)).toBe(3)
  })

  it('decays to zero once the stream goes quiet', () => {
    const arrivals = [1_000, 2_000, 3_000]
    expect(eventsPerMinute(arrivals, 3_000)).toBe(3)
    expect(eventsPerMinute(arrivals, 3_000 + RATE_WINDOW_MS)).toBe(0)
  })

  it('reports a sustained 50 events/s as 3000 events/min', () => {
    const now = 200_000
    const arrivals = Array.from({ length: 3_000 }, (_, i) => now - i * 20).reverse()
    expect(eventsPerMinute(arrivals, now)).toBe(3_000)
  })

  it('empty arrivals → 0', () => {
    expect(eventsPerMinute([], 1)).toBe(0)
  })
})

describe('trimArrivals — the ref stays bounded', () => {
  it('drops aged-out arrivals and keeps the live ones', () => {
    const now = 100_000
    expect(trimArrivals([now - 90_000, now - 70_000, now - 10_000, now], now)).toEqual([now - 10_000, now])
  })

  it('is a no-op when everything is still inside the window', () => {
    expect(trimArrivals([9, 10], 10)).toEqual([9, 10])
  })

  it('drops everything when it has all aged out', () => {
    expect(trimArrivals([1, 2], 1 + RATE_WINDOW_MS * 2)).toEqual([])
  })
})
