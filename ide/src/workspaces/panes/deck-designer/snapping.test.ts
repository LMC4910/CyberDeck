import { describe, it, expect } from 'vitest'
import { snapBox } from './snapping'
import type { Frame } from '@/shared/project'

const sibling: Frame = { x: 100, y: 100, w: 100, h: 100 } // edges x:100/150/200, y:100/150/200

describe('snapBox (CD-307 snap accuracy)', () => {
  it('snaps a left edge to a sibling left edge within threshold', () => {
    const r = snapBox({ x: 104, y: 300, w: 50, h: 50 }, [sibling], { threshold: 6 })
    expect(r.dx).toBe(-4) // 104 → 100
    expect(r.guidesV).toEqual([100])
    expect(r.dy).toBe(0)
  })

  it('snaps center-to-center', () => {
    // moving center x should align to sibling center 150. box center = x+25.
    const r = snapBox({ x: 122, y: 300, w: 50, h: 50 }, [sibling], { threshold: 6 })
    expect(r.dx).toBe(3) // center 147 → 150
    expect(r.guidesV).toEqual([150])
  })

  it('snaps right edge to sibling right edge', () => {
    // Width 54 so only the right edge (197) is within range of a target (200).
    const r = snapBox({ x: 143, y: 300, w: 54, h: 50 }, [sibling], { threshold: 6 })
    expect(r.dx).toBe(3) // 197 → 200
    expect(r.guidesV).toEqual([200])
  })

  it('does not snap beyond the threshold', () => {
    // Small box centered away from every sibling edge/center.
    const r = snapBox({ x: 130, y: 300, w: 10, h: 10 }, [sibling], { threshold: 6 })
    expect(r).toMatchObject({ dx: 0, dy: 0, guidesV: [], guidesH: [] })
  })

  it('snaps to the grid when no sibling is closer', () => {
    const r = snapBox({ x: 26, y: 300, w: 50, h: 50 }, [sibling], { threshold: 6, grid: 24 })
    expect(r.dx).toBe(-2) // left edge 26 → 24
    expect(r.guidesV).toEqual([24])
  })

  it('prefers the nearest target across siblings and grid', () => {
    const r = snapBox({ x: 98, y: 300, w: 50, h: 50 }, [sibling], { threshold: 6, grid: 24 })
    // left edge 98: sibling 100 (dist 2) vs grid 96 (dist 2) — first found (sibling) wins ties
    expect(Math.abs(r.dx)).toBe(2)
  })

  it('snaps both axes independently', () => {
    const r = snapBox({ x: 104, y: 96, w: 50, h: 50 }, [sibling], { threshold: 6 })
    expect(r.dx).toBe(-4) // 104 → 100
    expect(r.dy).toBe(4) // top 96 → 100
    expect(r.guidesV).toEqual([100])
    expect(r.guidesH).toEqual([100])
  })

  it('returns no guides when nothing is in range', () => {
    const r = snapBox({ x: 500, y: 500, w: 20, h: 20 }, [sibling], { threshold: 6 })
    expect(r.guidesV).toEqual([])
    expect(r.guidesH).toEqual([])
  })
})
