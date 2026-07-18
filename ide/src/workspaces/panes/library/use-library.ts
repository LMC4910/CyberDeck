// Library authoring context (CD-404). Resolves the one live model / selection / undo /
// canvas-view the Design canvas uses (via the seam) and derives the insert target:
// the first page, centered on the visible canvas rect when the Design surface is
// mounted, else the page centre. Double-click / Enter in a tab inserts THERE, so a
// widget dropped from the Library lands in the open document exactly as Insert does.
import { useMemo, useSyncExternalStore } from 'react'
import {
  useProjectModel,
  useSelection,
  useUndo,
  useCanvasViewBus,
} from './registry-seam'
import { visibleWorldRect } from '@/shared/canvas'

export function useLibraryContext() {
  const model = useProjectModel()
  const engine = useSelection()
  const undo = useUndo()
  const viewBus = useCanvasViewBus()
  const pageId = useMemo(() => model.pages()[0]!.id, [model])

  // Insert point (world): the visible canvas centre if the Design surface is live,
  // otherwise the page centre. The Library is usually the active workspace (canvas
  // unmounted → size 0), so this falls back to the page centre — the same fallback
  // the Insert panel uses.
  const center = () => {
    const { transform, size } = viewBus.getView()
    if (size.w > 0) {
      const r = visibleWorldRect(transform, size)
      return { x: r.x + r.w / 2, y: r.y + r.h / 2 }
    }
    const canvas = model.page(pageId)?.canvas
    return { x: (canvas?.w ?? 400) / 2, y: (canvas?.h ?? 300) / 2 }
  }

  return { model, engine, undo, pageId, center }
}

/** Subscribe a component to the live ProjectModel (styles registry, use-counts, …). */
export function useModelRevision(model: { subscribe: (cb: () => void) => () => void; revision: number }): number {
  return useSyncExternalStore((cb) => model.subscribe(cb), () => model.revision)
}
