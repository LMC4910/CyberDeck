// Widget host contract (CD-420). The React surface that lazy-loads a widget module
// on first render, isolates it behind an error boundary, and disposes its scope on
// unmount. The headless loader/registry live in services/widgets (CD-419); this
// layer consumes the validated WidgetManifest and a module resolver injected by
// assembly (CD-421 will feed it from the registry).
import type { ComponentType } from 'react'
import type { WidgetManifest } from '@/services/widgets'
import type { WidgetScope } from './widget-scope'

/** Props every lazy-loaded widget module receives from the host. */
export interface WidgetModuleProps {
  manifest: WidgetManifest
  /** Register subscriptions/timers here — disposed on unmount/retry. */
  scope: WidgetScope
  /** Instance config (validated against manifest.configSchema upstream). */
  config?: unknown
}

/** A widget module: a default-exported React component. */
export type WidgetComponent = ComponentType<WidgetModuleProps>
export interface WidgetModule {
  default: WidgetComponent
}

/**
 * Resolves a manifest to its (lazily-imported) module. Assembly wires this to a
 * per-manifest dynamic `import()` keyed on `lifecycle.chunk`; each widget is its
 * own code-split chunk, loaded only when first rendered.
 */
export type WidgetModuleResolver = (manifest: WidgetManifest) => Promise<WidgetModule>

/** Lifecycle phase a telemetry breadcrumb marks. */
export type WidgetPhase = 'load-start' | 'load-ok' | 'load-error' | 'render-error'

/** A telemetry breadcrumb — assembly bridges this to the event bus / inspector. */
export interface WidgetBreadcrumb {
  widgetId: string
  phase: WidgetPhase
  ts: number
  error?: string
  componentStack?: string
}
