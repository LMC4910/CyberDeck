// Browse table (CD-405). Rows come from the ProjectRepository through the catalog
// port — sorted and paged BY IT — and are rendered in the order they arrive. The
// grid is windowed (shared/virtual), keyboard-navigable with a roving tabindex, and
// every row carries a menu: open / duplicate / delete (confirmed, undoable).
import { useCallback, useEffect, useRef, useState } from 'react'
import { useVirtualRows } from '@/shared/virtual'
import { activateOnKey } from '@/shared/a11y'
import { formatStamp, type ProjectSummary } from './project-summary'
import type { ProjectTable, SortField } from './use-project-table'
import { ConfirmDialog } from './confirm-dialog'
import type { ProjectActions } from './project-actions'

const ROW_H = 34

export interface ProjectsTableProps {
  table: ProjectTable
  actions: ProjectActions
  selectedId: string | null
  onSelect: (id: string) => void
  /** Id of the project currently open in the authoring workspace, if any. */
  openId: string | null
}

interface Column {
  key: string
  label: string
  /** Present when the repository can order by this column. */
  sort?: SortField
  className?: string
}

// Only `savedAt` and `id` are offered as sorts: the repository query orders on
// top-level document fields, and a project's name lives at `meta.name`. Rather than
// ship a Name sort that the data layer silently ignores, Name is a plain column
// until the repository can order by a nested path.
const COLUMNS: Column[] = [
  { key: 'name', label: 'Name', className: 'pj-col-name' },
  { key: 'pages', label: 'Pages', className: 'pj-col-num' },
  { key: 'widgets', label: 'Widgets', className: 'pj-col-num' },
  { key: 'savedAt', label: 'Updated', sort: 'savedAt', className: 'pj-col-date' },
  { key: 'id', label: 'ID', sort: 'id', className: 'pj-col-id' },
]

export function ProjectsTable({ table, actions, selectedId, onSelect, openId }: ProjectsTableProps) {
  const { rows, sort, page, totalPages, total, loading, error } = table
  const v = useVirtualRows(rows.length, ROW_H)
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [confirmFor, setConfirmFor] = useState<ProjectSummary | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  // Keep the roving tabindex on a row that still exists after a re-query.
  const focusedId = selectedId && rows.some((r) => r.id === selectedId) ? selectedId : (rows[0]?.id ?? null)

  const move = useCallback(
    (delta: number) => {
      if (!rows.length) return
      const at = rows.findIndex((r) => r.id === focusedId)
      const next = rows[Math.min(rows.length - 1, Math.max(0, (at < 0 ? 0 : at) + delta))]
      if (next) {
        onSelect(next.id)
        gridRef.current?.querySelector<HTMLElement>(`[data-row="${next.id}"]`)?.focus()
      }
    },
    [rows, focusedId, onSelect],
  )

  const onGridKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      move(1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      move(-1)
    }
  }

  return (
    <section className="pj-browse" aria-label="All projects">
      <header className="pj-browse-head">
        <h2 className="pj-h2">All projects</h2>
        <span className="pj-browse-count" data-testid="row-count">
          {loading ? 'Loading…' : `${total} project${total === 1 ? '' : 's'}`}
        </span>
      </header>

      {error ? (
        <p className="pj-error" role="alert" data-testid="table-error">
          Could not load projects: {error}
        </p>
      ) : (
        <>
          <div className="pj-grid" role="grid" aria-label="Projects" aria-rowcount={total} ref={gridRef} onKeyDown={onGridKeyDown}>
            <div className="pj-row pj-row-head" role="row">
              {COLUMNS.map((col) => (
                <HeaderCell key={col.key} column={col} sort={sort} onSort={table.toggleSort} />
              ))}
              <span className="pj-col-menu" role="columnheader" aria-label="Actions" />
            </div>
            <div className="pj-grid-scroll" ref={v.containerRef} onScroll={v.onScroll}>
              <div style={{ height: v.totalHeight, position: 'relative' }}>
                <div style={{ transform: `translateY(${v.offsetY}px)` }}>
                  {rows.slice(v.start, v.end).map((row, i) => (
                    <Row
                      key={row.id}
                      row={row}
                      rowIndex={v.start + i + 1}
                      selected={row.id === selectedId}
                      focusable={row.id === focusedId}
                      isOpen={row.id === openId}
                      menuOpen={menuFor === row.id}
                      onSelect={onSelect}
                      onToggleMenu={(id) => setMenuFor((cur) => (cur === id ? null : id))}
                      onOpen={() => void actions.open(row)}
                      onDuplicate={() => void actions.duplicate(row)}
                      onDelete={() => setConfirmFor(row)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
          {!loading && rows.length === 0 && (
            <p className="pj-empty" data-testid="table-empty">
              No projects yet — create one to get started.
            </p>
          )}
          <nav className="pj-pager" aria-label="Pagination">
            <button
              type="button"
              className="pj-btn"
              onClick={() => table.setPage(page - 1)}
              disabled={page <= 1 || loading}
            >
              Previous
            </button>
            <span className="pj-pager-label" data-testid="pager-label">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              className="pj-btn"
              onClick={() => table.setPage(page + 1)}
              disabled={page >= totalPages || loading}
            >
              Next
            </button>
          </nav>
        </>
      )}

      <ConfirmDialog
        open={confirmFor !== null}
        title="Delete project?"
        body={
          confirmFor
            ? `“${confirmFor.name}” will be removed. You can undo this from the toast or with ⌘Z.`
            : ''
        }
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          const row = confirmFor
          setConfirmFor(null)
          setMenuFor(null)
          if (row) void actions.remove(row)
        }}
        onCancel={() => setConfirmFor(null)}
      />
    </section>
  )
}

function HeaderCell({
  column,
  sort,
  onSort,
}: {
  column: Column
  sort: ProjectTable['sort']
  onSort: (field: SortField) => void
}) {
  const active = column.sort !== undefined && sort.field === column.sort
  const ariaSort = active ? (sort.dir === 'desc' ? 'descending' : 'ascending') : 'none'
  return (
    <span
      className={`pj-cell pj-head ${column.className ?? ''}`}
      role="columnheader"
      aria-sort={column.sort ? ariaSort : undefined}
      data-col={column.key}
    >
      {column.sort ? (
        <button
          type="button"
          className="pj-sort"
          data-testid={`sort-${column.sort}`}
          onClick={() => onSort(column.sort!)}
        >
          {column.label}
          <span className="pj-sort-caret" aria-hidden="true">
            {active ? (sort.dir === 'desc' ? '▾' : '▴') : '⇅'}
          </span>
        </button>
      ) : (
        column.label
      )}
    </span>
  )
}

interface RowProps {
  row: ProjectSummary
  rowIndex: number
  selected: boolean
  focusable: boolean
  isOpen: boolean
  menuOpen: boolean
  onSelect: (id: string) => void
  onToggleMenu: (id: string) => void
  onOpen: () => void
  onDuplicate: () => void
  onDelete: () => void
}

function Row({
  row, rowIndex, selected, focusable, isOpen, menuOpen,
  onSelect, onToggleMenu, onOpen, onDuplicate, onDelete,
}: RowProps) {
  return (
    <div
      className="pj-row"
      role="row"
      aria-rowindex={rowIndex}
      aria-selected={selected}
      data-row={row.id}
      data-open={isOpen || undefined}
      tabIndex={focusable ? 0 : -1}
      style={{ height: ROW_H }}
      onClick={() => onSelect(row.id)}
      onDoubleClick={onOpen}
      onKeyDown={activateOnKey(() => {
        onSelect(row.id)
        onOpen()
      })}
    >
      <span className="pj-cell pj-col-name" role="gridcell">
        <span className="pj-row-name">{row.name}</span>
        {isOpen && <span className="pj-chip">Open</span>}
      </span>
      <span className="pj-cell pj-col-num" role="gridcell">{row.stats.pages}</span>
      <span className="pj-cell pj-col-num" role="gridcell">{row.stats.widgets}</span>
      <span className="pj-cell pj-col-date" role="gridcell">{formatStamp(row.savedAt)}</span>
      <span className="pj-cell pj-col-id" role="gridcell">{row.id}</span>
      <span className="pj-cell pj-col-menu" role="gridcell">
        <RowMenu
          row={row}
          open={menuOpen}
          onToggle={() => onToggleMenu(row.id)}
          onOpenProject={onOpen}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
        />
      </span>
    </div>
  )
}

function RowMenu({
  row, open, onToggle, onOpenProject, onDuplicate, onDelete,
}: {
  row: ProjectSummary
  open: boolean
  onToggle: () => void
  onOpenProject: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const menuRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (open) menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
  }, [open])

  const close = () => {
    onToggle()
    buttonRef.current?.focus()
  }
  const run = (fn: () => void) => () => {
    onToggle()
    fn()
  }

  return (
    <span className="pj-menu-wrap">
      <button
        ref={buttonRef}
        type="button"
        className="pj-menu-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${row.name}`}
        data-testid={`row-menu-${row.id}`}
        onClick={(e) => {
          e.stopPropagation()
          onToggle()
        }}
      >
        ⋯
      </button>
      {open && (
        <div
          ref={menuRef}
          className="pj-menu"
          role="menu"
          aria-label={`Actions for ${row.name}`}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation()
              close()
            }
          }}
        >
          <button type="button" role="menuitem" className="pj-menu-item" onClick={run(onOpenProject)}>
            Open
          </button>
          <button type="button" role="menuitem" className="pj-menu-item" onClick={run(onDuplicate)}>
            Duplicate
          </button>
          <button
            type="button"
            role="menuitem"
            className="pj-menu-item pj-menu-danger"
            data-testid={`delete-${row.id}`}
            onClick={run(onDelete)}
          >
            Delete…
          </button>
        </div>
      )}
    </span>
  )
}
