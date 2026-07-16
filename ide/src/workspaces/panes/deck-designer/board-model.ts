// Board-model selector (CD-314). ONE memoized projection of the page a widget board
// needs — id, frame, type, color, hidden, plus the world bounds. The minimap and the
// Live Mirror both render from this single selector, so both stay in sync on any
// board change (AC).
import { useMemo, useSyncExternalStore } from 'react'
import type { ProjectModel, Frame } from '@/shared/project'
import { boundingFrame } from './transform-math'

export interface BoardCell {
  id: string
  frame: Frame
  type: string
  color?: string
  hidden: boolean
}

export interface BoardModel {
  cells: BoardCell[]
  /** World bounds: the page canvas if set, else the widgets' bounding box. */
  bounds: { w: number; h: number }
}

export function selectBoardModel(model: ProjectModel, pageId: string): BoardModel {
  const page = model.page(pageId)
  const widgets = page?.widgets ?? []
  const cells: BoardCell[] = widgets.map((w) => {
    const cfg = (w.config ?? {}) as { colorLabel?: string; hidden?: boolean }
    return { id: w.id, frame: w.frame, type: w.type, color: cfg.colorLabel, hidden: !!cfg.hidden }
  })
  let bounds = { w: page?.canvas?.w ?? 0, h: page?.canvas?.h ?? 0 }
  if (!bounds.w || !bounds.h) {
    const box = boundingFrame(widgets.map((w) => w.frame))
    bounds = box ? { w: box.x + box.w, h: box.y + box.h } : { w: 1, h: 1 }
  }
  return { cells, bounds }
}

/** Subscribed, memoized board model — recomputes only when the document changes. */
export function useBoardModel(model: ProjectModel, pageId: string): BoardModel {
  const rev = useSyncExternalStore((cb) => model.subscribe(cb), () => model.revision)
  return useMemo(() => selectBoardModel(model, pageId), [model, pageId, rev])
}
