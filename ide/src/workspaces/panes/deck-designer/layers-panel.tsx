// Layers tree (CD-310). A virtualized tree rendered from the model: expand/collapse,
// select (synced through the one selection store), double-click rename (Esc cancels),
// lock / hide / color-label toggles, and pointer drag to reorder/nest — every
// mutation an undoable command. Proven to virtualize at 1 000 layers.
import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { isContainer, childIdsOf, type ProjectModel } from '@/shared/project'
import type { SelectionEngine } from '@/stores'
import type { UndoStack } from '@/platform/undo'
import { useProjectModel } from './use-project-model'
import { useSelection, useSelectionState } from './use-selection'
import { useUndo } from './use-undo'
import { flattenLayers, type LayerRow } from './layers-model'
import { useVirtualRows } from './use-virtual-rows'
import './layers.css'

const ROW_H = 26
const COLORS = ['#e5484d', '#f5a623', '#30a46c', '#4c9aff', '#a960e8']

type DropPos = 'before' | 'after' | 'inside'

function useModelRevision(model: ProjectModel): number {
  return useSyncExternalStore((cb) => model.subscribe(cb), () => model.revision)
}

export function LayersPanel({ pageId }: { pageId: string }) {
  const model = useProjectModel()
  const engine = useSelection()
  const undo = useUndo()
  const selection = useSelectionState()
  useModelRevision(model)

  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set())
  const rows = useMemo(() => flattenLayers(model, pageId, collapsed), [model, pageId, collapsed, model.revision])
  const v = useVirtualRows(rows.length, ROW_H)
  // The drag SOURCE id is a ref (set synchronously in onDragStart) so drop never
  // depends on React state timing; `dropHint` is state only for the visual indicator.
  const dragId = useRef<string | null>(null)
  const [dropHint, setDropHint] = useState<{ overId: string; pos: DropPos } | null>(null)

  const toggleCollapse = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const orderedIds = useMemo(() => rows.map((r) => r.id), [rows])

  const selectRow = (row: LayerRow, e: React.PointerEvent) => {
    engine.click(row.id, { shift: e.shiftKey, meta: e.metaKey || e.ctrlKey }, orderedIds)
  }

  const applyDrop = useCallback(
    (dragId: string, targetId: string, pos: DropPos) => {
      dropOnto({ model, undo, engine, pageId, dragId, targetId, pos })
    },
    [model, undo, engine, pageId],
  )

  return (
    <div className="dd-layers" data-testid="layers-panel">
      <div className="dd-layers-title">Layers</div>
      <div
        className="dd-layers-scroll"
        ref={v.containerRef}
        onScroll={v.onScroll}
        role="tree"
        aria-label="Layers"
      >
        <div style={{ height: v.totalHeight, position: 'relative' }}>
          <div style={{ transform: `translateY(${v.offsetY}px)` }}>
            {rows.slice(v.start, v.end).map((row) => (
              <LayerRowView
                key={row.id}
                row={row}
                selected={selection.ids.includes(row.id)}
                dropHint={dropHint?.overId === row.id ? dropHint.pos : null}
                onToggleCollapse={() => toggleCollapse(row.id)}
                onSelect={(e) => selectRow(row, e)}
                onRename={(name) => renameRow(model, undo, row.id, name)}
                onToggleLock={() => toggleFlag(model, undo, row.id, 'lock')}
                onToggleHide={() => toggleFlag(model, undo, row.id, 'hide')}
                onSetColor={(c) => setColor(model, undo, row.id, c)}
                onDragStart={() => {
                  dragId.current = row.id
                }}
                onDragOver={(pos) => setDropHint({ overId: row.id, pos })}
                onDrop={(pos) => {
                  if (dragId.current && dragId.current !== row.id) applyDrop(dragId.current, row.id, pos)
                  dragId.current = null
                  setDropHint(null)
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

interface RowProps {
  row: LayerRow
  selected: boolean
  dropHint: DropPos | null
  onToggleCollapse: () => void
  onSelect: (e: React.PointerEvent) => void
  onRename: (name: string) => void
  onToggleLock: () => void
  onToggleHide: () => void
  onSetColor: (color: string | undefined) => void
  onDragStart: () => void
  onDragOver: (pos: DropPos) => void
  onDrop: (pos: DropPos) => void
}

function LayerRowView({
  row, selected, dropHint, onToggleCollapse, onSelect, onRename, onToggleLock, onToggleHide, onSetColor, onDragStart, onDragOver, onDrop,
}: RowProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(row.name)

  const commit = () => {
    setEditing(false)
    if (draft.trim() && draft !== row.name) onRename(draft.trim())
  }

  const posFromEvent = (e: React.DragEvent): DropPos => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const y = e.clientY - rect.top
    return row.container && y > rect.height / 3 && y < (rect.height * 2) / 3 ? 'inside' : y < rect.height / 2 ? 'before' : 'after'
  }
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault() // allow drop
    onDragOver(posFromEvent(e))
  }

  return (
    <div
      className="dd-layer-row"
      role="treeitem"
      aria-selected={selected}
      aria-level={row.depth + 1}
      data-layer={row.id}
      data-selected={selected || undefined}
      data-drop={dropHint ?? undefined}
      style={{ height: ROW_H, paddingLeft: 8 + row.depth * 14 }}
      draggable={!editing}
      onPointerDown={(e) => !editing && onSelect(e)}
      onDragStart={onDragStart}
      onDragOver={handleDragOver}
      onDrop={(e) => {
        e.preventDefault()
        onDrop(posFromEvent(e))
      }}
    >
      {row.hasChildren ? (
        <button
          type="button"
          className="dd-layer-twist"
          aria-label={row.collapsed ? 'Expand' : 'Collapse'}
          data-testid={`twist-${row.id}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onToggleCollapse}
        >
          {row.collapsed ? '▸' : '▾'}
        </button>
      ) : (
        <span className="dd-layer-twist-spacer" />
      )}
      <span className="dd-layer-color" style={{ background: row.color ?? 'transparent' }} aria-hidden="true" />
      {editing ? (
        <input
          className="dd-layer-rename"
          data-testid={`rename-${row.id}`}
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onPointerDown={(e) => e.stopPropagation()}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            else if (e.key === 'Escape') {
              setDraft(row.name)
              setEditing(false)
            }
          }}
        />
      ) : (
        <span
          className="dd-layer-name"
          data-hidden={row.hidden || undefined}
          onDoubleClick={() => {
            setDraft(row.name)
            setEditing(true)
          }}
        >
          {row.name}
        </span>
      )}
      <span className="dd-layer-controls">
        <ColorMenu current={row.color} onSet={onSetColor} />
        <button type="button" className="dd-layer-btn" aria-pressed={row.hidden} aria-label={row.hidden ? 'Show' : 'Hide'} data-testid={`hide-${row.id}`} onPointerDown={(e) => e.stopPropagation()} onClick={onToggleHide}>
          {row.hidden ? '🙈' : '👁'}
        </button>
        <button type="button" className="dd-layer-btn" aria-pressed={row.locked} aria-label={row.locked ? 'Unlock' : 'Lock'} data-testid={`lock-${row.id}`} onPointerDown={(e) => e.stopPropagation()} onClick={onToggleLock}>
          {row.locked ? '🔒' : '🔓'}
        </button>
      </span>
    </div>
  )
}

function ColorMenu({ current, onSet }: { current?: string; onSet: (c: string | undefined) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="dd-color-menu">
      <button type="button" className="dd-layer-btn" aria-label="Color label" style={current ? { color: current } : undefined} onPointerDown={(e) => e.stopPropagation()} onClick={() => setOpen((v) => !v)}>
        ●
      </button>
      {open && (
        <span className="dd-color-swatches" role="menu">
          {COLORS.map((c) => (
            <button key={c} type="button" aria-label={`Set color ${c}`} style={{ background: c }} onPointerDown={(e) => e.stopPropagation()} onClick={() => { onSet(c); setOpen(false) }} />
          ))}
          <button type="button" aria-label="Clear color" onPointerDown={(e) => e.stopPropagation()} onClick={() => { onSet(undefined); setOpen(false) }}>
            ✕
          </button>
        </span>
      )}
    </span>
  )
}

// ── undoable mutations ─────────────────────────────────────────────────────────
function renameRow(model: ProjectModel, undo: UndoStack, id: string, name: string) {
  undo.execUndoable('Rename', () => model.setName(id, name))
}
function toggleFlag(model: ProjectModel, undo: UndoStack, id: string, kind: 'lock' | 'hide') {
  const w = model.widget(id)
  if (!w) return
  if (kind === 'lock') {
    undo.execUndoable(w.locked ? 'Unlock' : 'Lock', () => model.setLocked(id, !w.locked))
  } else {
    const hidden = !!(w.config as { hidden?: boolean } | undefined)?.hidden
    undo.execUndoable(hidden ? 'Show' : 'Hide', () => model.updateConfig(id, { hidden: hidden ? undefined : true }))
  }
}
function setColor(model: ProjectModel, undo: UndoStack, id: string, color: string | undefined) {
  undo.execUndoable('Color label', () => model.updateConfig(id, { colorLabel: color }))
}

interface DropArgs {
  model: ProjectModel
  undo: UndoStack
  engine: SelectionEngine
  pageId: string
  dragId: string
  targetId: string
  pos: DropPos
}
function dropOnto({ model, undo, pageId, dragId, targetId, pos }: DropArgs) {
  const target = model.widget(targetId)
  if (!target) return
  // Guard: never nest a container into its own subtree.
  const subtreeBlocks = (root: string, candidate: string): boolean => {
    if (root === candidate) return true
    const w = model.widget(root)
    return !!w && isContainer(w) && childIdsOf(w).some((c) => subtreeBlocks(c, candidate))
  }
  if (subtreeBlocks(dragId, targetId)) return

  if (pos === 'inside' && isContainer(target)) {
    undo.execUndoable('Nest', () => model.reparent(dragId, targetId))
    return
  }
  const parentId = model.parentOf(targetId) ?? null
  if (parentId) {
    const kids = childIdsOf(model.widget(parentId)!).filter((x) => x !== dragId)
    let idx = kids.indexOf(targetId)
    if (pos === 'after') idx += 1
    undo.execUndoable('Reorder', () => model.reparent(dragId, parentId, idx))
  } else {
    // root ↔ root reorder (and unnest if the dragged item had a parent)
    undo.execUndoable('Reorder', () => {
      const inv1 = model.parentOf(dragId) ? model.reparent(dragId, null) : () => {}
      const arr = model.widgetsOf(pageId)
      let targetIdx = arr.findIndex((w) => w.id === targetId)
      if (pos === 'after') targetIdx += 1
      const inv2 = model.reorderWidget(dragId, targetIdx)
      return () => {
        inv2()
        inv1()
      }
    })
  }
}
