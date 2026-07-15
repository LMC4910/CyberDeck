// Command palette (CD-206): ⌘K overlay, focus-trapped, rendering context-filtered
// registry commands with a fuzzy scorer and keymap shortcut hints. Enter executes,
// Esc closes (focus restored by the Dialog primitive), Arrow keys navigate.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CommandDescriptor, CommandRegistry, WhenContext } from '@/platform/commands'
import { Dialog } from '@/shared/a11y'
import { fuzzyFilter } from '@/shared/fuzzy'
import './palette.css'

// Design category ordering for the empty-query grouped view.
const CATEGORY_ORDER = ['General', 'Edit', 'Design', 'Project', 'View', 'Platform']

export interface CommandPaletteProps {
  registry: CommandRegistry
  context: WhenContext
  open: boolean
  onClose: () => void
  /** Execute a command by id (wiring calls registry.execute). */
  onExecute: (id: string) => void
  /** commandId → shortcut hint (e.g. "⌘K"), from the keymap. */
  shortcutFor?: (id: string) => string | undefined
  /** Most-recent-first command ids (CD-207); shown first when the query is empty. */
  recents?: string[]
  /** Called when a command is run, so the caller can record recency. */
  onUse?: (id: string) => void
}

interface Group {
  label: string
  commands: CommandDescriptor[]
}

export function CommandPalette({
  registry,
  context,
  open,
  onClose,
  onExecute,
  shortcutFor,
  recents = [],
  onUse,
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

  // Empty-query view: a "Recently used" group (MRU) then category groups in design
  // order. A non-empty query shows a flat fuzzy-ranked list (no groups).
  const grouped = query.trim() === ''
  const groups = useMemo<Group[]>(() => {
    if (!grouped) return []
    const byId = new Map(available.map((c) => [c.id, c]))
    const out: Group[] = []
    const recentCmds = recents.map((id) => byId.get(id)).filter((c): c is CommandDescriptor => !!c)
    const recentIds = new Set(recentCmds.map((c) => c.id))
    if (recentCmds.length) out.push({ label: 'Recently used', commands: recentCmds })
    // category groups exclude commands already lifted into "Recently used" so each
    // command appears exactly once (unique DOM ids + keys).
    const rest = available.filter((c) => !recentIds.has(c.id))
    for (const cat of CATEGORY_ORDER) {
      const cmds = rest.filter((c) => c.category === cat)
      if (cmds.length) out.push({ label: cat, commands: cmds })
    }
    const known = new Set(CATEGORY_ORDER)
    for (const c of rest) {
      if (!known.has(c.category) && !out.some((g) => g.label === c.category)) {
        out.push({ label: c.category, commands: rest.filter((x) => x.category === c.category) })
      }
    }
    return out
  }, [grouped, available, recents])

  // Flat ordered list backing keyboard navigation (recents+groups when empty).
  const flat = grouped ? groups.flatMap((g) => g.commands) : results

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
    onUse?.(cmd.id)
    onExecute(cmd.id)
    onClose()
  }

  const renderOption = (cmd: CommandDescriptor) => {
    const i = flat.indexOf(cmd)
    return (
      <div
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
      </div>
    )
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
          aria-activedescendant={flat[index] ? `palette-item-${flat[index]!.id}` : undefined}
          aria-label="Command Palette"
          placeholder="Type a command…"
          className="palette-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setIndex((i) => Math.min(i + 1, flat.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setIndex((i) => Math.max(i - 1, 0))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              run(flat[index])
            }
          }}
        />
        <div id="palette-list" role="listbox" className="palette-list" aria-label="Commands">
          {flat.length === 0 && <div className="palette-empty">No matching commands</div>}
          {grouped
            ? groups.map((g) => (
                <div
                  key={g.label}
                  role="group"
                  aria-labelledby={`palette-grp-${g.label}`}
                  className="palette-group"
                >
                  <div
                    id={`palette-grp-${g.label}`}
                    className="palette-group-header"
                    data-group={g.label}
                  >
                    {g.label}
                  </div>
                  {g.commands.map(renderOption)}
                </div>
              ))
            : results.map(renderOption)}
        </div>
      </div>
    </Dialog>
  )
}
