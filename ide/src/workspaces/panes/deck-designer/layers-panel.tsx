// Layers tree (CD-310). A virtualized tree rendered from the model: expand/collapse,
// select (synced through the one selection store), double-click rename (Esc cancels),
// lock / hide / color-label toggles, and pointer drag to reorder/nest — every
// mutation an undoable command. Proven to virtualize at 1 000 layers.
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { isContainer, childIdsOf, type ProjectModel } from '@/shared/project'
import type { SelectionEngine } from '@/stores'
import type { UndoStack } from '@/platform/undo'
import { useProjectModel } from './use-project-model'
import { useSelection, useSelectionState } from './use-selection'
import { useUndo } from './use-undo'
import { flattenLayers, type LayerRow } from './layers-model'
import { filterRows, ancestorsOf, LAYER_FILTERS, type LayerFilter } from './layers-filter'
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
  const [filter, setFilter] = useState<LayerFilter>('all')
  const [query, setQuery] = useState('')
  // Explicit keyboard focus target (drives roving tabindex + DOM focus); distinct
  // from selection so external (canvas) selection never steals focus from the tree.
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const dragId = useRef<string | null>(null)
  const [dropHint, setDropHint] = useState<{ overId: string; pos: DropPos } | null>(null)
  const typeahead = useRef({ buf: '', time: 0 })

  const allRows = useMemo(() => flattenLayers(model, pageId, collapsed), [model, pageId, collapsed, model.revision])
  const rows = useMemo(() => filterRows(allRows, filter, query), [allRows, filter, query])
  const v = useVirtualRows(rows.length, ROW_H)
  const orderedIds = useMemo(() => rows.map((r) => r.id), [rows])
  const containerIds = useMemo(
    () => flattenLayers(model, pageId, new Set()).filter((r) => r.container).map((r) => r.id),
    [model, pageId, model.revision],
  )

  const toggleCollapse = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectRow = (row: LayerRow, e: React.PointerEvent) => {
    setFocusedId(row.id)
    engine.click(row.id, { shift: e.shiftKey, meta: e.metaKey || e.ctrlKey }, orderedIds)
  }

  const focusRow = useCallback(
    (id: string) => {
      setFocusedId(id)
      engine.selectOnly(id)
    },
    [engine],
  )

  const applyDrop = useCallback(
    (dragId: string, targetId: string, pos: DropPos) => {
      dropOnto({ model, undo, engine, pageId, dragId, targetId, pos })
    },
    [model, undo, engine, pageId],
  )

  // Roving-tabindex active row: the explicitly focused row, else the selection, else
  // the first row. Only the explicitly focused row grabs DOM focus (autoFocus).
  const activeId = focusedId ?? selection.ids[0] ?? rows[0]?.id ?? null
  const crumbs = activeId ? ancestorsOf(model, activeId) : []

  const onTreeKeyDown = (e: React.KeyboardEvent) => {
    const idx = rows.findIndex((r) => r.id === activeId)
    const go = (i: number) => {
      const r = rows[Math.max(0, Math.min(rows.length - 1, i))]
      if (r) {
        e.preventDefault()
        focusRow(r.id)
      }
    }
    if (e.key === 'ArrowDown') go(idx + 1)
    else if (e.key === 'ArrowUp') go(idx - 1)
    else if (e.key === 'Home') go(0)
    else if (e.key === 'End') go(rows.length - 1)
    else if (e.key === 'ArrowRight') {
      const r = rows[idx]
      if (r?.container && r.collapsed) toggleCollapse(r.id)
    } else if (e.key === 'ArrowLeft') {
      const r = rows[idx]
      if (r?.container && !r.collapsed) toggleCollapse(r.id)
    } else if (e.key.length === 1 && /\S/.test(e.key) && !e.metaKey && !e.ctrlKey) {
      // type-ahead: accumulate within 700 ms, jump to the next matching name
      const now = performance.now()
      const ta = typeahead.current
      ta.buf = now - ta.time > 700 ? e.key : ta.buf + e.key
      ta.time = now
      const q = ta.buf.toLowerCase()
      const order = [...rows.slice(idx + 1), ...rows.slice(0, idx + 1)]
      const match = order.find((r) => r.name.toLowerCase().startsWith(q))
      if (match) focusRow(match.id)
    }
  }

  return (
    <div className="dd-layers" data-testid="layers-panel">
      <div className="dd-layers-title">Layers</div>
      <div className="dd-layers-toolbar">
        <input
          className="dd-layers-search"
          type="search"
          placeholder="Search layers"
          aria-label="Search layers"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="dd-layers-chips" role="group" aria-label="Filter layers">
          {LAYER_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className="dd-chip"
              aria-pressed={filter === f.id}
              data-testid={`filter-${f.id}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
          <span className="dd-layers-spacer" />
          <button type="button" className="dd-chip" aria-label="Collapse all" title="Collapse all" onClick={() => setCollapsed(new Set(containerIds))}>
            ⊟
          </button>
          <button type="button" className="dd-chip" aria-label="Expand all" title="Expand all" onClick={() => setCollapsed(new Set())}>
            ⊞
          </button>
        </div>
      </div>
      {crumbs.length > 1 && (
        <nav className="dd-layers-breadcrumb" aria-label="Nesting">
          {crumbs.map((c, i) => (
            <span key={c.id}>
              {i > 0 && <span className="dd-crumb-sep" aria-hidden="true">›</span>}
              <button type="button" className="dd-crumb" data-testid={`crumb-${c.id}`} onClick={() => focusRow(c.id)}>
                {c.name}
              </button>
            </span>
          ))}
        </nav>
      )}
      <div
        className="dd-layers-scroll"
        ref={v.containerRef}
        onScroll={v.onScroll}
        onKeyDown={onTreeKeyDown}
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
                tabbable={row.id === activeId}
                autoFocus={row.id === focusedId}
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
  tabbable: boolean
  autoFocus: boolean
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
  row, selected, tabbable, autoFocus, dropHint, onToggleCollapse, onSelect, onRename, onToggleLock, onToggleHide, onSetColor, onDragStart, onDragOver, onDrop,
}: RowProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(row.name)
  const ref = useRef<HTMLDivElement>(null)

  // Only the explicitly keyboard-focused row grabs DOM focus (never on external
  // selection), so canvas interaction never yanks focus into the tree.
  useEffect(() => {
    if (autoFocus && ref.current && document.activeElement !== ref.current) ref.current.focus()
  }, [autoFocus])

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
      ref={ref}
      className="dd-layer-row"
      role="treeitem"
      aria-selected={selected}
      aria-level={row.depth + 1}
      aria-expanded={row.container ? !row.collapsed : undefined}
      tabIndex={tabbable ? 0 : -1}
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
      {row.instanceOf && (
        <span className="dd-layer-instance" data-testid={`instance-badge-${row.id}`} title="Component instance" aria-label="Component instance">◇</span>
      )}
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
