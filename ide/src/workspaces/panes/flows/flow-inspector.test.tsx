import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { UndoStack } from '@/platform/undo'
import { FlowModel, TRIGGER_NODE_ID } from './flow-model'
import { starterFlows } from './flow-starter'
import { NODE_CATALOG } from './flow-catalog'
import { NODE_PARAM_FIELDS } from './flow-params'
import { addFlowNode } from './flow-ops'
import { FlowInspector } from './flow-inspector'
import { selectNodes, selectEdge, EMPTY_SELECTION, type FlowSelection } from './flow-selection'
import type { FlowsCtx } from './flow-ops'
import type { FlowsService } from './flows-service'

function setup(flowId = 'flow_strt0001') {
  const model = new FlowModel(starterFlows())
  const undo = new UndoStack()
  const service = { model, arm: vi.fn() } as unknown as FlowsService
  const ctx: FlowsCtx = { model, undo, service }
  return { ctx, model, flowId }
}

function mount(ctx: FlowsCtx, flowId: string, selection: FlowSelection) {
  const setSelection = vi.fn()
  const view = render(
    <FlowInspector ctx={ctx} flowId={flowId} selection={selection} setSelection={setSelection} />,
  )
  return { ...view, setSelection }
}

const paramsOf = (model: FlowModel, flowId: string, id: string) =>
  (model.node(flowId, id)?.params ?? {}) as Record<string, unknown>

describe('flow param registry (CD-413)', () => {
  it('every catalog node kind has schema-driven fields (AC: every kind renders)', () => {
    for (const m of NODE_CATALOG) {
      expect(NODE_PARAM_FIELDS[m.kind], m.kind).toBeDefined()
      expect(NODE_PARAM_FIELDS[m.kind].length).toBeGreaterThan(0)
    }
  })
})

describe('FlowInspector — node (CD-413)', () => {
  it('renders the selected node kind and persists a field edit on the node (AC)', () => {
    const { ctx, model, flowId } = setup()
    const { container } = mount(ctx, flowId, selectNodes(['n_scene01'])) // integration.obs → field "scene"
    const input = container.querySelector('[data-field="scene"] input') as HTMLInputElement
    expect(input).toBeTruthy()
    fireEvent.change(input, { target: { value: 'Main Scene' } })
    expect(paramsOf(model, flowId, 'n_scene01').scene).toBe('Main Scene')
  })

  it('renders every field of a schema-rich kind (condition: op/match/negate)', () => {
    const { ctx, model, flowId } = setup()
    const id = addFlowNode(ctx, flowId, 'logic.condition', { x: 300, y: 300 })
    const { container } = mount(ctx, flowId, selectNodes([id]))
    expect(container.querySelector('[data-field="op"]')).toBeTruthy()
    expect(container.querySelector('[data-field="match"]')).toBeTruthy()
    expect(container.querySelector('[data-field="negate"]')).toBeTruthy()
    // number + boolean coercion: retry field lands as a number, negate as a boolean.
    fireEvent.click(container.querySelector('[data-field="negate"] input') as HTMLInputElement)
    expect(paramsOf(model, flowId, id).negate).toBe(true)
  })

  it('coerces a number field to a number, and clears a param when emptied', () => {
    const { ctx, model, flowId } = setup()
    const id = addFlowNode(ctx, flowId, 'action.notify', { x: 0, y: 0 })
    const { container } = mount(ctx, flowId, selectNodes([id]))
    const retry = container.querySelector('[data-field="retry"] input') as HTMLInputElement
    fireEvent.change(retry, { target: { value: '3' } })
    expect(paramsOf(model, flowId, id).retry).toBe(3)
    fireEvent.change(retry, { target: { value: '' } })
    expect('retry' in paramsOf(model, flowId, id)).toBe(false)
  })
})

describe('FlowInspector — trigger (CD-413)', () => {
  it('edits the trigger config and persists it (event trigger)', () => {
    const { ctx, model, flowId } = setup() // flow_strt0001 trigger is event
    const { container } = mount(ctx, flowId, selectNodes([TRIGGER_NODE_ID]))
    const event = container.querySelector('[data-field="event"] input') as HTMLInputElement
    fireEvent.change(event, { target: { value: 'obs.recording.started' } })
    expect(model.trigger(flowId)!.config?.event).toBe('obs.recording.started')
  })

  it('changing the trigger kind swaps the fields', () => {
    const { ctx, model, flowId } = setup()
    const { container } = mount(ctx, flowId, selectNodes([TRIGGER_NODE_ID]))
    fireEvent.change(container.querySelector('[data-inspector="trigger"] select') as HTMLSelectElement, {
      target: { value: 'stateChange' },
    })
    expect(model.trigger(flowId)!.kind).toBe('stateChange')
  })
})

describe('FlowInspector — edge + empty (CD-413)', () => {
  it('retargets the selected edge branch on the document', () => {
    const { ctx, model, flowId } = setup()
    const edge = { from: 'n_scene01', to: 'n_alert01', label: 'always' as const }
    const { container } = mount(ctx, flowId, selectEdge(edge))
    fireEvent.change(container.querySelector('[data-inspector="edge"] select') as HTMLSelectElement, {
      target: { value: 'true' },
    })
    expect(model.flow(flowId)!.edges.find((e) => e.from === 'n_scene01')?.label).toBe('true')
  })

  it('shows the flow meta (name + armed) when nothing is selected', () => {
    const { ctx, flowId } = setup()
    mount(ctx, flowId, EMPTY_SELECTION)
    expect(screen.getByRole('checkbox', { name: /armed/i })).toBeInTheDocument()
    expect(screen.getByText(/select a node/i)).toBeInTheDocument()
  })
})
