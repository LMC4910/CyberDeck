// Flow graph surface (CD-410). Mounts the shared PanZoomSurface (CD-301) — so it
// inherits the authoring canvas's navigation verbatim (wheel pan, ⌘/ctrl-wheel
// zoom-to-cursor, Space-drag / middle-button pan, ⌘0 fit, ⌘±/⌘- zoom) — and draws the
// active flow's nodes in WORLD space, coloured by their 6 categories. A node dragged
// from the palette drops at the cursor; a node already on the graph drags to reposition
// (coalesced to one undo entry). The graph fits its content on first open.
// Edges (CD-411), inspectors (CD-413) and test-run (CD-414) build on this seam.
import { useCallback, useEffect, useRef, type RefObject } from 'react'
import {
  PanZoomSurface,
  screenToWorld,
  type PanZoomHandle,
  type Point,
  type Rect,
} from '@/shared/canvas'
import { useGraphNodes } from './use-flows'
import { TRIGGER_NODE_ID, type FlowModel, type GraphNode, type NodeKind } from './flow-model'
import {
  NODE_W,
  NODE_H,
  graphBounds,
  labelForKind,
  manifestOf,
  CATEGORY_LABELS,
  FLOW_NODE_DND_TYPE,
} from './flow-catalog'
import './graph.css'

export interface FlowGraphProps {
  model: FlowModel
  flowId: string
  /** Owned by the workspace so the palette's double-click add can read the centre. */
  surfaceRef: RefObject<PanZoomHandle | null>
  /** Add `kind` at a world position (the drop point). */
  onAddNode: (kind: NodeKind, world: Point) => void
  /** Reposition a node: `from`→`to` (world top-left), coalesced by `gestureKey`. */
  onMoveNode: (nodeId: string, from: Point, to: Point, gestureKey: string) => void
  /** Selected node ids (CD-412) — highlights + drives multi-drag callers. */
  selectedIds?: ReadonlySet<string>
  /** Node clicked (with modifiers) — selection wiring (CD-412). */
  onNodeClick?: (nodeId: string, mods: { shift: boolean; meta: boolean }) => void
  /** Per-node run phase (CD-414 test-run visuals). */
  runPhase?: (nodeId: string) => 'pending' | 'active' | 'done' | undefined
  /** When set, the graph is read-only (a test-run is in progress, CD-414). */
  locked?: boolean
}

export function FlowGraph({
  model,
  flowId,
  surfaceRef,
  onAddNode,
  onMoveNode,
  selectedIds,
  onNodeClick,
  runPhase,
  locked = false,
}: FlowGraphProps) {
  const nodes = useGraphNodes(model, flowId)

  const boundsOf = useCallback(
    (): Rect | null => graphBounds(nodes.map((n) => n.pos)),
    [nodes],
  )

  // First-open fit: frame the flow's content the first time this flow's graph mounts
  // with a measurable surface (and again when switching to a not-yet-fitted flow), so
  // an engine-authored flow lands centred rather than off in the corner.
  const fitted = useRef<string | null>(null)
  useEffect(() => {
    if (fitted.current === flowId) return
    const bounds = boundsOf()
    const el = surfaceRef.current?.getElement()
    if (!bounds || !el) return
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) return // not laid out yet — retry next paint
    surfaceRef.current?.actions.fitTo(bounds)
    fitted.current = flowId
  }, [flowId, boundsOf, surfaceRef])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      const kind = e.dataTransfer.getData(FLOW_NODE_DND_TYPE)
      if (!kind || locked) return
      e.preventDefault()
      const el = surfaceRef.current?.getElement()
      const rect = el?.getBoundingClientRect()
      const transform = surfaceRef.current?.getTransform()
      if (!transform) return
      const world = screenToWorld(transform, {
        x: e.clientX - (rect?.left ?? 0),
        y: e.clientY - (rect?.top ?? 0),
      })
      onAddNode(kind as NodeKind, world)
    },
    [surfaceRef, onAddNode, locked],
  )

  return (
    <div
      className="fw-graph"
      data-testid="flow-graph"
      data-locked={locked || undefined}
      onDragOver={(e) => {
        if (!locked && e.dataTransfer.types.includes(FLOW_NODE_DND_TYPE)) {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'copy'
        }
      }}
      onDrop={onDrop}
    >
      <PanZoomSurface ref={surfaceRef} aria-label="Flow graph" getFitBounds={boundsOf}>
        {nodes.map((n) => (
          <FlowNodeView
            key={n.id}
            node={n}
            surfaceRef={surfaceRef}
            onMoveNode={onMoveNode}
            selected={selectedIds?.has(n.id) ?? false}
            onNodeClick={onNodeClick}
            run={runPhase?.(n.id)}
            locked={locked}
          />
        ))}
      </PanZoomSurface>
    </div>
  )
}

interface FlowNodeViewProps {
  node: GraphNode
  surfaceRef: RefObject<PanZoomHandle | null>
  onMoveNode: (nodeId: string, from: Point, to: Point, gestureKey: string) => void
  selected: boolean
  onNodeClick?: (nodeId: string, mods: { shift: boolean; meta: boolean }) => void
  run?: 'pending' | 'active' | 'done'
  locked: boolean
}

let dragSeq = 0

function FlowNodeView({ node, surfaceRef, onMoveNode, selected, onNodeClick, run, locked }: FlowNodeViewProps) {
  const isTrigger = node.id === TRIGGER_NODE_ID
  // The trigger root shows the trigger kind ("event"); a catalog node shows its label.
  const kindLabel = isTrigger ? node.kind.split('.').at(-1) ?? node.kind : labelForKind(node.kind)
  const icon = isTrigger ? '◆' : manifestOf(node.kind)?.icon ?? '•'
  const categoryLabel = CATEGORY_LABELS[node.category]

  // Pointer drag: convert the screen delta to world (÷ scale) off the pre-drag node
  // position, so the whole gesture coalesces to one undo entry that reverts to `from`.
  const drag = useRef<{ key: string; from: Point; startClient: Point; moved: boolean } | null>(null)
  // A drag that actually moved must swallow the trailing click so it doesn't select.
  const draggedRef = useRef(false)

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (locked || e.button !== 0) return
      // Let Space-drag (hand tool) pan through the node instead of grabbing it.
      e.stopPropagation()
      ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
      drag.current = {
        key: `flow-move:${node.id}:${dragSeq++}`,
        from: node.pos,
        startClient: { x: e.clientX, y: e.clientY },
        moved: false,
      }
    },
    [locked, node.id, node.pos],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = drag.current
      if (!d) return
      const scale = surfaceRef.current?.getTransform().scale ?? 1
      const to: Point = {
        x: Math.round(d.from.x + (e.clientX - d.startClient.x) / scale),
        y: Math.round(d.from.y + (e.clientY - d.startClient.y) / scale),
      }
      if (to.x !== d.from.x || to.y !== d.from.y) d.moved = true
      onMoveNode(node.id, d.from, to, d.key)
    },
    [surfaceRef, onMoveNode, node.id],
  )

  const endDrag = useCallback((e: React.PointerEvent) => {
    if (!drag.current) return
    ;(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)
    draggedRef.current = drag.current.moved
    drag.current = null
  }, [])

  return (
    <div
      className="fw-node"
      data-node-id={node.id}
      data-category={node.category}
      data-trigger={isTrigger || undefined}
      data-selected={selected || undefined}
      data-run={run}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${kindLabel} — ${categoryLabel}${isTrigger ? ' trigger' : ' node'}`}
      style={{ transform: `translate(${node.pos.x}px, ${node.pos.y}px)`, width: NODE_W, height: NODE_H }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onClick={(e) => {
        // A drag that moved shouldn't also register as a select-click.
        if (draggedRef.current) {
          draggedRef.current = false
          return
        }
        onNodeClick?.(node.id, { shift: e.shiftKey, meta: e.metaKey || e.ctrlKey })
      }}
    >
      <span className="fw-node-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="fw-node-text">
        <span className="fw-node-title">{kindLabel}</span>
        <span className="fw-node-kind">{isTrigger ? 'Trigger' : node.kind}</span>
      </span>
    </div>
  )
}
