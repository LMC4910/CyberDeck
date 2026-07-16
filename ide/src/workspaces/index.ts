// workspaces layer — one feature folder per workspace + the shell chrome that
// hosts them. See ide/README.md for the boundary matrix.
export { WorkspaceRail, type WorkspaceRailProps } from './workspace-rail'
export { PaneHost, type PaneHostProps } from './pane-host'
export { WORKSPACE_CONTRIBUTIONS } from './workspace-contributions'
export { Breadcrumb, type BreadcrumbProps } from './chrome/breadcrumb'
export { StatusBar, type StatusBarProps } from './chrome/status-bar'
export {
  crumbFor,
  BREADCRUMB_SEGMENTS,
  type CrumbSegment,
  type CrumbContext,
} from './chrome/breadcrumb-segments'
export { CommandPalette, type CommandPaletteProps } from './palette'
export { fuzzyScore, fuzzyFilter, PaletteRecents } from './palette'
export {
  PreferencesDialog,
  KeyboardPane,
  useConfigValue,
  searchSettings,
  SETTINGS_INDEX,
  type PreferencesDialogProps,
  type PreferencesTab,
  type SettingEntry,
} from './preferences'
export { Toaster, NotificationDrawer, type ToasterProps, type NotificationDrawerProps } from './notifications'
export {
  ResizablePanel,
  panelFor,
  setPanelWidth,
  togglePanel,
  setPanelVisible,
  clampWidth,
  PANEL_MIN,
  PANEL_MAX,
  PANEL_DEFAULT,
  type ResizablePanelProps,
  type PanelSide,
  type PanelState,
  type PanelsState,
} from './panels'
export { DockHost, computeInsets, type DockHostProps, type Insets } from './dock'
export {
  ProjectModelProvider,
  useProjectModel,
  useAllWidgetIds,
  useRootWidgetIds,
  useWidget,
  usePage,
} from './panes/deck-designer/use-project-model'
export { SelectionProvider, useSelection, useSelectionState } from './panes/deck-designer/use-selection'
export { UndoProvider, useUndo } from './panes/deck-designer/use-undo'
export { CanvasSettingsProvider, useCanvasSettings, type CanvasSettings } from './panes/deck-designer/use-canvas-settings'
export { CommandsProvider, useCommands } from './panes/deck-designer/use-commands'
export { registerCanvasCommands, CANVAS_COMMANDS, type CanvasCtx } from './panes/deck-designer/canvas-commands'
export { generatePerfProject } from './panes/deck-designer/perf-fixture'
export { LayersPanel } from './panes/deck-designer/layers-panel'
export { InsertPanel } from './panes/deck-designer/insert-panel'
export { SymbolsPanel } from './panes/deck-designer/symbols-panel'
export { InspectorPanel as DeckInspectorPanel } from './panes/deck-designer/inspector-panel'
export { Minimap } from './panes/deck-designer/minimap'
export { LiveMirror } from './panes/deck-designer/live-mirror'
export { CanvasViewProvider } from './panes/deck-designer/use-canvas-view'
export {
  LayoutPresetMenu,
  BUILTIN_PRESETS,
  applyPreset,
  currentPresetName,
  capturePreset,
  CUSTOM,
  type LayoutPresetMenuProps,
  type LayoutPreset,
} from './panels'
