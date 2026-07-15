// Pan/zoom world transform (CD-301). Pure math shared by the authoring canvas now
// and the Flows graph at CD-410 — deliberately free of any consumer-specific code
// (AC: "no consumer-specific code inside the module"). The transform maps world
// coordinates to screen (viewport) coordinates:
//
//   screen = world * scale + translate
//
// so `screenToWorld` is the exact inverse. Every interaction (zoom-to-cursor, fit,
// keyboard zoom, wheel pan, hand drag) is expressed as a function returning a NEW
// transform; nothing mutates in place, which keeps it trivially testable and lets a
// React store treat transforms as immutable values.

export interface Point {
  x: number
  y: number
}

export interface Size {
  w: number
  h: number
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** world→screen affine (uniform scale + translation; no rotation/shear). */
export interface ViewTransform {
  /** uniform zoom factor; screen px per world px. */
  scale: number
  /** screen-space translation applied after scaling. */
  tx: number
  ty: number
}

export interface ZoomLimits {
  min: number
  max: number
}

/** Default zoom range for canvas surfaces: 5 %…6400 %. */
export const DEFAULT_ZOOM_LIMITS: ZoomLimits = { min: 0.05, max: 64 }

export const IDENTITY: ViewTransform = { scale: 1, tx: 0, ty: 0 }

export function clampScale(scale: number, limits: ZoomLimits = DEFAULT_ZOOM_LIMITS): number {
  return Math.min(limits.max, Math.max(limits.min, scale))
}

export function worldToScreen(t: ViewTransform, p: Point): Point {
  return { x: p.x * t.scale + t.tx, y: p.y * t.scale + t.ty }
}

export function screenToWorld(t: ViewTransform, p: Point): Point {
  return { x: (p.x - t.tx) / t.scale, y: (p.y - t.ty) / t.scale }
}

/**
 * Zoom to `nextScale` while keeping the world point currently under `anchor`
 * (a screen-space point, e.g. the cursor) pinned to that same screen position.
 * This is the invariant the unit tests assert: worldToScreen of the pre-zoom
 * world-point equals `anchor` before and after.
 */
export function zoomAtPoint(
  t: ViewTransform,
  anchor: Point,
  nextScale: number,
  limits: ZoomLimits = DEFAULT_ZOOM_LIMITS,
): ViewTransform {
  const scale = clampScale(nextScale, limits)
  const world = screenToWorld(t, anchor)
  return {
    scale,
    tx: anchor.x - world.x * scale,
    ty: anchor.y - world.y * scale,
  }
}

/** Multiply the current scale by `factor`, pinned at `anchor`. */
export function zoomByFactor(
  t: ViewTransform,
  factor: number,
  anchor: Point,
  limits: ZoomLimits = DEFAULT_ZOOM_LIMITS,
): ViewTransform {
  return zoomAtPoint(t, anchor, t.scale * factor, limits)
}

/** Pan by a screen-space delta (wheel/hand drag). */
export function panBy(t: ViewTransform, dxScreen: number, dyScreen: number): ViewTransform {
  return { scale: t.scale, tx: t.tx + dxScreen, ty: t.ty + dyScreen }
}

/**
 * Fit `content` (world-space bounds) inside `viewport` (screen size) with uniform
 * padding (screen px on each edge) and center it. An empty/zero-area content or
 * viewport falls back to the identity transform so callers never divide by zero.
 */
export function fit(
  content: Rect,
  viewport: Size,
  padding = 24,
  limits: ZoomLimits = DEFAULT_ZOOM_LIMITS,
): ViewTransform {
  const availW = viewport.w - padding * 2
  const availH = viewport.h - padding * 2
  if (content.w <= 0 || content.h <= 0 || availW <= 0 || availH <= 0) {
    return { ...IDENTITY }
  }
  const scale = clampScale(Math.min(availW / content.w, availH / content.h), limits)
  // Center the scaled content within the viewport.
  const contentCenter: Point = { x: content.x + content.w / 2, y: content.y + content.h / 2 }
  return {
    scale,
    tx: viewport.w / 2 - contentCenter.x * scale,
    ty: viewport.h / 2 - contentCenter.y * scale,
  }
}

/** Reset to 100 % with `worldOrigin` centered in the viewport. */
export function resetToActualSize(
  viewport: Size,
  worldOrigin: Point = { x: 0, y: 0 },
): ViewTransform {
  return {
    scale: 1,
    tx: viewport.w / 2 - worldOrigin.x,
    ty: viewport.h / 2 - worldOrigin.y,
  }
}

/** The world-space rectangle currently visible in `viewport` (for culling/minimap). */
export function visibleWorldRect(t: ViewTransform, viewport: Size): Rect {
  const topLeft = screenToWorld(t, { x: 0, y: 0 })
  return {
    x: topLeft.x,
    y: topLeft.y,
    w: viewport.w / t.scale,
    h: viewport.h / t.scale,
  }
}

/** CSS `transform` string for a world layer positioned at the screen origin. */
export function toCssTransform(t: ViewTransform): string {
  return `translate(${t.tx}px, ${t.ty}px) scale(${t.scale})`
}

export function transformsEqual(a: ViewTransform, b: ViewTransform): boolean {
  return a.scale === b.scale && a.tx === b.tx && a.ty === b.ty
}
