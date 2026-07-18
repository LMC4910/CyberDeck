// Flow test-run simulator (CD-414). A PURE graph walk over a flow document: from the
// roots (in-degree-0 nodes, in document order), DFS following each node's outgoing
// edges, deterministic and cycle-safe. Condition/branch nodes take the TRUE branch
// (plus unconditional `always` edges) so a run is repeatable; a genuine back-edge
// terminates the walk and raises a cycle warning. The engine ships a real trace at
// CD-518 — this implements the same FlowTraceAdapter interface so the swap is a
// one-line change in the run hook, not a rewrite of the visuals.
import { edgeKey, type BranchLabel, type FlowDocument, type FlowEdge } from './flow-model'

export interface FlowTraceStep {
  nodeId: string
  /** 0-based execution order. */
  order: number
  /** The edge that led here (root steps have none) — drives the animated-edge overlay. */
  via?: { from: string; to: string; label: BranchLabel }
}

export interface FlowTrace {
  steps: readonly FlowTraceStep[]
  /** Keys of every edge traversed, for FlowGraph's activeEdgeKeys. */
  edgeKeys: readonly string[]
  /** A reachable cycle was detected and the walk terminated at the back-edge. */
  cycle: boolean
}

/** The seam CD-518 replaces with an engine-backed trace. Same in/out as the local sim. */
export interface FlowTraceAdapter {
  trace(doc: FlowDocument): FlowTrace
}

const BRANCHING_KINDS = new Set(['logic.condition', 'logic.branch'])

/** Edges a node fires. Branch nodes take TRUE + `always` (skip the FALSE port); every
 *  other node fires all of its outgoing edges. Document order is preserved. */
function firedEdges(kind: string | undefined, out: readonly FlowEdge[]): readonly FlowEdge[] {
  if (kind && BRANCHING_KINDS.has(kind)) return out.filter((e) => (e.label ?? 'always') !== 'false')
  return out
}

/** Deterministic, cycle-safe execution trace for a flow document. */
export function simulateFlow(doc: FlowDocument): FlowTrace {
  const out = new Map<string, FlowEdge[]>()
  const indeg = new Map<string, number>()
  const kindOf = new Map<string, string>()
  for (const n of doc.nodes) {
    indeg.set(n.id, 0)
    kindOf.set(n.id, n.kind)
  }
  for (const e of doc.edges) {
    if (!out.has(e.from)) out.set(e.from, [])
    out.get(e.from)!.push(e)
    if (indeg.has(e.to)) indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1)
  }

  const steps: FlowTraceStep[] = []
  const edgeKeys: string[] = []
  const visited = new Set<string>()
  const stack = new Set<string>()
  let cycle = false
  let order = 0

  const walk = (id: string, via?: FlowEdge): void => {
    if (stack.has(id)) {
      cycle = true // back-edge into an ancestor on the current path
      return
    }
    if (visited.has(id)) return
    visited.add(id)
    stack.add(id)
    steps.push({
      nodeId: id,
      order: order++,
      via: via ? { from: via.from, to: via.to, label: via.label ?? 'always' } : undefined,
    })
    if (via) edgeKeys.push(edgeKey(via))
    for (const e of firedEdges(kindOf.get(id), out.get(id) ?? [])) walk(e.to, e)
    stack.delete(id)
  }

  for (const n of doc.nodes) {
    if ((indeg.get(n.id) ?? 0) === 0) walk(n.id)
  }
  // A flow that is one closed cycle has no in-degree-0 root; enter at the first node so
  // the walk still runs (and trips the cycle warning) rather than doing nothing.
  if (steps.length === 0 && doc.nodes.length > 0) walk(doc.nodes[0]!.id)

  return { steps, edgeKeys, cycle }
}

/** The default adapter: the local pure simulator. CD-518 swaps an engine-trace adapter. */
export const localSimAdapter: FlowTraceAdapter = { trace: simulateFlow }
