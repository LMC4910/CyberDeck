// Canvas selection gestures (CD-305). Wires the surface's empty-canvas interactions
// to the SelectionEngine:
//   • left-drag on the background → marquee (⇧ = additive)
//   • ⌥ + drag → lasso
//   • background click (no drag) → clear
//   • Tab / ⇧Tab → cycle, Esc → clear, [ / ] → selection history, ⌘/Ctrl+A → all
// Space-drag stays pan (handled by PanZoomSurface); we suppress marquee while Space
// is held. Returns the in-progress marquee rect / lasso points (world coords) so the
// pane can draw the overlay.
import { useEffect, useRef, useState } from 'react'
import { screenToWorld, type ViewTransform } from '@/shared/canvas'
import { rectFromCorners, type Point, type Rect } from '@/stores'
import type { ProjectModel } from '@/shared/project'
import type { SelectionEngine } from '@/stores'

interface Options {
  element: HTMLElement | null
  getTransform: () => ViewTransform
  model: ProjectModel
  pageId: string
  engine: SelectionEngine
}

const DRAG_THRESHOLD = 4 // px in screen space before a drag counts as a marquee/lasso

export interface CanvasSelectionOverlay {
  marquee: Rect | null
  lasso: Point[] | null
}

export function useCanvasSelection({ element, getTransform, model, pageId, engine }: Options): CanvasSelectionOverlay {
  const [marquee, setMarquee] = useState<Rect | null>(null)
  const [lasso, setLasso] = useState<Point[] | null>(null)
  const spaceHeld = useRef(false)
  const drag = useRef<{
    mode: 'marquee' | 'lasso'
    startClient: Point
    startWorld: Point
    additive: boolean
    moved: boolean
    points: Point[]
  } | null>(null)

  useEffect(() => {
    if (!element) return
    const toWorld = (clientX: number, clientY: number): Point => {
      const r = element.getBoundingClientRect()
      return screenToWorld(getTransform(), { x: clientX - r.left, y: clientY - r.top })
    }

    const onKeyDownSpace = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceHeld.current = true
    }
    const onKeyUpSpace = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceHeld.current = false
    }

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 || spaceHeld.current) return
      // Only background drags marquee; a widget handles its own pointerdown.
      if ((e.target as HTMLElement)?.closest('[data-widget]')) return
      const startWorld = toWorld(e.clientX, e.clientY)
      drag.current = {
        mode: e.altKey ? 'lasso' : 'marquee',
        startClient: { x: e.clientX, y: e.clientY },
        startWorld,
        additive: e.shiftKey,
        moved: false,
        points: [startWorld],
      }
      element.setPointerCapture?.(e.pointerId)
    }

    const onPointerMove = (e: PointerEvent) => {
      const d = drag.current
      if (!d) return
      const dist = Math.hypot(e.clientX - d.startClient.x, e.clientY - d.startClient.y)
      if (dist >= DRAG_THRESHOLD) d.moved = true
      const world = toWorld(e.clientX, e.clientY)
      if (d.mode === 'marquee') {
        setMarquee(rectFromCorners(d.startWorld, world))
      } else {
        d.points.push(world)
        setLasso([...d.points])
      }
    }

    const onPointerUp = (e: PointerEvent) => {
      const d = drag.current
      if (!d) return
      drag.current = null
      element.releasePointerCapture?.(e.pointerId)
      setMarquee(null)
      setLasso(null)
      if (!d.moved) {
        engine.clear() // background click clears the selection
        return
      }
      if (d.mode === 'marquee') {
        engine.marqueeSelect(rectFromCorners(d.startWorld, toWorld(e.clientX, e.clientY)), model, pageId, d.additive)
      } else {
        engine.lassoSelect([...d.points, toWorld(e.clientX, e.clientY)], model, pageId, d.additive)
      }
    }

    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (e.key === 'Tab') {
        e.preventDefault()
        engine.cycle(e.shiftKey ? -1 : 1, model, pageId)
      } else if (e.key === 'Escape') {
        engine.clear()
      } else if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        engine.selectAll(model, pageId)
      } else if (e.key === '[') {
        engine.back()
      } else if (e.key === ']') {
        engine.forward()
      }
    }

    element.addEventListener('pointerdown', onPointerDown)
    element.addEventListener('pointermove', onPointerMove)
    element.addEventListener('pointerup', onPointerUp)
    element.addEventListener('keydown', onKeyDown)
    window.addEventListener('keydown', onKeyDownSpace)
    window.addEventListener('keyup', onKeyUpSpace)
    return () => {
      element.removeEventListener('pointerdown', onPointerDown)
      element.removeEventListener('pointermove', onPointerMove)
      element.removeEventListener('pointerup', onPointerUp)
      element.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keydown', onKeyDownSpace)
      window.removeEventListener('keyup', onKeyUpSpace)
    }
  }, [element, getTransform, model, pageId, engine])

  return { marquee, lasso }
}
