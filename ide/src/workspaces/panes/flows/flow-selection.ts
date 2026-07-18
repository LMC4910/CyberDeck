// Flow graph selection (CD-411 edge select · CD-412 multi-node select). A small,
// pure, immutable selection value the workspace holds in React state — deliberately
// LOCAL rather than the global widget Selection store (CD-305): that store is bound to
// the ProjectModel (its marquee needs widgets, its `kind` is widget/page) and is a
// singleton shared with the deck-designer, so pushing flow-node ids through it would
// leak a foreign namespace across the workspace boundary. Instead this reuses the
// shared hit-test geometry (`@/stores` rectFromCorners/frameIntersectsRect) — the same
// math the canvas marquee uses — without a 14th store.
import { rectFromCorners, frameIntersectsRect, type Rect } from '@/stores'
import { NODE_W, NODE_H } from './flow-catalog'
import { edgesEqual, type FlowEdge, type GraphNode } from './flow-model'
import type { Point } from '@/shared/canvas'

/** A node/edge selection. At most one edge is selected at a time; nodes are a set.
 *  Selecting nodes clears the edge and vice-versa (they are different inspectors). */
export interface FlowSelection {
  readonly nodes: ReadonlySet<string>
  readonly edge: FlowEdge | null
  /** Anchor node for future range ops; last node touched. */
  readonly anchor: string | null
}

export const EMPTY_SELECTION: FlowSelection = { nodes: new Set(), edge: null, anchor: null }

export interface ClickMods {
  shift: boolean
  meta: boolean
}

export function isNodeSelected(sel: FlowSelection, id: string): boolean {
  return sel.nodes.has(id)
}

export function isEdgeSelected(sel: FlowSelection, edge: FlowEdge): boolean {
  return sel.edge != null && edgesEqual(sel.edge, edge)
}

/** Plain click selects only `id`; ⇧/⌘ click toggles it in/out of the set (additive). */
export function clickNode(sel: FlowSelection, id: string, mods: ClickMods): FlowSelection {
  if (mods.shift || mods.meta) {
    const nodes = new Set(sel.nodes)
    if (nodes.has(id)) nodes.delete(id)
    else nodes.add(id)
    return { nodes, edge: null, anchor: nodes.has(id) ? id : sel.anchor }
  }
  return { nodes: new Set([id]), edge: null, anchor: id }
}

export function selectEdge(edge: FlowEdge): FlowSelection {
  return { nodes: new Set(), edge, anchor: null }
}

export function clearSelection(): FlowSelection {
  return EMPTY_SELECTION
}

export function selectNodes(ids: Iterable<string>): FlowSelection {
  const nodes = new Set(ids)
  return { nodes, edge: null, anchor: [...nodes].at(-1) ?? null }
}

const nodeRectOf = (n: GraphNode): Rect => ({ x: n.pos.x, y: n.pos.y, w: NODE_W, h: NODE_H })

/**
 * Marquee-select every node whose box intersects the world rect between two corners.
 * `additive` unions with the current node set (⇧-drag); otherwise it replaces it.
 */
export function marqueeNodes(
  sel: FlowSelection,
  cornerA: Point,
  cornerB: Point,
  nodes: readonly GraphNode[],
  additive: boolean,
): FlowSelection {
  const rect = rectFromCorners(cornerA, cornerB)
  const hits = nodes.filter((n) => frameIntersectsRect(nodeRectOf(n), rect)).map((n) => n.id)
  const base = additive ? [...sel.nodes] : []
  return selectNodes([...base, ...hits])
}
