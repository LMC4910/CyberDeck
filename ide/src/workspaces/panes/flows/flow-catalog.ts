// Flow node catalog (CD-410) — the library the node palette reads and the source of
// each node's label/icon. Mirrors the mock node-catalog the engine's flow registry
// exposes (PROJ-161); M5 swaps this for the gateway-backed catalog with the palette
// UI unchanged. Every kind here is one of the CD-112 contract's node kinds, so the
// palette can never author a node the schema rejects.
import { writeUiPos, type FlowNode, type NodeKind, type NodeCategory } from './flow-model'
import type { Point, Rect } from '@/shared/canvas'

export interface NodeManifest {
  kind: NodeKind
  label: string
  category: NodeCategory
  /** Single-glyph icon for the palette tile + node header. */
  icon: string
}

/** The addable node kinds. Triggers are the flow's top-level field (rendered as the
 *  synthetic root), not palette entries — the 6th category colours that root only. */
export const NODE_CATALOG: readonly NodeManifest[] = [
  { kind: 'logic.condition', label: 'Condition', category: 'logic', icon: '?' },
  { kind: 'logic.branch', label: 'Branch', category: 'logic', icon: '⑃' },
  { kind: 'logic.delay', label: 'Delay', category: 'logic', icon: '⏱' },
  { kind: 'logic.gate', label: 'Gate', category: 'logic', icon: '⨂' },
  { kind: 'data.math', label: 'Math', category: 'data', icon: '∑' },
  { kind: 'data.text', label: 'Text', category: 'data', icon: '“' },
  { kind: 'data.datetime', label: 'Date / Time', category: 'data', icon: '◷' },
  { kind: 'integration.obs', label: 'OBS', category: 'integration', icon: '◉' },
  { kind: 'integration.spotify', label: 'Spotify', category: 'integration', icon: '♫' },
  { kind: 'integration.http', label: 'HTTP', category: 'integration', icon: '⇄' },
  { kind: 'integration.mqtt', label: 'MQTT', category: 'integration', icon: '⇅' },
  { kind: 'action.command', label: 'Command', category: 'action', icon: '⌘' },
  { kind: 'action.notify', label: 'Notify', category: 'action', icon: '✦' },
  { kind: 'action.setVariable', label: 'Set Variable', category: 'action', icon: '=' },
  { kind: 'action.setState', label: 'Set State', category: 'action', icon: '◑' },
  { kind: 'action.runFlow', label: 'Run Flow', category: 'action', icon: '⏵' },
  { kind: 'structure.group', label: 'Group', category: 'structure', icon: '▢' },
  { kind: 'structure.comment', label: 'Comment', category: 'structure', icon: '❝' },
  { kind: 'structure.subflow', label: 'Subflow', category: 'structure', icon: '◈' },
]

/** Palette section order (matches 00_Product_Baseline §Automation). */
export const PALETTE_CATEGORIES: readonly NodeCategory[] = ['logic', 'data', 'integration', 'action', 'structure']

export const CATEGORY_LABELS: Record<NodeCategory, string> = {
  trigger: 'Trigger',
  logic: 'Logic',
  data: 'Data',
  integration: 'Integrations',
  action: 'Actions',
  structure: 'Structure',
}

/** MIME-ish key the palette tiles put on the drag payload; the graph reads it on drop. */
export const FLOW_NODE_DND_TYPE = 'application/x-cyberdeck-flownode'

const BY_KIND = new Map<string, NodeManifest>(NODE_CATALOG.map((m) => [m.kind, m]))

/** The catalog entry for a kind, or undefined for a plugin/unknown kind. */
export function manifestOf(kind: string): NodeManifest | undefined {
  return BY_KIND.get(kind)
}

/** Human label for a node/trigger kind. Falls back to the kind's last segment so an
 *  unknown or future kind still reads sensibly on the node body. */
export function labelForKind(kind: string): string {
  return manifestOf(kind)?.label ?? (kind.split('.').at(-1) ?? kind)
}

// ── graph geometry ────────────────────────────────────────────────────────────────
/** Fixed node box (world px). Nodes are positioned by their top-left corner. */
export const NODE_W = 168
export const NODE_H = 64

/** World rect a node occupies at `pos` (its top-left). */
export function nodeRect(pos: Point): Rect {
  return { x: pos.x, y: pos.y, w: NODE_W, h: NODE_H }
}

/** Union of every node's rect — the bounds first-open fit (and ⌘0) frames. Null only
 *  when there are no nodes at all (a flow always has its trigger root, so in practice
 *  never null for a live flow). */
export function graphBounds(positions: readonly Point[]): Rect | null {
  if (positions.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of positions) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x + NODE_W)
    maxY = Math.max(maxY, p.y + NODE_H)
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

/** A fresh node of `kind` centred on the world `center`. `id` must come from
 *  `model.newNodeId()`. The reserved `ui` position is the only param seeded; the
 *  CD-413 inspector fills the per-kind fields. */
export function makeNode(id: string, kind: NodeKind, center: Point): FlowNode {
  const topLeft: Point = { x: Math.round(center.x - NODE_W / 2), y: Math.round(center.y - NODE_H / 2) }
  return { id, kind, params: writeUiPos(undefined, topLeft) as FlowNode['params'] }
}
