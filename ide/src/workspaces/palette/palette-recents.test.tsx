import { describe, expect, it } from 'vitest'
import { act } from 'react'
import { renderWithProviders } from '@/shared/test'
import { MemoryStorageAdapter } from '@/services/persistence'
import { CommandRegistry, seedCommands, type WhenContext } from '@/platform/commands'
import { CommandPalette, PaletteRecents } from '@/workspaces'

const PERMISSIVE: WhenContext = {
  workspace: 'deck-designer',
  selectionKind: 'widget',
  flags: { devTools: true },
}

describe('PaletteRecents — persisted MRU', () => {
  it('records most-recent-first, dedupes, caps, and persists', () => {
    const storage = new MemoryStorageAdapter()
    const r = new PaletteRecents({ storage, cap: 3 })
    r.record('a')
    r.record('b')
    r.record('a') // move a to front
    r.record('c')
    r.record('d') // caps at 3 → drops b
    expect(r.list()).toEqual(['d', 'c', 'a'])

    // persisted across instances
    const r2 = new PaletteRecents({ storage, cap: 3 })
    expect(r2.list()).toEqual(['d', 'c', 'a'])
  })
})

describe('CommandPalette — groups + recents (CD-207)', () => {
  function registry() {
    const reg = new CommandRegistry()
    reg.registerAll(seedCommands())
    return reg
  }

  it('empty-query view shows category groups in design order', () => {
    const { container } = renderWithProviders(
      <CommandPalette registry={registry()} context={PERMISSIVE} open onClose={() => {}} onExecute={() => {}} />,
    )
    const headers = Array.from(container.querySelectorAll('[data-group]')).map((el) =>
      el.getAttribute('data-group'),
    )
    // design ordering (no recents yet): General, Edit, Design, Project, View, Platform
    expect(headers).toEqual(['General', 'Edit', 'Design', 'Project', 'View', 'Platform'])
  })

  it('recently used commands float to a top group', () => {
    const { container } = renderWithProviders(
      <CommandPalette
        registry={registry()}
        context={PERMISSIVE}
        open
        onClose={() => {}}
        onExecute={() => {}}
        recents={['togL', 'undo']}
      />,
    )
    const headers = Array.from(container.querySelectorAll('[data-group]')).map((el) =>
      el.getAttribute('data-group'),
    )
    expect(headers[0]).toBe('Recently used')
    // the recent commands appear under the first group, lifted out of their categories
    const recentGroup = container.querySelector('[data-group="Recently used"]')!.closest('[role="group"]')!
    expect(recentGroup.querySelector('[data-command="togL"]')).toBeInTheDocument()
    expect(recentGroup.querySelector('[data-command="undo"]')).toBeInTheDocument()
    // and each command appears exactly once in the whole list (unique ids)
    expect(container.querySelectorAll('[data-command="togL"]')).toHaveLength(1)
  })

  it('a non-empty query drops groups and shows a flat ranked list', () => {
    const { container } = renderWithProviders(
      <CommandPalette
        registry={registry()}
        context={PERMISSIVE}
        open
        onClose={() => {}}
        onExecute={() => {}}
        recents={['togL']}
      />,
    )
    const input = container.querySelector('[role="combobox"]') as HTMLInputElement
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
      setter.call(input, 'undo')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(container.querySelectorAll('[data-group]')).toHaveLength(0) // no groups while searching
    expect(container.querySelector('[data-command="undo"]')).toBeInTheDocument()
  })

  it('onUse fires with the executed command id (records recency)', () => {
    const used: string[] = []
    const { container } = renderWithProviders(
      <CommandPalette
        registry={registry()}
        context={PERMISSIVE}
        open
        onClose={() => {}}
        onExecute={() => {}}
        onUse={(id) => used.push(id)}
      />,
    )
    act(() => (container.querySelector('[data-command="undo"]') as HTMLElement).click())
    expect(used).toEqual(['undo'])
  })
})
