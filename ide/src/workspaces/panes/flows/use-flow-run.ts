// Test-run animation hook (CD-414). Wraps a FlowTraceAdapter (the local sim by
// default; CD-518 injects the engine trace) and reveals its steps over time: it
// exposes runPhase()/activeEdgeKeys for the graph's pulse/done/dimmed visuals, a step
// log with timings for the inspector, and start/stop so the pane can lock editing
// while a run is live. The scheduler is injectable so tests drive it frame by frame.
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { RunPhase } from './flow-graph'
import type { FlowModel } from './flow-model'
import { localSimAdapter, type FlowTrace, type FlowTraceAdapter } from './flow-simulator'

export interface FlowRunLogEntry {
  nodeId: string
  order: number
  atMs: number
}

export interface UseFlowRunOptions {
  adapter?: FlowTraceAdapter
  /** Delay between revealed steps. */
  stepMs?: number
  schedule?: (fn: () => void, ms: number) => number
  cancel?: (handle: number) => void
}

export interface FlowRun {
  /** A run is live (running or showing its result) — the pane locks editing on this. */
  locked: boolean
  running: boolean
  done: boolean
  cycle: boolean
  runPhase: (nodeId: string) => RunPhase | undefined
  activeEdgeKeys: ReadonlySet<string>
  /** True when a node participates in the trace (others are dimmed during a run). */
  inTrace: (nodeId: string) => boolean
  log: readonly FlowRunLogEntry[]
  /** Start (or replay) the run from the top. */
  start: () => void
  stop: () => void
}

const EMPTY_EDGES: ReadonlySet<string> = new Set()

export function useFlowRun(model: FlowModel, flowId: string, options: UseFlowRunOptions = {}): FlowRun {
  const adapter = options.adapter ?? localSimAdapter
  const stepMs = options.stepMs ?? 400
  const schedule = options.schedule ?? ((fn, ms) => setTimeout(fn, ms) as unknown as number)
  const cancel = options.cancel ?? ((h) => clearTimeout(h))

  const [trace, setTrace] = useState<FlowTrace | null>(null)
  const [index, setIndex] = useState(-1) // order of the currently-active step
  const [phase, setPhase] = useState<'idle' | 'running' | 'done'>('idle')

  // Cleared when the active flow changes so a stale trace never lights another graph.
  useEffect(() => {
    setPhase('idle')
    setTrace(null)
    setIndex(-1)
  }, [flowId])

  const start = useCallback(() => {
    const doc = model.flow(flowId)
    if (!doc) return
    const t = adapter.trace(doc)
    setTrace(t)
    setIndex(0)
    setPhase(t.steps.length > 0 ? 'running' : 'done')
  }, [model, flowId, adapter])

  const stop = useCallback(() => {
    setPhase('idle')
    setTrace(null)
    setIndex(-1)
  }, [])

  useEffect(() => {
    if (phase !== 'running' || !trace) return
    if (index >= trace.steps.length - 1) {
      setPhase('done')
      return
    }
    const handle = schedule(() => setIndex((i) => i + 1), stepMs)
    return () => cancel(handle)
  }, [phase, index, trace, schedule, cancel, stepMs])

  const runPhase = useCallback(
    (nodeId: string): RunPhase | undefined => {
      if (!trace || phase === 'idle') return undefined
      const step = trace.steps.find((s) => s.nodeId === nodeId)
      if (!step) return undefined
      if (phase === 'done') return 'done'
      if (step.order < index) return 'done'
      if (step.order === index) return 'active'
      return 'pending'
    },
    [trace, phase, index],
  )

  const activeEdgeKeys = useMemoActiveEdges(trace, index, phase)

  const inTrace = useCallback(
    (nodeId: string) => (trace ? trace.steps.some((s) => s.nodeId === nodeId) : false),
    [trace],
  )

  const log: FlowRunLogEntry[] =
    trace && phase !== 'idle'
      ? trace.steps
          .filter((s) => phase === 'done' || s.order <= index)
          .map((s) => ({ nodeId: s.nodeId, order: s.order, atMs: s.order * stepMs }))
      : []

  return {
    locked: phase !== 'idle',
    running: phase === 'running',
    done: phase === 'done',
    cycle: trace?.cycle ?? false,
    runPhase,
    activeEdgeKeys,
    inTrace,
    log,
    start,
    stop,
  }
}

/** The edge feeding the currently-active step pulses; nothing pulses once done. */
function useMemoActiveEdges(trace: FlowTrace | null, index: number, phase: string): ReadonlySet<string> {
  return useMemo(() => {
    if (!trace || phase !== 'running') return EMPTY_EDGES
    const step = trace.steps.find((s) => s.order === index)
    if (!step?.via) return EMPTY_EDGES
    return new Set([`${step.via.from}~${step.via.to}~${step.via.label}`])
  }, [trace, index, phase])
}
