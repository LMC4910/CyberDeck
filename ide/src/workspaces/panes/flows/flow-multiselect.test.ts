import { describe, it, expect, vi } from 'vitest'
import { UndoStack } from '@/platform/undo'
import { FlowModel, TRIGGER_NODE_ID, readUiPos, type FlowEdge } from './flow-model'
import { starterFlows } from './flow-starter'
import { addFlowNode, connectNodes, duplicateSelection, deleteSelection, moveFlowNodes } from './flow-ops'
import { selectNodes, selectEdge } from './flow-selection'
import type { FlowsCtx } from './flow-ops'
import type { FlowsService } from './flows-service'

function fresh(flowId = 'flow_strt0001') {
  const model = new FlowModel(starterFlows())
  const undo = new UndoStack()
  const service = { model, arm: vi.fn() } as unknown as FlowsService
  const ctx: FlowsCtx = { model, undo, service }
  return { ctx, model, undo, flowId }
}

const posOf = (model: FlowModel, flowId: string, id: string) =>
  readUiPos(model.node(flowId, id)?.params as Record<string, unknown> | undefined)

const hasEdge = (edges: readonly FlowEdge[], from: string, to: string) =>
  edges.some((e) => e.from === from && e.to === to)

describe('duplicateSelection (CD-412)', () => {
  it('clones selected nodes with FRESH ids and preserves the INTERNAL wiring (AC)', () => {
    const { ctx, model, flowId } = fresh()
    // starter: n_scene01 → n_alert01 (internal). Add an external node the edge leaves the selection for.
    const cId = addFlowNode(ctx, flowId, 'data.text', { x: 400, y: 400 })
    connectNodes(ctx, flowId, 'n_alert01', cId) // external: n_alert01 is selected, cId is not

    const before = model.flow(flowId)!
    const beforeNodeCount = before.nodes.length
    const beforeEdgeCount = before.edges.length

    const created = duplicateSelection(ctx, flowId, selectNodes(['n_scene01', 'n_alert01']))

    expect(created).toHaveLength(2)
    // fresh ids — none collide with the sources
    expect(created).not.toContain('n_scene01')
    expect(created).not.toContain('n_alert01')

    const doc = model.flow(flowId)!
    expect(doc.nodes).toHaveLength(beforeNodeCount + 2)
    // kinds carried over in source order
    const [aClone, bClone] = created
    expect(model.node(flowId, aClone!)!.kind).toBe('integration.obs')
    expect(model.node(flowId, bClone!)!.kind).toBe('action.notify')
    // the internal edge is duplicated onto the clones…
    expect(hasEdge(doc.edges, aClone!, bClone!)).toBe(true)
    // …and the external edge (n_alert01 → cId) is NOT (only one endpoint was selected)
    expect(hasEdge(doc.edges, bClone!, cId)).toBe(false)
    expect(doc.edges).toHaveLength(beforeEdgeCount + 1) // exactly the one internal clone

    // copies are offset from their sources (visibly distinct)
    expect(posOf(model, flowId, aClone!)).not.toEqual(posOf(model, flowId, 'n_scene01'))
  })

  it('is one undo entry that removes every copied node + edge', () => {
    const { ctx, model, undo, flowId } = fresh()
    const nodeCount = model.flow(flowId)!.nodes.length
    const edgeCount = model.flow(flowId)!.edges.length

    duplicateSelection(ctx, flowId, selectNodes(['n_scene01', 'n_alert01']))
    expect(undo.list().map((e) => e.label)).toEqual(['Duplicate nodes'])

    undo.undo()
    expect(model.flow(flowId)!.nodes).toHaveLength(nodeCount)
    expect(model.flow(flowId)!.edges).toHaveLength(edgeCount)
  })

  it('never duplicates the synthetic trigger root', () => {
    const { ctx, model, flowId } = fresh()
    const created = duplicateSelection(ctx, flowId, selectNodes([TRIGGER_NODE_ID, 'n_scene01']))
    expect(created).toHaveLength(1) // only the real node
    expect(model.flow(flowId)!.nodes.filter((n) => n.kind === 'integration.obs')).toHaveLength(2)
  })
})

describe('deleteSelection (CD-412)', () => {
  it('removes selected nodes and their incident edges as one undoable entry', () => {
    const { ctx, model, undo, flowId } = fresh()
    const ok = deleteSelection(ctx, flowId, selectNodes(['n_alert01']))
    expect(ok).toBe(true)
    const doc = model.flow(flowId)!
    expect(doc.nodes.find((n) => n.id === 'n_alert01')).toBeUndefined()
    // the n_scene01 → n_alert01 edge went with it (no dangling ref)
    expect(hasEdge(doc.edges, 'n_scene01', 'n_alert01')).toBe(false)
    expect(undo.list().map((e) => e.label)).toEqual(['Delete node'])

    undo.undo()
    expect(model.node(flowId, 'n_alert01')).toBeDefined()
    expect(hasEdge(model.flow(flowId)!.edges, 'n_scene01', 'n_alert01')).toBe(true)
  })

  it('deletes the selected edge when the selection is an edge', () => {
    const { ctx, model, flowId } = fresh()
    const edge: FlowEdge = { from: 'n_scene01', to: 'n_alert01', label: 'always' }
    expect(deleteSelection(ctx, flowId, selectEdge(edge))).toBe(true)
    expect(hasEdge(model.flow(flowId)!.edges, 'n_scene01', 'n_alert01')).toBe(false)
  })

  it('never deletes the trigger root and no-ops on an empty selection', () => {
    const { ctx, model, flowId } = fresh()
    expect(deleteSelection(ctx, flowId, selectNodes([TRIGGER_NODE_ID]))).toBe(false)
    expect(model.node(flowId, 'n_scene01')).toBeDefined()
  })
})

describe('moveFlowNodes (CD-412 multi-drag)', () => {
  it('moves every node by the gesture as ONE coalesced undo entry, restored on undo', () => {
    const { ctx, model, undo, flowId } = fresh()
    const aFrom = posOf(model, flowId, 'n_scene01')!
    const bFrom = posOf(model, flowId, 'n_alert01')!
    const key = 'group:1'
    // two coalesced steps of one gesture
    moveFlowNodes(ctx, flowId, [
      { nodeId: 'n_scene01', from: aFrom, to: { x: aFrom.x + 10, y: aFrom.y + 5 } },
      { nodeId: 'n_alert01', from: bFrom, to: { x: bFrom.x + 10, y: bFrom.y + 5 } },
    ], key)
    moveFlowNodes(ctx, flowId, [
      { nodeId: 'n_scene01', from: aFrom, to: { x: aFrom.x + 40, y: aFrom.y + 20 } },
      { nodeId: 'n_alert01', from: bFrom, to: { x: bFrom.x + 40, y: bFrom.y + 20 } },
    ], key)

    expect(posOf(model, flowId, 'n_scene01')).toEqual({ x: aFrom.x + 40, y: aFrom.y + 20 })
    expect(posOf(model, flowId, 'n_alert01')).toEqual({ x: bFrom.x + 40, y: bFrom.y + 20 })
    expect(undo.list().map((e) => e.label)).toEqual(['Move nodes']) // coalesced to one

    undo.undo()
    expect(posOf(model, flowId, 'n_scene01')).toEqual(aFrom)
    expect(posOf(model, flowId, 'n_alert01')).toEqual(bFrom)
  })
})
