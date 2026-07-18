// Widget host (CD-420). Lazy-loads a widget module on first render (per-widget
// dynamic import ⇒ its own code-split chunk), shows the standard card states while
// it resolves, isolates render/load crashes behind a per-widget error boundary
// (fallback + retry + telemetry breadcrumb), and disposes the widget's scope
// (subscriptions/timers) on unmount and on retry. One widget can never crash the
// board or leak past its lifetime.
import { Suspense, lazy, useEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import type { WidgetManifest } from '@/services/widgets'
import { WidgetScope } from './widget-scope'
import { WidgetErrorBoundary } from './widget-error-boundary'
import { WidgetEmptyCard, WidgetErrorCard, WidgetLoadingCard } from './widget-card-states'
import type { WidgetBreadcrumb, WidgetModuleProps, WidgetModuleResolver } from './types'

export interface WidgetHostProps {
  /** The widget to mount. Null/undefined renders the empty card. */
  manifest?: WidgetManifest | null
  /** Resolves the manifest to its lazily-imported module (assembly-injected). */
  resolve: WidgetModuleResolver
  /** Telemetry breadcrumb sink — bridged to the bus/inspector at assembly. */
  onTelemetry?: (breadcrumb: WidgetBreadcrumb) => void
  /** Instance config forwarded to the widget module. */
  config?: unknown
}

export function WidgetHost({ manifest, resolve, onTelemetry, config }: WidgetHostProps) {
  const [attempt, setAttempt] = useState(0)

  // One scope per mounted instance; replaced (old one disposed) on retry.
  const scopeRef = useRef<WidgetScope>(null as unknown as WidgetScope)
  if (scopeRef.current == null) scopeRef.current = new WidgetScope()

  // Dispose the live scope when the host unmounts (the leak-test invariant).
  useEffect(() => {
    return () => scopeRef.current?.dispose()
  }, [])

  // Build the lazy component. `attempt` is a real dependency: a retry recreates it
  // so the dynamic import actually re-runs (React.lazy caches per component).
  const Lazy = useMemo<ComponentType<WidgetModuleProps> | null>(() => {
    if (!manifest) return null
    const target = manifest
    return lazy(async () => {
      onTelemetry?.({ widgetId: target.id, phase: 'load-start', ts: Date.now() })
      try {
        const mod = await resolve(target)
        onTelemetry?.({ widgetId: target.id, phase: 'load-ok', ts: Date.now() })
        return mod
      } catch (err) {
        onTelemetry?.({
          widgetId: target.id,
          phase: 'load-error',
          ts: Date.now(),
          error: err instanceof Error ? err.message : String(err),
        })
        throw err
      }
    })
    // `attempt` is intentionally a dependency: a retry must rebuild the lazy
    // component so the dynamic import re-runs (React.lazy caches per instance).
  }, [manifest, attempt, resolve])

  if (!manifest || !Lazy) return <WidgetEmptyCard />

  const retry = () => {
    // Fresh scope + fresh lazy import for the retried instance.
    scopeRef.current?.dispose()
    scopeRef.current = new WidgetScope()
    setAttempt((n) => n + 1)
  }

  return (
    // `key={attempt}` remounts the boundary on retry, clearing its caught error.
    <WidgetErrorBoundary
      key={attempt}
      widgetId={manifest.id}
      onError={(error, componentStack) =>
        onTelemetry?.({
          widgetId: manifest.id,
          phase: 'render-error',
          ts: Date.now(),
          error: error.message || String(error),
          componentStack,
        })
      }
      fallback={(error) => (
        <WidgetErrorCard widgetId={manifest.id} error={error} onRetry={retry} />
      )}
    >
      <Suspense fallback={<WidgetLoadingCard widgetId={manifest.id} />}>
        <Lazy manifest={manifest} scope={scopeRef.current} config={config} />
      </Suspense>
    </WidgetErrorBoundary>
  )
}
