// Per-widget error boundary (CD-420). Catches a render/load throw from a single
// widget, drops a telemetry breadcrumb, and renders a fallback — so one crashing
// widget is isolated and the board survives. The host resets it by remounting
// (a fresh `key` per retry attempt), which also re-runs the lazy import.
import { Component, type ErrorInfo, type ReactNode } from 'react'

export interface WidgetErrorBoundaryProps {
  widgetId: string
  /** Rendered in place of the widget when it throws. */
  fallback: (error: Error) => ReactNode
  /** Telemetry breadcrumb sink (assembly bridges to the bus/inspector). */
  onError?: (error: Error, componentStack: string) => void
  children: ReactNode
}

interface WidgetErrorBoundaryState {
  error: Error | null
}

export class WidgetErrorBoundary extends Component<
  WidgetErrorBoundaryProps,
  WidgetErrorBoundaryState
> {
  state: WidgetErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): WidgetErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info.componentStack ?? '')
  }

  render(): ReactNode {
    if (this.state.error) return this.props.fallback(this.state.error)
    return this.props.children
  }
}
