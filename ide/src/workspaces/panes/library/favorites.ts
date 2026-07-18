// Library favorites (CD-404). A per-registry set of favorited item ids, persisted
// through the injected StorageAdapter (the sanctioned path — no direct localStorage,
// per the CD-117 architecture guard). Kept separate per tab so a favorite gauge and a
// favorite symbol never collide.
import { useCallback, useMemo, useState } from 'react'
import { LocalStorageAdapter, type StorageAdapter } from '@/services/persistence'

export type FavoriteRegistry = 'components' | 'styles' | 'symbols'

const KEY = (registry: FavoriteRegistry) => `cdk-library-favorites:${registry}`

export function loadFavorites(storage: StorageAdapter, registry: FavoriteRegistry): Set<string> {
  try {
    const raw = storage.get(KEY(registry))
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

export function saveFavorites(storage: StorageAdapter, registry: FavoriteRegistry, favs: Set<string>): void {
  storage.set(KEY(registry), JSON.stringify([...favs]))
}

export interface FavoritesApi {
  favs: Set<string>
  isFav: (id: string) => boolean
  toggle: (id: string) => void
}

/** Favorites state + persistence for one registry. Storage is injectable for tests. */
export function useFavorites(registry: FavoriteRegistry, storage?: StorageAdapter): FavoritesApi {
  const adapter = useMemo(() => storage ?? new LocalStorageAdapter(), [storage])
  const [favs, setFavs] = useState<Set<string>>(() => loadFavorites(adapter, registry))

  const toggle = useCallback(
    (id: string) => {
      setFavs((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        saveFavorites(adapter, registry, next)
        return next
      })
    },
    [adapter, registry],
  )

  const isFav = useCallback((id: string) => favs.has(id), [favs])
  return { favs, isFav, toggle }
}
