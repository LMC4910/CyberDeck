// Canvas view bus (CD-314). A tiny observable that shares the authoring canvas's
// live pan/zoom transform + viewport size between the pane (which owns the
// PanZoomSurface) and dock tool windows rendered elsewhere in the shell (minimap,
// Live Mirror). The pane publishes its view + registers a navigator; the minimap
// reads the view to draw the viewport rect and calls centerOn() to pan.
import { IDENTITY, type Size, type ViewTransform, type Point } from '@/shared/canvas'

export interface CanvasView {
  transform: ViewTransform
  size: Size
}

export class CanvasViewBus {
  private view: CanvasView = { transform: IDENTITY, size: { w: 0, h: 0 } }
  private readonly listeners = new Set<() => void>()
  private navigator: ((world: Point) => void) | null = null

  getView(): CanvasView {
    return this.view
  }

  setView(transform: ViewTransform, size: Size): void {
    if (
      this.view.transform === transform &&
      this.view.size.w === size.w &&
      this.view.size.h === size.h
    ) {
      return
    }
    this.view = { transform, size }
    for (const l of this.listeners) l()
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** The pane registers how to center the canvas on a world point. */
  registerNavigator(fn: (world: Point) => void): () => void {
    this.navigator = fn
    return () => {
      if (this.navigator === fn) this.navigator = null
    }
  }

  /** Pan the canvas so `world` is centered (no-op if no pane is mounted). */
  centerOn(world: Point): void {
    this.navigator?.(world)
  }
}
