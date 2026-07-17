// Variables table (CD-401). A windowed grid over the *server's* row count: it mounts
// ~a viewport of rows whatever `total` says (10k fixture proven in the tests), asks
// the controller for the pages the window overlaps, and renders exactly what came
// back. Sorting is a column-header click that changes the repo's sort param — the
// table never re-orders rows it already has.
import { useCallback, useEffect, useRef, type KeyboardEvent } from 'react'
import { useVirtualRows } from '@/shared/virtual'
import { formatValue, scopeMeta, typeMeta, type VariableRecord } from './variables-model'
import type { VariableSortField } from './variables-source'
import type { VariablesController } from './variables-controller'
import { useVariablesState, shallowArrayEqual } from './use-variables'

export const ROW_H = 28

interface Column {
  field: VariableSortField
  label: string
  /** Grid track width. */
  width: string
}

const COLUMNS: readonly Column[] = [
  { field: 'name', label: 'Name', width: 'minmax(140px, 1.4fr)' },
  { field: 'id', label: 'Path', width: 'minmax(160px, 1.6fr)' },
  { field: 'scope', label: 'Scope', width: '110px' },
  { field: 'type', label: 'Type', width: '100px' },
  { field: 'value', label: 'Value', width: 'minmax(120px, 1.2fr)' },
  { field: 'updatedAt', label: 'Updated', width: '96px' },
]

const TEMPLATE = COLUMNS.map((c) => c.width).join(' ')

export interface VariablesTableProps {
  controller: VariablesController
  /** Renders the value cell — plain text here, editable/masked from CD-402. */
  renderValue?: (row: VariableRecord) => React.ReactNode
  /** Row activation (Enter / double-click), e.g. start an inline edit. */
  onActivate?: (row: VariableRecord) => void
}

export function VariablesTable({ controller, renderValue, onActivate }: VariablesTableProps) {
  const total = useVariablesState(controller, (s) => s.total)
  const loading = useVariablesState(controller, (s) => s.loading)
  const sort = useVariablesState(controller, (s) => s.sort, (a, b) => a.field === b.field && a.dir === b.dir)
  const selectedIds = useVariablesState(controller, (s) => s.selectedIds, shallowArrayEqual)
  // Cache identity changes whenever a page lands — that is the table's repaint cue.
  const pages = useVariablesState(controller, (s) => s.pages)

  const v = useVirtualRows(total, ROW_H)
  const focusIndex = useRef(0)
  const gridRef = useRef<HTMLDivElement>(null)

  // Fetch the pages this window overlaps. Re-runs when the window moves and when a
  // new query invalidates the cache (pages identity), never on a value tick.
  useEffect(() => {
    controller.ensureRange(v.start, v.end)
  }, [controller, v.start, v.end, pages])

  const focusRow = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(total - 1, index))
    focusIndex.current = clamped
    const el = gridRef.current?.querySelector<HTMLElement>(`[data-row-index="${clamped}"]`)
    el?.focus()
  }, [total])

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      const index = Number((e.target as HTMLElement).dataset.rowIndex)
      if (Number.isNaN(index)) return
      const row = controller.rowAt(index)
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          focusRow(index + 1)
          break
        case 'ArrowUp':
          e.preventDefault()
          focusRow(index - 1)
          break
        case 'Home':
          e.preventDefault()
          focusRow(0)
          break
        case 'End':
          e.preventDefault()
          focusRow(total - 1)
          break
        case ' ':
          e.preventDefault()
          if (row) controller.select(row.id, { shift: e.shiftKey, meta: e.metaKey || e.ctrlKey })
          break
        case 'Enter':
          e.preventDefault()
          if (row) {
            controller.select(row.id, { shift: e.shiftKey, meta: e.metaKey || e.ctrlKey })
            onActivate?.(row)
          }
          break
        default:
          break
      }
    },
    [controller, focusRow, onActivate, total],
  )

  const rows: React.ReactNode[] = []
  for (let i = v.start; i < v.end; i++) {
    const row = controller.rowAt(i)
    rows.push(
      row ? (
        <Row
          key={row.id}
          index={i}
          row={row}
          selected={selectedIds.includes(row.id)}
          tabbable={i === focusIndex.current}
          onSelect={(mods) => controller.select(row.id, mods)}
          onActivate={() => onActivate?.(row)}
          renderValue={renderValue}
        />
      ) : (
        // Its page is still in flight — a placeholder keeps the window honest
        // instead of collapsing the scrollbar.
        <div
          key={`skeleton-${i}`}
          className="vars-row vars-row-skeleton"
          role="row"
          aria-rowindex={i + 2}
          aria-busy="true"
          data-row-index={i}
          style={{ gridTemplateColumns: TEMPLATE }}
        >
          <span className="vars-cell vars-skeleton-bar" role="gridcell" />
        </div>
      ),
    )
  }

  return (
    <div className="vars-table">
      <div
        role="grid"
        aria-label="Variables"
        aria-rowcount={total + 1}
        aria-colcount={COLUMNS.length}
        aria-busy={loading || undefined}
        className="vars-grid"
        ref={gridRef}
        onKeyDown={onKeyDown}
      >
        <div className="vars-head" role="rowgroup">
          <div className="vars-row vars-headrow" role="row" aria-rowindex={1} style={{ gridTemplateColumns: TEMPLATE }}>
            {COLUMNS.map((col, i) => (
              <div
                key={col.field}
                role="columnheader"
                aria-colindex={i + 1}
                aria-sort={sort.field === col.field ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                className="vars-cell vars-colheader"
              >
                <button
                  type="button"
                  className="vars-sort-btn"
                  data-testid={`sort-${col.field}`}
                  onClick={() => controller.toggleSort(col.field)}
                  aria-label={`Sort by ${col.label}`}
                >
                  {col.label}
                  <span aria-hidden="true" className="vars-sort-caret">
                    {sort.field === col.field ? (sort.dir === 'asc' ? '▲' : '▼') : ''}
                  </span>
                </button>
              </div>
            ))}
          </div>
        </div>

        <div
          className="vars-scroll"
          data-testid="vars-scroll"
          ref={v.containerRef}
          onScroll={v.onScroll}
          role="rowgroup"
        >
          {total === 0 && !loading ? (
            <p className="vars-empty" data-testid="vars-empty">
              No variables match this filter.
            </p>
          ) : (
            <div className="vars-spacer" style={{ height: v.totalHeight }}>
              <div className="vars-window" style={{ transform: `translateY(${v.offsetY}px)` }}>
                {rows}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

interface RowProps {
  index: number
  row: VariableRecord
  selected: boolean
  tabbable: boolean
  onSelect: (mods: { shift?: boolean; meta?: boolean }) => void
  onActivate: () => void
  renderValue?: (row: VariableRecord) => React.ReactNode
}

function Row({ index, row, selected, tabbable, onSelect, onActivate, renderValue }: RowProps) {
  return (
    <div
      role="row"
      aria-rowindex={index + 2 /* 1-based, and the header is row 1 */}
      aria-selected={selected}
      className="vars-row"
      data-variable={row.id}
      data-row-index={index}
      data-selected={selected || undefined}
      tabIndex={tabbable ? 0 : -1}
      style={{ gridTemplateColumns: TEMPLATE }}
      onClick={(e) => onSelect({ shift: e.shiftKey, meta: e.metaKey || e.ctrlKey })}
      onDoubleClick={onActivate}
    >
      <span className="vars-cell vars-name" role="gridcell" aria-colindex={1}>
        {row.name}
      </span>
      <span className="vars-cell vars-path" role="gridcell" aria-colindex={2}>
        {row.id}
      </span>
      <span className="vars-cell" role="gridcell" aria-colindex={3}>
        <span className="vars-scope-chip" data-scope={row.scope}>
          {scopeMeta(row.scope)?.label ?? row.scope}
        </span>
        {row.plugin ? <span className="vars-plugin-badge">{row.plugin}</span> : null}
      </span>
      <span className="vars-cell vars-type" role="gridcell" aria-colindex={4}>
        {typeMeta(row.type)?.label ?? row.type}
      </span>
      <span className="vars-cell vars-value" role="gridcell" aria-colindex={5}>
        {renderValue ? renderValue(row) : formatValue(row)}
      </span>
      <span className="vars-cell vars-updated" role="gridcell" aria-colindex={6}>
        {row.updatedAt ? relative(row.updatedAt) : '—'}
      </span>
    </div>
  )
}

/** Compact "updated" readout. Absolute timestamps live in the inspector (CD-403). */
function relative(ts: number): string {
  const delta = Date.now() - ts
  if (delta < 0 || delta < 60_000) return 'just now'
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`
  return `${Math.floor(delta / 86_400_000)}d ago`
}
