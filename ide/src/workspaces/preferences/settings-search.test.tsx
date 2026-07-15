import { describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { renderWithProviders } from '@/shared/test'
import { ConfigurationService } from '@/services/configuration'
import { ThemeService } from '@/services/theme'
import { PreferencesDialog, searchSettings } from '@/workspaces'

describe('searchSettings — matches label + keywords', () => {
  it('matches by keyword (privacy → telemetry) and by label', () => {
    expect(searchSettings('privacy').map((s) => s.id)).toContain('telemetry.enabled')
    expect(searchSettings('theme').map((s) => s.id)).toContain('theme.id')
    expect(searchSettings('rebind').map((s) => s.id)).toContain('keyboard')
    expect(searchSettings('')).toEqual([]) // empty query → no results
    expect(searchSettings('zzzz')).toEqual([]) // no match
  })
})

function renderPrefs(onTabChange = vi.fn()) {
  const config = new ConfigurationService({
    layers: { defaults: { telemetry: { enabled: false }, density: 'comfortable', theme: { id: 'cyber-dark' } } },
  })
  const theme = new ThemeService({ root: { style: { setProperty: () => {} } } })
  return {
    onTabChange,
    ...renderWithProviders(
      <PreferencesDialog
        config={config}
        theme={theme}
        open
        tab="general"
        onClose={() => {}}
        onTabChange={onTabChange}
      />,
    ),
  }
}

describe('Settings search — in the prefs dialog', () => {
  it('typing shows matching results; Enter jumps to the owning pane', () => {
    const onTabChange = vi.fn()
    const { getByRole, container } = renderPrefs(onTabChange)
    const search = getByRole('searchbox')
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
      setter.call(search, 'theme')
      search.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(container.querySelector('[data-setting-result="theme.id"]')).toBeInTheDocument()

    act(() => search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
    expect(onTabChange).toHaveBeenCalledWith('appearance') // jumped to the theme's pane
  })

  it('results are keyboard-navigable (ArrowDown moves selection)', () => {
    const { getByRole, container } = renderPrefs()
    const search = getByRole('searchbox')
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
      setter.call(search, 'e') // broad query → multiple results
      search.dispatchEvent(new Event('input', { bubbles: true }))
    })
    const options = container.querySelectorAll('[data-setting-result]')
    expect(options.length).toBeGreaterThan(1)
    expect(options[0]).toHaveAttribute('aria-selected', 'true')
    act(() => search.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })))
    const after = container.querySelectorAll('[data-setting-result]')
    expect(after[1]).toHaveAttribute('aria-selected', 'true')
  })

  it('clicking a result jumps to its pane', () => {
    const onTabChange = vi.fn()
    const { getByRole, container } = renderPrefs(onTabChange)
    const search = getByRole('searchbox')
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
      setter.call(search, 'shortcut')
      search.dispatchEvent(new Event('input', { bubbles: true }))
    })
    act(() => (container.querySelector('[data-setting-result="keyboard"]') as HTMLElement).click())
    expect(onTabChange).toHaveBeenCalledWith('keyboard')
  })
})
