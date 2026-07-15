import { describe, expect, it } from 'vitest'
import { act } from 'react'
import { renderWithProviders } from '@/shared/test'
import { ConfigurationService } from '@/services/configuration'
import { ConfigPersistence, MemoryStorageAdapter } from '@/services/persistence'
import { ThemeService } from '@/services/theme'
import { PreferencesDialog } from '@/workspaces'

function setup(storage = new MemoryStorageAdapter()) {
  // config whose user-layer writes persist (write-behind) so we can "relaunch"
  const config = new ConfigurationService({
    layers: {
      defaults: { telemetry: { enabled: false }, density: 'comfortable', theme: { id: 'cyber-dark' } },
      // the persisted user document carries a version stamp (CD-118 migration gate)
      user: { version: 1 },
    },
  })
  const persistence = new ConfigPersistence({ adapter: storage, scheduler: (fn) => { fn(); return () => {} } })
  config.onChange(() => persistence.schedule('cdk-user', config.getLayer('user')))
  const theme = new ThemeService({ root: { style: { setProperty: () => {} } } })
  return { config, theme, storage }
}

function renderPrefs(config: ConfigurationService, theme: ThemeService, tab: 'general' | 'appearance' = 'general') {
  return renderWithProviders(
    <PreferencesDialog config={config} theme={theme} open tab={tab} onClose={() => {}} onTabChange={() => {}} />,
  )
}

describe('PreferencesDialog — writes through ConfigurationService (no local state)', () => {
  it('toggling telemetry writes to config and the control reflects the live value', () => {
    const { config, theme } = setup()
    const { container } = renderPrefs(config, theme)
    const toggle = container.querySelector('[data-setting="telemetry.enabled"]')!
    expect(toggle).toHaveAttribute('aria-checked', 'false')

    act(() => (toggle as HTMLButtonElement).click())
    // config is the source of truth
    expect(config.get('telemetry.enabled')).toBe(true)
    // control mirrors it (no local state)
    expect(container.querySelector('[data-setting="telemetry.enabled"]')).toHaveAttribute('aria-checked', 'true')
  })

  it('density select writes through config', () => {
    const { config, theme } = setup()
    const { container } = renderPrefs(config, theme)
    const select = container.querySelector('[data-setting="density"]') as HTMLSelectElement
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!
      setter.call(select, 'compact')
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(config.get('density')).toBe('compact')
  })
})

describe('PreferencesDialog — round-trip persist (change → relaunch → holds)', () => {
  it('a changed setting survives a simulated relaunch', () => {
    const storage = new MemoryStorageAdapter()
    const { config, theme } = setup(storage)
    const { container } = renderPrefs(config, theme)

    act(() => (container.querySelector('[data-setting="telemetry.enabled"]') as HTMLButtonElement).click())
    expect(config.get('telemetry.enabled')).toBe(true)

    // "relaunch": load the persisted user layer into a fresh config
    const persistence = new ConfigPersistence({ adapter: storage })
    const userLayer = persistence.load({ key: 'cdk-user', currentVersion: 1 })
    expect(userLayer).not.toBeNull() // persisted + reloaded through the migration gate
    const relaunched = new ConfigurationService({
      layers: { defaults: { telemetry: { enabled: false } }, user: userLayer ?? {} },
    })
    expect(relaunched.get('telemetry.enabled')).toBe(true) // value holds
  })
})

describe('PreferencesDialog — appearance theme picker', () => {
  it('selecting a theme writes config and drives ThemeService', () => {
    const { config } = setup()
    const applied: string[] = []
    const theme = new ThemeService({
      root: { style: { setProperty: () => {} } },
      onThemeChanged: (i) => applied.push(i.id),
    })
    const { container } = renderPrefs(config, theme, 'appearance')
    const light = container.querySelector('[data-theme-option="cyber-light"]')!
    act(() => (light as HTMLButtonElement).click())
    expect(config.get('theme.id')).toBe('cyber-light')
    expect(applied).toContain('cyber-light') // ThemeService.apply ran
  })
})
