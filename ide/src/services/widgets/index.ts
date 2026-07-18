// Widget platform service barrel (CD-419+). The headless loader/registry/validator
// live here (services layer, injected-port design per CD-118); the React host and
// error boundary (CD-420) live under src/widgets/host. Assembly (boot-sequence.ts)
// wires the ports: WidgetManifestsRepository → discover, the ajv validator →
// validate, NotificationService → notify, TypedEventBus → the registry's emit.
export {
  WidgetLoader,
  satisfiesPlatform,
  type WidgetLoaderOptions,
  type WidgetLoadResult,
  type WidgetLoadNotice,
  type WidgetLoadNoticeCode,
} from './widget-loader'
export { WidgetRegistry, type WidgetRegistryOptions } from './widget-registry'
export {
  fromAjv,
  structuralManifestValidator,
  validatePermissions,
  type ManifestValidator,
  type ManifestValidationResult,
  type AjvValidateFn,
} from './manifest-validator'
export { resolveDependencies, type ResolveResult } from './dependency-resolver'
export {
  KNOWN_CAPABILITIES,
  isKnownCapability,
  type WidgetManifest,
  type WidgetCapability,
} from './types'
// CD-422 permissions.
export {
  WidgetPermissionsStore,
  type WidgetPermissionsStoreOptions,
} from './permissions-store'
export {
  WidgetCapabilityBroker,
  type WidgetCapabilityBrokerOptions,
} from './capability-broker'
export {
  WidgetPermissionError,
  WidgetPermissionDeniedError,
  type PermissionDecision,
  type PermissionState,
  type WidgetPermissionRequest,
  type WidgetPermissionPrompt,
} from './permissions'
