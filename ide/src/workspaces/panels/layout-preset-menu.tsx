// Layout preset menu (CD-217): status-bar control to apply built-in/user presets,
// shows the current preset (or "Custom"), and save/delete user presets. Applies to
// the active workspace only (per-workspace independence).
import { useState } from 'react'
import type { Store } from '@/stores'
import { useStore } from '@/stores'
import {
  BUILTIN_PRESETS,
  applyPreset,
  currentPresetName,
  capturePreset,
  CUSTOM,
  type LayoutPreset,
} from './layout-presets'
import type { PanelsState } from './panels-model'
import './panels.css'

export interface LayoutPresetMenuProps {
  store: Store<PanelsState>
  workspaceId: string
  userPresets: LayoutPreset[]
  onSaveUserPreset: (preset: LayoutPreset) => void
  onDeleteUserPreset: (name: string) => void
}

export function LayoutPresetMenu({
  store,
  workspaceId,
  userPresets,
  onSaveUserPreset,
  onDeleteUserPreset,
}: LayoutPresetMenuProps) {
  const state = useStore(store, (s) => s)
  const all = [...BUILTIN_PRESETS, ...userPresets]
  const current = currentPresetName(state, workspaceId, all)
  const [open, setOpen] = useState(false)

  return (
    <div className="preset-menu">
      <button
        data-preset-current
        aria-haspopup="menu"
        aria-expanded={open}
        className="preset-current"
        onClick={() => setOpen((v) => !v)}
      >
        Layout: {current}
      </button>
      {open && (
        <div role="menu" aria-label="Layout presets" className="preset-list">
          {all.map((p) => (
            <div key={p.name} className="preset-row">
              <button
                role="menuitem"
                data-preset={p.name}
                className={p.name === current ? 'preset-item on' : 'preset-item'}
                onClick={() => {
                  applyPreset(store, workspaceId, p)
                  setOpen(false)
                }}
              >
                {p.name}
              </button>
              {userPresets.some((u) => u.name === p.name) && (
                <button
                  data-preset-delete={p.name}
                  aria-label={`Delete preset ${p.name}`}
                  onClick={() => onDeleteUserPreset(p.name)}
                >
                  ×
                </button>
              )}
            </div>
          ))}
          {current === CUSTOM && (
            <button
              data-preset-save
              className="preset-save"
              onClick={() => {
                onSaveUserPreset(capturePreset(state, workspaceId, `Custom ${userPresets.length + 1}`))
                setOpen(false)
              }}
            >
              Save current as preset
            </button>
          )}
        </div>
      )}
    </div>
  )
}
