// Styles tab (CD-404). Reads the CD-321 shared-style registry LIVE from the ProjectModel
// (model.styles()) through the seam — the exact registry the inspector edits and every
// linked widget resolves its appearance from (effectiveStyleProps), never a copy.
// Recoloring a style here calls setStyleProp (the CD-321 path), so the change propagates
// to every widget on the canvas with zero extra wiring. Double-click applies (links) the
// style to the currently-selected widget(s).
import { useMemo, useState } from 'react'
import { fuzzyFilter } from '@/shared/fuzzy'
import type { StorageAdapter } from '@/services/persistence'
import type { StyleKind } from '@/shared/project'
import { STYLE_KINDS, setStyleProp, linkStyle, type StyleCtx } from './registry-seam'
import { useLibraryContext, useModelRevision } from './use-library'
import { useFavorites } from './favorites'
import { LibraryToolbar, LibraryBody, LibraryTile, PreviewCard, PreviewEmpty, type Chip } from './library-ui'

const ALL = '__all'
const FAVS = '__favs'

interface StyleRow {
  id: string
  kind: StyleKind
  name: string
  props: Record<string, unknown>
}

const KIND_META = new Map(STYLE_KINDS.map((k) => [k.kind, k] as const))
const KIND_GLYPH: Record<StyleKind, string> = {
  fill: '●',
  stroke: '◯',
  typography: 'T',
  effect: '✦',
  radius: '⬭',
}
const kindHasColor = (kind: StyleKind) => (KIND_META.get(kind)?.props ?? []).includes('color')
const asColor = (props: Record<string, unknown>) => (typeof props.color === 'string' ? props.color : undefined)

function swatch(row: StyleRow) {
  const color = asColor(row.props)
  if (kindHasColor(row.kind) && color) {
    return <span className="lib-swatch" style={{ background: color }} />
  }
  return <span>{KIND_GLYPH[row.kind]}</span>
}

export function StylesTab({ storage }: { storage?: StorageAdapter }) {
  const { model, engine, undo } = useLibraryContext()
  const rev = useModelRevision(model) // live: recolors + new styles surface immediately
  const favorites = useFavorites('styles', storage)
  const [search, setSearch] = useState('')
  const [chip, setChip] = useState(ALL)
  const [previewId, setPreviewId] = useState<string | null>(null)

  const styleList = useMemo<StyleRow[]>(
    () =>
      Object.entries(model.styles()).map(([id, s]) => ({
        id,
        kind: s.kind,
        name: s.name,
        props: (s.props ?? {}) as Record<string, unknown>,
      })),
    [model, rev],
  )

  // Only chip the kinds that actually have styles, in STYLE_KINDS order.
  const kinds = useMemo(() => {
    const present = new Set(styleList.map((s) => s.kind))
    return STYLE_KINDS.filter((k) => present.has(k.kind))
  }, [styleList])

  const chips: Chip[] = [
    { id: ALL, label: 'All', count: styleList.length },
    { id: FAVS, label: '★ Favorites', count: favorites.favs.size },
    ...kinds.map((k) => ({ id: k.kind, label: k.label })),
  ]

  const items = useMemo(() => {
    let list = styleList
    if (chip === FAVS) list = list.filter((s) => favorites.isFav(s.id))
    else if (chip !== ALL) list = list.filter((s) => s.kind === chip)
    return fuzzyFilter(search, list, (s) => `${s.name} ${s.kind}`).map((r) => r.item)
  }, [styleList, search, chip, favorites])

  // Re-derived from the live list so the preview (and its color input) stay in sync
  // after a recolor.
  const preview = styleList.find((s) => s.id === previewId) ?? null

  const ctx: StyleCtx = { model, undo, engine }

  // THE CD-321 propagation path: edits the shared style in the registry; every linked
  // widget re-resolves. Coalesced by setStyleProp so a color drag is one undo step.
  const recolor = (row: StyleRow, color: string) => setStyleProp(ctx, row.id, 'color', color)

  // Link the style onto the currently-selected widget(s) of its kind (undoable).
  const applyToSelection = (row: StyleRow) => {
    const sel = engine.state
    const ids = sel.kind === 'widget' ? sel.ids : []
    for (const id of ids) linkStyle(ctx, id, row.kind, row.id)
  }

  return (
    <div className="lib-tab" data-testid="library-styles">
      <LibraryToolbar
        search={search}
        onSearch={setSearch}
        placeholder="Search styles"
        chips={chips}
        activeChip={chip}
        onChip={setChip}
      />
      <LibraryBody
        empty={items.length === 0}
        emptyLabel={
          styleList.length === 0
            ? 'No shared styles yet. Create one from a widget in Design.'
            : 'No styles match.'
        }
        preview={
          preview ? (
            <PreviewCard
              icon={swatch(preview)}
              title={preview.name}
              subtitle={preview.kind}
              rows={Object.entries(preview.props).map(([k, v]) => ({ label: k, value: String(v) }))}
              hint="Double-click to apply to the selected widget"
            >
              {kindHasColor(preview.kind) && (
                <label className="lib-recolor">
                  <span>Color</span>
                  <input
                    type="color"
                    aria-label={`Recolor ${preview.name}`}
                    data-testid="lib-recolor"
                    value={asColor(preview.props) ?? '#888888'}
                    onChange={(e) => recolor(preview, e.target.value)}
                  />
                </label>
              )}
            </PreviewCard>
          ) : (
            <PreviewEmpty hint="Hover or focus a style to preview and recolor it." />
          )
        }
      >
        {items.map((row) => (
          <LibraryTile
            key={row.id}
            dataAttr={{ name: 'data-style', value: row.id }}
            icon={swatch(row)}
            label={row.name}
            title={`${row.name} — double-click to apply to selection`}
            favorite={{ on: favorites.isFav(row.id), onToggle: () => favorites.toggle(row.id) }}
            onInsert={() => applyToSelection(row)}
            onPreview={() => setPreviewId(row.id)}
          />
        ))}
      </LibraryBody>
    </div>
  )
}
