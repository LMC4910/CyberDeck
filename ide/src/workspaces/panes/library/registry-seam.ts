// ── THE Library ↔ registry seam (CD-404) ────────────────────────────────────
// This module is the *single* place the Library workspace reaches across into the
// deck-designer feature. Every other file under `library/` imports the registries,
// insert operations, and authoring hooks from HERE — never directly from
// `../deck-designer/*`. That keeps the cross-feature coupling to one isolated file.
//
// Single source of truth: we re-export the *live* registry values/functions by
// reference (not copies), so a change to a registry (e.g. a new INSERT_CATALOG
// entry) surfaces in the Library with zero extra wiring — proven in library.test.tsx.
//
// CD-421 (Widget platform: registry→surfaces wiring) re-points THIS FILE at the
// platform WidgetManifestRepository. When it lands, only this seam changes; the tabs,
// tiles, favorites, search and preview cards stay exactly as they are.

// Components registry (CD-315 insert catalog) + insert op.
export {
  INSERT_CATALOG,
  insertManifest,
  type InsertManifest,
} from '../deck-designer/insert-catalog'

// Styles registry (CD-321) + recolor/link ops + resolution helpers.
export {
  STYLE_KINDS,
  setStyleProp,
  linkStyle,
  effectiveStyleProps,
  type StyleCtx,
} from '../deck-designer/style-ops'

// Symbols registry (CD-322) + insert op + live use-count.
export {
  SYMBOL_CATALOG,
  SYMBOL_GROUPS,
  insertSymbol,
  symbolUseCount,
  type SymbolAsset,
  type SymbolGroup,
} from '../deck-designer/symbol-catalog'

// Authoring context hooks. The App mounts these providers around every workspace
// (see App.tsx), so the Library — like the Insert panel — resolves the one live
// ProjectModel / SelectionEngine / UndoStack / CanvasViewBus the canvas uses.
export { useProjectModel } from '../deck-designer/use-project-model'
export { useSelection } from '../deck-designer/use-selection'
export { useUndo } from '../deck-designer/use-undo'
export { useCanvasViewBus } from '../deck-designer/use-canvas-view'
