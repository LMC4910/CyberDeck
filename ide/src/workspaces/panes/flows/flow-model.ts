// FlowModel (CD-409) — the in-memory authoring model for the Flows workspace, bound
// to the generated `cyberdeck.flow` contract (CD-112). It holds MANY flows (the tab
// strip switches between them); each flow owns its own trigger, nodes, edges and
// armed state.
//
// Contract (mirrors ProjectModel, CD-302):
//   • Every entity is keyed by an opaque stable id minted by the shared IdAllocator;
//     ids are never derived from labels, so renaming never touches a key.
//   • Every MUTATION performs its change and returns an `Inverse` that exactly
//     reverts it — that is what the undo stack records. Ids for created entities are
//     minted ONCE by the caller (newFlowId/newNodeId) so redo reuses them and never
//     regenerates keys.
//   • Graph positions persist inside the document's free-key bags (`node.params` /
//     `trigger.config`) under the reserved `ui` key — the same trick CD-302 uses for
//     group childIds. FLOW_MAPPING.md §"known deviations": the engine ignores unknown
//     JSON keys, so an authored flow round-trips through FlowsRepository (and later
//     the engine) with its layout intact.
//   • The trigger is a top-level document field, not a node. The graph renders it as
//     a synthetic root node (TRIGGER_NODE_ID) so the 6 node categories (Triggers /
//     Logic / Data / Integrations / Actions / Structure) all draw the same way.
import { IdAllocator, type Inverse } from '@/shared/project'
import type { Point } from '@/shared/canvas'
import type { CyberDeckFlowDocumentCyberdeckFlow as FlowDocument } from '@/shared/contract'

export type { FlowDocument }
export type FlowNode = FlowDocument['nodes'][number]
export type FlowEdge = FlowDocument['edges'][number]
export type NodeKind = FlowNode['kind']
export type BranchLabel = NonNullable<FlowEdge['label']>

/** Trigger kinds from the schema (triggers.go). The generated `trigger` type erases
 *  to an index signature because of the schema's per-kind allOf, so the model reads
 *  and writes it through this narrow view. */
export type TriggerKind = 'manual' | 'event' | 'stateChange' | 'schedule'
export const TRIGGER_KINDS: readonly TriggerKind[] = ['manual', 'event', 'stateChange', 'schedule']
export interface FlowTrigger {
  kind: TriggerKind
  config?: Record<string, unknown>
}

/** The 6 node categories (00_Product_Baseline §Automation). Category is derived from
 *  the kind prefix — there is no second registry to keep in sync. */
export const NODE_CATEGORIES = ['trigger', 'logic', 'data', 'integration', 'action', 'structure'] as const
export type NodeCategory = (typeof NODE_CATEGORIES)[number]

const CATEGORY_SET: ReadonlySet<string> = new Set(NODE_CATEGORIES)

/** Category of a node kind (`logic.condition` → `logic`). An unknown prefix (a future
 *  or plugin-contributed node) falls back to `structure` so the graph renders it in a
 *  neutral colour rather than crashing. */
export function categoryOf(kind: string): NodeCategory {
  const prefix = kind.split('.')[0] ?? ''
  return CATEGORY_SET.has(prefix) ? (prefix as NodeCategory) : 'structure'
}

/** Id of the synthetic trigger node. Reserved with the allocator so no minted node
 *  id can ever collide with it. */
export const TRIGGER_NODE_ID = 'trigger'

/** Reserved key inside `node.params` / `trigger.config` holding IDE-only
 *  presentation state. Namespaced so it can never collide with a real per-kind param
 *  — the CD-413 inspectors generate fields from the param schema and must skip it. */
export const UI_PARAM_KEY = 'ui'

/** A node as the graph draws it: the synthetic trigger root followed by the document's
 *  nodes, each already resolved to a category + world position. */
export interface GraphNode {
  id: string
  /** `trigger.<kind>` for the synthetic root, else the node's catalog kind. */
  kind: string
  category: NodeCategory
  pos: Point
}

/** Vertical fallback spacing for nodes with no stored position (see `graphNodes`). */
const AUTO_STEP_Y = 120

export interface FlowChange {
  /** Structural changes (add/remove flow, add/remove node or edge) invalidate
   *  index-derived views. */
  structural: boolean
  /** Entities the change touched (flow ids and node ids), for render granularity. */
  dirtyIds: string[]
}

export type FlowListener = (change: FlowChange) => void

// ── document helpers ────────────────────────────────────────────────────────────

/** Read the document's trigger through the narrow view. A document that somehow
 *  carries no kind reads as `manual` (the schema requires one; this keeps a corrupt
 *  blob rendering instead of throwing). */
export function triggerOf(doc: FlowDocument): FlowTrigger {
  const raw = doc.trigger as { kind?: unknown; config?: unknown }
  const kind = TRIGGER_KINDS.find((k) => k === raw.kind) ?? 'manual'
  const config = raw.config && typeof raw.config === 'object' ? (raw.config as Record<string, unknown>) : undefined
  return config ? { kind, config } : { kind }
}

function bagOf(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined
}

/** Read the `ui` position out of a params/config bag, or null when unpositioned. */
export function readUiPos(bag: Record<string, unknown> | undefined): Point | null {
  const ui = bagOf(bag?.[UI_PARAM_KEY])
  return typeof ui?.x === 'number' && typeof ui.y === 'number' ? { x: ui.x, y: ui.y } : null
}

/** A copy of `bag` carrying `pos` under the reserved `ui` key. */
export function writeUiPos(bag: Record<string, unknown> | undefined, pos: Point): Record<string, unknown> {
  return { ...bag, [UI_PARAM_KEY]: { x: pos.x, y: pos.y } }
}

/** FlowTrigger → the document's trigger field. The generated type erases to an index
 *  signature (the schema expresses the per-kind shape with allOf/if-then), so the
 *  narrow view is widened back on the way in. */
function toTriggerField(t: FlowTrigger): FlowDocument['trigger'] {
  return { kind: t.kind, ...(t.config ? { config: t.config } : {}) }
}

/** Per-kind params with the reserved presentation key removed — what a CD-413
 *  inspector generates its fields from. */
export function authoredParams(node: FlowNode): Record<string, unknown> {
  const { [UI_PARAM_KEY]: _ui, ...rest } = (node.params ?? {}) as Record<string, unknown>
  return rest
}

/** A blank flow: manual trigger, no nodes. `id` must come from `newFlowId()`. */
export function blankFlow(id: string, label: string): FlowDocument {
  return {
    id,
    label,
    version: 1,
    armed: false,
    trigger: { kind: 'manual', config: { [UI_PARAM_KEY]: { x: 0, y: 0 } } },
    nodes: [],
    edges: [],
  }
}

function collectIds(docs: FlowDocument[]): string[] {
  const ids = [TRIGGER_NODE_ID]
  for (const d of docs) {
    ids.push(d.id)
    for (const n of d.nodes) ids.push(n.id)
  }
  return ids
}

// ── model ───────────────────────────────────────────────────────────────────────

export class FlowModel {
  private docs: FlowDocument[]
  private readonly ids: IdAllocator
  private readonly listeners = new Set<FlowListener>()
  private readonly versions = new Map<string, number>()
  private revCounter = 0
  private structuralRevCounter = 0

  constructor(docs: FlowDocument[] = []) {
    this.docs = structuredClone(docs)
    this.ids = new IdAllocator(undefined, collectIds(this.docs))
  }

  // ── ids ───────────────────────────────────────────────────────────────────
  /** Mint a flow id (schema pattern `flow_……`). Call ONCE, before the mutation. */
  newFlowId(): string {
    return this.ids.next('flow')
  }
  /** Mint a node id. Call ONCE, before the mutation. */
  newNodeId(): string {
    return this.ids.next('n')
  }

  // ── subscription ──────────────────────────────────────────────────────────
  subscribe(listener: FlowListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(dirtyIds: string[], structural = false): void {
    if (structural) this.structuralRevCounter++
    for (const id of dirtyIds) this.versions.set(id, (this.versions.get(id) ?? 0) + 1)
    this.revCounter++
    const change: FlowChange = { structural, dirtyIds }
    for (const l of this.listeners) l(change)
  }

  /** Change counter for one entity — bumps whenever that id is a dirty target. */
  version(id: string): number {
    return this.versions.get(id) ?? 0
  }
  /** Monotonic counter that bumps on ANY change. */
  get revision(): number {
    return this.revCounter
  }
  /** Revision that bumps on any structural change (flow/node/edge add or remove). */
  get structuralRev(): number {
    return this.structuralRevCounter
  }

  // ── reads ─────────────────────────────────────────────────────────────────
  /** The flows in tab order (live objects — never mutate them outside the model). */
  list(): readonly FlowDocument[] {
    return this.docs
  }
  flow(id: string): FlowDocument | undefined {
    return this.docs.find((f) => f.id === id)
  }
  node(flowId: string, nodeId: string): FlowNode | undefined {
    return this.flow(flowId)?.nodes.find((n) => n.id === nodeId)
  }
  trigger(flowId: string): FlowTrigger | undefined {
    const doc = this.flow(flowId)
    return doc ? triggerOf(doc) : undefined
  }
  armed(flowId: string): boolean {
    return this.flow(flowId)?.armed ?? false
  }

  /**
   * The flow's nodes as the graph draws them: the synthetic trigger root first, then
   * the document's nodes. Nodes with no stored position fall back to a deterministic
   * column so an engine-authored flow (which carries no IDE layout) still renders
   * readably; the first drag stamps a real position.
   */
  graphNodes(flowId: string): GraphNode[] {
    const doc = this.flow(flowId)
    if (!doc) return []
    const t = triggerOf(doc)
    const out: GraphNode[] = [
      {
        id: TRIGGER_NODE_ID,
        kind: `trigger.${t.kind}`,
        category: 'trigger',
        pos: readUiPos(t.config) ?? { x: 0, y: 0 },
      },
    ]
    doc.nodes.forEach((n, i) => {
      out.push({
        id: n.id,
        kind: n.kind,
        category: categoryOf(n.kind),
        pos: readUiPos(n.params as Record<string, unknown> | undefined) ?? { x: 0, y: (i + 1) * AUTO_STEP_Y },
      })
    })
    return out
  }

  /** Deep copy of every flow — what the persistence seam writes. */
  serialize(): FlowDocument[] {
    return structuredClone(this.docs)
  }

  // ── flow mutations ────────────────────────────────────────────────────────
  /** Insert a flow (default: append). `doc.id` must come from `newFlowId()`. */
  addFlow(doc: FlowDocument, index = this.docs.length): Inverse {
    const at = Math.max(0, Math.min(index, this.docs.length))
    this.ids.reserve(doc.id)
    this.docs.splice(at, 0, structuredClone(doc))
    this.emit([doc.id], true)
    return () => {
      const i = this.docs.findIndex((f) => f.id === doc.id)
      if (i >= 0) this.docs.splice(i, 1)
      this.emit([doc.id], true)
    }
  }

  removeFlow(id: string): Inverse {
    const index = this.docs.findIndex((f) => f.id === id)
    if (index < 0) return () => {}
    // Snapshot the whole document so the inverse restores it byte-for-byte at its
    // original tab position (redo-safe: re-applying re-removes the same id).
    const snapshot = structuredClone(this.docs[index]!)
    this.docs.splice(index, 1)
    this.emit([id], true)
    return () => {
      this.docs.splice(Math.min(index, this.docs.length), 0, structuredClone(snapshot))
      this.emit([id], true)
    }
  }

  renameFlow(id: string, label: string): Inverse {
    const doc = this.flow(id)
    if (!doc || doc.label === label) return () => {}
    const before = doc.label
    doc.label = label
    this.emit([id])
    return () => {
      const d = this.flow(id)
      if (d) d.label = before
      this.emit([id])
    }
  }

  setArmed(id: string, armed: boolean): Inverse {
    const doc = this.flow(id)
    if (!doc || (doc.armed ?? false) === armed) return () => {}
    const before = doc.armed ?? false
    doc.armed = armed
    this.emit([id])
    return () => {
      const d = this.flow(id)
      if (d) d.armed = before
      this.emit([id])
    }
  }

  setTrigger(id: string, trigger: FlowTrigger): Inverse {
    const doc = this.flow(id)
    if (!doc) return () => {}
    const before = structuredClone(doc.trigger)
    doc.trigger = structuredClone(toTriggerField(trigger))
    this.emit([id, TRIGGER_NODE_ID])
    return () => {
      const d = this.flow(id)
      if (d) d.trigger = structuredClone(before)
      this.emit([id, TRIGGER_NODE_ID])
    }
  }

  // ── node mutations ────────────────────────────────────────────────────────
  /** Append a node. `node.id` must come from `newNodeId()`. */
  addNode(flowId: string, node: FlowNode): Inverse {
    const doc = this.flow(flowId)
    if (!doc) return () => {}
    this.ids.reserve(node.id)
    doc.nodes.push(structuredClone(node))
    this.emit([flowId, node.id], true)
    return () => {
      const d = this.flow(flowId)
      const i = d?.nodes.findIndex((n) => n.id === node.id) ?? -1
      if (d && i >= 0) d.nodes.splice(i, 1)
      this.emit([flowId, node.id], true)
    }
  }

  /** Remove a node and every edge incident to it (no dangling refs). */
  removeNode(flowId: string, nodeId: string): Inverse {
    const doc = this.flow(flowId)
    const index = doc?.nodes.findIndex((n) => n.id === nodeId) ?? -1
    if (!doc || index < 0) return () => {}
    const snapshot = structuredClone(doc.nodes[index]!)
    const edges = structuredClone(doc.edges)
    doc.nodes.splice(index, 1)
    doc.edges = doc.edges.filter((e) => e.from !== nodeId && e.to !== nodeId)
    this.emit([flowId, nodeId], true)
    return () => {
      const d = this.flow(flowId)
      if (!d) return
      d.nodes.splice(Math.min(index, d.nodes.length), 0, structuredClone(snapshot))
      d.edges = structuredClone(edges)
      this.emit([flowId, nodeId], true)
    }
  }

  /** Move a node (or the synthetic trigger root) to a world position. */
  moveNode(flowId: string, nodeId: string, pos: Point): Inverse {
    const doc = this.flow(flowId)
    if (!doc) return () => {}
    if (nodeId === TRIGGER_NODE_ID) {
      const before = structuredClone(doc.trigger)
      const t = triggerOf(doc)
      doc.trigger = { ...t, config: writeUiPos(t.config, pos) } as FlowDocument['trigger']
      this.emit([flowId, nodeId])
      return () => {
        const d = this.flow(flowId)
        if (d) d.trigger = structuredClone(before)
        this.emit([flowId, nodeId])
      }
    }
    const node = doc.nodes.find((n) => n.id === nodeId)
    if (!node) return () => {}
    const before = structuredClone(node.params ?? {})
    node.params = writeUiPos(node.params as Record<string, unknown> | undefined, pos) as FlowNode['params']
    this.emit([flowId, nodeId])
    return () => {
      const n = this.node(flowId, nodeId)
      if (n) n.params = structuredClone(before) as FlowNode['params']
      this.emit([flowId, nodeId])
    }
  }

  /** Replace a node's authored params, preserving the reserved `ui` position
   *  (CD-413 writes through here). */
  setNodeParams(flowId: string, nodeId: string, params: Record<string, unknown>): Inverse {
    const node = this.node(flowId, nodeId)
    if (!node) return () => {}
    const before = structuredClone(node.params ?? {}) as Record<string, unknown>
    const ui = before[UI_PARAM_KEY]
    const { [UI_PARAM_KEY]: _drop, ...authored } = params
    node.params = (ui === undefined ? authored : { ...authored, [UI_PARAM_KEY]: ui }) as FlowNode['params']
    this.emit([flowId, nodeId])
    return () => {
      const n = this.node(flowId, nodeId)
      if (n) n.params = structuredClone(before) as FlowNode['params']
      this.emit([flowId, nodeId])
    }
  }

  // ── edge mutations (CD-411 builds its engine on these) ─────────────────────
  addEdge(flowId: string, edge: FlowEdge): Inverse {
    const doc = this.flow(flowId)
    if (!doc) return () => {}
    doc.edges.push(structuredClone(edge))
    this.emit([flowId, edge.from, edge.to], true)
    return () => {
      const d = this.flow(flowId)
      if (d) d.edges = d.edges.filter((e) => !sameEdge(e, edge))
      this.emit([flowId, edge.from, edge.to], true)
    }
  }

  removeEdge(flowId: string, edge: FlowEdge): Inverse {
    const doc = this.flow(flowId)
    const index = doc?.edges.findIndex((e) => sameEdge(e, edge)) ?? -1
    if (!doc || index < 0) return () => {}
    const snapshot = structuredClone(doc.edges[index]!)
    doc.edges.splice(index, 1)
    this.emit([flowId, edge.from, edge.to], true)
    return () => {
      const d = this.flow(flowId)
      if (d) d.edges.splice(Math.min(index, d.edges.length), 0, structuredClone(snapshot))
      this.emit([flowId, edge.from, edge.to], true)
    }
  }
}

function sameEdge(a: FlowEdge, b: FlowEdge): boolean {
  return a.from === b.from && a.to === b.to && (a.label ?? 'always') === (b.label ?? 'always')
}
