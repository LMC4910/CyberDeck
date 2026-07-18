// Flow edge layer (CD-411). An SVG drawn INSIDE the world layer (so it pans/zooms with
// the nodes) whose paths are recomputed from live node geometry every render — an edge
// therefore tracks its endpoints as the nodes drag. It also renders the out-ports a
// drag-connect starts from, the ghost line while connecting, and each edge's select
// hit-target + × delete hotspot. `pointer-events` is off on the <svg> and re-enabled
// only on the interactive paths/ports, so it never steals clicks from the nodes below.
import { edgeKey, type BranchLabel, type FlowEdge, type GraphNode } from './flow-model'
import { edgePath, outPorts, resolveEdges, type ResolvedEdge } from './flow-geometry'
import type { Point } from '@/shared/canvas'

const BRANCHES: readonly BranchLabel[] = ['always', 'true', 'false']

export interface ConnectDraft {
  from: Point
  to: Point
  label: BranchLabel
}

export interface FlowEdgesProps {
  nodes: readonly GraphNode[]
  edges: readonly FlowEdge[]
  selectedEdgeKey: string | null
  onSelectEdge: (edge: FlowEdge) => void
  onDeleteEdge: (edge: FlowEdge) => void
  /** Begin a drag-connect from a node's out-port. */
  onPortDown: (e: React.PointerEvent, nodeId: string, label: BranchLabel, portWorld: Point) => void
  /** The live ghost while connecting, or null. */
  draft: ConnectDraft | null
  locked: boolean
}

export function FlowEdges({
  nodes,
  edges,
  selectedEdgeKey,
  onSelectEdge,
  onDeleteEdge,
  onPortDown,
  draft,
  locked,
}: FlowEdgesProps) {
  const resolved = resolveEdges(nodes, edges)
  return (
    <svg className="fw-edges" data-testid="flow-edges" aria-hidden="true">
      <defs>
        {BRANCHES.map((b) => (
          <marker
            key={b}
            id={`fw-arrow-${b}`}
            className={`fw-arrow fw-arrow-${b}`}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" />
          </marker>
        ))}
      </defs>

      {resolved.map((r) => (
        <EdgeView
          key={edgeKey(r.edge)}
          r={r}
          selected={edgeKey(r.edge) === selectedEdgeKey}
          onSelect={onSelectEdge}
          onDelete={onDeleteEdge}
          locked={locked}
        />
      ))}

      {draft && (
        <path
          className="fw-edge-ghost"
          data-testid="edge-ghost"
          data-branch={draft.label}
          d={edgePath(draft.from, draft.to)}
          markerEnd={`url(#fw-arrow-${draft.label})`}
        />
      )}

      {!locked &&
        nodes.map((n) =>
          outPorts(n).map((p) => (
            <circle
              key={`${n.id}-${p.label}`}
              className="fw-port"
              data-testid={`port-${n.id}-${p.label}`}
              data-branch={p.label}
              cx={p.pos.x}
              cy={p.pos.y}
              r={5}
              onPointerDown={(e) => onPortDown(e, n.id, p.label, p.pos)}
            />
          )),
        )}
    </svg>
  )
}

interface EdgeViewProps {
  r: ResolvedEdge
  selected: boolean
  onSelect: (edge: FlowEdge) => void
  onDelete: (edge: FlowEdge) => void
  locked: boolean
}

function EdgeView({ r, selected, onSelect, onDelete, locked }: EdgeViewProps) {
  const d = edgePath(r.from, r.to)
  const key = edgeKey(r.edge)
  return (
    <g className="fw-edge" data-branch={r.label} data-selected={selected || undefined}>
      {/* Wide invisible hit path so the thin visible line is easy to click. */}
      <path
        className="fw-edge-hit"
        data-testid={`edge-${key}`}
        d={d}
        role="button"
        aria-label={`Edge ${r.edge.from} to ${r.edge.to} (${r.label})`}
        onPointerDown={(e) => {
          if (locked) return
          e.stopPropagation()
          onSelect(r.edge)
        }}
      />
      <path className="fw-edge-line" d={d} markerEnd={`url(#fw-arrow-${r.label})`} />
      {selected && !locked && (
        <g
          className="fw-edge-x"
          data-testid={`edge-x-${key}`}
          role="button"
          tabIndex={0}
          aria-label="Delete edge"
          transform={`translate(${r.mid.x}, ${r.mid.y})`}
          onPointerDown={(e) => {
            e.stopPropagation()
            onDelete(r.edge)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onDelete(r.edge)
            }
          }}
        >
          <circle className="fw-edge-x-bg" r={8} />
          <line className="fw-edge-x-mark" x1={-3} y1={-3} x2={3} y2={3} />
          <line className="fw-edge-x-mark" x1={3} y1={-3} x2={-3} y2={3} />
        </g>
      )}
    </g>
  )
}
