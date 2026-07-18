// Flow authoring operations (CD-409). Pure functions over (model, undo, service)
// that the tab strip invokes — the same shape the canvas uses (canvas-commands.ts).
// Every op records exactly ONE undo entry on the shell's stack, so ⌘Z/⌘⇧Z reverse a
// flow edit just like a canvas edit. Nothing here mutates the model outside an
// `execUndoable` — a direct mutation would be invisible to history (CD-329).
import type { UndoStack } from '@/platform/undo'
import type { Point } from '@/shared/canvas'
import {
  blankFlow,
  edgesEqual,
  TRIGGER_NODE_ID,
  type BranchLabel,
  type FlowEdge,
  type FlowModel,
  type NodeKind,
} from './flow-model'
import { makeNode, labelForKind } from './flow-catalog'
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
 * Add a node of `kind` to a flow, centred on the world `center` (the drop point, or
 * the visible-graph centre for a double-click add). Returns its id. The id is minted
 * ONCE outside the undoable so redo re-adds the SAME node key (CD-302 id contract).
 */
export function addFlowNode({ model, undo }: FlowsCtx, flowId: string, kind: NodeKind, center: Point): string {
  const node = makeNode(model.newNodeId(), kind, center)
  undo.execUndoable(`Add ${labelForKind(kind)}`, () => model.addNode(flowId, node))
  return node.id
}

/**
 * Move a node (or the synthetic trigger root) from `from` to `to` (both world
 * top-left). Coalesced by `gestureKey` so a whole pointer drag collapses to ONE undo
 * entry whose inverse restores the pre-drag position (mirrors the canvas nudge, CD-308).
 * `from` is captured once at drag start, so it stays absolute and redo-safe: the
 * gesture's final apply lands `to`, and undo always returns to the original `from`.
 */
export function moveFlowNode(
  { model, undo }: FlowsCtx,
  flowId: string,
  nodeId: string,
  from: Point,
  to: Point,
  gestureKey: string,
): void {
  if (from.x === to.x && from.y === to.y) return
  undo.execUndoable(
    'Move node',
    () => {
      model.moveNode(flowId, nodeId, to)
      return () => void model.moveNode(flowId, nodeId, from)
    },
    { coalesceKey: gestureKey },
  )
}

// ── edge ops (CD-411) ──────────────────────────────────────────────────────────

/**
 * Connect `from`→`to` on the given branch. Rejects self-loops, the trigger root as an
 * endpoint (it fires roots implicitly — never an edge endpoint), and a duplicate of an
 * existing edge. Returns true when an edge was actually added. One undo entry.
 */
export function connectNodes(
  { model, undo }: FlowsCtx,
  flowId: string,
  from: string,
  to: string,
  label: BranchLabel = 'always',
): boolean {
  if (from === to || from === TRIGGER_NODE_ID || to === TRIGGER_NODE_ID) return false
  const doc = model.flow(flowId)
  if (!doc || !model.node(flowId, from) || !model.node(flowId, to)) return false
  const edge: FlowEdge = { from, to, label }
  if (doc.edges.some((e) => edgesEqual(e, edge))) return false
  undo.execUndoable('Connect nodes', () => model.addEdge(flowId, edge))
  return true
}

/** Delete an edge. One undo entry. */
export function deleteEdge({ model, undo }: FlowsCtx, flowId: string, edge: FlowEdge): void {
  if (!model.flow(flowId)) return
  undo.execUndoable('Delete edge', () => model.removeEdge(flowId, edge))
}

/** Retarget an edge's branch to `label`. Returns the retargeted edge (so the caller can
 *  keep it selected), or null when nothing changed. One undo entry. */
export function setEdgeBranch(
  { model, undo }: FlowsCtx,
  flowId: string,
  edge: FlowEdge,
  label: BranchLabel,
): FlowEdge | null {
  if ((edge.label ?? 'always') === label) return null
  if (!model.flow(flowId)) return null
  undo.execUndoable('Set branch', () => model.setEdgeLabel(flowId, edge, label))
  return { ...edge, label }
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
