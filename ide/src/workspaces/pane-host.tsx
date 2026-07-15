// Pane host (CD-203): mounts the active workspace's pane, lazy-loading its module
// via the contribution's dynamic import on first entry (cached across switches).
import { Suspense, lazy, useMemo, type ComponentType } from 'react'
import type { WorkspaceService, PaneLoader } from '@/services/workspace'

export interface PaneHostProps {
  service: WorkspaceService
  active: string | null
}

// Cache lazy components per loader so re-entry doesn't re-import.
const cache = new WeakMap<PaneLoader, ComponentType>()

function laneFor(loader: PaneLoader): ComponentType {
  let comp = cache.get(loader)
  if (!comp) {
    comp = lazy(loader as () => Promise<{ default: ComponentType }>)
    cache.set(loader, comp)
  }
  return comp
}

export function PaneHost({ service, active }: PaneHostProps) {
  const contribution = active ? service.get(active) : undefined
  const Pane = useMemo(
    () => (contribution ? laneFor(contribution.lazyPane) : null),
    [contribution],
  )

  return (
    <main className="ws-pane-host" aria-live="polite">
      {Pane ? (
        <Suspense fallback={<div data-pane-loading>Loading…</div>}>
          <Pane />
        </Suspense>
      ) : (
        <div data-pane-empty>No workspace selected.</div>
      )}
    </main>
  )
}
