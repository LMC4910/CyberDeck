// Widget permissions UI barrel (CD-422). The store + broker are headless in
// services/widgets; this layer is the React surface: the first-use prompt, the
// per-widget inspector list, and the Platform Inspector perms tab. Assembly wires
// broker.prompt → controller.prompt and mounts <WidgetPermissionPrompt> in the shell.
export { PermissionPromptController } from './prompt-controller'
export { WidgetPermissionPrompt, type WidgetPermissionPromptProps } from './permission-prompt'
export {
  WidgetPermissionsPanel,
  type WidgetPermissionsPanelProps,
} from './widget-permissions-panel'
export {
  PlatformPermissionsTab,
  type PlatformPermissionsTabProps,
} from './platform-permissions-tab'
export {
  usePermissionsSnapshot,
  usePermissionDecision,
} from './use-widget-permissions'
