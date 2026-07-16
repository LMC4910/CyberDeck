// Snapping + smart guides (CD-307). Pure geometry: given a moving box and the static
// sibling frames (plus an optional grid), find the smallest position adjustment that
// aligns a moving edge/center to a sibling edge/center or grid line, within a
// threshold. Returns the adjustment (dx, dy) and the world coordinates of the active
// guide lines (so the canvas can draw them ONLY during a gesture). ⇧ bypass is the
// caller's job (skip snapping when Shift is held).
import type { Frame } from '@/shared/project'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface SnapConfig {
  /** Max distance (world px) at which an edge snaps. Default 6. */
  threshold?: number
  /** Grid size (world px); omit for sibling-only snapping. */
  grid?: number
}

export interface SnapResult {
  dx: number
  dy: number
  /** World x of active vertical guides. */
  guidesV: number[]
  /** World y of active horizontal guides. */
  guidesH: number[]
}

interface AxisSnap {
  delta: number
  guide: number
  dist: number
}

function edgesX(f: Rect): number[] {
  return [f.x, f.x + f.w / 2, f.x + f.w]
}
function edgesY(f: Rect): number[] {
  return [f.y, f.y + f.h / 2, f.y + f.h]
}

function bestSnap(movingEdges: number[], targets: number[], grid: number | undefined, threshold: number): AxisSnap | null {
  let best: AxisSnap | null = null
  const consider = (edge: number, target: number) => {
    const dist = Math.abs(target - edge)
    if (dist <= threshold && (best === null || dist < best.dist)) {
      best = { delta: target - edge, guide: target, dist }
    }
  }
  for (const edge of movingEdges) {
    for (const t of targets) consider(edge, t)
    if (grid && grid > 0) consider(edge, Math.round(edge / grid) * grid)
  }
  return best
}

/**
 * Snap `box` against the static `targets` (and optional grid). Returns the position
 * delta to apply plus the guide lines to draw. Best (nearest) snap per axis.
 */
export function snapBox(box: Rect, targets: Frame[], config: SnapConfig = {}): SnapResult {
  const threshold = config.threshold ?? 6
  const targetXs = targets.flatMap(edgesX)
  const targetYs = targets.flatMap(edgesY)

  const sx = bestSnap(edgesX(box), targetXs, config.grid, threshold)
  const sy = bestSnap(edgesY(box), targetYs, config.grid, threshold)

  return {
    dx: sx?.delta ?? 0,
    dy: sy?.delta ?? 0,
    guidesV: sx ? [sx.guide] : [],
    guidesH: sy ? [sy.guide] : [],
  }
}
