// Transform gestures (CD-306). Pointer controllers for multi-drag, 8-handle resize,
// and rotation. Every gesture:
//   • converts screen deltas to world via the live zoom (zoom-correct),
//   • applies live to the model, rAF-batched (one apply per frame, not per event),
//   • records exactly ONE undo entry on pointer-up whose inverse restores the
//     starting frames/rotations of all moved widgets.
// Locked widgets never move. Rotation snaps to 15° unless ⇧ (free).
//
// Window listeners are attached once; all gesture logic reads refs (a ctx ref keeps
// props fresh) so there is no per-gesture add/removeEventListener churn and no
// callback dependency cycle.
import { useCallback, useEffect, useRef, useState } from 'react'
import { screenToWorld, type ViewTransform } from '@/shared/canvas'
import type { ProjectModel, Frame, WidgetInstance } from '@/shared/project'
import type { SelectionEngine } from '@/stores'
import type { UndoStack } from '@/platform/undo'
import {
  dragFrame,
  resizeFrame,
  rotationFromPointer,
  screenDeltaToWorld,
  frameCenter,
  boundingFrame,
  type ResizeHandle,
  type Vec,
} from './transform-math'

export type GestureKind = 'drag' | 'resize' | 'rotate'

interface Options {
  model: ProjectModel
  engine: SelectionEngine
  undo: UndoStack
  pageId: string
  element: HTMLElement | null
  getTransform: () => ViewTransform
}

interface ActiveGesture {
  kind: GestureKind
  handle?: ResizeHandle
  startPointerWorld: Vec
  startPointerClient: Vec
  startFrames: Map<string, Frame>
  startRotations: Map<string, number>
  center: Vec
  moved: boolean
  free: boolean
  pendingClickId: string | null
}

const rotationOf = (w: WidgetInstance): number => {
  const r = (w.config as { rotation?: number } | undefined)?.rotation
  return typeof r === 'number' ? r : 0
}

export interface TransformGestures {
  onWidgetPointerDown: (id: string, e: React.PointerEvent) => void
  beginResize: (handle: ResizeHandle, e: React.PointerEvent) => void
  beginRotate: (e: React.PointerEvent) => void
  active: GestureKind | null
}

export function useTransformGestures(options: Options): TransformGestures {
  const ctx = useRef(options)
  ctx.current = options
  const gesture = useRef<ActiveGesture | null>(null)
  const rafId = useRef<number | null>(null)
  const latestClient = useRef<Vec | null>(null)
  const [active, setActive] = useState<GestureKind | null>(null)

  const toWorld = useCallback((clientX: number, clientY: number): Vec => {
    const { element, getTransform } = ctx.current
    const rect = element?.getBoundingClientRect()
    return screenToWorld(getTransform(), { x: clientX - (rect?.left ?? 0), y: clientY - (rect?.top ?? 0) })
  }, [])

  const movingFrames = useCallback((): Map<string, Frame> => {
    const { model, engine } = ctx.current
    const m = new Map<string, Frame>()
    for (const id of engine.state.ids) {
      const w = model.widget(id)
      if (w && !w.locked) m.set(id, w.frame)
    }
    return m
  }, [])

  // Attach the window move/up listeners once; they operate purely on refs.
  useEffect(() => {
    const apply = () => {
      const g = gesture.current
      const client = latestClient.current
      if (!g || !client) return
      const { model, getTransform } = ctx.current
      if (g.kind === 'drag') {
        const world = toWorld(client.x, client.y)
        const d: Vec = { x: world.x - g.startPointerWorld.x, y: world.y - g.startPointerWorld.y }
        for (const [id, start] of g.startFrames) model.updateFrame(id, dragFrame(start, d))
      } else if (g.kind === 'resize' && g.handle) {
        const dScreen: Vec = { x: client.x - g.startPointerClient.x, y: client.y - g.startPointerClient.y }
        const d = screenDeltaToWorld(dScreen, getTransform().scale)
        for (const [id, start] of g.startFrames) model.updateFrame(id, resizeFrame(start, g.handle, d))
      } else if (g.kind === 'rotate') {
        const deg = rotationFromPointer(g.center, toWorld(client.x, client.y), g.free)
        for (const id of g.startRotations.keys()) model.updateConfig(id, { rotation: deg })
      }
    }

    const scheduleApply = () => {
      if (rafId.current != null) return
      const raf =
        typeof requestAnimationFrame === 'function'
          ? requestAnimationFrame
          : (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0) as unknown as number
      rafId.current = raf(() => {
        rafId.current = null
        apply()
      })
    }

    const finalize = () => {
      const g = gesture.current
      if (!g) return
      if (rafId.current != null) {
        const caf = typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame : clearTimeout
        caf(rafId.current)
        rafId.current = null
      }
      apply()
      const { model, engine, undo } = ctx.current

      if (g.moved) {
        // One undo entry: apply = restore-end (already applied → no-op), inverse =
        // restore-start. Captures the whole gesture as a single history step.
        const endFrames = new Map<string, Frame>()
        const endRotations = new Map<string, number>()
        for (const id of g.startFrames.keys()) {
          const w = model.widget(id)
          if (w) endFrames.set(id, w.frame)
        }
        for (const id of g.startRotations.keys()) {
          const w = model.widget(id)
          if (w) endRotations.set(id, rotationOf(w))
        }
        const label = g.kind === 'drag' ? 'Move' : g.kind === 'resize' ? 'Resize' : 'Rotate'
        undo.execUndoable(label, () => {
          for (const [id, f] of endFrames) model.updateFrame(id, f)
          for (const [id, r] of endRotations) model.updateConfig(id, { rotation: r })
          return () => {
            for (const [id, f] of g.startFrames) model.updateFrame(id, f)
            for (const [id, r] of g.startRotations) model.updateConfig(id, { rotation: r })
          }
        })
      } else if (g.pendingClickId && engine.state.ids.length > 1) {
        engine.selectOnly(g.pendingClickId)
      }

      gesture.current = null
      latestClient.current = null
      setActive(null)
    }

    const onMove = (e: PointerEvent) => {
      const g = gesture.current
      if (!g) return
      if (Math.hypot(e.clientX - g.startPointerClient.x, e.clientY - g.startPointerClient.y) >= 3) g.moved = true
      g.free = e.shiftKey
      latestClient.current = { x: e.clientX, y: e.clientY }
      scheduleApply()
    }
    const onUp = () => finalize()

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      if (rafId.current != null) {
        const caf = typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame : clearTimeout
        caf(rafId.current)
      }
    }
  }, [toWorld])

  const start = useCallback((g: ActiveGesture) => {
    gesture.current = g
    latestClient.current = g.startPointerClient
    setActive(g.kind)
  }, [])

  const onWidgetPointerDown = useCallback(
    (id: string, e: React.PointerEvent) => {
      const { model, engine, pageId } = ctx.current
      const mods = { shift: e.shiftKey, meta: e.metaKey || e.ctrlKey }
      if (mods.shift || mods.meta) {
        engine.click(id, mods, model.widgetsOf(pageId).map((w) => w.id))
        return
      }
      const wasSelected = engine.state.ids.includes(id)
      if (!wasSelected) engine.selectOnly(id)
      e.preventDefault()
      const startFrames = movingFrames()
      if (startFrames.size === 0) return
      start({
        kind: 'drag',
        startPointerWorld: toWorld(e.clientX, e.clientY),
        startPointerClient: { x: e.clientX, y: e.clientY },
        startFrames,
        startRotations: new Map(),
        center: { x: 0, y: 0 },
        moved: false,
        free: false,
        pendingClickId: wasSelected ? id : null,
      })
    },
    [movingFrames, start, toWorld],
  )

  const beginResize = useCallback(
    (handle: ResizeHandle, e: React.PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const startFrames = movingFrames()
      if (startFrames.size === 0) return
      start({
        kind: 'resize',
        handle,
        startPointerWorld: toWorld(e.clientX, e.clientY),
        startPointerClient: { x: e.clientX, y: e.clientY },
        startFrames,
        startRotations: new Map(),
        center: { x: 0, y: 0 },
        moved: false,
        free: false,
        pendingClickId: null,
      })
    },
    [movingFrames, start, toWorld],
  )

  const beginRotate = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const { model } = ctx.current
      const frames = [...movingFrames().values()]
      const box = boundingFrame(frames)
      if (!box) return
      const startRotations = new Map<string, number>()
      for (const id of movingFrames().keys()) startRotations.set(id, rotationOf(model.widget(id)!))
      start({
        kind: 'rotate',
        startPointerWorld: toWorld(e.clientX, e.clientY),
        startPointerClient: { x: e.clientX, y: e.clientY },
        startFrames: new Map(),
        startRotations,
        center: frameCenter(box),
        moved: false,
        free: e.shiftKey,
        pendingClickId: null,
      })
    },
    [movingFrames, start, toWorld],
  )

  return { onWidgetPointerDown, beginResize, beginRotate, active }
}
