// Touch simulation model (CD-418). Pure helpers the preview uses to turn a press on a
// published widget into a tap-vs-hold verb + an event-readout entry. Kept pure so the
// gesture rules are unit-tested without a DOM; the visual press-scale/ripple lives in
// the LayoutView, the readout in the PreviewScreen.
export type TouchGesture = 'tap' | 'hold'

export interface TouchSimEvent {
  widgetId: string
  type: string
  gesture: TouchGesture
  /** Human verb shown in the readout, e.g. "pressed" / "held toggle". */
  verb: string
  ts: number
}

/** Press ≥ this long reads as a hold rather than a tap. */
export const HOLD_MS = 500

/** Classify a press by its duration. */
export function classifyTouch(downTs: number, upTs: number, holdMs = HOLD_MS): TouchGesture {
  return upTs - downTs >= holdMs ? 'hold' : 'tap'
}

/** Kind-specific verb for a gesture on a widget type (the interaction the player runs). */
export function verbFor(type: string, gesture: TouchGesture): string {
  const base = type.split('.').at(-1) ?? type
  if (gesture === 'hold') return `held ${base}`
  switch (base) {
    case 'button':
      return 'pressed'
    case 'toggle':
      return 'toggled'
    case 'slider':
      return 'adjusted'
    case 'input':
      return 'focused'
    default:
      return `tapped ${base}`
  }
}
