// CD-115: the generated contract barrel is importable and typed. This is the
// import surface kernel code uses (only @/shared/contract, never raw schemas).
import { describe, expect, it } from 'vitest'
import { ROUTE_IDS, type RouteId, type CyberDeckFeatureFlags } from '@/shared/contract'

describe('generated contract', () => {
  it('exposes the route-id union + runtime list', () => {
    expect(ROUTE_IDS.length).toBe(32)
    const id: RouteId = 'projects.list'
    expect(ROUTE_IDS).toContain(id)
  })

  it('feature-flags type matches the schema shape', () => {
    const flags: CyberDeckFeatureFlags = {
      version: 1,
      features: {
        expWidgets: false,
        devTools: true,
        aiProviders: true,
        marketplace: false,
        cloudSync: false,
        automation: true,
        pluginSandbox: true,
      },
    }
    expect(flags.features.devTools).toBe(true)
  })
})
