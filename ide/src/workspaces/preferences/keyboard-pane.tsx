// Keyboard pane (CD-209): rendered from the command registry (single source).
// Each command shows its effective binding; rebind captures the next key combo,
// warns on conflict, and reset-to-default removes the user override. Rebinds take
// effect immediately (the dispatcher resolves the new combo) and persist via the
// injected onChange callback (into the keymap config layer).
import { useState } from 'react'
import type { CommandRegistry } from '@/platform/commands'
import { comboFromEvent, comboLabel, type KeymapDispatcher } from '@/platform/keymap'
import './preferences.css'

export interface KeyboardPaneProps {
  registry: CommandRegistry
  dispatcher: KeymapDispatcher
  /** Called after any rebind/reset so the caller can persist user bindings. */
  onChange?: () => void
}

export function KeyboardPane({ registry, dispatcher, onChange }: KeyboardPaneProps) {
  const [capturing, setCapturing] = useState<string | null>(null)
  // bump to force a re-render after a mutation (dispatcher is the source of truth)
  const [, force] = useState(0)
  const refresh = () => {
    force((n) => n + 1)
    onChange?.()
  }

  const conflicts = new Set(dispatcher.conflicts().flatMap((c) => c.commandIds))

  return (
    <div className="prefs-pane">
      <table className="kb-table">
        <tbody>
          {registry.list().map((cmd) => {
            const binding = dispatcher.bindingFor(cmd.id)
            const label = binding ? comboLabel(binding.combo) : '—'
            const isCapturing = capturing === cmd.id
            const conflicted = conflicts.has(cmd.id)
            return (
              <tr key={cmd.id} data-kb-command={cmd.id} className={conflicted ? 'kb-conflict' : ''}>
                <td className="kb-label">{cmd.label}</td>
                <td className="kb-combo" data-kb-combo={cmd.id}>
                  {isCapturing ? 'Press keys…' : label}
                </td>
                <td className="kb-actions">
                  <button
                    data-kb-rebind={cmd.id}
                    aria-label={`Rebind ${cmd.label}`}
                    onClick={() => setCapturing(cmd.id)}
                    onKeyDown={(e) => {
                      if (!isCapturing) return
                      // ignore lone modifier presses
                      if (['Control', 'Meta', 'Shift', 'Alt'].includes(e.key)) return
                      e.preventDefault()
                      const combo = comboFromEvent(e.nativeEvent, 'other')
                      dispatcher.rebind(cmd.id, comboToTokens(combo))
                      setCapturing(null)
                      refresh()
                    }}
                  >
                    {isCapturing ? 'Listening' : 'Rebind'}
                  </button>
                  <button
                    data-kb-reset={cmd.id}
                    aria-label={`Reset ${cmd.label}`}
                    onClick={() => {
                      dispatcher.resetBinding(cmd.id)
                      refresh()
                    }}
                  >
                    Reset
                  </button>
                  {conflicted && (
                    <span role="alert" className="kb-conflict-warn" data-kb-warn={cmd.id}>
                      Conflict
                    </span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// Turn a captured combo back into rebind tokens the dispatcher parses.
function comboToTokens(combo: { mod: boolean; shift: boolean; alt: boolean; key: string }): string[] {
  const tokens: string[] = []
  if (combo.mod) tokens.push('⌘')
  if (combo.shift) tokens.push('⇧')
  if (combo.alt) tokens.push('⌥')
  tokens.push(combo.key)
  return tokens
}
