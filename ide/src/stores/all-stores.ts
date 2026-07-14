// The full store set (CD-132) — the design's 13 STORES assembled, plus a manifest
// the persistence-map test checks against the STORES() rows exactly.
import type { Store, StoreKind, RestoreAt } from './store-base'
import { createBootCriticalStores, type BootCriticalStores } from './boot-critical'
import {
  createProjectStore,
  createWidgetStore,
  createEditorStore,
  createBindingStore,
  createHistoryStore,
  createRepositoryCacheStore,
  createAIStore,
  createRuntimeStore,
  createNotificationStore,
} from './domain/domain-stores'

export interface AllStores extends BootCriticalStores {
  project: Store<unknown>
  widget: Store<unknown>
  editor: Store<unknown>
  binding: Store<unknown>
  history: Store<unknown>
  repositoryCache: Store<unknown>
  ai: Store<unknown>
  runtime: Store<unknown>
  notification: Store<unknown>
}

export function createAllStores(): AllStores {
  const boot = createBootCriticalStores()
  return {
    ...boot,
    project: createProjectStore() as Store<unknown>,
    widget: createWidgetStore() as Store<unknown>,
    editor: createEditorStore() as Store<unknown>,
    binding: createBindingStore() as Store<unknown>,
    history: createHistoryStore() as Store<unknown>,
    repositoryCache: createRepositoryCacheStore() as Store<unknown>,
    ai: createAIStore() as Store<unknown>,
    runtime: createRuntimeStore() as Store<unknown>,
    notification: createNotificationStore() as Store<unknown>,
  }
}

/** The 13 STORES rows (design STORES()) — kind + persistence location. */
export interface StoreRow {
  name: string
  kind: StoreKind
  location?: string
  restoreAt?: RestoreAt
}

export function storesManifest(stores: AllStores): StoreRow[] {
  return Object.values(stores).map((s) => ({
    name: s.descriptor.name,
    kind: s.descriptor.kind,
    location: s.descriptor.location,
    restoreAt: s.descriptor.restoreAt,
  }))
}
