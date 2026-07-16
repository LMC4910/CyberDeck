// PanZoomSurface (CD-301) — a focusable viewport that hosts a world layer whose CSS
// transform is driven by usePanZoom. Children render in WORLD coordinates; the
// surface handles all pan/zoom gestures. Consumer-agnostic: the authoring canvas and
// the Flows graph (CD-410) both mount it. A render-prop variant exposes the live
// transform + actions so consumers can draw overlays (rulers, guides, minimap).
import { forwardRef, useImperativeHandle, useRef, type ReactNode } from 'react'
import { toCssTransform, type ViewTransform } from './view-transform'
import { usePanZoom, type PanZoomActions, type UsePanZoomOptions } from './use-pan-zoom'
import './canvas.css'

export interface PanZoomSurfaceProps extends UsePanZoomOptions {
  /** Rendered inside the world layer (world coordinates). */
  children?: ReactNode | ((ctx: { transform: ViewTransform; actions: PanZoomActions }) => ReactNode)
  /** Fixed-position overlay rendered in SCREEN space, above the world layer. */
  overlay?: ReactNode | ((ctx: { transform: ViewTransform; actions: PanZoomActions }) => ReactNode)
  className?: string
  'aria-label'?: string
}

export interface PanZoomHandle {
  actions: PanZoomActions
  getTransform: () => ViewTransform
  /** The surface DOM element (for consumers that need screen↔world conversion). */
  getElement: () => HTMLElement | null
}

export const PanZoomSurface = forwardRef<PanZoomHandle, PanZoomSurfaceProps>(
  function PanZoomSurface(props, ref) {
    const { children, overlay, className, 'aria-label': ariaLabel, ...options } = props
    const surfaceRef = useRef<HTMLDivElement>(null)
    const { transform, actions, handlers, isPanning, handArmed } = usePanZoom(
      surfaceRef,
      options as UsePanZoomOptions,
    )

    useImperativeHandle(
      ref,
      () => ({ actions, getTransform: () => transform, getElement: () => surfaceRef.current }),
      [actions, transform],
    )

    const ctx = { transform, actions }
    const cursor = isPanning ? 'grabbing' : handArmed ? 'grab' : undefined

    return (
      <div
        ref={surfaceRef}
        className={['pz-surface', className].filter(Boolean).join(' ')}
        tabIndex={0}
        role="application"
        aria-label={ariaLabel ?? 'Canvas'}
        data-panning={isPanning || undefined}
        style={cursor ? { cursor } : undefined}
        {...handlers}
      >
        <div className="pz-world" style={{ transform: toCssTransform(transform) }}>
          {typeof children === 'function' ? children(ctx) : children}
        </div>
        {overlay != null && (
          <div className="pz-overlay">
            {typeof overlay === 'function' ? overlay(ctx) : overlay}
          </div>
        )}
      </div>
    )
  },
)
