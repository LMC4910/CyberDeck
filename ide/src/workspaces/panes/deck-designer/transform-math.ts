// Transform math (CD-306). Pure geometry for drag / 8-handle resize / rotation,
// operating in WORLD coordinates. Screen pointer deltas are converted to world by
// dividing by the zoom scale (screenDeltaToWorld) BEFORE these run, which is what
// makes every gesture zoom-correct: the same on-screen drag moves a widget by half
// the world distance at 200 % and double at 50 %. Tested at 50/100/200 %.
import type { Frame } from '@/shared/project'

export interface Vec {
  x: number
  y: number
}

/** The 8 resize handles (compass points). */
export type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

export const RESIZE_HANDLES: ResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

/** Minimum widget size (world px) — resize never collapses a widget past this. */
export const MIN_SIZE = 8

/** Convert a screen-space delta to world space (the zoom correction). */
export function screenDeltaToWorld(dScreen: Vec, scale: number): Vec {
  return { x: dScreen.x / scale, y: dScreen.y / scale }
}

/** Translate a frame by a world delta (drag). */
export function dragFrame(start: Frame, dWorld: Vec): Frame {
  return { ...start, x: start.x + dWorld.x, y: start.y + dWorld.y }
}

const movesWest = (h: ResizeHandle) => h === 'w' || h === 'nw' || h === 'sw'
const movesEast = (h: ResizeHandle) => h === 'e' || h === 'ne' || h === 'se'
const movesNorth = (h: ResizeHandle) => h === 'n' || h === 'ne' || h === 'nw'
const movesSouth = (h: ResizeHandle) => h === 's' || h === 'se' || h === 'sw'

/**
 * Resize `start` by dragging `handle` a world delta. West/north handles move the
 * opposite edge fixed and adjust origin; min size is enforced without flipping.
 */
export function resizeFrame(start: Frame, handle: ResizeHandle, dWorld: Vec, min = MIN_SIZE): Frame {
  let { x, y, w, h } = start
  const right = start.x + start.w
  const bottom = start.y + start.h

  if (movesEast(handle)) w = Math.max(min, start.w + dWorld.x)
  if (movesWest(handle)) {
    w = Math.max(min, start.w - dWorld.x)
    x = right - w
  }
  if (movesSouth(handle)) h = Math.max(min, start.h + dWorld.y)
  if (movesNorth(handle)) {
    h = Math.max(min, start.h - dWorld.y)
    y = bottom - h
  }
  return { x, y, w, h }
}

export function frameCenter(f: Frame): Vec {
  return { x: f.x + f.w / 2, y: f.y + f.h / 2 }
}

/**
 * Rotation (degrees, clockwise, 0 = pointer directly above center) from the pointer
 * world position. Snaps to 15° unless `free` (⇧). Result normalized to [0, 360).
 */
export function rotationFromPointer(center: Vec, pointerWorld: Vec, free = false, snapDeg = 15): number {
  const dx = pointerWorld.x - center.x
  const dy = pointerWorld.y - center.y
  // atan2(dx, -dy): 0 when the pointer is straight up, increasing clockwise.
  let deg = (Math.atan2(dx, -dy) * 180) / Math.PI
  if (!free) deg = Math.round(deg / snapDeg) * snapDeg
  return ((deg % 360) + 360) % 360
}

/** Axis-aligned bounding box of several frames (for a multi-selection gizmo). */
export function boundingFrame(frames: Frame[]): Frame | null {
  if (frames.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const f of frames) {
    minX = Math.min(minX, f.x)
    minY = Math.min(minY, f.y)
    maxX = Math.max(maxX, f.x + f.w)
    maxY = Math.max(maxY, f.y + f.h)
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}
