// Widget permissions model (CD-422). Shared types + errors for the grant/deny
// store, the capability broker, and the UI. Two distinct failure modes, by design:
//  • undeclared capability  → WidgetPermissionError, thrown *synchronously* — a
//    programming error (the widget asked for a capability its manifest never
//    declared). The AC's "undeclared API access throws" lands here.
//  • declared but denied     → WidgetPermissionDeniedError — a *policy* block the
//    UI surfaces with a visible reason; the widget degrades, it doesn't crash.
import type { WidgetCapability } from './types'

export type PermissionDecision = 'granted' | 'denied'
/** Store view: a capability the widget declared but the user hasn't decided yet. */
export type PermissionState = PermissionDecision | 'unset'

export interface WidgetPermissionRequest {
  widgetId: string
  capability: WidgetCapability
  /** Human context shown in the prompt / block reason. */
  reason?: string
}

/** Prompt port — the UI resolves it with the user's choice. Assembly-injected. */
export type WidgetPermissionPrompt = (
  request: WidgetPermissionRequest,
) => Promise<PermissionDecision>

/** Undeclared capability access — a dev-facing programming error (thrown). */
export class WidgetPermissionError extends Error {
  readonly widgetId: string
  readonly capability: string
  constructor(widgetId: string, capability: string, declared: readonly string[]) {
    super(
      `widget "${widgetId}" accessed undeclared capability "${capability}". ` +
        `Declared: [${declared.join(', ') || 'none'}]. Add it to the manifest's permissions to use it.`,
    )
    this.name = 'WidgetPermissionError'
    this.widgetId = widgetId
    this.capability = capability
  }
}

/** Declared-but-denied access — a policy block carrying a surfaced reason. */
export class WidgetPermissionDeniedError extends Error {
  readonly widgetId: string
  readonly capability: string
  readonly reason: string
  constructor(widgetId: string, capability: WidgetCapability, reason: string) {
    super(reason)
    this.name = 'WidgetPermissionDeniedError'
    this.widgetId = widgetId
    this.capability = capability
    this.reason = reason
  }
}
