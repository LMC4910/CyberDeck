// Flows catalog + event ops (CD-328). Event→flow wiring lives in the document
// (doc.events[widgetId][gesture] = flowId), so it persists + restores. The flow list
// mocks the FlowRepository (CD-124); the Flows workspace + "open in Flows" deep link
// land at M4.
import type { ProjectModel } from '@/shared/project'
import type { UndoStack } from '@/platform/undo'

export const GESTURES = ['tap', 'hold', 'doubletap', 'valuechange'] as const
export type Gesture = (typeof GESTURES)[number]

export const GESTURE_LABELS: Record<Gesture, string> = {
  tap: 'Tap',
  hold: 'Hold',
  doubletap: 'Double-tap',
  valuechange: 'Value change',
}

export interface FlowStub {
  id: string
  name: string
  trigger: string
  action: string
}

export const FLOWS_CATALOG: FlowStub[] = [
  { id: 'flow_reset1', name: 'Reset Deck', trigger: 'tap', action: 'deck.reset' },
  { id: 'flow_mute01', name: 'Toggle Mute', trigger: 'tap', action: 'audio.toggleMute' },
  { id: 'flow_scene1', name: 'Switch Scene', trigger: 'tap', action: 'obs.switchScene' },
  { id: 'flow_boost1', name: 'FPS Boost', trigger: 'hold', action: 'system.boost' },
  { id: 'flow_snap01', name: 'Snapshot', trigger: 'doubletap', action: 'camera.snapshot' },
]

export function flowById(id: string): FlowStub | undefined {
  return FLOWS_CATALOG.find((f) => f.id === id)
}

export interface EventCtx {
  model: ProjectModel
  undo: UndoStack
}

export function assignFlow(ctx: EventCtx, widgetId: string, gesture: Gesture, flowId: string): void {
  ctx.undo.execUndoable('Wire event', () => ctx.model.setEvent(widgetId, gesture, flowId))
}

export function disconnectFlow(ctx: EventCtx, widgetId: string, gesture: Gesture): void {
  ctx.undo.execUndoable('Disconnect event', () => ctx.model.clearEvent(widgetId, gesture))
}

/** True if the widget wires any gesture to a flow (for a canvas/layers marker). */
export function hasAnyEvent(model: ProjectModel, widgetId: string): boolean {
  const e = model.eventsOf(widgetId)
  return !!e && Object.keys(e).length > 0
}
