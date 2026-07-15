// usePanZoom (CD-301) — the interaction layer over the pure ViewTransform math.
// It owns a transform value and wires the gestures a canvas surface needs:
//   • wheel pan (trackpad two-finger), ⌘/ctrl+wheel = zoom-to-cursor
//   • Space-drag / hand-tool / middle-button pan
//   • keyboard ⌘0 (reset/fit), ⌘= / ⌘+ (zoom in), ⌘- (zoom out)
// It is consumer-agnostic: the authoring canvas and the Flows graph (CD-410) both
// drive it. The only DOM it touches is the surface element passed by ref, so it can
// compute cursor-relative anchors and its own viewport size.
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import {
  IDENTITY,
  DEFAULT_ZOOM_LIMITS,
  fit,
  panBy,
  resetToActualSize,
  zoomByFactor,
  zoomAtPoint,
  type Point,
  type Rect,
  type Size,
  type ViewTransform,
  type ZoomLimits,
} from './view-transform'

export interface UsePanZoomOptions {
  limits?: ZoomLimits
  initial?: ViewTransform
  /** Multiplicative step per zoom-in/out command (default 1.2). */
  zoomStep?: number
  /** Called whenever the transform changes (persist/broadcast). */
  onChange?: (t: ViewTransform) => void
  /**
   * World bounds used by reset (⌘0). Return null (or omit) to reset to 100 %
   * centered instead of fitting content.
   */
  getFitBounds?: () => Rect | null
  /** Wheel deltaY→zoom sensitivity when zoom-modifier held (default 0.0015). */
  wheelZoomSensitivity?: number
}

export interface PanZoomActions {
  zoomIn: (anchor?: Point) => void
  zoomOut: (anchor?: Point) => void
  zoomTo: (scale: number, anchor?: Point) => void
  reset: () => void
  fitTo: (bounds: Rect) => void
  setTransform: (t: ViewTransform) => void
}

/** Handlers the consumer spreads onto its surface element. */
export interface PanZoomHandlers {
  onPointerDown: (e: React.PointerEvent) => void
  onPointerMove: (e: React.PointerEvent) => void
  onPointerUp: (e: React.PointerEvent) => void
  onPointerCancel: (e: React.PointerEvent) => void
  onKeyDown: (e: React.KeyboardEvent) => void
}

export interface PanZoomState {
  transform: ViewTransform
  actions: PanZoomActions
  handlers: PanZoomHandlers
  /** True while a hand/space/middle-button pan drag is in progress. */
  isPanning: boolean
  /** True while Space is held (hand tool armed). */
  handArmed: boolean
}

function surfaceSize(el: HTMLElement | null): Size {
  if (!el) return { w: 0, h: 0 }
  const r = el.getBoundingClientRect()
  return { w: r.width, h: r.height }
}

function centerOf(el: HTMLElement | null): Point {
  const { w, h } = surfaceSize(el)
  return { x: w / 2, y: h / 2 }
}

function clientToSurface(el: HTMLElement | null, clientX: number, clientY: number): Point {
  if (!el) return { x: clientX, y: clientY }
  const r = el.getBoundingClientRect()
  return { x: clientX - r.left, y: clientY - r.top }
}

export function usePanZoom(
  surfaceRef: RefObject<HTMLElement | null>,
  options: UsePanZoomOptions = {},
): PanZoomState {
  const {
    limits = DEFAULT_ZOOM_LIMITS,
    initial = IDENTITY,
    zoomStep = 1.2,
    onChange,
    getFitBounds,
    wheelZoomSensitivity = 0.0015,
  } = options

  const [transform, setTransformState] = useState<ViewTransform>(initial)
  const [isPanning, setIsPanning] = useState(false)
  const [handArmed, setHandArmed] = useState(false)

  // Keep the freshest transform in a ref so native (non-React) wheel listeners and
  // pointer-move handlers read current state without re-subscribing every render.
  const transformRef = useRef(transform)
  transformRef.current = transform
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const commit = useCallback((next: ViewTransform) => {
    setTransformState((prev) => {
      if (prev.scale === next.scale && prev.tx === next.tx && prev.ty === next.ty) {
        return prev
      }
      onChangeRef.current?.(next)
      return next
    })
  }, [])

  const zoomTo = useCallback(
    (scale: number, anchor?: Point) => {
      commit(zoomAtPoint(transformRef.current, anchor ?? centerOf(surfaceRef.current), scale, limits))
    },
    [commit, limits, surfaceRef],
  )

  const zoomIn = useCallback(
    (anchor?: Point) => {
      commit(zoomByFactor(transformRef.current, zoomStep, anchor ?? centerOf(surfaceRef.current), limits))
    },
    [commit, limits, surfaceRef, zoomStep],
  )

  const zoomOut = useCallback(
    (anchor?: Point) => {
      commit(zoomByFactor(transformRef.current, 1 / zoomStep, anchor ?? centerOf(surfaceRef.current), limits))
    },
    [commit, limits, surfaceRef, zoomStep],
  )

  const fitTo = useCallback(
    (bounds: Rect) => {
      commit(fit(bounds, surfaceSize(surfaceRef.current), 24, limits))
    },
    [commit, limits, surfaceRef],
  )

  const reset = useCallback(() => {
    const bounds = getFitBounds?.() ?? null
    const size = surfaceSize(surfaceRef.current)
    commit(bounds ? fit(bounds, size, 24, limits) : resetToActualSize(size))
  }, [commit, getFitBounds, limits, surfaceRef])

  const setTransform = useCallback((t: ViewTransform) => commit(t), [commit])

  // Native non-passive wheel listener so we can preventDefault (React's onWheel is
  // passive and cannot). Modifier+wheel zooms at the cursor; plain wheel pans.
  useEffect(() => {
    const el = surfaceRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (e.ctrlKey || e.metaKey) {
        const anchor = clientToSurface(el, e.clientX, e.clientY)
        commit(zoomByFactor(transformRef.current, Math.exp(-e.deltaY * wheelZoomSensitivity), anchor, limits))
      } else {
        commit(panBy(transformRef.current, -e.deltaX, -e.deltaY))
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [commit, limits, surfaceRef, wheelZoomSensitivity])

  // Space arms the hand tool (only while the surface owns focus, so pressing Space
  // in a field elsewhere never hijacks it).
  useEffect(() => {
    const el = surfaceRef.current
    if (!el) return
    const owned = () => el === document.activeElement || el.contains(document.activeElement)
    const onDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && owned() && !e.repeat) {
        e.preventDefault()
        setHandArmed(true)
      }
    }
    const onUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setHandArmed(false)
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
  }, [surfaceRef])

  // Pointer pan-drag (hand tool or middle button).
  const dragLast = useRef<Point | null>(null)
  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!(handArmed || e.button === 1)) return
      e.preventDefault()
      ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
      dragLast.current = { x: e.clientX, y: e.clientY }
      setIsPanning(true)
    },
    [handArmed],
  )
  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragLast.current) return
      const dx = e.clientX - dragLast.current.x
      const dy = e.clientY - dragLast.current.y
      dragLast.current = { x: e.clientX, y: e.clientY }
      commit(panBy(transformRef.current, dx, dy))
    },
    [commit],
  )
  const endPan = useCallback((e: React.PointerEvent) => {
    if (!dragLast.current) return
    dragLast.current = null
    setIsPanning(false)
    ;(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)
  }, [])

  // Keyboard zoom commands (⌘0 / ⌘= / ⌘+ / ⌘-). Scoped to the focused surface.
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return
      if (e.key === '0') {
        e.preventDefault()
        reset()
      } else if (e.key === '=' || e.key === '+') {
        e.preventDefault()
        zoomIn()
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault()
        zoomOut()
      }
    },
    [reset, zoomIn, zoomOut],
  )

  return {
    transform,
    isPanning,
    handArmed,
    actions: { zoomIn, zoomOut, zoomTo, reset, fitTo, setTransform },
    handlers: { onPointerDown, onPointerMove, onPointerUp: endPan, onPointerCancel: endPan, onKeyDown },
  }
}
