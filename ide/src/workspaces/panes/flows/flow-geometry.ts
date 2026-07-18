// Flow graph geometry (CD-411). Pure functions that turn live node geometry into the
// port anchors and edge paths the edge layer draws — so an edge tracks its endpoints
// as the nodes move (the anchors are recomputed from `node.pos` every render, never
// stored). Condition nodes expose two out-ports (true/false); every other node a
// single `always` port. The trigger root has NO out-ports: the engine fires a flow's
// ROOT nodes implicitly, so the trigger is never an edge endpoint (flow-starter.ts).
import { NODE_W, NODE_H } from './flow-catalog'
import { TRIGGER_NODE_ID, type BranchLabel, type FlowEdge, type GraphNode } from './flow-model'
import type { Point } from '@/shared/canvas'

export const CONDITION_KIND = 'logic.condition'

/** A condition exposes distinct true/false out-ports; the palette also has an explicit
 *  `logic.branch` that reads the same way. */
export function isBranchingKind(kind: string): boolean {
  return kind === CONDITION_KIND || kind === 'logic.branch'
}

export interface OutPort {
  label: BranchLabel
  pos: Point
}

/** Input anchor: the node's left edge, vertically centred. */
export function inPort(pos: Point): Point {
  return { x: pos.x, y: pos.y + NODE_H / 2 }
}

/**
 * Out-ports for a node. A branching node splits its right edge into an upper `true`
 * and a lower `false` port; any other node has one `always` port at right-centre. The
 * trigger root has none.
 */
export function outPorts(node: GraphNode): OutPort[] {
  if (node.id === TRIGGER_NODE_ID) return []
  const rx = node.pos.x + NODE_W
  if (isBranchingKind(node.kind)) {
    return [
      { label: 'true', pos: { x: rx, y: node.pos.y + NODE_H * 0.3 } },
      { label: 'false', pos: { x: rx, y: node.pos.y + NODE_H * 0.7 } },
    ]
  }
  return [{ label: 'always', pos: { x: rx, y: node.pos.y + NODE_H / 2 } }]
}

/** The out-port on `node` an edge with `label` leaves from (falls back to the first). */
export function outPortFor(node: GraphNode, label: BranchLabel | undefined): Point {
  const ports = outPorts(node)
  const found = ports.find((p) => p.label === (label ?? 'always')) ?? ports[0]
  return found ? found.pos : { x: node.pos.x + NODE_W, y: node.pos.y + NODE_H / 2 }
}

/** A cubic-bezier SVG path from an out-port to an in-port (horizontal easing). */
export function edgePath(from: Point, to: Point): string {
  const dx = Math.max(36, Math.abs(to.x - from.x) * 0.5)
  return `M ${from.x} ${from.y} C ${from.x + dx} ${from.y}, ${to.x - dx} ${to.y}, ${to.x} ${to.y}`
}

export function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

export interface ResolvedEdge {
  edge: FlowEdge
  from: Point
  to: Point
  mid: Point
  label: BranchLabel
}

/** Resolve every edge to its live endpoint anchors, dropping any whose endpoints are
 *  no longer present (defensive — the model already prunes on node removal). */
export function resolveEdges(nodes: readonly GraphNode[], edges: readonly FlowEdge[]): ResolvedEdge[] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const out: ResolvedEdge[] = []
  for (const e of edges) {
    const a = byId.get(e.from)
    const b = byId.get(e.to)
    if (!a || !b) continue
    const label = (e.label ?? 'always') as BranchLabel
    const from = outPortFor(a, label)
    const to = inPort(b.pos)
    out.push({ edge: e, from, to, mid: midpoint(from, to), label })
  }
  return out
}

/** The topmost node whose box contains `world`, honouring an optional exclude. Scans
 *  back-to-front so a later-drawn node wins (matches paint order). */
export function nodeAt(
  nodes: readonly GraphNode[],
  world: Point,
  exclude?: (n: GraphNode) => boolean,
): GraphNode | null {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i]!
    if (exclude?.(n)) continue
    if (
      world.x >= n.pos.x &&
      world.x <= n.pos.x + NODE_W &&
      world.y >= n.pos.y &&
      world.y <= n.pos.y + NODE_H
    ) {
      return n
    }
  }
  return null
}
