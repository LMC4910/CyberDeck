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
  type PreferencesDialogProps,
  type PreferencesTab,
} from './preferences'
