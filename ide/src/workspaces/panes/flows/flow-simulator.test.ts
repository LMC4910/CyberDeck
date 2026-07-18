import { describe, it, expect } from 'vitest'
import type { FlowDocument, FlowEdge, FlowNode } from './flow-model'
import { simulateFlow } from './flow-simulator'

function doc(nodes: FlowNode[], edges: FlowEdge[]): FlowDocument {
  return { id: 'flow_test01', label: 'Test', version: 1, trigger: { kind: 'manual' }, nodes, edges } as FlowDocument
}
const node = (id: string, kind = 'action.notify') => ({ id, kind }) as FlowNode
const ids = (t: { steps: readonly { nodeId: string }[] }) => t.steps.map((s) => s.nodeId)

describe('simulateFlow (CD-414)', () => {
  it('walks a linear flow root→leaf in deterministic order', () => {
    const t = simulateFlow(doc([node('a'), node('b'), node('c')], [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
    ]))
    expect(ids(t)).toEqual(['a', 'b', 'c'])
    expect(t.cycle).toBe(false)
    expect(t.steps.map((s) => s.order)).toEqual([0, 1, 2])
  })

  it('starts every in-degree-0 root in document order', () => {
    const t = simulateFlow(doc([node('a'), node('b')], [])) // two disjoint roots
    expect(ids(t)).toEqual(['a', 'b'])
  })

  it('takes the TRUE branch at a condition node and skips the FALSE port (AC: branch selection)', () => {
    const t = simulateFlow(
      doc([node('c', 'logic.condition'), node('yes'), node('no')], [
        { from: 'c', to: 'yes', label: 'true' },
        { from: 'c', to: 'no', label: 'false' },
      ]),
    )
    expect(ids(t)).toEqual(['c', 'yes'])
    expect(ids(t)).not.toContain('no')
  })

  it('still follows an unconditional (always) edge out of a condition node', () => {
    const t = simulateFlow(
      doc([node('c', 'logic.condition'), node('yes'), node('side')], [
        { from: 'c', to: 'yes', label: 'true' },
        { from: 'c', to: 'side', label: 'always' },
      ]),
    )
    expect(ids(t).sort()).toEqual(['c', 'side', 'yes'])
  })

  it('terminates a reachable cycle and raises the warning (AC: cycle terminates)', () => {
    const t = simulateFlow(doc([node('a'), node('b')], [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'a' }, // back-edge
    ]))
    expect(t.cycle).toBe(true)
    expect(ids(t)).toEqual(['a', 'b']) // each node executes exactly once, then stops
  })

  it('executes each node at most once even with diamond re-convergence (no double-visit)', () => {
    const t = simulateFlow(
      doc([node('a'), node('b'), node('c'), node('d')], [
        { from: 'a', to: 'b' },
        { from: 'a', to: 'c' },
        { from: 'b', to: 'd' },
        { from: 'c', to: 'd' },
      ]),
    )
    expect(ids(t).filter((x) => x === 'd')).toHaveLength(1)
    expect(t.cycle).toBe(false)
  })

  it('records the traversed edge keys for the animated overlay', () => {
    const t = simulateFlow(doc([node('a'), node('b')], [{ from: 'a', to: 'b', label: 'always' }]))
    expect(t.edgeKeys).toEqual(['a~b~always'])
  })

  it('handles an empty flow without throwing', () => {
    const t = simulateFlow(doc([], []))
    expect(t.steps).toEqual([])
    expect(t.cycle).toBe(false)
  })
})
