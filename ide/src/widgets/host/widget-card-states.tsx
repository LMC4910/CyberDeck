// Standard widget card states (CD-420): loading / empty / error / fallback. Every
// widget on a surface renders one of these while it resolves, has nothing to show,
// crashes, or degrades. `data-widget-state` is the stable hook for tests and the
// dead-control sweep. Presentational only — no data, no side effects.
import type { ReactNode } from 'react'
import './widget-card.css'

function Card({ state, children }: { state: string; children: ReactNode }) {
  return (
    <div className={`wgt-card wgt-card--${state}`} data-widget-state={state} role="group">
      {children}
    </div>
  )
}

/** First-render / re-import in flight. */
export function WidgetLoadingCard({ widgetId }: { widgetId: string }) {
  return (
    <Card state="loading">
      <span className="wgt-card__spinner" aria-hidden="true" />
      <span className="wgt-card__label" aria-live="polite">
        Loading {widgetId}…
      </span>
    </Card>
  )
}

/** No widget/manifest bound to this slot. */
export function WidgetEmptyCard({ hint }: { hint?: string } = {}) {
  return (
    <Card state="empty">
      <span className="wgt-card__label">{hint ?? 'No widget'}</span>
    </Card>
  )
}

/** Widget threw (load or render). Shows the reason and a retry affordance. */
export function WidgetErrorCard({
  widgetId,
  error,
  onRetry,
}: {
  widgetId: string
  error: Error
  onRetry: () => void
}) {
  return (
    <Card state="error">
      <span className="wgt-card__title">{widgetId} failed</span>
      <span className="wgt-card__reason" data-widget-error>
        {error.message || String(error)}
      </span>
      <button type="button" className="wgt-card__retry" onClick={onRetry}>
        Retry
      </button>
    </Card>
  )
}

/** Generic degraded state (e.g. module resolved with no renderable component). */
export function WidgetFallbackCard({
  widgetId,
  reason,
}: {
  widgetId: string
  reason?: string
}) {
  return (
    <Card state="fallback">
      <span className="wgt-card__title">{widgetId} unavailable</span>
      {reason ? <span className="wgt-card__reason">{reason}</span> : null}
    </Card>
  )
}
