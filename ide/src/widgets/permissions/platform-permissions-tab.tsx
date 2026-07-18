// Platform Inspector — Permissions tab (CD-422). A cross-widget view: every loaded
// widget × its declared capabilities × the live decision. Reads the registry's
// manifests (passed in — registry-agnostic) and the permissions store. This is the
// "perms tab goes live" surface; assembly feeds it registry.list().
import type { WidgetManifest, WidgetPermissionsStore, WidgetCapability } from '@/services/widgets'
import { usePermissionsSnapshot } from './use-widget-permissions'
import './permissions.css'

export interface PlatformPermissionsTabProps {
  /** Loaded widget manifests (assembly passes registry.list()). */
  widgets: WidgetManifest[]
  store: WidgetPermissionsStore
}

export function PlatformPermissionsTab({ widgets, store }: PlatformPermissionsTabProps) {
  usePermissionsSnapshot(store)
  const gated = widgets.filter((w) => (w.permissions?.length ?? 0) > 0)

  return (
    <div className="wperm-tab" data-perm-tab aria-label="Platform permissions">
      {gated.length === 0 ? (
        <p className="wperm-panel__empty">No widget declares any capability.</p>
      ) : (
        <table className="wperm-table">
          <thead>
            <tr>
              <th>Widget</th>
              <th>Capability</th>
              <th>State</th>
            </tr>
          </thead>
          <tbody>
            {gated.flatMap((w) =>
              (w.permissions as WidgetCapability[]).map((cap) => {
                const state = store.decision(w.id, cap)
                return (
                  <tr key={`${w.id}:${cap}`} data-perm-row={`${w.id}:${cap}`} data-perm-state={state}>
                    <td>{w.id}</td>
                    <td>
                      <code>{cap}</code>
                    </td>
                    <td className={`wperm-row__state wperm-row__state--${state}`}>{state}</td>
                  </tr>
                )
              }),
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}
