// Flow tab strip (CD-409): switch flows, rename one inline (Enter commits, Esc
// cancels — IDE-E20 "Esc cancels renames"), add a new one, and arm/disarm the active
// flow behind a confirm. Every mutation goes through flow-ops, so each lands as one
// undo entry on the shell's stack.
import { useCallback, useRef, useState } from 'react'
import { Dialog } from '@/shared/a11y'
import { useFlow, useFlowIds } from './use-flows'
import { createFlow, renameFlow, setFlowArmed, type FlowsCtx } from './flow-ops'
import type { FlowModel } from './flow-model'

export interface FlowTabsProps {
  ctx: FlowsCtx
  /** null only while the model holds no flows at all. */
  activeId: string | null
  onActivate: (id: string) => void
}

export function FlowTabs({ ctx, activeId, onActivate }: FlowTabsProps) {
  const { model } = ctx
  const ids = useFlowIds(model)
  const active = useFlow(model, activeId ?? '')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmArm, setConfirmArm] = useState(false)

  const commitRename = useCallback(
    (id: string, label: string) => {
      renameFlow(ctx, id, label)
      setEditingId(null)
    },
    [ctx],
  )

  // Roving tabindex: only the selected tab is in the tab order, so ←/→ must move
  // between tabs for the strip to be keyboard-operable at all.
  const onStripKeyDown = (e: React.KeyboardEvent) => {
    if (editingId) return
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (delta === 0 || ids.length === 0) return
    const at = activeId ? ids.indexOf(activeId) : 0
    const next = ids[(at + delta + ids.length) % ids.length]
    if (!next) return
    e.preventDefault()
    onActivate(next)
  }

  const armed = active?.armed ?? false

  return (
    <div className="fw-tabbar">
      <div className="fw-tabs" role="tablist" aria-label="Flows" onKeyDown={onStripKeyDown}>
        {ids.map((id) => (
          <FlowTab
            key={id}
            model={model}
            id={id}
            selected={id === activeId}
            editing={editingId === id}
            onActivate={() => onActivate(id)}
            onStartRename={() => setEditingId(id)}
            onCommit={(label) => commitRename(id, label)}
            onCancel={() => setEditingId(null)}
          />
        ))}
        <button
          type="button"
          className="fw-tab-new"
          data-testid="new-flow"
          aria-label="New flow"
          title="New flow"
          onClick={() => onActivate(createFlow(ctx))}
        >
          +
        </button>
      </div>
      <button
        type="button"
        className="fw-armed"
        data-testid="armed-toggle"
        aria-pressed={armed}
        // No active flow = nothing to arm; disabled rather than silently inert.
        disabled={!active}
        title={armed ? 'Disarm this flow' : 'Arm this flow — its trigger starts firing'}
        // Arming is the destructive direction (an armed flow fires while you edit —
        // blueprint IDE-E16 risk row), so only that side asks; disarming is safe.
        onClick={() => {
          if (!active) return
          if (armed) setFlowArmed(ctx, active.id, false)
          else setConfirmArm(true)
        }}
      >
        <span className="fw-armed-dot" aria-hidden="true" />
        {armed ? 'Armed' : 'Disarmed'}
      </button>
      <Dialog open={confirmArm} onClose={() => setConfirmArm(false)} label="Arm flow">
        <h2 className="fw-confirm-title">Arm “{active?.label}”?</h2>
        <p className="fw-confirm-body">
          Its trigger starts firing immediately — including while you keep editing the graph.
        </p>
        <div className="fw-confirm-actions">
          <button type="button" className="fw-btn" onClick={() => setConfirmArm(false)}>
            Cancel
          </button>
          <button
            type="button"
            className="fw-btn fw-btn-primary"
            data-testid="confirm-arm"
            autoFocus
            onClick={() => {
              if (active) setFlowArmed(ctx, active.id, true)
              setConfirmArm(false)
            }}
          >
            Arm
          </button>
        </div>
      </Dialog>
    </div>
  )
}

interface FlowTabProps {
  model: FlowModel
  id: string
  selected: boolean
  editing: boolean
  onActivate: () => void
  onStartRename: () => void
  onCommit: (label: string) => void
  onCancel: () => void
}

/** One tab. Subscribed to its own flow id, so renaming or arming one flow repaints
 *  exactly one tab, never the strip. */
function FlowTab({ model, id, selected, editing, onActivate, onStartRename, onCommit, onCancel }: FlowTabProps) {
  const flow = useFlow(model, id)
  const [draft, setDraft] = useState('')
  // Esc unmounts the input, and React does not fire blur on unmount — but the commit
  // path is guarded anyway so a cancel can never be turned into a write.
  const cancelled = useRef(false)

  if (!flow) return null

  if (editing) {
    return (
      <input
        className="fw-tab-rename"
        data-testid={`rename-${id}`}
        aria-label={`Rename ${flow.label}`}
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => !cancelled.current && onCommit(draft)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            onCommit(draft)
          } else if (e.key === 'Escape') {
            e.preventDefault()
            e.stopPropagation()
            cancelled.current = true
            onCancel()
          }
        }}
      />
    )
  }

  return (
    <button
      type="button"
      role="tab"
      className="fw-tab"
      data-testid={`tab-${id}`}
      aria-selected={selected}
      tabIndex={selected ? 0 : -1}
      data-armed={flow.armed || undefined}
      title={`${flow.label} — double-click to rename`}
      onClick={onActivate}
      onDoubleClick={() => {
        cancelled.current = false
        setDraft(flow.label)
        onStartRename()
      }}
    >
      {flow.armed && <span className="fw-tab-armed" role="img" aria-label="Armed" />}
      {flow.label}
    </button>
  )
}
