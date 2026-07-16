// Selection store + engine (CD-305) — the single selection source (AUDIT C2).
export {
  createSelectionStore,
  selectionMode,
  isSelected,
  primaryWidgetId,
  EMPTY_SELECTION,
  type SelectionState,
  type SelectionKind,
  type SelectionMode,
} from './selection-store'
export { SelectionEngine, type ClickModifiers } from './selection-engine'
export {
  frameIntersectsRect,
  frameCenter,
  pointInPolygon,
  rectFromCorners,
  type Rect,
  type Point,
} from './geometry'
