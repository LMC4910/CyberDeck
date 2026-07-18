// Per-widget permissions list (CD-422). Mounts in the widget inspector: each
// capability the widget's manifest DECLARES, with its live grant/deny/unset state
// and controls. A widget with no declared capabilities says so (no silent gap).
import type { WidgetManifest, WidgetPermissionsStore, WidgetCapability } from '@/services/widgets'
import { usePermissionsSnapshot } from './use-widget-permissions'
import './permissions.css'

export interface WidgetPermissionsPanelProps {
  manifest: WidgetManifest
  store: WidgetPermissionsStore
}

export function WidgetPermissionsPanel({ manifest, store }: WidgetPermissionsPanelProps) {
  // Subscribe so rows reflect grants/denies immediately.
  usePermissionsSnapshot(store)
  const declared = (manifest.permissions ?? []) as WidgetCapability[]

  return (
    <section className="wperm-panel" data-perm-panel={manifest.id} aria-label="Widget permissions">
      <header className="wperm-panel__head">Permissions</header>
      {declared.length === 0 ? (
        <p className="wperm-panel__empty" data-perm-empty>
          This widget declares no capabilities.
        </p>
      ) : (
        <ul className="wperm-panel__list">
          {declared.map((cap) => {
            const state = store.decision(manifest.id, cap)
            return (
              <li key={cap} className="wperm-row" data-perm-cap={cap} data-perm-state={state}>
                <span className="wperm-row__cap">{cap}</span>
                <span className={`wperm-row__state wperm-row__state--${state}`}>{state}</span>
                <span className="wperm-row__actions">
                  <button
                    type="button"
                    className="wperm-btn wperm-btn--grant"
                    aria-pressed={state === 'granted'}
                    onClick={() => store.grant(manifest.id, cap)}
                  >
                    Grant
                  </button>
                  <button
                    type="button"
                    className="wperm-btn wperm-btn--deny"
                    aria-pressed={state === 'denied'}
                    onClick={() => store.deny(manifest.id, cap)}
                  >
                    Deny
                  </button>
                  <button
                    type="button"
                    className="wperm-btn wperm-btn--reset"
                    disabled={state === 'unset'}
                    onClick={() => store.reset(manifest.id, cap)}
                  >
                    Reset
                  </button>
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
