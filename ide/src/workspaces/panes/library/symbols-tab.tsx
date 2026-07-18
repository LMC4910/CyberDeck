// Symbols tab (CD-404). Reads the CD-322 SYMBOL_CATALOG through the seam. Group chips
// (icon / svg / lottie / animation) + fuzzy search + favorites; live use-counts off
// the ProjectModel; double-click / Enter drops the symbol into the open document.
import { useMemo, useState } from 'react'
import { fuzzyFilter } from '@/shared/fuzzy'
import type { StorageAdapter } from '@/services/persistence'
import { SYMBOL_CATALOG, SYMBOL_GROUPS, insertSymbol, symbolUseCount, type SymbolAsset } from './registry-seam'
import { useLibraryContext, useModelRevision } from './use-library'
import { useFavorites } from './favorites'
import { LibraryToolbar, LibraryBody, LibraryTile, PreviewCard, PreviewEmpty, type Chip } from './library-ui'

const ALL = '__all'
const FAVS = '__favs'

export function SymbolsTab({ storage }: { storage?: StorageAdapter }) {
  const { model, engine, undo, pageId, center } = useLibraryContext()
  useModelRevision(model) // live use-counts
  const favorites = useFavorites('symbols', storage)
  const [search, setSearch] = useState('')
  const [chip, setChip] = useState(ALL)
  const [preview, setPreview] = useState<SymbolAsset | null>(null)

  const chips: Chip[] = [
    { id: ALL, label: 'All', count: SYMBOL_CATALOG.length },
    { id: FAVS, label: '★ Favorites', count: favorites.favs.size },
    ...SYMBOL_GROUPS.map((g) => ({ id: g, label: g })),
  ]

  const items = useMemo(() => {
    let list = SYMBOL_CATALOG
    if (chip === FAVS) list = list.filter((s) => favorites.isFav(s.id))
    else if (chip !== ALL) list = list.filter((s) => s.group === chip)
    return fuzzyFilter(search, list, (s) => `${s.name} ${s.group}`).map((r) => r.item)
  }, [search, chip, favorites])

  const insert = (s: SymbolAsset) => insertSymbol({ model, engine, undo, pageId }, s, center())

  return (
    <div className="lib-tab" data-testid="library-symbols">
      <LibraryToolbar
        search={search}
        onSearch={setSearch}
        placeholder="Search symbols"
        chips={chips}
        activeChip={chip}
        onChip={setChip}
      />
      <LibraryBody
        empty={items.length === 0}
        emptyLabel="No symbols match."
        preview={
          preview ? (
            <PreviewCard
              icon={preview.glyph}
              title={preview.name}
              subtitle={preview.group}
              rows={[{ label: 'In use', value: `${symbolUseCount(model, preview.id)} widget(s)` }]}
              hint="Double-click or press Enter to insert into Design"
            />
          ) : (
            <PreviewEmpty hint="Hover or focus a symbol to preview it." />
          )
        }
      >
        {items.map((s) => {
          const count = symbolUseCount(model, s.id)
          return (
            <LibraryTile
              key={s.id}
              dataAttr={{ name: 'data-symbol', value: s.id }}
              icon={s.glyph}
              label={s.name}
              title={`${s.name} — double-click to insert`}
              badge={count > 0 ? <span className="lib-tile-badge" data-testid={`use-${s.id}`}>{count}</span> : undefined}
              favorite={{ on: favorites.isFav(s.id), onToggle: () => favorites.toggle(s.id) }}
              onInsert={() => insert(s)}
              onPreview={() => setPreview(s)}
            />
          )
        })}
      </LibraryBody>
    </div>
  )
}
