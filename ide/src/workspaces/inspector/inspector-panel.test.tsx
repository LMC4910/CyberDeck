import { describe, expect, it } from 'vitest'
import { act } from 'react'
import { renderWithProviders } from '@/shared/test'
import { ServiceContainer, token } from '@/platform/container'
import { ConfigurationService, type SettingsDelta } from '@/services/configuration'
import { createAllStores } from '@/stores'
import { InspectorPanel } from '@/workspaces/inspector'

function setup() {
  const container = new ServiceContainer()
  container.register(token('logger'), () => ({ log: () => {} }))
  container.register(token('telemetry'), () => ({}), { lazy: false })
  container.get(token('telemetry')) // instantiate one → 'ready'

  const config = new ConfigurationService({
    layers: { defaults: { features: { devTools: true, marketplace: false } } },
  })
  const stores = Object.values(createAllStores())
  return { container, config, stores }
}

describe('InspectorPanel — live kernel state (no fixtures)', () => {
  it('services tab renders live container registrations', () => {
    const { container, config, stores } = setup()
    const { getByRole, container: dom } = renderWithProviders(
      <InspectorPanel container={container} stores={stores} config={config} />,
    )
    // default tab is services
    expect(getByRole('tab', { name: 'services' })).toHaveAttribute('aria-selected', 'true')
    expect(dom.querySelector('[data-service="logger"]')).toBeInTheDocument()
    // telemetry was instantiated → ready
    expect(dom.querySelector('[data-service="telemetry"]')).toHaveTextContent('ready')
  })

  it('stores tab renders the live 13 store descriptors', () => {
    const { container, config, stores } = setup()
    const { getByRole, container: dom } = renderWithProviders(
      <InspectorPanel container={container} stores={stores} config={config} />,
    )
    act(() => getByRole('tab', { name: 'stores' }).click())
    expect(dom.querySelectorAll('[data-store]')).toHaveLength(13)
    expect(dom.querySelector('[data-store="auth"]')).toHaveTextContent('cdk-auth')
  })

  it('flags tab toggle round-trips config + emits SettingsChanged', () => {
    const { container, config, stores } = setup()
    const deltas: SettingsDelta[] = []
    config.watch('features.marketplace', (d) => deltas.push(d))

    const { getByRole, container: dom } = renderWithProviders(
      <InspectorPanel container={container} stores={stores} config={config} />,
    )
    act(() => getByRole('tab', { name: 'flags' }).click())

    const toggle = dom.querySelector('[data-flag-toggle="marketplace"]')!
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    act(() => (toggle as HTMLButtonElement).click())

    // config updated
    expect(config.get('features.marketplace')).toBe(true)
    // SettingsChanged emitted with the precise delta
    expect(deltas).toHaveLength(1)
    expect(deltas[0]).toMatchObject({ path: 'features.marketplace', value: true, layer: 'runtime' })
    // UI reflects the new state
    expect(dom.querySelector('[data-flag-toggle="marketplace"]')).toHaveAttribute('aria-checked', 'true')
  })
})
