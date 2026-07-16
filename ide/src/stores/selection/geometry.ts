// Selection hit-testing geometry (CD-305). Pure functions for marquee (rect) and
// lasso (polygon) selection in world coordinates.
import type { Frame } from '@/shared/project'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}
export interface Point {
  x: number
  y: number
}

/** True when a widget frame overlaps the marquee rect (any intersection selects). */
export function frameIntersectsRect(frame: Frame, rect: Rect): boolean {
  const rx2 = rect.x + rect.w
  const ry2 = rect.y + rect.h
  const fx2 = frame.x + frame.w
  const fy2 = frame.y + frame.h
  return frame.x < rx2 && fx2 > rect.x && frame.y < ry2 && fy2 > rect.y
}

/** Center point of a frame (used for lasso containment). */
export function frameCenter(frame: Frame): Point {
  return { x: frame.x + frame.w / 2, y: frame.y + frame.h / 2 }
}

/** Ray-casting point-in-polygon test. Polygon is an ordered list of vertices. */
export function pointInPolygon(pt: Point, polygon: Point[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!
    const b = polygon[j]!
    const intersect =
      a.y > pt.y !== b.y > pt.y &&
      pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x
    if (intersect) inside = !inside
  }
  return inside
}

/** Normalize a drag (two corners) into a positive-size rect. */
export function rectFromCorners(a: Point, b: Point): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(a.x - b.x),
    h: Math.abs(a.y - b.y),
  }
}
