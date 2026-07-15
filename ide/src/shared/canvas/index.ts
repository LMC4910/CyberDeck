// Shared canvas / pan-zoom module (CD-301). Consumed by the authoring canvas now
// and the Flows graph at CD-410. No consumer-specific code lives here.
export {
  IDENTITY,
  DEFAULT_ZOOM_LIMITS,
  clampScale,
  worldToScreen,
  screenToWorld,
  zoomAtPoint,
  zoomByFactor,
  panBy,
  fit,
  resetToActualSize,
  visibleWorldRect,
  toCssTransform,
  transformsEqual,
  type Point,
  type Size,
  type Rect,
  type ViewTransform,
  type ZoomLimits,
} from './view-transform'
export {
  usePanZoom,
  type UsePanZoomOptions,
  type PanZoomActions,
  type PanZoomHandlers,
  type PanZoomState,
} from './use-pan-zoom'
export {
  PanZoomSurface,
  type PanZoomSurfaceProps,
  type PanZoomHandle,
} from './pan-zoom-surface'
