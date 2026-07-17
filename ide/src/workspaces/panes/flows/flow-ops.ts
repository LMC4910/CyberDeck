// Flow authoring operations (CD-409). Pure functions over (model, undo, service)
// that the tab strip invokes — the same shape the canvas uses (canvas-commands.ts).
// Every op records exactly ONE undo entry on the shell's stack, so ⌘Z/⌘⇧Z reverse a
// flow edit just like a canvas edit. Nothing here mutates the model outside an
// `execUndoable` — a direct mutation would be invisible to history (CD-329).
import type { UndoStack } from '@/platform/undo'
import { blankFlow, type FlowModel } from './flow-model'
import type { FlowsService } from './flows-service'

export interface FlowsCtx {
  model: FlowModel
  undo: UndoStack
  service: FlowsService
}

/** Next default label ("Flow 3") that does not collide with an existing one. */
function nextFlowLabel(model: FlowModel): string {
  const taken = new Set(model.list().map((f) => f.label))
  for (let n = model.list().length + 1; ; n++) {
    const label = `Flow ${n}`
    if (!taken.has(label)) return label
  }
}

/** Create an empty flow and append it to the tab strip. Returns its id. */
export function createFlow({ model, undo }: FlowsCtx, label?: string): string {
  // The id is minted ONCE, outside the undoable, so redo re-adds the SAME flow id
  // rather than minting a fresh key (CD-302 id contract).
  const doc = blankFlow(model.newFlowId(), label ?? nextFlowLabel(model))
  undo.execUndoable('New flow', () => model.addFlow(doc))
  return doc.id
}

/** Rename a flow. No-ops on an unchanged or blank label (the tab strip cancels
 *  instead of writing an empty name). */
export function renameFlow({ model, undo }: FlowsCtx, flowId: string, label: string): void {
  const trimmed = label.trim()
  const current = model.flow(flowId)
  if (!current || trimmed === '' || trimmed === current.label) return
  undo.execUndoable('Rename flow', () => model.renameFlow(flowId, trimmed))
}

/**
 * Arm or disarm a flow. The document's `armed` field carries the state for
 * round-trip; the port's `flows.arm` route drives the engine's TriggerManager, so
 * both the apply and the inverse notify it — undoing an arm really disarms.
 */
export function setFlowArmed({ model, undo, service }: FlowsCtx, flowId: string, armed: boolean): void {
  const current = model.flow(flowId)
  if (!current || (current.armed ?? false) === armed) return
  undo.execUndoable(armed ? 'Arm flow' : 'Disarm flow', () => {
    const inverse = model.setArmed(flowId, armed)
    void service.arm(flowId, armed)
    return () => {
      inverse()
      void service.arm(flowId, !armed)
    }
  })
}
