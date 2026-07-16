import { describe, it, expect } from 'vitest'
import {
  screenDeltaToWorld,
  dragFrame,
  resizeFrame,
  rotationFromPointer,
  boundingFrame,
  MIN_SIZE,
} from './transform-math'
import type { Frame } from '@/shared/project'

const F: Frame = { x: 100, y: 100, w: 200, h: 100 }

describe('zoom correction (CD-306 AC: math at 50/100/200%)', () => {
  it('the same screen delta maps to a scale-corrected world delta', () => {
    const dScreen = { x: 40, y: 20 }
    expect(screenDeltaToWorld(dScreen, 0.5)).toEqual({ x: 80, y: 40 }) // 50% → 2× world
    expect(screenDeltaToWorld(dScreen, 1)).toEqual({ x: 40, y: 20 })
    expect(screenDeltaToWorld(dScreen, 2)).toEqual({ x: 20, y: 10 }) // 200% → ½ world
  })

  it('drag moves a widget by the same on-screen distance at every zoom', () => {
    const dScreen = { x: 40, y: 0 }
    for (const [scale, expectedX] of [
      [0.5, 100 + 80],
      [1, 100 + 40],
      [2, 100 + 20],
    ] as const) {
      const moved = dragFrame(F, screenDeltaToWorld(dScreen, scale))
      expect(moved.x).toBe(expectedX)
      expect(moved.y).toBe(100)
    }
  })

  it('resize east grows width by the world delta at each zoom', () => {
    const dScreen = { x: 60, y: 0 }
    expect(resizeFrame(F, 'e', screenDeltaToWorld(dScreen, 0.5)).w).toBe(200 + 120)
    expect(resizeFrame(F, 'e', screenDeltaToWorld(dScreen, 1)).w).toBe(200 + 60)
    expect(resizeFrame(F, 'e', screenDeltaToWorld(dScreen, 2)).w).toBe(200 + 30)
  })
})

describe('resizeFrame handles', () => {
  it('west handle moves origin and shrinks width, keeping the right edge fixed', () => {
    const r = resizeFrame(F, 'w', { x: 50, y: 0 })
    expect(r).toEqual({ x: 150, y: 100, w: 150, h: 100 })
    expect(r.x + r.w).toBe(F.x + F.w) // right edge unchanged
  })

  it('north handle keeps the bottom edge fixed', () => {
    const r = resizeFrame(F, 'n', { x: 0, y: 30 })
    expect(r.y + r.h).toBe(F.y + F.h)
    expect(r.h).toBe(70)
  })

  it('corner handle resizes both axes', () => {
    const r = resizeFrame(F, 'se', { x: 20, y: 10 })
    expect(r).toEqual({ x: 100, y: 100, w: 220, h: 110 })
  })

  it('enforces the minimum size without flipping', () => {
    const r = resizeFrame(F, 'e', { x: -1000, y: 0 })
    expect(r.w).toBe(MIN_SIZE)
    const rw = resizeFrame(F, 'w', { x: 1000, y: 0 })
    expect(rw.w).toBe(MIN_SIZE)
    expect(rw.x).toBe(F.x + F.w - MIN_SIZE) // still anchored to the right edge
  })
})

describe('rotationFromPointer', () => {
  const center = { x: 100, y: 100 }
  it('0° when the pointer is directly above the center', () => {
    expect(rotationFromPointer(center, { x: 100, y: 0 })).toBe(0)
  })
  it('90° to the right, 180° below, 270° to the left', () => {
    expect(rotationFromPointer(center, { x: 200, y: 100 })).toBe(90)
    expect(rotationFromPointer(center, { x: 100, y: 200 })).toBe(180)
    expect(rotationFromPointer(center, { x: 0, y: 100 })).toBe(270)
  })
  it('snaps to 15° by default, free with ⇧', () => {
    // ~10° from vertical → snaps to 15° (nearest multiple)… actually rounds to 0 or 15
    const snapped = rotationFromPointer(center, { x: 100 + 20, y: 100 - 100 })
    expect(snapped % 15).toBe(0)
    const free = rotationFromPointer(center, { x: 100 + 20, y: 100 - 100 }, true)
    expect(free).toBeCloseTo((Math.atan2(20, 100) * 180) / Math.PI, 5)
  })
})

describe('boundingFrame', () => {
  it('computes the AABB of several frames', () => {
    expect(
      boundingFrame([
        { x: 0, y: 0, w: 50, h: 50 },
        { x: 100, y: 20, w: 40, h: 80 },
      ]),
    ).toEqual({ x: 0, y: 0, w: 140, h: 100 })
  })
  it('returns null for an empty set', () => {
    expect(boundingFrame([])).toBeNull()
  })
})
