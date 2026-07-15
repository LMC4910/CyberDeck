// Command palette (CD-206): ⌘K overlay, focus-trapped, rendering context-filtered
// registry commands with a fuzzy scorer and keymap shortcut hints. Enter executes,
// Esc closes (focus restored by the Dialog primitive), Arrow keys navigate.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CommandDescriptor, CommandRegistry, WhenContext } from '@/platform/commands'
import { Dialog } from '@/shared/a11y'
import { fuzzyFilter } from './fuzzy'
import './palette.css'

export interface CommandPaletteProps {
  registry: CommandRegistry
  context: WhenContext
  open: boolean
  onClose: () => void
  /** Execute a command by id (wiring calls registry.execute). */
  onExecute: (id: string) => void
  /** commandId → shortcut hint (e.g. "⌘K"), from the keymap. */
  shortcutFor?: (id: string) => string | undefined
}

export function CommandPalette({
  registry,
  context,
  open,
  onClose,
  onExecute,
  shortcutFor,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // context-filtered commands (only those runnable in this context)
  const available = useMemo(
    () => registry.list().filter((c) => registry.canExecute(c.id, context)),
    [registry, context],
  )
  const results = useMemo(
    () => fuzzyFilter(query, available, (c) => `${c.category} ${c.label}`).map((s) => s.item),
    [query, available],
  )

  // reset + focus on open
  useEffect(() => {
    if (open) {
      setQuery('')
      setIndex(0)
      // Dialog moves focus into the trap; focus the input specifically
      queueMicrotask(() => inputRef.current?.focus())
    }
  }, [open])

  useEffect(() => {
    setIndex(0)
  }, [query])

  if (!open) return null

  const run = (cmd: CommandDescriptor | undefined) => {
    if (!cmd) return
    onExecute(cmd.id)
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} label="Command Palette">
      <div className="palette">
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-list"
          aria-activedescendant={results[index] ? `palette-item-${results[index]!.id}` : undefined}
          aria-label="Command Palette"
          placeholder="Type a command…"
          className="palette-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setIndex((i) => Math.min(i + 1, results.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setIndex((i) => Math.max(i - 1, 0))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              run(results[index])
            }
          }}
        />
        <ul id="palette-list" role="listbox" className="palette-list" aria-label="Commands">
          {results.length === 0 && <li className="palette-empty">No matching commands</li>}
          {results.map((cmd, i) => (
            <li
              key={cmd.id}
              id={`palette-item-${cmd.id}`}
              role="option"
              aria-selected={i === index}
              data-command={cmd.id}
              className={i === index ? 'palette-item on' : 'palette-item'}
              onMouseEnter={() => setIndex(i)}
              onClick={() => run(cmd)}
            >
              <span className="palette-cat">{cmd.category}</span>
              <span className="palette-label">{cmd.label}</span>
              {shortcutFor?.(cmd.id) && <kbd className="palette-kbd">{shortcutFor(cmd.id)}</kbd>}
            </li>
          ))}
        </ul>
      </div>
    </Dialog>
  )
}
