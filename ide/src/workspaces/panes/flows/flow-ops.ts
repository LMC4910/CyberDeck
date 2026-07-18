// Flow authoring operations (CD-409). Pure functions over (model, undo, service)
// that the tab strip invokes — the same shape the canvas uses (canvas-commands.ts).
// Every op records exactly ONE undo entry on the shell's stack, so ⌘Z/⌘⇧Z reverse a
// flow edit just like a canvas edit. Nothing here mutates the model outside an
// `execUndoable` — a direct mutation would be invisible to history (CD-329).
import type { UndoStack } from '@/platform/undo'
import type { Inverse } from '@/shared/project'
import type { Point } from '@/shared/canvas'
import {
  blankFlow,
  edgesEqual,
  writeUiPos,
  TRIGGER_NODE_ID,
  UI_PARAM_KEY,
  type BranchLabel,
  type FlowEdge,
  type FlowModel,
  type FlowNode,
  type NodeKind,
  type TriggerKind,
} from './flow-model'
import { makeNode, labelForKind } from './flow-catalog'
import type { FlowSelection } from './flow-selection'
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

// ── multi-node ops (CD-412) ──────────────────────────────────────────────────────

/** How far a duplicate is offset from its source so the copy is visibly distinct. */
const DUPLICATE_OFFSET = 24

/** Run a list of model mutations as ONE undo entry: its inverse replays each
 *  mutation's own inverse in reverse order. */
function undoableBatch(undo: UndoStack, label: string, applies: () => Inverse[]): void {
  undo.execUndoable(label, () => {
    const inverses = applies()
    return () => {
      for (let i = inverses.length - 1; i >= 0; i--) inverses[i]!()
    }
  })
}

/**
 * Move several nodes by one gesture as a single coalesced undo entry (multi-drag).
 * Each move carries its own absolute `from`→`to`, captured at drag start, so undo
 * restores every node's pre-drag position exactly (redo-safe, mirrors moveFlowNode).
 */
export function moveFlowNodes(
  { model, undo }: FlowsCtx,
  flowId: string,
  moves: readonly { nodeId: string; from: Point; to: Point }[],
  gestureKey: string,
): void {
  const real = moves.filter((m) => m.from.x !== m.to.x || m.from.y !== m.to.y)
  if (real.length === 0) return
  undo.execUndoable(
    real.length > 1 ? 'Move nodes' : 'Move node',
    () => {
      for (const m of real) model.moveNode(flowId, m.nodeId, m.to)
      return () => {
        for (const m of real) model.moveNode(flowId, m.nodeId, m.from)
      }
    },
    { coalesceKey: gestureKey },
  )
}

/**
 * Duplicate the selected nodes and the edges *internal* to the selection (both
 * endpoints selected), offset so the copies are visible, with FRESH ids. One undo
 * entry. Returns the new node ids so the caller can select the copies. The synthetic
 * trigger root is never duplicable (a flow has exactly one).
 */
export function duplicateSelection({ model, undo }: FlowsCtx, flowId: string, selection: FlowSelection): string[] {
  const doc = model.flow(flowId)
  if (!doc) return []
  const sourceIds = [...selection.nodes].filter((id) => id !== TRIGGER_NODE_ID && model.node(flowId, id))
  if (sourceIds.length === 0) return []

  // Positions the graph actually draws (a node with no stored pos still has a column).
  const drawn = new Map(model.graphNodes(flowId).map((g) => [g.id, g.pos]))
  // Mint every new id ONCE, outside the undoable, so redo reuses them (CD-302 id contract).
  const idMap = new Map<string, string>()
  const clones: FlowNode[] = sourceIds.map((id) => {
    const src = model.node(flowId, id)!
    const newId = model.newNodeId()
    idMap.set(id, newId)
    const base = drawn.get(id) ?? { x: 0, y: 0 }
    const params = writeUiPos(structuredClone(src.params ?? {}) as Record<string, unknown>, {
      x: base.x + DUPLICATE_OFFSET,
      y: base.y + DUPLICATE_OFFSET,
    })
    return { ...structuredClone(src), id: newId, params } as FlowNode
  })
  const internalEdges: FlowEdge[] = doc.edges
    .filter((e) => idMap.has(e.from) && idMap.has(e.to))
    .map((e) => ({ ...structuredClone(e), from: idMap.get(e.from)!, to: idMap.get(e.to)! }))

  undoableBatch(undo, clones.length > 1 ? 'Duplicate nodes' : 'Duplicate node', () => [
    ...clones.map((c) => model.addNode(flowId, c)),
    ...internalEdges.map((e) => model.addEdge(flowId, e)),
  ])
  return clones.map((c) => c.id)
}

// ── per-node / trigger param edits (CD-413 inspector) ────────────────────────────

/**
 * Set one authored param on a node from the inspector. `undefined` clears the key so
 * the stored bag stays minimal. Coalesced by node+key, so typing a field collapses to
 * one undo entry; the reserved `ui` position is preserved by setNodeParams.
 */
export function setNodeParam({ model, undo }: FlowsCtx, flowId: string, nodeId: string, key: string, value: unknown): void {
  const node = model.node(flowId, nodeId)
  if (!node) return
  const { [key]: _drop, ...rest } = (node.params ?? {}) as Record<string, unknown>
  const params = value === undefined ? rest : { ...rest, [key]: value }
  undo.execUndoable('Edit node', () => model.setNodeParams(flowId, nodeId, params), {
    coalesceKey: `flow-param:${nodeId}:${key}`,
  })
}

/** Set one field on the trigger's config (CD-413). Preserves the reserved ui position
 *  and the trigger kind; coalesced by key. */
export function setTriggerParam({ model, undo }: FlowsCtx, flowId: string, key: string, value: unknown): void {
  const t = model.trigger(flowId)
  if (!t) return
  const { [key]: _drop, ...rest } = (t.config ?? {}) as Record<string, unknown>
  const config = value === undefined ? rest : { ...rest, [key]: value }
  const trigger = Object.keys(config).length ? { kind: t.kind, config } : { kind: t.kind }
  undo.execUndoable('Edit trigger', () => model.setTrigger(flowId, trigger), {
    coalesceKey: `flow-trigger:${key}`,
  })
}

/** Change the trigger kind (CD-413). Drops the previous kind's config but keeps the
 *  node's ui position, and no-ops on an unchanged kind. */
export function setTriggerKind({ model, undo }: FlowsCtx, flowId: string, kind: TriggerKind): void {
  const t = model.trigger(flowId)
  if (!t || t.kind === kind) return
  const ui = (t.config ?? {})[UI_PARAM_KEY]
  const config = ui !== undefined ? { [UI_PARAM_KEY]: ui } : undefined
  undo.execUndoable('Change trigger', () => model.setTrigger(flowId, config ? { kind, config } : { kind }))
}

/**
 * Delete the current selection: the selected edge, or the selected nodes and every
 * edge incident to them (removeNode drops incident edges). The trigger root is never
 * deletable. One undo entry; returns true when something was removed.
 */
export function deleteSelection(ctx: FlowsCtx, flowId: string, selection: FlowSelection): boolean {
  const { model, undo } = ctx
  if (selection.edge) {
    deleteEdge(ctx, flowId, selection.edge)
    return true
  }
  const ids = [...selection.nodes].filter((id) => id !== TRIGGER_NODE_ID && model.node(flowId, id))
  if (ids.length === 0) return false
  undoableBatch(undo, ids.length > 1 ? 'Delete nodes' : 'Delete node', () =>
    ids.map((id) => model.removeNode(flowId, id)),
  )
  return true
}
