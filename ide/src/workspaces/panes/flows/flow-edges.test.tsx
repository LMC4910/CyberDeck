import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { createRef, useState } from 'react'
import { UndoStack } from '@/platform/undo'
import { IDENTITY, type PanZoomHandle } from '@/shared/canvas'
import { FlowGraph } from './flow-graph'
import { FlowModel, edgeKey, type FlowDocument } from './flow-model'
import { starterFlows } from './flow-starter'
import {
  connectNodes,
  deleteEdge,
  moveFlowNode,
  setEdgeBranch,
  type FlowsCtx,
} from './flow-ops'
import {
  clearSelection,
  clickNode,
  EMPTY_SELECTION,
  selectEdge,
  type FlowSelection,
} from './flow-selection'
import { inPort, isBranchingKind, nodeAt, outPorts, resolveEdges } from './flow-geometry'
import { NODE_H, NODE_W } from './flow-catalog'
import type { FlowsService } from './flows-service'

function stubRects() {
  const proto = Element.prototype as unknown as { getBoundingClientRect: () => DOMRect }
  proto.getBoundingClientRect = () =>
    ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, x: 0, y: 0, toJSON() {} }) as DOMRect
}

function fakeService(model: FlowModel): FlowsService {
  return { model, arm: vi.fn() } as unknown as FlowsService
}

/** A stateful harness so selection round-trips through the real reducer + ops, exactly
 *  as the pane wires it. Exposes the ctx + surfaceRef for assertions. */
function Harness({ ctx, flowId, surfaceRef }: { ctx: FlowsCtx; flowId: string; surfaceRef: React.RefObject<PanZoomHandle | null> }) {
  const [selection, setSelection] = useState<FlowSelection>(EMPTY_SELECTION)
  return (
    <FlowGraph
      model={ctx.model}
      flowId={flowId}
      surfaceRef={surfaceRef}
      onAddNode={() => {}}
      onMoveNode={(id, f, t, k) => moveFlowNode(ctx, flowId, id, f, t, k)}
      selection={selection}
      onNodeClick={(id, m) => setSelection((s) => clickNode(s, id, m))}
      onConnect={(from, to, label) => connectNodes(ctx, flowId, from, to, label)}
      onSelectEdge={(e) => setSelection(selectEdge(e))}
      onDeleteEdge={(e) => {
        deleteEdge(ctx, flowId, e)
        setSelection(clearSelection())
      }}
      onBackgroundClick={() => setSelection(clearSelection())}
    />
  )
}

function mount(flowId: string, docs: FlowDocument[] = starterFlows()) {
  const model = new FlowModel(docs)
  const undo = new UndoStack()
  const ctx: FlowsCtx = { model, undo, service: fakeService(model) }
  const surfaceRef = createRef<PanZoomHandle>()
  const view = render(<Harness ctx={ctx} flowId={flowId} surfaceRef={surfaceRef} />)
  act(() => surfaceRef.current?.actions.setTransform(IDENTITY))
  return { ...view, model, undo }
}

/** Dispatch a window-level pointer event with a client position (jsdom lacks a usable
 *  PointerEvent + drag, mirroring the drop pattern in flow-graph.test.tsx). */
function windowPointer(type: string, x: number, y: number) {
  const e = new Event(type, { bubbles: true })
  Object.assign(e, { clientX: x, clientY: y })
  act(() => void window.dispatchEvent(e))
}

const conditionDoc = (): FlowDocument => ({
  id: 'flow_cond0001',
  label: 'Cond',
  version: 1,
  trigger: { kind: 'manual', config: { ui: { x: 0, y: 0 } } },
  nodes: [
    { id: 'c1', kind: 'logic.condition', params: { ui: { x: 100, y: 100 } } },
    { id: 'a1', kind: 'action.notify', params: { ui: { x: 400, y: 60 } } },
  ],
  edges: [],
})

describe('flow geometry (CD-411)', () => {
  it('a condition exposes distinct true/false out-ports; other nodes one always port', () => {
    expect(isBranchingKind('logic.condition')).toBe(true)
    const cond = { id: 'c', kind: 'logic.condition', category: 'logic' as const, pos: { x: 0, y: 0 } }
    const ports = outPorts(cond)
    expect(ports.map((p) => p.label)).toEqual(['true', 'false'])
    expect(ports[0]!.pos.x).toBe(NODE_W)
    expect(ports[0]!.pos.y).toBeLessThan(ports[1]!.pos.y)

    const action = { id: 'a', kind: 'action.notify', category: 'action' as const, pos: { x: 0, y: 0 } }
    expect(outPorts(action).map((p) => p.label)).toEqual(['always'])
  })

  it('the trigger root has no out-ports (never an edge endpoint)', () => {
    const trig = { id: 'trigger', kind: 'trigger.manual', category: 'trigger' as const, pos: { x: 0, y: 0 } }
    expect(outPorts(trig)).toEqual([])
  })

  it('resolveEdges anchors from live geometry, so an edge tracks a moved node', () => {
    const model = new FlowModel(starterFlows())
    const nodes0 = model.graphNodes('flow_strt0001')
    const r0 = resolveEdges(nodes0, model.flow('flow_strt0001')!.edges)
    expect(r0).toHaveLength(1)
    const toY0 = r0[0]!.to.y
    // Move the target node down; the resolved anchor must follow.
    model.moveNode('flow_strt0001', 'n_alert01', { x: 0, y: 500 })
    const nodes1 = model.graphNodes('flow_strt0001')
    const r1 = resolveEdges(nodes1, model.flow('flow_strt0001')!.edges)
    expect(r1[0]!.to.y).toBe(500 + NODE_H / 2)
    expect(r1[0]!.to.y).not.toBe(toY0)
    expect(inPort({ x: 0, y: 500 })).toEqual({ x: 0, y: 500 + NODE_H / 2 })
  })

  it('nodeAt hit-tests node boxes and honours the exclude', () => {
    const nodes = new FlowModel(starterFlows()).graphNodes('flow_strt0001')
    const inside = { x: 40, y: 140 + 10 }
    expect(nodeAt(nodes, inside)?.id).toBe('n_scene01')
    expect(nodeAt(nodes, inside, (n) => n.id === 'n_scene01')?.id).not.toBe('n_scene01')
    expect(nodeAt(nodes, { x: 9999, y: 9999 })).toBeNull()
  })
})

describe('FlowEdges rendering (CD-411)', () => {
  beforeEach(() => {
    stubRects()
    if (!Element.prototype.setPointerCapture) {
      Element.prototype.setPointerCapture = vi.fn()
      Element.prototype.releasePointerCapture = vi.fn()
    }
  })

  it('renders an edge per document edge, with the branch on the marker', () => {
    mount('flow_strt0001')
    const edge = screen.getByTestId(`edge-${edgeKey({ from: 'n_scene01', to: 'n_alert01', label: 'always' })}`)
    expect(edge).toBeTruthy()
  })

  it('drag-connect from an out-port creates an edge (undoable)', () => {
    const { model, undo } = mount('flow_strt0001')
    expect(model.flow('flow_strt0001')!.edges).toHaveLength(1)
    // n_alert01 out-port → drop over n_scene01.
    const port = screen.getByTestId('port-n_alert01-always')
    fireEvent.pointerDown(port, { button: 0, clientX: NODE_W, clientY: 280 + NODE_H / 2, pointerId: 1 })
    windowPointer('pointermove', 40, 150)
    windowPointer('pointerup', 40, 150)
    const edges = model.flow('flow_strt0001')!.edges
    expect(edges).toHaveLength(2)
    expect(edges.at(-1)).toEqual({ from: 'n_alert01', to: 'n_scene01', label: 'always' })
    // one undo entry restores it
    act(() => void undo.undo())
    expect(model.flow('flow_strt0001')!.edges).toHaveLength(1)
  })

  it('a condition’s true-port connects on the true branch (distinct T/F ports)', () => {
    const { model } = mount('flow_cond0001', [conditionDoc()])
    const truePort = screen.getByTestId('port-c1-true')
    const falsePort = screen.getByTestId('port-c1-false')
    expect(truePort).toBeTruthy()
    expect(falsePort).toBeTruthy()
    fireEvent.pointerDown(truePort, { button: 0, clientX: 100 + NODE_W, clientY: 100, pointerId: 1 })
    windowPointer('pointermove', 420, 80)
    windowPointer('pointerup', 420, 80)
    expect(model.flow('flow_cond0001')!.edges).toEqual([{ from: 'c1', to: 'a1', label: 'true' }])
  })

  it('clicking an edge selects it; its × hotspot deletes it (undoable)', () => {
    const { model, undo } = mount('flow_strt0001')
    const key = edgeKey({ from: 'n_scene01', to: 'n_alert01', label: 'always' })
    fireEvent.pointerDown(screen.getByTestId(`edge-${key}`))
    // Selecting reveals the × hotspot.
    const x = screen.getByTestId(`edge-x-${key}`)
    fireEvent.pointerDown(x)
    expect(model.flow('flow_strt0001')!.edges).toHaveLength(0)
    act(() => void undo.undo())
    expect(model.flow('flow_strt0001')!.edges).toHaveLength(1)
  })

  it('drag-connect rejects self-loops, trigger endpoints, and duplicates', () => {
    const model = new FlowModel(starterFlows())
    const undo = new UndoStack()
    const ctx: FlowsCtx = { model, undo, service: fakeService(model) }
    expect(connectNodes(ctx, 'flow_strt0001', 'n_scene01', 'n_scene01', 'always')).toBe(false)
    expect(connectNodes(ctx, 'flow_strt0001', 'trigger', 'n_scene01', 'always')).toBe(false)
    // duplicate of the seeded edge
    expect(connectNodes(ctx, 'flow_strt0001', 'n_scene01', 'n_alert01', 'always')).toBe(false)
    expect(model.flow('flow_strt0001')!.edges).toHaveLength(1)
  })

  it('setEdgeBranch retargets an edge’s branch as one undo entry', () => {
    const model = new FlowModel(starterFlows())
    const undo = new UndoStack()
    const ctx: FlowsCtx = { model, undo, service: fakeService(model) }
    const edge = { from: 'n_scene01', to: 'n_alert01', label: 'always' } as const
    const next = setEdgeBranch(ctx, 'flow_strt0001', edge, 'true')
    expect(next).toEqual({ from: 'n_scene01', to: 'n_alert01', label: 'true' })
    expect(model.flow('flow_strt0001')!.edges[0]!.label).toBe('true')
    expect(undo.list().map((e) => e.label)).toEqual(['Set branch'])
    act(() => void undo.undo())
    expect(model.flow('flow_strt0001')!.edges[0]!.label).toBe('always')
  })
})
