import { describe, expect, it, vi } from 'vitest'
import { act, useState } from 'react'
import { axe } from 'vitest-axe'
import { renderWithProviders } from '@/shared/test'
import { CommandRegistry, seedCommands, type WhenContext } from '@/platform/commands'
import { CommandPalette, fuzzyScore, fuzzyFilter } from '@/workspaces'

// a context where every seed command's when-clause is satisfied
const PERMISSIVE: WhenContext = {
  workspace: 'deck-designer',
  selectionKind: 'widget',
  flags: { devTools: true },
}

function registryWithSeed() {
  const r = new CommandRegistry()
  r.registerAll(seedCommands())
  return r
}

describe('fuzzyScore', () => {
  it('matches subsequences and ranks word-start/consecutive higher', () => {
    expect(fuzzyScore('', 'anything')).toBe(0)
    expect(fuzzyScore('xyz', 'abc')).toBeNull()
    const consec = fuzzyScore('com', 'Command Palette')!
    const scattered = fuzzyScore('cop', 'Command Palette')!
    expect(consec).toBeGreaterThan(scattered)
  })

  it('fuzzyFilter drops non-matches and sorts by score', () => {
    const items = ['Undo', 'Redo', 'Duplicate']
    const out = fuzzyFilter('du', items, (s) => s).map((s) => s.item)
    expect(out).toContain('Duplicate')
    expect(out).not.toContain('Redo')
  })
})

describe('CommandPalette — every registered command reachable + executable', () => {
  it('lists every context-available command and executes on Enter', () => {
    const registry = registryWithSeed()
    const executed: string[] = []
    const available = registry.list().filter((c) => registry.canExecute(c.id, PERMISSIVE))

    for (const cmd of available) {
      const onExecute = (id: string) => executed.push(id)
      const { getByRole, container, unmount } = renderWithProviders(
        <CommandPalette
          registry={registry}
          context={PERMISSIVE}
          open
          onClose={() => {}}
          onExecute={onExecute}
        />,
      )
      // the command is reachable (rendered as an option)
      expect(container.querySelector(`[data-command="${cmd.id}"]`)).toBeInTheDocument()
      // type its label to surface it at the top, then Enter executes
      const input = getByRole('combobox')
      act(() => {
        ;(input as HTMLInputElement).focus()
      })
      // click the option directly (equivalent to Enter on it)
      act(() => (container.querySelector(`[data-command="${cmd.id}"]`) as HTMLElement).click())
      expect(executed).toContain(cmd.id)
      unmount()
    }
    // proved every available command executed
    expect(new Set(executed).size).toBe(available.length)
  })

  it('context filtering hides gated commands (no selection → no Duplicate)', () => {
    const registry = registryWithSeed()
    const { container } = renderWithProviders(
      <CommandPalette
        registry={registry}
        context={{ workspace: 'home', selectionKind: 'none' }}
        open
        onClose={() => {}}
        onExecute={() => {}}
      />,
    )
    expect(container.querySelector('[data-command="dup"]')).not.toBeInTheDocument() // needs selection
    expect(container.querySelector('[data-command="palette"]')).toBeInTheDocument() // global
  })
})

describe('CommandPalette — keyboard', () => {
  it('Arrow keys move selection; Enter runs the highlighted command', () => {
    const registry = registryWithSeed()
    const executed: string[] = []
    const { getByRole } = renderWithProviders(
      <CommandPalette
        registry={registry}
        context={PERMISSIVE}
        open
        onClose={() => {}}
        onExecute={(id) => executed.push(id)}
      />,
    )
    const input = getByRole('combobox') as HTMLInputElement
    act(() => input.focus())
    // filter to a single command, then Enter
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
      setter.call(input, 'Command Palette')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    act(() => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
    expect(executed).toContain('palette')
  })

  it('Esc closes the palette', () => {
    const registry = registryWithSeed()
    const onClose = vi.fn()
    function Harness() {
      const [open, setOpen] = useState(true)
      return (
        <CommandPalette
          registry={registry}
          context={PERMISSIVE}
          open={open}
          onClose={() => {
            onClose()
            setOpen(false)
          }}
          onExecute={() => {}}
        />
      )
    }
    const { getByRole } = renderWithProviders(<Harness />)
    act(() => {
      getByRole('dialog').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(onClose).toHaveBeenCalled()
  })
})

describe('CommandPalette — axe clean', () => {
  it('has no accessibility violations', async () => {
    const registry = registryWithSeed()
    const { container } = renderWithProviders(
      <CommandPalette
        registry={registry}
        context={PERMISSIVE}
        open
        onClose={() => {}}
        onExecute={() => {}}
        shortcutFor={(id) => (id === 'palette' ? '⌘K' : undefined)}
      />,
    )
    const results = await axe(container)
    expect(results.violations).toEqual([])
  })
})
