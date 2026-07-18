// Flow graph surface (CD-410 → CD-414). Mounts the shared PanZoomSurface (CD-301) — so
// it inherits the authoring canvas's navigation verbatim (wheel pan, ⌘/ctrl-wheel
// zoom-to-cursor, Space-drag / middle-button pan, ⌘0 fit, ⌘±/⌘- zoom) — and draws the
// active flow's nodes in WORLD space, coloured by their 6 categories, wired together by
// branch-coloured edges (CD-411). A node dragged from the palette drops at the cursor; a
// node on the graph drags to reposition (single, or the whole selection — CD-412); an
// out-port drags to connect two nodes. Selection (nodes + one edge) is owned by the
// workspace and threaded down. The graph fits its content on first open.
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import {
  PanZoomSurface,
  screenToWorld,
  type PanZoomHandle,
  type Point,
  type Rect,
} from '@/shared/canvas'
import { rectFromCorners } from '@/stores'
import { useGraphEdges, useGraphNodes } from './use-flows'
import {
  TRIGGER_NODE_ID,
  type BranchLabel,
  type FlowEdge,
  type FlowModel,
  type GraphNode,
  type NodeKind,
} from './flow-model'
import {
  NODE_W,
  NODE_H,
  graphBounds,
  labelForKind,
  manifestOf,
  CATEGORY_LABELS,
  FLOW_NODE_DND_TYPE,
} from './flow-catalog'
import { nodeAt } from './flow-geometry'
import { FlowEdges, type ConnectDraft } from './flow-edges'
import { EMPTY_SELECTION, isNodeSelected, type FlowSelection } from './flow-selection'
import './graph.css'

/** Per-node phase during a test-run (CD-414). */
export type RunPhase = 'pending' | 'active' | 'done'

export interface MarqueeDraft {
  a: Point
  b: Point
}

export interface FlowGraphProps {
  model: FlowModel
  flowId: string
  /** Owned by the workspace so the palette's double-click add can read the centre. */
  surfaceRef: RefObject<PanZoomHandle | null>
  /** Add `kind` at a world position (the drop point). */
  onAddNode: (kind: NodeKind, world: Point) => void
  /** Reposition a node: `from`→`to` (world top-left), coalesced by `gestureKey`. When the
   *  node is part of a multi-selection the workspace moves the whole set (CD-412). */
  onMoveNode: (nodeId: string, from: Point, to: Point, gestureKey: string) => void
  /** Node + edge selection (CD-411/412). */
  selection?: FlowSelection
  /** Node clicked (with modifiers) — selection wiring. */
  onNodeClick?: (nodeId: string, mods: { shift: boolean; meta: boolean }) => void
  /** Connect `from`→`to` on `label` (drag-connect drop, CD-411). */
  onConnect?: (from: string, to: string, label: BranchLabel) => void
  /** An edge was clicked. */
  onSelectEdge?: (edge: FlowEdge) => void
  /** An edge's × hotspot was activated. */
  onDeleteEdge?: (edge: FlowEdge) => void
  /** Empty background was clicked (clear selection) or marquee-selected. */
  onBackgroundClick?: () => void
  /** Marquee-select nodes within a world rect (CD-412); additive with ⇧. */
  onMarquee?: (rect: Rect, additive: boolean) => void
  /** Per-node run phase (CD-414 test-run visuals). */
  runPhase?: (nodeId: string) => RunPhase | undefined
  /** Edge keys currently animating in a test-run (CD-414). */
  activeEdgeKeys?: ReadonlySet<string>
  /** When set, the graph is read-only (a test-run is in progress, CD-414). */
  locked?: boolean
}

export function FlowGraph({
  model,
  flowId,
  surfaceRef,
  onAddNode,
  onMoveNode,
  selection = EMPTY_SELECTION,
  onNodeClick,
  onConnect,
  onSelectEdge,
  onDeleteEdge,
  onBackgroundClick,
  onMarquee,
  runPhase,
  activeEdgeKeys,
  locked = false,
}: FlowGraphProps) {
  const nodes = useGraphNodes(model, flowId)
  const edges = useGraphEdges(model, flowId)

  const boundsOf = useCallback((): Rect | null => graphBounds(nodes.map((n) => n.pos)), [nodes])

  // First-open fit: frame the flow's content the first time this flow's graph mounts
  // with a measurable surface, so an engine-authored flow lands centred.
  const fitted = useRef<string | null>(null)
  useEffect(() => {
    if (fitted.current === flowId) return
    const bounds = boundsOf()
    const el = surfaceRef.current?.getElement()
    if (!bounds || !el) return
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) return
    surfaceRef.current?.actions.fitTo(bounds)
    fitted.current = flowId
  }, [flowId, boundsOf, surfaceRef])

  // Screen (client) → world, using the live transform + surface rect.
  const toWorld = useCallback(
    (clientX: number, clientY: number): Point => {
      const el = surfaceRef.current?.getElement()
      const rect = el?.getBoundingClientRect()
      const transform = surfaceRef.current?.getTransform()
      if (!transform) return { x: 0, y: 0 }
      return screenToWorld(transform, { x: clientX - (rect?.left ?? 0), y: clientY - (rect?.top ?? 0) })
    },
    [surfaceRef],
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      const kind = e.dataTransfer.getData(FLOW_NODE_DND_TYPE)
      if (!kind || locked) return
      e.preventDefault()
      onAddNode(kind as NodeKind, toWorld(e.clientX, e.clientY))
    },
    [toWorld, onAddNode, locked],
  )

  // ── drag-connect (CD-411) ──────────────────────────────────────────────────────
  const [connect, setConnect] = useState<{
    from: string
    label: BranchLabel
    start: Point
    world: Point
    target: string | null
  } | null>(null)

  const onPortDown = useCallback(
    (e: React.PointerEvent, nodeId: string, label: BranchLabel, portWorld: Point) => {
      if (locked || e.button !== 0) return
      e.stopPropagation()
      e.preventDefault()
      setConnect({ from: nodeId, label, start: portWorld, world: portWorld, target: null })
    },
    [locked],
  )

  useEffect(() => {
    if (!connect) return
    const excludes = (n: GraphNode) => n.id === connect.from || n.id === TRIGGER_NODE_ID
    const move = (e: PointerEvent) => {
      const world = toWorld(e.clientX, e.clientY)
      const target = nodeAt(nodes, world, excludes)?.id ?? null
      setConnect((c) => (c ? { ...c, world, target } : c))
    }
    const up = (e: PointerEvent) => {
      const world = toWorld(e.clientX, e.clientY)
      const target = nodeAt(nodes, world, excludes)?.id ?? null
      if (target) onConnect?.(connect.from, target, connect.label)
      setConnect(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [connect, nodes, onConnect, toWorld])

  const draft: ConnectDraft | null = connect
    ? { from: connect.start, to: connect.world, label: connect.label }
    : null

  // ── marquee-select (CD-412) ─────────────────────────────────────────────────────
  const [marquee, setMarquee] = useState<MarqueeDraft | null>(null)
  const marqueeMoved = useRef(false)

  const onSurfacePointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Only a plain left-press on the empty background starts a marquee; node/port/edge
      // presses stopPropagation, and the surface owns space/middle-button panning.
      if (locked || e.button !== 0) return
      const target = e.target as HTMLElement
      if (!target.classList.contains('pz-surface') && !target.classList.contains('pz-world')) return
      marqueeMoved.current = false
      const world = toWorld(e.clientX, e.clientY)
      setMarquee({ a: world, b: world })
    },
    [locked, toWorld],
  )

  useEffect(() => {
    if (!marquee) return
    const move = (e: PointerEvent) => {
      marqueeMoved.current = true
      setMarquee((m) => (m ? { ...m, b: toWorld(e.clientX, e.clientY) } : m))
    }
    const up = (e: PointerEvent) => {
      if (marqueeMoved.current) {
        const b = toWorld(e.clientX, e.clientY)
        onMarquee?.(rectFromCorners(marquee.a, b), e.shiftKey || e.metaKey)
      } else {
        onBackgroundClick?.()
      }
      setMarquee(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [marquee, onMarquee, onBackgroundClick, toWorld])

  const marqueeScreenRect = useMemo(() => (marquee ? worldRectToScreen(marquee, surfaceRef) : null), [
    marquee,
    surfaceRef,
  ])

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
      onPointerDown={onSurfacePointerDown}
    >
      <PanZoomSurface ref={surfaceRef} aria-label="Flow graph" getFitBounds={boundsOf}>
        <FlowEdges
          nodes={nodes}
          edges={edges}
          selectedEdgeKey={selection.edge ? edgeSelectionKey(selection.edge) : null}
          onSelectEdge={(edge) => onSelectEdge?.(edge)}
          onDeleteEdge={(edge) => onDeleteEdge?.(edge)}
          onPortDown={onPortDown}
          draft={draft}
          locked={locked}
          activeKeys={activeEdgeKeys}
        />
        {nodes.map((n) => (
          <FlowNodeView
            key={n.id}
            node={n}
            surfaceRef={surfaceRef}
            onMoveNode={onMoveNode}
            selected={isNodeSelected(selection, n.id)}
            dropTarget={connect?.target === n.id}
            onNodeClick={onNodeClick}
            run={runPhase?.(n.id)}
            locked={locked}
          />
        ))}
      </PanZoomSurface>
      {marqueeScreenRect && (
        <div className="fw-marquee" data-testid="flow-marquee" style={marqueeScreenRect} />
      )}
    </div>
  )
}

/** The selection key must match the edge layer's — mirror model.edgeKey without the
 *  import churn (from/to/branch). */
function edgeSelectionKey(e: FlowEdge): string {
  return `${e.from}~${e.to}~${e.label ?? 'always'}`
}

function worldRectToScreen(m: MarqueeDraft, surfaceRef: RefObject<PanZoomHandle | null>): React.CSSProperties | null {
  const t = surfaceRef.current?.getTransform()
  if (!t) return null
  const r = rectFromCorners(m.a, m.b)
  return {
    left: r.x * t.scale + t.tx,
    top: r.y * t.scale + t.ty,
    width: r.w * t.scale,
    height: r.h * t.scale,
  }
}

interface FlowNodeViewProps {
  node: GraphNode
  surfaceRef: RefObject<PanZoomHandle | null>
  onMoveNode: (nodeId: string, from: Point, to: Point, gestureKey: string) => void
  selected: boolean
  dropTarget: boolean
  onNodeClick?: (nodeId: string, mods: { shift: boolean; meta: boolean }) => void
  run?: RunPhase
  locked: boolean
}

let dragSeq = 0

function FlowNodeView({ node, surfaceRef, onMoveNode, selected, dropTarget, onNodeClick, run, locked }: FlowNodeViewProps) {
  const isTrigger = node.id === TRIGGER_NODE_ID
  const kindLabel = isTrigger ? node.kind.split('.').at(-1) ?? node.kind : labelForKind(node.kind)
  const icon = isTrigger ? '◆' : manifestOf(node.kind)?.icon ?? '•'
  const categoryLabel = CATEGORY_LABELS[node.category]

  const drag = useRef<{ key: string; from: Point; startClient: Point; moved: boolean } | null>(null)
  const draggedRef = useRef(false)

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (locked || e.button !== 0) return
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
      data-drop-target={dropTarget || undefined}
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
