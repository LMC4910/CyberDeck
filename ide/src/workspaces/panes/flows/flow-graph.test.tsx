import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { createRef } from 'react'
import { UndoStack } from '@/platform/undo'
import { IDENTITY, type PanZoomHandle, type Point } from '@/shared/canvas'
import { FlowGraph } from './flow-graph'
import { FlowModel, TRIGGER_NODE_ID, readUiPos } from './flow-model'
import { starterFlows } from './flow-starter'
import { moveFlowNode, addFlowNode } from './flow-ops'
import { FLOW_NODE_DND_TYPE } from './flow-catalog'
import type { FlowsService } from './flows-service'

// jsdom returns a zero rect; give the surface a real 800×600 viewport so the world↔
// screen math (drop point, node drag) is exercised for real.
function stubRects() {
  const proto = Element.prototype as unknown as { getBoundingClientRect: () => DOMRect }
  proto.getBoundingClientRect = () =>
    ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, x: 0, y: 0, toJSON() {} }) as DOMRect
}

function fakeService(model: FlowModel): FlowsService {
  return { model, arm: vi.fn() } as unknown as FlowsService
}

function mountGraph(flowId: string, docs = starterFlows()) {
  const model = new FlowModel(docs)
  const undo = new UndoStack()
  const service = fakeService(model)
  const ctx = { model, undo, service }
  const surfaceRef = createRef<PanZoomHandle>()
  const onAddNode = (kind: Parameters<typeof addFlowNode>[2], world: Point) =>
    addFlowNode(ctx, flowId, kind, world)
  const onMoveNode = (nodeId: string, from: Point, to: Point, key: string) =>
    moveFlowNode(ctx, flowId, nodeId, from, to, key)
  const view = render(
    <FlowGraph
      model={model}
      flowId={flowId}
      surfaceRef={surfaceRef}
      onAddNode={onAddNode}
      onMoveNode={onMoveNode}
    />,
  )
  // First-open fit applies a non-identity transform; these tests exercise the
  // screen→world drop/drag math at identity (fit itself is covered separately).
  act(() => surfaceRef.current?.actions.setTransform(IDENTITY))
  return { ...view, model, undo, surfaceRef }
}

function nodeEl(id: string): HTMLElement {
  return document.querySelector(`[data-node-id="${id}"]`) as HTMLElement
}

describe('FlowGraph (CD-410)', () => {
  beforeEach(() => {
    stubRects()
    if (!Element.prototype.setPointerCapture) {
      Element.prototype.setPointerCapture = vi.fn()
      Element.prototype.releasePointerCapture = vi.fn()
    }
  })

  it('renders the synthetic trigger root + every node, coloured by category', () => {
    mountGraph('flow_strt0001')
    // trigger root
    const root = nodeEl(TRIGGER_NODE_ID)
    expect(root).toBeTruthy()
    expect(root).toHaveAttribute('data-category', 'trigger')
    // its two nodes, category-coloured
    expect(nodeEl('n_scene01')).toHaveAttribute('data-category', 'integration')
    expect(nodeEl('n_alert01')).toHaveAttribute('data-category', 'action')
  })

  it('mounts the shared PanZoomSurface so graph nav is the canvas nav (AC parity)', () => {
    mountGraph('flow_strt0001')
    // Same component the deck-designer canvas uses: a focusable role=application surface.
    const surface = screen.getByRole('application', { name: 'Flow graph' })
    expect(surface).toBeTruthy()
    expect(surface).toHaveAttribute('tabindex', '0')
  })

  it('⌘0 / ⌘= zoom the graph via the inherited surface shortcuts', () => {
    const { surfaceRef } = mountGraph('flow_strt0001')
    const surface = screen.getByRole('application', { name: 'Flow graph' })
    surface.focus()
    const key = (k: string) =>
      act(() => {
        surface.dispatchEvent(new KeyboardEvent('keydown', { key: k, metaKey: true, bubbles: true, cancelable: true }))
      })
    key('=')
    expect(surfaceRef.current!.getTransform().scale).toBeGreaterThan(1)
  })

  it('drop from the palette lands the correct node type at the cursor (AC)', () => {
    const { model } = mountGraph('flow_lite0001')
    const before = model.flow('flow_lite0001')!.nodes.length
    const graph = screen.getByTestId('flow-graph')
    const data = new Map<string, string>([[FLOW_NODE_DND_TYPE, 'integration.obs']])
    // jsdom has no DragEvent, so fireEvent.drop drops clientX/clientY off the event —
    // build the event by hand so the drop coordinate actually reaches the handler.
    const dropEvent = new Event('drop', { bubbles: true, cancelable: true })
    Object.assign(dropEvent, {
      clientX: 400,
      clientY: 300,
      dataTransfer: { getData: (t: string) => data.get(t) ?? '', types: [FLOW_NODE_DND_TYPE] },
    })
    fireEvent(graph, dropEvent)
    const nodes = model.flow('flow_lite0001')!.nodes
    expect(nodes.length).toBe(before + 1)
    const added = nodes.at(-1)!
    expect(added.kind).toBe('integration.obs')
    // Dropped at viewport centre (400,300) → world (400,300) under identity, centred box.
    const pos = readUiPos(added.params as Record<string, unknown>)!
    expect(pos.x).toBe(400 - 84) // NODE_W/2
    expect(pos.y).toBe(300 - 32) // NODE_H/2
  })

  it('dragging a node repositions it as ONE undoable entry (undo restores it)', () => {
    const { model, undo } = mountGraph('flow_strt0001')
    const el = nodeEl('n_scene01')
    const start = readUiPos(model.node('flow_strt0001', 'n_scene01')!.params as Record<string, unknown>)!

    fireEvent.pointerDown(el, { button: 0, clientX: 0, clientY: 0, pointerId: 1 })
    fireEvent.pointerMove(el, { clientX: 40, clientY: 20, pointerId: 1 })
    fireEvent.pointerMove(el, { clientX: 60, clientY: 30, pointerId: 1 })
    fireEvent.pointerUp(el, { clientX: 60, clientY: 30, pointerId: 1 })

    const moved = readUiPos(model.node('flow_strt0001', 'n_scene01')!.params as Record<string, unknown>)!
    expect(moved).toEqual({ x: start.x + 60, y: start.y + 30 })
    // Whole drag coalesced to a single history entry.
    expect(undo.list().map((e) => e.label)).toEqual(['Move node'])
    act(() => void undo.undo())
    const reverted = readUiPos(model.node('flow_strt0001', 'n_scene01')!.params as Record<string, unknown>)!
    expect(reverted).toEqual(start)
  })

  it('the trigger root is draggable too (moves the trigger config ui pos)', () => {
    const { model } = mountGraph('flow_lite0001')
    const el = nodeEl(TRIGGER_NODE_ID)
    fireEvent.pointerDown(el, { button: 0, clientX: 0, clientY: 0, pointerId: 1 })
    fireEvent.pointerMove(el, { clientX: 10, clientY: 15, pointerId: 1 })
    fireEvent.pointerUp(el, { clientX: 10, clientY: 15, pointerId: 1 })
    const t = model.trigger('flow_lite0001')!
    expect(readUiPos(t.config)).toEqual({ x: 10, y: 15 })
  })
})

// The surface starts at identity; assert the module's IDENTITY is what we assumed.
describe('FlowGraph drop math assumption', () => {
  it('identity transform maps screen→world 1:1', () => {
    expect(IDENTITY).toEqual({ scale: 1, tx: 0, ty: 0 })
  })
})
