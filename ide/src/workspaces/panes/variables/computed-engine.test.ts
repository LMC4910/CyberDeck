// CD-403 — the computed/expression engine, as a pure unit. Proves the two ACs at
// their root: a dependency tick re-evaluates (and an unrelated tick does not), and a
// dependency cycle is rejected with a readable message instead of looping forever.
import { describe, it, expect, vi } from 'vitest'
import { ComputedEngine, type ComputedResult } from './computed-engine'

function ok(r: ComputedResult | undefined): unknown {
  if (!r) throw new Error('no result')
  if (!r.ok) throw new Error(`expected ok, got error: ${r.error}`)
  return r.value
}

describe('ComputedEngine (CD-403)', () => {
  it('AC: a computed var re-evaluates when a dependency ticks', () => {
    const engine = new ComputedEngine()
    engine.setDefinitions([{ id: 'headroom', expr: '100 - cpu' }])
    engine.seed({ cpu: 40 })
    expect(ok(engine.resultOf('headroom'))).toBe(60)

    const ran = engine.onTick('cpu', 10)
    expect(ran).toBe(true) // it was a dependency, so it recomputed
    expect(ok(engine.resultOf('headroom'))).toBe(90)
  })

  it('an unrelated tick is a no-op (dependency-tracked, not recompute-everything)', () => {
    const sink = vi.fn()
    const engine = new ComputedEngine(sink)
    engine.setDefinitions([{ id: 'headroom', expr: '100 - cpu' }])
    engine.seed({ cpu: 40 })
    sink.mockClear()

    const ran = engine.onTick('gpu', 999) // gpu is not a dependency of anything
    expect(ran).toBe(false)
    expect(sink).not.toHaveBeenCalled()
    expect(ok(engine.resultOf('headroom'))).toBe(60)
  })

  it('re-evaluates a computed var that depends on another computed var (topo order)', () => {
    const engine = new ComputedEngine()
    engine.setDefinitions([
      { id: 'headroom', expr: '100 - cpu' },
      { id: 'label', expr: 'headroom > 50' }, // depends on a derived var
    ])
    engine.seed({ cpu: 40 })
    expect(ok(engine.resultOf('label'))).toBe(true)

    engine.onTick('cpu', 70) // headroom → 30, so label → false, both fresh
    expect(ok(engine.resultOf('headroom'))).toBe(30)
    expect(ok(engine.resultOf('label'))).toBe(false)
  })

  it('AC: a dependency cycle is rejected with a message, not an infinite loop', () => {
    const engine = new ComputedEngine()
    engine.setDefinitions([
      { id: 'a', expr: 'b + 1' },
      { id: 'b', expr: 'a + 1' },
    ])
    const a = engine.resultOf('a')
    const b = engine.resultOf('b')
    expect(a?.ok).toBe(false)
    expect(b?.ok).toBe(false)
    if (a && !a.ok) expect(a.error).toMatch(/cycle/i)
    if (b && !b.ok) expect(b.error).toMatch(/cycle/i)
  })

  it('a self-reference is a cycle too', () => {
    const engine = new ComputedEngine()
    engine.setDefinitions([{ id: 'a', expr: 'a + 1' }])
    const a = engine.resultOf('a')
    expect(a?.ok).toBe(false)
    if (a && !a.ok) expect(a.error).toMatch(/cycle/i)
  })

  it('notifies the sink and reports the paths to watch', () => {
    const sink = vi.fn()
    const engine = new ComputedEngine(sink)
    engine.setDefinitions([{ id: 'headroom', expr: '100 - cpu' }])
    expect(engine.dependencyPaths()).toEqual(['cpu'])
    expect(engine.dependenciesOf('headroom')).toEqual(['cpu'])
    expect(sink).toHaveBeenCalled()
  })
})
