// Platform Inspector — a dev surface behind the devTools flag. Mounted as a lazy
// chunk by the shell (M2); `lazyInspector` gives the code-split entry.
import { lazy } from 'react'

export { InspectorPanel, StoreBadge, type InspectorProps } from './inspector-panel'
export {
  ReposTab,
  EventsTab,
  ArchitectureMode,
  BootReplay,
  type RequestRow,
  type RequestTap,
} from './inspector-extra'
export { ARCH_NOTES, type ArchNote } from './arch-notes'

/** Code-split entry (lazy chunk) — the shell renders this only when devTools is on. */
export const lazyInspector = lazy(async () => {
  const mod = await import('./inspector-panel')
  return { default: mod.InspectorPanel }
})
