// Widget host surface barrel (CD-420). The React layer that lazy-loads, isolates,
// and disposes widget modules. Surfaces (board/canvas, CD-421) mount <WidgetHost>;
// assembly injects the module resolver + telemetry sink.
export { WidgetHost, type WidgetHostProps } from './widget-host'
export { WidgetScope } from './widget-scope'
export { WidgetErrorBoundary, type WidgetErrorBoundaryProps } from './widget-error-boundary'
export {
  WidgetLoadingCard,
  WidgetEmptyCard,
  WidgetErrorCard,
  WidgetFallbackCard,
} from './widget-card-states'
export type {
  WidgetModule,
  WidgetModuleProps,
  WidgetModuleResolver,
  WidgetComponent,
  WidgetBreadcrumb,
  WidgetPhase,
} from './types'
