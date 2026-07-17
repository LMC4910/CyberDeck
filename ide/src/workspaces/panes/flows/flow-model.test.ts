import { describe, it, expect, vi } from 'vitest'
import {
  FlowModel,
  TRIGGER_NODE_ID,
  UI_PARAM_KEY,
  authoredParams,
  blankFlow,
  categoryOf,
  readUiPos,
  triggerOf,
  type FlowDocument,
} from './flow-model'
import { starterFlows } from './flow-starter'

function docs(): FlowDocument[] {
  return starterFlows()
}

describe('categoryOf (CD-409) — the 6 node categories derive from the kind prefix', () => {
  it('maps every kind in the CD-112 catalog to one of the six', () => {
    expect(categoryOf('logic.condition')).toBe('logic')
    expect(categoryOf('action.notify')).toBe('action')
    expect(categoryOf('structure.group')).toBe('structure')
    expect(categoryOf('integration.obs')).toBe('integration')
    expect(categoryOf('data.math')).toBe('data')
    expect(categoryOf('trigger.manual')).toBe('trigger')
  })

  it('an unknown prefix renders neutral rather than throwing', () => {
    expect(categoryOf('plugin.something')).toBe('structure')
    expect(categoryOf('nonsense')).toBe('structure')
  })
})

describe('FlowModel reads (CD-409)', () => {
  it('exposes every seeded flow with its own nodes/edges/armed state', () => {
    const model = new FlowModel(docs())
    expect(model.list().map((f) => f.id)).toEqual(['flow_strt0001', 'flow_lite0001'])
    expect(model.armed('flow_strt0001')).toBe(true)
    expect(model.armed('flow_lite0001')).toBe(false)
    expect(model.flow('flow_strt0001')!.nodes).toHaveLength(2)
    expect(model.flow('flow_lite0001')!.edges).toHaveLength(0)
  })

  it('does not alias the documents it was constructed from', () => {
    const source = docs()
    const model = new FlowModel(source)
    model.renameFlow('flow_strt0001', 'Renamed')
    expect(source[0]!.label).toBe('Stream Start')
  })

  it('graphNodes puts the synthetic trigger root first, then the document nodes', () => {
    const model = new FlowModel(docs())
    const nodes = model.graphNodes('flow_strt0001')
    expect(nodes.map((n) => n.id)).toEqual([TRIGGER_NODE_ID, 'n_scene01', 'n_alert01'])
    expect(nodes[0]).toMatchObject({ kind: 'trigger.event', category: 'trigger', pos: { x: 0, y: 0 } })
    expect(nodes[1]).toMatchObject({ category: 'integration', pos: { x: 0, y: 140 } })
  })

  it('nodes with no stored position fall back to a deterministic column', () => {
    // An engine-authored flow carries no IDE layout — it must still render readably.
    const model = new FlowModel([
      {
        id: 'flow_bare0001',
        label: 'Bare',
        version: 1,
        trigger: { kind: 'manual' },
        nodes: [
          { id: 'a', kind: 'logic.gate' },
          { id: 'b', kind: 'logic.gate' },
        ],
        edges: [],
      },
    ])
    expect(model.graphNodes('flow_bare0001').map((n) => n.pos)).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 120 },
      { x: 0, y: 240 },
    ])
  })

  it('triggerOf falls back to manual for a document with a garbled trigger', () => {
    const model = new FlowModel([{ ...blankFlow('flow_odd00001', 'Odd'), trigger: { kind: 'nope' } }])
    expect(model.trigger('flow_odd00001')).toEqual({ kind: 'manual' })
  })

  it('graphNodes/flow of an unknown id are empty rather than throwing', () => {
    const model = new FlowModel(docs())
    expect(model.graphNodes('flow_none0001')).toEqual([])
    expect(model.flow('flow_none0001')).toBeUndefined()
  })
})

describe('FlowModel ids (CD-409)', () => {
  it('mints schema-valid flow ids and never re-issues a loaded one', () => {
    const model = new FlowModel(docs())
    const id = model.newFlowId()
    expect(id).toMatch(/^[a-z][a-z0-9]*_[a-z0-9][a-z0-9-]{5,}$/)
    const minted = new Set([id, ...Array.from({ length: 50 }, () => model.newFlowId())])
    expect(minted.has('flow_strt0001')).toBe(false)
    expect(minted.size).toBe(51)
  })

  it('mints node ids matching the schema nodeId pattern and never the trigger id', () => {
    const model = new FlowModel(docs())
    const ids = Array.from({ length: 50 }, () => model.newNodeId())
    for (const id of ids) expect(id).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/)
    expect(ids).not.toContain(TRIGGER_NODE_ID)
    expect(ids).not.toContain('n_scene01')
  })
})

describe('FlowModel mutations return exact inverses (CD-409 undo contract)', () => {
  it('addFlow / removeFlow round-trip, restoring tab position', () => {
    const model = new FlowModel(docs())
    const doc = blankFlow(model.newFlowId(), 'Third')
    const undoAdd = model.addFlow(doc)
    expect(model.list().map((f) => f.label)).toEqual(['Stream Start', 'Toggle Lights', 'Third'])
    undoAdd()
    expect(model.list()).toHaveLength(2)

    const undoRemove = model.removeFlow('flow_strt0001')
    expect(model.list().map((f) => f.id)).toEqual(['flow_lite0001'])
    undoRemove()
    expect(model.list().map((f) => f.id)).toEqual(['flow_strt0001', 'flow_lite0001'])
    expect(model.flow('flow_strt0001')!.nodes).toHaveLength(2)
  })

  it('renameFlow round-trips and never touches the key', () => {
    const model = new FlowModel(docs())
    const inverse = model.renameFlow('flow_strt0001', 'Go Live')
    expect(model.flow('flow_strt0001')!.label).toBe('Go Live')
    inverse()
    expect(model.flow('flow_strt0001')!.label).toBe('Stream Start')
  })

  it('setArmed round-trips per flow', () => {
    const model = new FlowModel(docs())
    const inverse = model.setArmed('flow_lite0001', true)
    expect(model.armed('flow_lite0001')).toBe(true)
    expect(model.armed('flow_strt0001')).toBe(true)
    inverse()
    expect(model.armed('flow_lite0001')).toBe(false)
  })

  it('addNode / removeNode round-trip, and removeNode drops incident edges', () => {
    const model = new FlowModel(docs())
    const inverse = model.removeNode('flow_strt0001', 'n_scene01')
    expect(model.flow('flow_strt0001')!.nodes.map((n) => n.id)).toEqual(['n_alert01'])
    expect(model.flow('flow_strt0001')!.edges).toEqual([])
    inverse()
    expect(model.flow('flow_strt0001')!.nodes.map((n) => n.id)).toEqual(['n_scene01', 'n_alert01'])
    expect(model.flow('flow_strt0001')!.edges).toEqual([{ from: 'n_scene01', to: 'n_alert01', label: 'always' }])
  })

  it('moveNode stores the position under the reserved ui key, preserving params', () => {
    const model = new FlowModel(docs())
    const inverse = model.moveNode('flow_lite0001', 'n_cmd0001', { x: 40, y: 80 })
    const node = model.node('flow_lite0001', 'n_cmd0001')!
    expect(readUiPos(node.params as Record<string, unknown>)).toEqual({ x: 40, y: 80 })
    expect(authoredParams(node)).toEqual({ command: 'lights.toggle' })
    inverse()
    expect(readUiPos(model.node('flow_lite0001', 'n_cmd0001')!.params as Record<string, unknown>)).toEqual({
      x: 0,
      y: 140,
    })
  })

  it('moveNode moves the synthetic trigger root through trigger.config', () => {
    const model = new FlowModel(docs())
    const inverse = model.moveNode('flow_strt0001', TRIGGER_NODE_ID, { x: 12, y: 34 })
    expect(model.graphNodes('flow_strt0001')[0]!.pos).toEqual({ x: 12, y: 34 })
    // the trigger's authored config survives the move
    expect(triggerOf(model.flow('flow_strt0001')!).config!.event).toBe('obs.streaming.started')
    inverse()
    expect(model.graphNodes('flow_strt0001')[0]!.pos).toEqual({ x: 0, y: 0 })
  })

  it('setNodeParams replaces authored params but keeps the ui position', () => {
    const model = new FlowModel(docs())
    const inverse = model.setNodeParams('flow_lite0001', 'n_cmd0001', { command: 'lights.on', retry: 2 })
    const node = model.node('flow_lite0001', 'n_cmd0001')!
    expect(authoredParams(node)).toEqual({ command: 'lights.on', retry: 2 })
    expect(readUiPos(node.params as Record<string, unknown>)).toEqual({ x: 0, y: 140 })
    inverse()
    expect(authoredParams(model.node('flow_lite0001', 'n_cmd0001')!)).toEqual({ command: 'lights.toggle' })
  })

  it('setNodeParams cannot smuggle a position in through the reserved key', () => {
    const model = new FlowModel(docs())
    model.setNodeParams('flow_lite0001', 'n_cmd0001', { [UI_PARAM_KEY]: { x: 999, y: 999 } })
    expect(readUiPos(model.node('flow_lite0001', 'n_cmd0001')!.params as Record<string, unknown>)).toEqual({
      x: 0,
      y: 140,
    })
  })

  it('addEdge / removeEdge round-trip (CD-411 builds on these)', () => {
    const model = new FlowModel(docs())
    const edge = { from: 'n_alert01', to: 'n_scene01', label: 'true' } as const
    const undoAdd = model.addEdge('flow_strt0001', edge)
    expect(model.flow('flow_strt0001')!.edges).toHaveLength(2)
    undoAdd()
    expect(model.flow('flow_strt0001')!.edges).toHaveLength(1)

    const undoRemove = model.removeEdge('flow_strt0001', { from: 'n_scene01', to: 'n_alert01', label: 'always' })
    expect(model.flow('flow_strt0001')!.edges).toEqual([])
    undoRemove()
    expect(model.flow('flow_strt0001')!.edges).toEqual([{ from: 'n_scene01', to: 'n_alert01', label: 'always' }])
  })

  it('mutating an unknown flow/node is an inert no-op', () => {
    const model = new FlowModel(docs())
    const before = model.serialize()
    model.renameFlow('flow_none0001', 'X')()
    model.setArmed('flow_none0001', true)()
    model.moveNode('flow_strt0001', 'nope', { x: 1, y: 1 })()
    model.removeNode('flow_strt0001', 'nope')()
    expect(model.serialize()).toEqual(before)
  })

  it('a random 40-op sequence fully reverts to the baseline (no escapes)', () => {
    const model = new FlowModel(docs())
    const baseline = model.serialize()
    const inverses: Array<() => void> = []
    for (let i = 0; i < 40; i++) {
      const flowId = i % 2 === 0 ? 'flow_strt0001' : 'flow_lite0001'
      switch (i % 5) {
        case 0:
          inverses.push(model.renameFlow(flowId, `Label ${i}`))
          break
        case 1:
          inverses.push(model.setArmed(flowId, i % 3 === 0))
          break
        case 2: {
          const node = { id: model.newNodeId(), kind: 'logic.gate' as const }
          inverses.push(model.addNode(flowId, node))
          break
        }
        case 3: {
          const first = model.flow(flowId)!.nodes[0]
          if (first) inverses.push(model.moveNode(flowId, first.id, { x: i, y: i * 2 }))
          break
        }
        default: {
          const doc = { id: model.newFlowId(), label: `Extra ${i}` }
          inverses.push(model.addFlow({ ...blankFlow(doc.id, doc.label) }))
          break
        }
      }
    }
    inverses.reverse().forEach((inv) => inv())
    expect(model.serialize()).toEqual(baseline)
  })
})

describe('FlowModel change notification (CD-409)', () => {
  it('reports dirty ids + structural flags so views repaint granularly', () => {
    const model = new FlowModel(docs())
    const listener = vi.fn()
    model.subscribe(listener)

    model.renameFlow('flow_strt0001', 'Go Live')
    expect(listener).toHaveBeenLastCalledWith({ structural: false, dirtyIds: ['flow_strt0001'] })
    const structuralBefore = model.structuralRev

    model.addNode('flow_strt0001', { id: 'n_new0001', kind: 'data.math' })
    expect(listener).toHaveBeenLastCalledWith({ structural: true, dirtyIds: ['flow_strt0001', 'n_new0001'] })
    expect(model.structuralRev).toBe(structuralBefore + 1)
  })

  it('version(id) bumps only for the touched flow', () => {
    const model = new FlowModel(docs())
    const other = model.version('flow_lite0001')
    model.setArmed('flow_strt0001', false)
    expect(model.version('flow_strt0001')).toBe(1)
    expect(model.version('flow_lite0001')).toBe(other)
    expect(model.revision).toBe(1)
  })

  it('unsubscribe stops delivery', () => {
    const model = new FlowModel(docs())
    const listener = vi.fn()
    model.subscribe(listener)()
    model.setArmed('flow_strt0001', false)
    expect(listener).not.toHaveBeenCalled()
  })
})
