import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import type { WidgetManifest } from '@/services/widgets'
import { CANON_MANIFESTS, CANON_IDS } from './manifests'
import { canonResolver, hasCanonModule } from './resolver'
import { registerCanonWidgets } from './register'

const manifestFor = (id: string) => CANON_MANIFESTS.find((m) => m.id === id)!

describe('canon registration (CD-423)', () => {
  it('registers all 11 canon widgets into the platform registry', () => {
    const registered: WidgetManifest[] = []
    registerCanonWidgets({ register: (m) => registered.push(m) })
    expect(registered).toHaveLength(11)
    expect(registered.map((m) => m.id).sort()).toEqual([...CANON_IDS].sort())
  })
})

describe('canon resolver — lazy modules (CD-423)', () => {
  it('every canon id has a lazy module loader', () => {
    for (const id of CANON_IDS) expect(hasCanonModule(id)).toBe(true)
  })

  it('resolves each manifest to a default-exported component (dynamic import)', async () => {
    for (const manifest of CANON_MANIFESTS) {
      const mod = await canonResolver(manifest)
      expect(typeof mod.default, manifest.id).toBe('function')
    }
  })

  it('rejects an unknown manifest id', async () => {
    await expect(canonResolver({ id: 'not.canon', version: '1.0.0', metadata: { label: 'x' } } as WidgetManifest))
      .rejects.toThrow(/no canon widget module/)
  })
})

describe('canon widgets render once lazily loaded (CD-423 AC: platform-loaded)', () => {
  it('renders the gauge widget with its config after resolving its module', async () => {
    const { default: Gauge } = await canonResolver(manifestFor('gauge.circular'))
    const { container } = render(<Gauge config={{ value: 42 }} />)
    expect(container.querySelector('[data-widget-kind="gauge"]')).toBeTruthy()
    expect(container.querySelector('.cw-gauge__value')?.textContent).toBe('42')
  })

  it('renders the button widget label from its resolved module', async () => {
    const { default: Button } = await canonResolver(manifestFor('button.action'))
    const { getByText, container } = render(<Button config={{ label: 'Go Live' }} />)
    expect(getByText('Go Live')).toBeInTheDocument()
    expect(container.querySelector('[data-widget-kind="button"]')).toBeTruthy()
  })
})
