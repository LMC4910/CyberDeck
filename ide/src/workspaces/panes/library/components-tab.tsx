// Components tab (CD-404). Reads the CD-315 INSERT_CATALOG through the seam — the very
// same registry the Insert panel renders, by reference — so a new catalog entry shows
// up here with zero extra wiring. Category chips + fuzzy search + favorites; a preview
// card on hover/focus; double-click / Enter inserts the widget into the open document.
import { useMemo, useState } from 'react'
import { fuzzyFilter } from '@/shared/fuzzy'
import type { StorageAdapter } from '@/services/persistence'
import { INSERT_CATALOG, insertManifest, type InsertManifest } from './registry-seam'
import { useLibraryContext } from './use-library'
import { useFavorites } from './favorites'
import { LibraryToolbar, LibraryBody, LibraryTile, PreviewCard, PreviewEmpty, type Chip } from './library-ui'

const ALL = '__all'
const FAVS = '__favs'

export function ComponentsTab({ storage }: { storage?: StorageAdapter }) {
  const { model, engine, undo, pageId, center } = useLibraryContext()
  const favorites = useFavorites('components', storage)
  const [search, setSearch] = useState('')
  const [chip, setChip] = useState(ALL)
  const [preview, setPreview] = useState<InsertManifest | null>(null)

  const categories = useMemo(() => [...new Set(INSERT_CATALOG.map((m) => m.category))].sort(), [])
  const chips: Chip[] = [
    { id: ALL, label: 'All', count: INSERT_CATALOG.length },
    { id: FAVS, label: '★ Favorites', count: favorites.favs.size },
    ...categories.map((c) => ({ id: c, label: c })),
  ]

  const items = useMemo(() => {
    let list = INSERT_CATALOG
    if (chip === FAVS) list = list.filter((m) => favorites.isFav(m.type))
    else if (chip !== ALL) list = list.filter((m) => m.category === chip)
    return fuzzyFilter(search, list, (m) => `${m.label} ${m.type}`).map((s) => s.item)
  }, [search, chip, favorites])

  const insert = (m: InsertManifest) => insertManifest({ model, undo, engine, pageId }, m, center())

  return (
    <div className="lib-tab" data-testid="library-components">
      <LibraryToolbar
        search={search}
        onSearch={setSearch}
        placeholder="Search components"
        chips={chips}
        activeChip={chip}
        onChip={setChip}
      />
      <LibraryBody
        empty={items.length === 0}
        emptyLabel="No components match."
        preview={
          preview ? (
            <PreviewCard
              icon={preview.icon}
              title={preview.label}
              subtitle={preview.type}
              rows={[
                { label: 'Category', value: preview.category },
                { label: 'Default size', value: `${preview.defaultSize.w} × ${preview.defaultSize.h}` },
              ]}
              hint="Double-click or press Enter to insert into Design"
            />
          ) : (
            <PreviewEmpty hint="Hover or focus a component to preview it." />
          )
        }
      >
        {items.map((m) => (
          <LibraryTile
            key={m.type}
            dataAttr={{ name: 'data-component', value: m.type }}
            icon={m.icon}
            label={m.label}
            title={`${m.label} — double-click to insert`}
            favorite={{ on: favorites.isFav(m.type), onToggle: () => favorites.toggle(m.type) }}
            onInsert={() => insert(m)}
            onPreview={() => setPreview(m)}
          />
        ))}
      </LibraryBody>
    </div>
  )
}
