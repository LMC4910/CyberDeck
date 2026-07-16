// Status bar (CD-205): a pure store subscriber. It renders the active workspace,
// the selection count from the Editor store, and the saved-state indicator from
// ConfigurationService write-behind — all via `useStore`, no imperative sync.
import type { Store } from '@/stores'
import { useStore } from '@/stores'
import './chrome.css'

interface EditorLike {
  selection: string[]
}

export interface StatusBarProps {
  activeWorkspaceLabel: string
  editorStore: Store<EditorLike>
  /** "saved · 09:41" style indicator, derived from config write-behind. */
  savedLabel: string
  /** Snap-to-guides toggle segment (CD-307); omit to hide the segment. */
  snapEnabled?: boolean
  onToggleSnap?: () => void
}

export function StatusBar({ activeWorkspaceLabel, editorStore, savedLabel, snapEnabled, onToggleSnap }: StatusBarProps) {
  const selectionCount = useStore(editorStore, (s) => s.selection.length)
  return (
    <footer className="statusbar" aria-label="Status bar">
      <span className="statusbar-ws" data-status-workspace>
        {activeWorkspaceLabel}
      </span>
      <span className="statusbar-sel" data-status-selection>
        {selectionCount === 0 ? 'No selection' : `${selectionCount} selected`}
      </span>
      {onToggleSnap && (
        <button
          type="button"
          className="statusbar-snap"
          data-status-snap
          aria-pressed={snapEnabled}
          onClick={onToggleSnap}
          title="Toggle snapping"
        >
          Snap: {snapEnabled ? 'On' : 'Off'}
        </button>
      )}
      <span className="statusbar-saved" data-status-saved>
        {savedLabel}
      </span>
    </footer>
  )
}
