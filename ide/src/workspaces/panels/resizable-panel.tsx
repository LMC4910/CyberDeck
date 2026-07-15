// ResizablePanel (CD-213): a left/right panel with a drag handle (pointer resize)
// and keyboard resize (Arrow keys on the separator), clamped to [MIN, MAX]. When
// hidden it collapses to a thin reopen strip. Width changes flow to onResize
// (which writes the per-workspace Workspace store).
import { useRef, type ReactNode } from 'react'
import { PANEL_MIN, PANEL_MAX, clampWidth, type PanelSide } from './panels-model'
import './panels.css'

const STEP = 16

export interface ResizablePanelProps {
  side: PanelSide
  width: number
  visible: boolean
  onResize: (width: number) => void
  onToggle: () => void
  label: string
  children?: ReactNode
}

export function ResizablePanel({ side, width, visible, onResize, onToggle, label, children }: ResizablePanelProps) {
  const startX = useRef(0)
  const startW = useRef(0)

  if (!visible) {
    return (
      <button
        className={`panel-reopen panel-reopen-${side}`}
        data-panel-reopen={side}
        aria-label={`Show ${label}`}
        onClick={onToggle}
      >
        {side === 'left' ? '›' : '‹'}
      </button>
    )
  }

  const onPointerMove = (e: PointerEvent) => {
    const dx = e.clientX - startX.current
    const delta = side === 'left' ? dx : -dx
    onResize(clampWidth(startW.current + delta))
  }
  const onPointerUp = () => {
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
  }

  return (
    <aside
      className={`panel panel-${side}`}
      data-panel={side}
      style={{ width: `${width}px` }}
      aria-label={label}
    >
      <div className="panel-content">{children}</div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={`Resize ${label}`}
        aria-valuenow={width}
        aria-valuemin={PANEL_MIN}
        aria-valuemax={PANEL_MAX}
        tabIndex={0}
        data-panel-handle={side}
        className="panel-handle"
        onPointerDown={(e) => {
          startX.current = e.clientX
          startW.current = width
          window.addEventListener('pointermove', onPointerMove)
          window.addEventListener('pointerup', onPointerUp)
        }}
        onKeyDown={(e) => {
          // Arrow keys resize; grow/shrink depends on the side's orientation.
          const grow = side === 'left' ? 'ArrowRight' : 'ArrowLeft'
          const shrink = side === 'left' ? 'ArrowLeft' : 'ArrowRight'
          if (e.key === grow) {
            e.preventDefault()
            onResize(clampWidth(width + STEP))
          } else if (e.key === shrink) {
            e.preventDefault()
            onResize(clampWidth(width - STEP))
          }
        }}
      />
    </aside>
  )
}
