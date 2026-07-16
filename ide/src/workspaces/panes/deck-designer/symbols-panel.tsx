// Symbols panel (CD-322). Type groups + favorites + live use-counts; double-click
// drops a symbol tile onto the canvas (undoable). Dropped symbols render on the board
// and appear in the layers tree.
import { useMemo, useState, useSyncExternalStore } from 'react'
import { useProjectModel } from './use-project-model'
import { useSelection } from './use-selection'
import { useUndo } from './use-undo'
import { useCanvasViewBus } from './use-canvas-view'
import { visibleWorldRect } from '@/shared/canvas'
import { LocalStorageAdapter } from '@/services/persistence'
import { SYMBOL_CATALOG, SYMBOL_GROUPS, loadFavorites, saveFavorites, symbolUseCount, insertSymbol } from './symbol-catalog'
import './symbols.css'

export function SymbolsPanel({ pageId }: { pageId: string }) {
  const model = useProjectModel()
  const engine = useSelection()
  const undo = useUndo()
  const viewBus = useCanvasViewBus()
  const storage = useMemo(() => new LocalStorageAdapter(), [])
  const [favs, setFavs] = useState<Set<string>>(() => loadFavorites(storage))
  const [showFavs, setShowFavs] = useState(false)
  useSyncExternalStore((cb) => model.subscribe(cb), () => model.revision) // live use-counts

  const groups = useMemo(() => {
    const visible = SYMBOL_CATALOG.filter((s) => !showFavs || favs.has(s.id))
    return SYMBOL_GROUPS.map((g) => [g, visible.filter((s) => s.group === g)] as const).filter(([, items]) => items.length)
  }, [showFavs, favs])

  const center = () => {
    const { transform, size } = viewBus.getView()
    if (size.w > 0) {
      const r = visibleWorldRect(transform, size)
      return { x: r.x + r.w / 2, y: r.y + r.h / 2 }
    }
    const canvas = model.page(pageId)?.canvas
    return { x: (canvas?.w ?? 400) / 2, y: (canvas?.h ?? 300) / 2 }
  }

  const toggleFav = (id: string) => {
    setFavs((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      saveFavorites(storage, next)
      return next
    })
  }

  return (
    <div className="dd-symbols" data-testid="symbols-panel">
      <div className="dd-symbols-head">
        <span className="dd-symbols-title">Symbols</span>
        <button type="button" className="dd-chip" aria-pressed={showFavs} onClick={() => setShowFavs((v) => !v)}>
          ★ Favorites
        </button>
      </div>
      <div className="dd-symbols-scroll">
        {groups.length === 0 && <p className="dd-symbols-empty">No symbols.</p>}
        {groups.map(([group, items]) => (
          <section key={group} className="dd-symbols-group" aria-label={group}>
            <h3 className="dd-symbols-group-title">{group}</h3>
            <div className="dd-symbols-grid">
              {items.map((s) => {
                const count = symbolUseCount(model, s.id)
                return (
                  <button
                    key={s.id}
                    type="button"
                    className="dd-symbol-tile"
                    data-symbol={s.id}
                    onDoubleClick={() => insertSymbol({ model, undo, engine, pageId }, s, center())}
                    title={`${s.name} — double-click to place`}
                  >
                    <span className="dd-symbol-glyph" aria-hidden="true">{s.glyph}</span>
                    <span className="dd-symbol-name">{s.name}</span>
                    {count > 0 && <span className="dd-symbol-count" data-testid={`use-${s.id}`}>{count}</span>}
                    <span
                      className="dd-symbol-fav"
                      role="button"
                      aria-label={favs.has(s.id) ? 'Unfavorite' : 'Favorite'}
                      aria-pressed={favs.has(s.id)}
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleFav(s.id)
                      }}
                    >
                      {favs.has(s.id) ? '★' : '☆'}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
