import { describe, it, expect } from 'vitest'
import { alignFrames, distributeFrames } from './align'
import type { Frame } from '@/shared/project'

const item = (id: string, f: Frame) => ({ id, frame: f })

describe('alignFrames (CD-312)', () => {
  const items = [
    item('a', { x: 0, y: 0, w: 40, h: 20 }),
    item('b', { x: 100, y: 50, w: 60, h: 40 }),
    item('c', { x: 50, y: 200, w: 20, h: 10 }),
  ]

  it('aligns left edges to the min x', () => {
    const r = alignFrames(items, 'left')
    expect(r.get('b')!.x).toBe(0)
    expect(r.get('c')!.x).toBe(0)
    expect(r.has('a')).toBe(false) // already at min → unchanged
  })

  it('aligns right edges to the max right', () => {
    const r = alignFrames(items, 'right')
    // max right = 160 (b). a → 160-40=120
    expect(r.get('a')!.x).toBe(120)
  })

  it('aligns top edges', () => {
    const r = alignFrames(items, 'top')
    expect(r.get('b')!.y).toBe(0)
    expect(r.get('c')!.y).toBe(0)
  })

  it('does nothing for a single item', () => {
    expect(alignFrames([items[0]!], 'left').size).toBe(0)
  })
})

describe('distributeFrames (CD-312)', () => {
  it('evenly spaces the middle items horizontally', () => {
    const items = [
      item('a', { x: 0, y: 0, w: 10, h: 10 }),
      item('b', { x: 40, y: 0, w: 10, h: 10 }),
      item('c', { x: 100, y: 0, w: 10, h: 10 }),
    ]
    const r = distributeFrames(items, 'horizontal')
    // gap = (100-0)/2 = 50 → b.x should be 50
    expect(r.get('b')!.x).toBe(50)
  })

  it('needs at least 3 items', () => {
    const items = [item('a', { x: 0, y: 0, w: 10, h: 10 }), item('b', { x: 40, y: 0, w: 10, h: 10 })]
    expect(distributeFrames(items, 'horizontal').size).toBe(0)
  })
})
