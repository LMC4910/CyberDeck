import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { FlowModel, type FlowDocument, type FlowEdge, type FlowNode } from './flow-model'
import { useFlowRun } from './use-flow-run'

function doc(id: string, nodes: FlowNode[], edges: FlowEdge[]): FlowDocument {
  return { id, label: 'Run', version: 1, trigger: { kind: 'manual' }, nodes, edges } as FlowDocument
}
const node = (id: string, kind = 'action.notify') => ({ id, kind }) as FlowNode

/** A hand-driven scheduler: capture the pending callback and fire it on demand. */
function manualScheduler() {
  let cb: (() => void) | null = null
  return {
    schedule: (fn: () => void) => {
      cb = fn
      return 1
    },
    cancel: () => {
      cb = null
    },
    flush() {
      const fn = cb
      cb = null
      fn?.()
    },
  }
}

describe('useFlowRun (CD-414)', () => {
  it('starts idle, then locks + pulses the first node on start (edit-lock)', () => {
    const model = new FlowModel([doc('flow_lin000001', [node('a'), node('b')], [{ from: 'a', to: 'b' }])])
    const s = manualScheduler()
    const { result } = renderHook(() =>
      useFlowRun(model, 'flow_lin000001', { schedule: s.schedule, cancel: s.cancel, stepMs: 10 }),
    )

    expect(result.current.locked).toBe(false)
    expect(result.current.runPhase('a')).toBeUndefined()

    act(() => result.current.start())
    expect(result.current.locked).toBe(true) // editing is locked while running
    expect(result.current.running).toBe(true)
    expect(result.current.runPhase('a')).toBe('active')
    expect(result.current.runPhase('b')).toBe('pending')
    // the active edge pulses
    expect([...result.current.activeEdgeKeys]).toEqual([]) // root step has no incoming edge yet
  })

  it('advances through the trace and settles into a done state that stays locked', () => {
    const model = new FlowModel([doc('flow_lin000002', [node('a'), node('b')], [{ from: 'a', to: 'b' }])])
    const s = manualScheduler()
    const { result } = renderHook(() =>
      useFlowRun(model, 'flow_lin000002', { schedule: s.schedule, cancel: s.cancel, stepMs: 10 }),
    )
    act(() => result.current.start())
    act(() => s.flush()) // reveal step 2 (b), which is the last → completes

    expect(result.current.done).toBe(true)
    expect(result.current.runPhase('a')).toBe('done')
    expect(result.current.runPhase('b')).toBe('done')
    expect(result.current.locked).toBe(true) // still showing the result until Stop
    expect(result.current.log.map((e) => e.nodeId)).toEqual(['a', 'b'])
    expect(result.current.log.map((e) => e.atMs)).toEqual([0, 10]) // order × stepMs
  })

  it('stop() clears the run and unlocks editing', () => {
    const model = new FlowModel([doc('flow_lin000003', [node('a')], [])])
    const s = manualScheduler()
    const { result } = renderHook(() => useFlowRun(model, 'flow_lin000003', { schedule: s.schedule, cancel: s.cancel }))
    act(() => result.current.start())
    act(() => result.current.stop())
    expect(result.current.locked).toBe(false)
    expect(result.current.runPhase('a')).toBeUndefined()
    expect(result.current.log).toEqual([])
  })

  it('surfaces the cycle warning from the trace', () => {
    const model = new FlowModel([
      doc('flow_cyc000001', [node('a'), node('b')], [{ from: 'a', to: 'b' }, { from: 'b', to: 'a' }]),
    ])
    const s = manualScheduler()
    const { result } = renderHook(() => useFlowRun(model, 'flow_cyc000001', { schedule: s.schedule, cancel: s.cancel }))
    act(() => result.current.start())
    expect(result.current.cycle).toBe(true)
  })
})
