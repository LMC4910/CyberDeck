import { describe, it, expect } from 'vitest'
import {
  IDENTITY,
  DEFAULT_ZOOM_LIMITS,
  clampScale,
  worldToScreen,
  screenToWorld,
  zoomAtPoint,
  zoomByFactor,
  panBy,
  fit,
  resetToActualSize,
  visibleWorldRect,
  toCssTransform,
  transformsEqual,
  type ViewTransform,
  type Point,
} from './view-transform'

const closeTo = (a: Point, b: Point, eps = 1e-9) => {
  expect(a.x).toBeCloseTo(b.x, 9)
  expect(a.y).toBeCloseTo(b.y, 9)
  void eps
}

describe('screen↔world round-trip', () => {
  const samples: ViewTransform[] = [
    IDENTITY,
    { scale: 2, tx: 10, ty: -30 },
    { scale: 0.5, tx: -100, ty: 250 },
    { scale: 3.7, tx: 12.3, ty: 44.9 },
  ]
  it('screenToWorld inverts worldToScreen for every transform', () => {
    for (const t of samples) {
      for (const p of [
        { x: 0, y: 0 },
        { x: 100, y: 200 },
        { x: -50, y: 75 },
      ]) {
        closeTo(screenToWorld(t, worldToScreen(t, p)), p)
      }
    }
  })
})

describe('zoomAtPoint invariant', () => {
  it('keeps the world point under the anchor pinned to the anchor', () => {
    const t: ViewTransform = { scale: 1, tx: 0, ty: 0 }
    const anchor: Point = { x: 320, y: 240 }
    const worldBefore = screenToWorld(t, anchor)

    for (const nextScale of [0.1, 0.5, 1, 2, 5, 40]) {
      const zoomed = zoomAtPoint(t, anchor, nextScale)
      // The same world point must still project to the anchor screen position.
      closeTo(worldToScreen(zoomed, worldBefore), anchor)
      expect(zoomed.scale).toBeCloseTo(nextScale, 9)
    }
  })

  it('holds the invariant when starting from a non-identity transform', () => {
    const t: ViewTransform = { scale: 2.5, tx: -140, ty: 60 }
    const anchor: Point = { x: 512, y: 384 }
    const worldBefore = screenToWorld(t, anchor)
    const zoomed = zoomAtPoint(t, anchor, 0.8)
    closeTo(worldToScreen(zoomed, worldBefore), anchor)
  })

  it('clamps to zoom limits but still pins the anchor', () => {
    const t = IDENTITY
    const anchor: Point = { x: 100, y: 100 }
    const worldBefore = screenToWorld(t, anchor)
    const zoomed = zoomAtPoint(t, anchor, 9999)
    expect(zoomed.scale).toBe(DEFAULT_ZOOM_LIMITS.max)
    closeTo(worldToScreen(zoomed, worldBefore), anchor)
  })

  it('zoomByFactor composes multiplicatively while pinning the anchor', () => {
    const t = IDENTITY
    const anchor: Point = { x: 200, y: 150 }
    const worldBefore = screenToWorld(t, anchor)
    const once = zoomByFactor(t, 1.2, anchor)
    const twice = zoomByFactor(once, 1.2, anchor)
    expect(twice.scale).toBeCloseTo(1.44, 9)
    closeTo(worldToScreen(twice, worldBefore), anchor)
  })
})

describe('clampScale', () => {
  it('bounds to the given limits', () => {
    expect(clampScale(1000)).toBe(DEFAULT_ZOOM_LIMITS.max)
    expect(clampScale(0.0001)).toBe(DEFAULT_ZOOM_LIMITS.min)
    expect(clampScale(2)).toBe(2)
    expect(clampScale(2, { min: 1, max: 1.5 })).toBe(1.5)
  })
})

describe('panBy', () => {
  it('translates in screen space without touching scale', () => {
    const t: ViewTransform = { scale: 2, tx: 10, ty: 20 }
    const panned = panBy(t, 5, -7)
    expect(panned).toEqual({ scale: 2, tx: 15, ty: 13 })
  })
})

describe('fit', () => {
  it('scales content to fit within padded viewport and centers it', () => {
    const content = { x: 0, y: 0, w: 200, h: 100 }
    const viewport = { w: 440, h: 340 }
    const t = fit(content, viewport, 20)
    // available = 400 x 300; min(400/200, 300/100) = min(2,3) = 2
    expect(t.scale).toBe(2)
    // content center (100,50) must land at viewport center (220,170)
    closeTo(worldToScreen(t, { x: 100, y: 50 }), { x: 220, y: 170 })
  })

  it('returns identity for degenerate content or viewport', () => {
    expect(fit({ x: 0, y: 0, w: 0, h: 0 }, { w: 100, h: 100 })).toEqual(IDENTITY)
    expect(fit({ x: 0, y: 0, w: 100, h: 100 }, { w: 10, h: 10 }, 20)).toEqual(IDENTITY)
  })

  it('respects a non-zero content origin', () => {
    const content = { x: 500, y: 500, w: 100, h: 100 }
    const viewport = { w: 300, h: 300 }
    const t = fit(content, viewport, 0)
    closeTo(worldToScreen(t, { x: 550, y: 550 }), { x: 150, y: 150 })
  })
})

describe('resetToActualSize', () => {
  it('centers the world origin at 100%', () => {
    const t = resetToActualSize({ w: 800, h: 600 })
    expect(t.scale).toBe(1)
    closeTo(worldToScreen(t, { x: 0, y: 0 }), { x: 400, y: 300 })
  })
})

describe('visibleWorldRect', () => {
  it('reports the world rect covering the viewport', () => {
    const t: ViewTransform = { scale: 2, tx: 0, ty: 0 }
    const r = visibleWorldRect(t, { w: 800, h: 600 })
    expect(r).toEqual({ x: 0, y: 0, w: 400, h: 300 })
  })
})

describe('serialization helpers', () => {
  it('toCssTransform emits translate+scale', () => {
    expect(toCssTransform({ scale: 1.5, tx: 12, ty: -8 })).toBe(
      'translate(12px, -8px) scale(1.5)',
    )
  })
  it('transformsEqual compares component-wise', () => {
    expect(transformsEqual({ scale: 1, tx: 0, ty: 0 }, IDENTITY)).toBe(true)
    expect(transformsEqual({ scale: 1, tx: 1, ty: 0 }, IDENTITY)).toBe(false)
  })
})
