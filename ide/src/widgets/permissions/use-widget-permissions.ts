// React bindings for the permissions store (CD-422). useSyncExternalStore keeps
// the inspector list + Platform Inspector perms tab live as grants/denies change.
import { useSyncExternalStore } from 'react'
import type { WidgetPermissionsStore, PermissionState, WidgetCapability } from '@/services/widgets'

/** Re-render on any permission change; returns the store's current snapshot. */
export function usePermissionsSnapshot(store: WidgetPermissionsStore) {
  return useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => store.snapshot(),
  )
}

/** Live decision for a single (widget, capability). */
export function usePermissionDecision(
  store: WidgetPermissionsStore,
  widgetId: string,
  capability: WidgetCapability,
): PermissionState {
  return useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => store.decision(widgetId, capability),
  )
}
