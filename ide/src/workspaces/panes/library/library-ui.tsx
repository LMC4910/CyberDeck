// Shared Library UI primitives (CD-404): the toolbar (search + category chips), the
// tile grid scaffold, favorite stars, and the hover/focus preview card. Each tab
// (Components / Styles / Symbols) composes these; behaviour that differs per registry
// (what a tile shows, what double-click does) lives in the tab.
import type { KeyboardEvent, ReactNode } from 'react'

export interface Chip {
  id: string
  label: string
  count?: number
}

export function LibraryToolbar({
  search,
  onSearch,
  placeholder,
  chips,
  activeChip,
  onChip,
}: {
  search: string
  onSearch: (v: string) => void
  placeholder: string
  chips: Chip[]
  activeChip: string
  onChip: (id: string) => void
}) {
  return (
    <div className="lib-toolbar">
      <input
        className="lib-search"
        type="search"
        value={search}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => onSearch(e.target.value)}
      />
      <div className="lib-chips" role="group" aria-label="Categories">
        {chips.map((c) => (
          <button
            key={c.id}
            type="button"
            className="lib-chip"
            aria-pressed={activeChip === c.id}
            onClick={() => onChip(c.id)}
          >
            {c.label}
            {c.count !== undefined && <span className="lib-chip-count">{c.count}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

export function FavoriteStar({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  // Not a nested <button> (invalid inside the tile button) — a role="button" span,
  // keyboard-operable, stops propagation so it never triggers the tile's insert.
  const activate = () => onToggle()
  return (
    <span
      className="lib-fav"
      role="button"
      tabIndex={0}
      aria-label={on ? 'Remove from favorites' : 'Add to favorites'}
      aria-pressed={on}
      onClick={(e) => {
        e.stopPropagation()
        activate()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          e.stopPropagation()
          activate()
        }
      }}
    >
      {on ? '★' : '☆'}
    </span>
  )
}

/** A grid tile that inserts on double-click or Enter and previews on hover/focus. */
export function LibraryTile({
  dataAttr,
  icon,
  label,
  badge,
  favorite,
  onInsert,
  onPreview,
  title,
}: {
  dataAttr: { name: string; value: string }
  icon: ReactNode
  label: string
  badge?: ReactNode
  favorite?: { on: boolean; onToggle: () => void }
  onInsert: () => void
  onPreview: () => void
  title: string
}) {
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      onInsert()
    }
  }
  return (
    <button
      type="button"
      className="lib-tile"
      {...{ [dataAttr.name]: dataAttr.value }}
      title={title}
      onDoubleClick={onInsert}
      onKeyDown={onKeyDown}
      onMouseEnter={onPreview}
      onFocus={onPreview}
    >
      <span className="lib-tile-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="lib-tile-label">{label}</span>
      {badge}
      {favorite && <FavoriteStar on={favorite.on} onToggle={favorite.onToggle} />}
    </button>
  )
}

/** The two-pane body: a scrolling tile grid beside a preview aside. */
export function LibraryBody({
  empty,
  emptyLabel,
  preview,
  children,
}: {
  empty: boolean
  emptyLabel: string
  preview: ReactNode
  children: ReactNode
}) {
  return (
    <div className="lib-body">
      <div className="lib-grid-scroll">
        {empty ? <p className="lib-empty">{emptyLabel}</p> : <div className="lib-grid">{children}</div>}
      </div>
      <aside className="lib-preview" aria-label="Preview" aria-live="polite">
        {preview}
      </aside>
    </div>
  )
}

export function PreviewCard({
  icon,
  title,
  subtitle,
  rows,
  hint,
  children,
}: {
  icon: ReactNode
  title: string
  subtitle?: string
  rows?: { label: string; value: ReactNode }[]
  hint?: string
  /** Interactive controls (e.g. the Styles recolor input) rendered under the rows. */
  children?: ReactNode
}) {
  return (
    <div className="lib-preview-card" data-testid="lib-preview">
      <div className="lib-preview-icon" aria-hidden="true">
        {icon}
      </div>
      <div className="lib-preview-title">{title}</div>
      {subtitle && <div className="lib-preview-subtitle">{subtitle}</div>}
      {rows && rows.length > 0 && (
        <dl className="lib-preview-rows">
          {rows.map((r) => (
            <div key={r.label} className="lib-preview-row">
              <dt>{r.label}</dt>
              <dd>{r.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {children}
      {hint && <div className="lib-preview-hint">{hint}</div>}
    </div>
  )
}

export function PreviewEmpty({ hint }: { hint: string }) {
  return <p className="lib-preview-empty">{hint}</p>
}
