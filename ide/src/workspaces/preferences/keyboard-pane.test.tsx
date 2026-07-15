import { describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { renderWithProviders } from '@/shared/test'
import { CommandRegistry, seedCommands } from '@/platform/commands'
import { KeymapDispatcher, parseCombo } from '@/platform/keymap'
import { KeyboardPane } from '@/workspaces'

function setup() {
  const registry = new CommandRegistry()
  registry.registerAll(seedCommands())
  const dispatcher = new KeymapDispatcher(registry, { platform: 'other' })
  dispatcher.loadDefaults()
  return { registry, dispatcher }
}

// Fire a rebind by entering capture then dispatching a keydown on the rebind button.
function rebind(button: HTMLElement, key: string, mods: { ctrl?: boolean; shift?: boolean } = {}) {
  act(() => button.click()) // enter capture mode
  act(() => {
    button.dispatchEvent(
      new KeyboardEvent('keydown', { key, ctrlKey: !!mods.ctrl, shiftKey: !!mods.shift, bubbles: true }),
    )
  })
}

describe('KeyboardPane — rendered from the registry', () => {
  it('lists every command with its current binding', () => {
    const { registry, dispatcher } = setup()
    const { container } = renderWithProviders(<KeyboardPane registry={registry} dispatcher={dispatcher} />)
    expect(container.querySelectorAll('[data-kb-command]')).toHaveLength(registry.list().length)
    // palette shows its default ⌘K → "Ctrl+K" on non-mac
    expect(container.querySelector('[data-kb-combo="palette"]')).toHaveTextContent('Ctrl+K')
  })
})

describe('KeyboardPane — rebind takes effect + persists', () => {
  it('rebinding changes the effective binding immediately and calls onChange', () => {
    const { registry, dispatcher } = setup()
    const onChange = vi.fn()
    const { container } = renderWithProviders(
      <KeyboardPane registry={registry} dispatcher={dispatcher} onChange={onChange} />,
    )
    // rebind 'palette' from Ctrl+K to Ctrl+P
    rebind(container.querySelector('[data-kb-rebind="palette"]')!, 'p', { ctrl: true })

    // effective binding updated (takes effect without reload)
    expect(dispatcher.resolve(parseCombo(['⌘', 'P']), {})).toBe('palette')
    // persisted via the onChange hook
    expect(onChange).toHaveBeenCalled()
    expect(dispatcher.userBindings().some((b) => b.commandId === 'palette')).toBe(true)
    // UI reflects the new combo
    expect(container.querySelector('[data-kb-combo="palette"]')).toHaveTextContent('Ctrl+P')
  })
})

describe('KeyboardPane — conflict surfaced', () => {
  it('rebinding onto an existing combo flags a conflict', () => {
    const { registry, dispatcher } = setup()
    const { container } = renderWithProviders(<KeyboardPane registry={registry} dispatcher={dispatcher} />)
    // rebind 'prefs' onto Ctrl+K (already used by 'palette') → conflict
    rebind(container.querySelector('[data-kb-rebind="prefs"]')!, 'k', { ctrl: true })
    // both commands surface the conflict warning
    expect(container.querySelector('[data-kb-warn="prefs"]')).toBeInTheDocument()
    expect(container.querySelector('[data-kb-warn="palette"]')).toBeInTheDocument()
  })
})

describe('KeyboardPane — reset to default', () => {
  it('reset removes the user binding, restoring the default', () => {
    const { registry, dispatcher } = setup()
    const { container } = renderWithProviders(<KeyboardPane registry={registry} dispatcher={dispatcher} />)
    rebind(container.querySelector('[data-kb-rebind="palette"]')!, 'p', { ctrl: true })
    expect(dispatcher.resolve(parseCombo(['⌘', 'P']), {})).toBe('palette')

    act(() => (container.querySelector('[data-kb-reset="palette"]') as HTMLElement).click())
    // default restored
    expect(dispatcher.resolve(parseCombo(['⌘', 'K']), {})).toBe('palette')
    expect(dispatcher.userBindings().some((b) => b.commandId === 'palette')).toBe(false)
    expect(container.querySelector('[data-kb-combo="palette"]')).toHaveTextContent('Ctrl+K')
  })
})
