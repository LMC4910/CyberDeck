// Workspace rail (CD-203): a vertical, keyboard-operable list of workspaces with
// roving tabindex (Arrow keys move, Enter/Space activates). Switching calls
// WorkspaceService.setActive → WorkspaceChanged.
import { useRef, useState } from 'react'
import type { WorkspaceService } from '@/services/workspace'
import { activateOnKey } from '@/shared/a11y'
import './workspace-rail.css'

export interface WorkspaceRailProps {
  service: WorkspaceService
  active: string | null
}

export function WorkspaceRail({ service, active }: WorkspaceRailProps) {
  const items = service.list()
  const [focusIndex, setFocusIndex] = useState(0)
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  const move = (delta: number) => {
    const next = (focusIndex + delta + items.length) % items.length
    setFocusIndex(next)
    refs.current[next]?.focus()
  }

  return (
    <nav aria-label="Workspaces" className="ws-rail">
      <ul role="tablist" aria-orientation="vertical" className="ws-rail-list">
        {items.map((w, i) => {
          const selected = w.id === active
          return (
            <li key={w.id} role="none">
              <button
                ref={(el) => {
                  refs.current[i] = el
                }}
                role="tab"
                aria-selected={selected}
                aria-label={w.label}
                data-workspace={w.id}
                tabIndex={i === focusIndex ? 0 : -1}
                className={selected ? 'ws-rail-btn on' : 'ws-rail-btn'}
                onFocus={() => setFocusIndex(i)}
                onClick={() => service.setActive(w.id)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    move(1)
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    move(-1)
                  } else {
                    activateOnKey<HTMLButtonElement>(() => service.setActive(w.id))(e)
                  }
                }}
              >
                <span className="ws-rail-icon" data-icon={w.icon} aria-hidden="true" />
                <span className="ws-rail-label">{w.label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
