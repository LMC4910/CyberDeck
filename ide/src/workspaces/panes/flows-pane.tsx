// Flows pane (CD-203 → CD-410 graph + palette). Composes the Flows workspace: the
// FlowsService loads the flow collection through its persistence seam and owns the
// FlowModel; the tab strip switches/renames/creates flows and arms the active one; the
// node palette + PanZoomSurface graph author the active flow's nodes. Its own chunk via
// import().
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { screenToWorld, type PanZoomHandle, type Point, type Rect } from '@/shared/canvas'
import { useUndo } from './deck-designer/use-undo'
import { FlowTabs } from './flows/flow-tabs'
import { FlowGraph } from './flows/flow-graph'
import { FlowInspector } from './flows/flow-inspector'
import { NodePalette } from './flows/node-palette'
import { defaultFlowsService, useFlowIds, useFlowsOptional, useFlowsState } from './flows/use-flows'
import {
  addFlowNode,
  connectNodes,
  deleteEdge,
  deleteSelection,
  duplicateSelection,
  moveFlowNode,
  moveFlowNodes,
  type FlowsCtx,
} from './flows/flow-ops'
import {
  clearSelection,
  clickNode,
  EMPTY_SELECTION,
  isNodeSelected,
  marqueeNodes,
  selectEdge,
  selectNodes,
  type FlowSelection,
} from './flows/flow-selection'
import type { BranchLabel, FlowEdge, FlowModel, NodeKind } from './flows/flow-model'
import type { FlowsService } from './flows/flows-service'
import './flows/flows.css'

/** World point at the visible centre of the graph surface (palette double-click add). */
function visibleCenterWorld(surfaceRef: React.RefObject<PanZoomHandle | null>): Point {
  const el = surfaceRef.current?.getElement()
  const transform = surfaceRef.current?.getTransform()
  if (!el || !transform) return { x: 0, y: 0 }
  const r = el.getBoundingClientRect()
  return screenToWorld(transform, { x: r.width / 2, y: r.height / 2 })
}

export default function FlowsPane() {
  // The composition root wires no gateway yet, so the pane falls back to the shared
  // local-persistence service; a FlowsProvider (tests, and the M5 swap) overrides it.
  const injected = useFlowsOptional()
  const service = useMemo(() => injected ?? defaultFlowsService(), [injected])
  const { status } = useFlowsState(service)

  useEffect(() => {
    void service.load()
  }, [service])

  const model = service.model
  if (!model) {
    return (
      <section className="fw-pane" data-pane="flows" data-status={status} aria-label="Flows workspace">
        <p className="fw-empty">{status === 'error' ? 'Flows could not be loaded.' : 'Loading flows…'}</p>
      </section>
    )
  }
  return <FlowsWorkspace service={service} model={model} />
}

function FlowsWorkspace({ service, model }: { service: FlowsService; model: FlowModel }) {
  const undo = useUndo()
  const ctx = useMemo<FlowsCtx>(() => ({ model, undo, service }), [model, undo, service])
  const ids = useFlowIds(model)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Derived, not stored: undoing a "New flow" (or any removal) drops the selection
  // back to the first tab without an effect racing the render.
  const activeId = selectedId && ids.includes(selectedId) ? selectedId : (ids[0] ?? null)
  const surfaceRef = useRef<PanZoomHandle | null>(null)

  // Graph selection (nodes + one edge). Local to the workspace — cleared when the
  // active flow changes so a stale node id never highlights another flow's graph.
  const [selection, setSelection] = useState<FlowSelection>(EMPTY_SELECTION)
  useEffect(() => setSelection(EMPTY_SELECTION), [activeId])

  const onAddNode = useCallback(
    (kind: NodeKind, world: Point) => {
      if (activeId) addFlowNode(ctx, activeId, kind, world)
    },
    [ctx, activeId],
  )
  // Palette double-click / Enter: drop at the visible-graph centre.
  const onPlace = useCallback(
    (kind: NodeKind) => onAddNode(kind, visibleCenterWorld(surfaceRef)),
    [onAddNode],
  )
  // Group-drag baselines, snapshotted once per gesture key so every selected node
  // moves by the same delta off its own pre-drag position (one coalesced undo entry).
  const groupDrag = useRef<{ key: string; bases: Map<string, Point> } | null>(null)
  const onMoveNode = useCallback(
    (nodeId: string, from: Point, to: Point, key: string) => {
      if (!activeId) return
      const multi = selection.nodes.size > 1 && isNodeSelected(selection, nodeId)
      if (!multi) {
        moveFlowNode(ctx, activeId, nodeId, from, to, key)
        return
      }
      if (groupDrag.current?.key !== key) {
        const drawn = new Map(model.graphNodes(activeId).map((g) => [g.id, g.pos]))
        const bases = new Map<string, Point>()
        for (const id of selection.nodes) {
          const base = id === nodeId ? from : drawn.get(id)
          if (base) bases.set(id, base)
        }
        groupDrag.current = { key, bases }
      }
      const delta = { x: to.x - from.x, y: to.y - from.y }
      const moves = [...groupDrag.current.bases].map(([id, base]) => ({
        nodeId: id,
        from: base,
        to: { x: base.x + delta.x, y: base.y + delta.y },
      }))
      moveFlowNodes(ctx, activeId, moves, key)
    },
    [ctx, activeId, model, selection],
  )

  // ⌘D duplicates the selection (copies land selected); ⌫/Delete removes it. Ignored
  // while typing in the tab-rename input so those keys still edit text.
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!activeId) return
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return
      if ((e.metaKey || e.ctrlKey) && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault()
        const created = duplicateSelection(ctx, activeId, selection)
        if (created.length) setSelection(selectNodes(created))
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selection.nodes.size === 0 && !selection.edge) return
        e.preventDefault()
        if (deleteSelection(ctx, activeId, selection)) setSelection(clearSelection())
      }
    },
    [ctx, activeId, selection],
  )

  const onNodeClick = useCallback(
    (nodeId: string, mods: { shift: boolean; meta: boolean }) =>
      setSelection((s) => clickNode(s, nodeId, mods)),
    [],
  )
  const onConnect = useCallback(
    (from: string, to: string, label: BranchLabel) => {
      if (activeId) connectNodes(ctx, activeId, from, to, label)
    },
    [ctx, activeId],
  )
  const onSelectEdge = useCallback((edge: FlowEdge) => setSelection(selectEdge(edge)), [])
  const onDeleteEdge = useCallback(
    (edge: FlowEdge) => {
      if (activeId) deleteEdge(ctx, activeId, edge)
      setSelection(clearSelection())
    },
    [ctx, activeId],
  )
  const onBackgroundClick = useCallback(() => setSelection(clearSelection()), [])
  const onMarquee = useCallback(
    (rect: Rect, additive: boolean) => {
      const graph = model.graphNodes(activeId ?? '')
      setSelection((s) =>
        marqueeNodes(s, { x: rect.x, y: rect.y }, { x: rect.x + rect.w, y: rect.y + rect.h }, graph, additive),
      )
    },
    [model, activeId],
  )

  return (
    <section
      className="fw-pane"
      data-pane="flows"
      data-status="ready"
      aria-label="Flows workspace"
      onKeyDown={onKeyDown}
    >
      <FlowTabs ctx={ctx} activeId={activeId} onActivate={setSelectedId} />
      {activeId ? (
        <div className="fw-body">
          <NodePalette onPlace={onPlace} />
          <FlowGraph
            key={activeId}
            model={model}
            flowId={activeId}
            surfaceRef={surfaceRef}
            onAddNode={onAddNode}
            onMoveNode={onMoveNode}
            selection={selection}
            onNodeClick={onNodeClick}
            onConnect={onConnect}
            onSelectEdge={onSelectEdge}
            onDeleteEdge={onDeleteEdge}
            onBackgroundClick={onBackgroundClick}
            onMarquee={onMarquee}
          />
          <FlowInspector ctx={ctx} flowId={activeId} selection={selection} setSelection={setSelection} />
        </div>
      ) : (
        <p className="fw-empty">No flows yet — use + to create one.</p>
      )}
    </section>
  )
}
