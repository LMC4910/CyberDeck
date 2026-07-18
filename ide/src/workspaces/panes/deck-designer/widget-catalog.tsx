// Widget catalog provider (CD-421). Upgrades the Insert/Library/palette/canvas
// surfaces from reading the static CD-315 INSERT_CATALOG directly to reading the
// platform WidgetRegistry (CD-419) through this one hook — so registering a manifest
// surfaces it in all four places with zero extra wiring. When no registry is bound
// (tests, and until the shell wires one), it falls back to the static catalog, so
// every existing surface behaves exactly as before. CD-423 removes the static
// fallback once the canon widgets are themselves manifest-registered.
import { createContext, useContext, useEffect, useState } from 'react'
import type { CyberDeckWidgetManifestV2 as WidgetManifest } from '@/shared/contract'
import { INSERT_CATALOG, type InsertManifest } from './insert-catalog'

/** The narrow registry view the catalog needs — satisfied by services/widgets'
 *  WidgetRegistry without importing it (the workspace boundary forbids that reach;
 *  the shell injects the real registry). */
export interface WidgetCatalogRegistry {
  list(): WidgetManifest[]
  subscribe(listener: () => void): () => void
}

const CatalogContext = createContext<WidgetCatalogRegistry | null>(null)
export const WidgetCatalogProvider = CatalogContext.Provider

/** Manifests carry no authoring frame size; a new widget lands at this default box. */
const DEFAULT_SIZE = { w: 200, h: 160 }

/** Project a platform manifest (CD-110) onto the InsertManifest shape the surfaces use. */
export function insertManifestFromWidget(m: WidgetManifest): InsertManifest {
  return {
    type: m.id,
    label: m.metadata.label,
    category: m.metadata.category ?? 'Other',
    icon: m.metadata.icon ?? '▫',
    defaultSize: DEFAULT_SIZE,
    ...(m.defaults && Object.keys(m.defaults).length ? { defaults: m.defaults as Record<string, unknown> } : {}),
  }
}

/**
 * The live insert catalog. Registry-backed when a registry is bound (re-renders as
 * manifests load), else the static INSERT_CATALOG fallback. This is the single seam
 * the four surfaces read — the "zero wiring" the CD-421 AC proves.
 */
export function useInsertCatalog(): InsertManifest[] {
  const registry = useContext(CatalogContext)
  const [catalog, setCatalog] = useState<InsertManifest[]>(() =>
    registry ? registry.list().map(insertManifestFromWidget) : INSERT_CATALOG,
  )
  useEffect(() => {
    if (!registry) {
      setCatalog(INSERT_CATALOG)
      return
    }
    const update = () => setCatalog(registry.list().map(insertManifestFromWidget))
    update() // sync to current registry contents on bind
    return registry.subscribe(update)
  }, [registry])
  return catalog
}
