// DockHost (CD-215): renders registered tool windows per the DockManager state —
// pinned docked windows as rails (resizable) that inset content, unpinned windows
// as edge tabs with hover/click peek, floating windows as movable panels. Header
// controls (keyboard-operable) drive the transitions; a zone chooser stands in for
// the design's drag-to-zone overlay (drag can layer on later; controls keep the
// journey reliable + accessible).
import type { ReactNode } from 'react'
import type { DockManager, DockSide, ToolWindow } from '@/platform/dock'
import './dock.css'

export interface DockHostProps {
  manager: DockManager
  /** Rendered content for each tool-window id. */
  content: Record<string, ReactNode>
  /** Live window rows (from a store subscription) so the host re-renders. */
  windows: ToolWindow[]
  /** Called after any transition so the caller persists + re-reads the manager. */
  onChange: () => void
}

export function DockHost({ manager, content, windows, onChange }: DockHostProps) {
  const act = (fn: () => void) => {
    fn()
    onChange()
  }

  return (
    <div className="dock-host">
      {windows.map((w) => {
        const body = content[w.id] ?? null
        // Unpinned docked → edge tab with peek
        if (w.mode === 'docked' && !w.pinned) {
          return (
            <div key={w.id} className={`dock-tab dock-tab-${w.side}`} data-dock-tab={w.id}>
              <button
                data-dock-peek={w.id}
                aria-label={`Peek ${w.id}`}
                onMouseEnter={() => act(() => manager.peek(w.id))}
                onClick={() => act(() => (w.peeking ? manager.unpeek(w.id) : manager.peek(w.id)))}
              >
                {w.id}
              </button>
              {w.peeking && (
                <div className="dock-peek-body" data-dock-peekbody={w.id}>
                  <ToolHeader w={w} manager={manager} act={act} />
                  {body}
                </div>
              )}
            </div>
          )
        }
        // Floating window
        if (w.mode === 'float') {
          return (
            <div key={w.id} className="dock-float" data-dock-float={w.id} role="dialog" aria-label={w.id}>
              <ToolHeader w={w} manager={manager} act={act} />
              {body}
            </div>
          )
        }
        // Pinned docked rail
        return (
          <aside
            key={w.id}
            className={`dock-rail dock-rail-${w.side}`}
            data-dock-rail={w.id}
            style={w.side === 'bottom' ? { height: w.size } : { width: w.size }}
            aria-label={w.id}
          >
            <ToolHeader w={w} manager={manager} act={act} />
            <div className="dock-rail-body">{body}</div>
          </aside>
        )
      })}
    </div>
  )
}

function ToolHeader({
  w,
  manager,
  act,
}: {
  w: ToolWindow
  manager: DockManager
  act: (fn: () => void) => void
}) {
  return (
    <header className="dock-head" data-dock-head={w.id}>
      <span className="dock-title">{w.id}</span>
      <div className="dock-controls">
        {w.mode === 'docked' && w.pinned && (
          <button data-dock-unpin={w.id} aria-label={`Auto-hide ${w.id}`} onClick={() => act(() => manager.unpin(w.id))}>
            ⌵
          </button>
        )}
        {w.mode === 'docked' && !w.pinned && (
          <button data-dock-pin={w.id} aria-label={`Pin ${w.id}`} onClick={() => act(() => manager.pin(w.id))}>
            ⌾
          </button>
        )}
        {w.mode === 'docked' && (
          <button data-dock-float={w.id} aria-label={`Float ${w.id}`} onClick={() => act(() => manager.float(w.id))}>
            ⧉
          </button>
        )}
        {w.mode === 'float' &&
          (['left', 'right', 'bottom'] as DockSide[]).map((side) => (
            <button
              key={side}
              data-dock-to={`${w.id}:${side}`}
              aria-label={`Dock ${w.id} ${side}`}
              onClick={() => act(() => manager.dock(w.id, side))}
            >
              {side[0]!.toUpperCase()}
            </button>
          ))}
      </div>
    </header>
  )
}
