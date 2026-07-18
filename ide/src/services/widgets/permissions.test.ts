// CD-422 (services): permissions store persistence + capability broker gating.
// Proves the ACs at the headless layer — deny blocks with a visible reason, grant
// persists across a reload, and undeclared access throws.
import { describe, it, expect, vi } from 'vitest'
import { MemoryStorageAdapter } from '@/services/persistence'
import { WidgetPermissionsStore } from './permissions-store'
import { WidgetCapabilityBroker } from './capability-broker'
import { WidgetPermissionDeniedError, WidgetPermissionError } from './permissions'
import type { WidgetCapability } from './types'

const declared = (caps: WidgetCapability[]) => () => caps

describe('WidgetPermissionsStore', () => {
  it('records and reads a decision', () => {
    const store = new WidgetPermissionsStore({ adapter: new MemoryStorageAdapter() })
    expect(store.decision('w.one', 'network')).toBe('unset')
    store.grant('w.one', 'network')
    expect(store.decision('w.one', 'network')).toBe('granted')
    expect(store.isGranted('w.one', 'network')).toBe(true)
    store.deny('w.one', 'network')
    expect(store.decision('w.one', 'network')).toBe('denied')
  })

  it('persists a grant across a reload (AC: grant persists)', () => {
    const adapter = new MemoryStorageAdapter()
    new WidgetPermissionsStore({ adapter }).grant('w.two', 'clipboard')
    // A fresh store on the same storage sees the persisted grant.
    const reloaded = new WidgetPermissionsStore({ adapter })
    expect(reloaded.isGranted('w.two', 'clipboard')).toBe(true)
  })

  it('reset clears a decision back to unset', () => {
    const store = new WidgetPermissionsStore({ adapter: new MemoryStorageAdapter() })
    store.deny('w.three', 'media')
    store.reset('w.three', 'media')
    expect(store.decision('w.three', 'media')).toBe('unset')
    expect(store.widgetIds()).not.toContain('w.three')
  })

  it('lists recorded decisions for a widget', () => {
    const store = new WidgetPermissionsStore({ adapter: new MemoryStorageAdapter() })
    store.grant('w.four', 'network')
    store.deny('w.four', 'devices')
    expect(store.decisionsFor('w.four').sort((a, b) => a.capability.localeCompare(b.capability))).toEqual([
      { capability: 'devices', decision: 'denied' },
      { capability: 'network', decision: 'granted' },
    ])
  })

  it('notifies subscribers on change', () => {
    const store = new WidgetPermissionsStore({ adapter: new MemoryStorageAdapter() })
    const listener = vi.fn()
    const off = store.subscribe(listener)
    store.grant('w.five', 'git')
    expect(listener).toHaveBeenCalledTimes(1)
    off()
    store.deny('w.five', 'git')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('degrades to an empty policy on corrupt storage (never crashes)', () => {
    const adapter = new MemoryStorageAdapter({ 'cyberdeck.widget.permissions': '{not json' })
    const store = new WidgetPermissionsStore({ adapter })
    expect(store.widgetIds()).toEqual([])
  })
})

describe('WidgetCapabilityBroker — undeclared access (AC: throws)', () => {
  const store = () => new WidgetPermissionsStore({ adapter: new MemoryStorageAdapter() })

  it('assertDeclared throws for a capability the manifest never declared', () => {
    const broker = new WidgetCapabilityBroker({
      store: store(),
      declaredCapabilities: declared(['network']),
      prompt: vi.fn(),
    })
    expect(() => broker.assertDeclared('w.six', 'automation')).toThrow(WidgetPermissionError)
  })

  it('isAllowed throws synchronously for undeclared access', () => {
    const broker = new WidgetCapabilityBroker({
      store: store(),
      declaredCapabilities: declared(['network']),
      prompt: vi.fn(),
    })
    expect(() => broker.isAllowed('w.six', 'filesystem')).toThrow(WidgetPermissionError)
  })

  it('ensure rejects for undeclared access and never prompts', async () => {
    const prompt = vi.fn()
    const broker = new WidgetCapabilityBroker({
      store: store(),
      declaredCapabilities: declared(['network']),
      prompt,
    })
    await expect(broker.ensure('w.six', 'git')).rejects.toBeInstanceOf(WidgetPermissionError)
    expect(prompt).not.toHaveBeenCalled()
  })
})

describe('WidgetCapabilityBroker — grant / deny / prompt', () => {
  it('prompts on first use, persists the grant, and proceeds (grant persists)', async () => {
    const adapter = new MemoryStorageAdapter()
    const store = new WidgetPermissionsStore({ adapter })
    const prompt = vi.fn().mockResolvedValue('granted')
    const broker = new WidgetCapabilityBroker({
      store,
      declaredCapabilities: declared(['network']),
      prompt,
    })
    await expect(broker.ensure('w.seven', 'network')).resolves.toBeUndefined()
    expect(prompt).toHaveBeenCalledTimes(1)
    // Persisted — a reloaded store still grants, and a second ensure won't prompt.
    expect(new WidgetPermissionsStore({ adapter }).isGranted('w.seven', 'network')).toBe(true)
    await broker.ensure('w.seven', 'network')
    expect(prompt).toHaveBeenCalledTimes(1)
  })

  it('deny blocks the capability with a visible reason (AC: deny blocks)', async () => {
    const store = new WidgetPermissionsStore({ adapter: new MemoryStorageAdapter() })
    const broker = new WidgetCapabilityBroker({
      store,
      declaredCapabilities: declared(['media']),
      prompt: vi.fn().mockResolvedValue('denied'),
    })
    const err = await broker.ensure('w.eight', 'media', 'needs to read now-playing').catch((e) => e)
    expect(err).toBeInstanceOf(WidgetPermissionDeniedError)
    expect((err as WidgetPermissionDeniedError).reason).toContain('needs to read now-playing')
    // The deny is persisted, so subsequent use blocks without re-prompting.
    expect(store.decision('w.eight', 'media')).toBe('denied')
  })

  it('an already-granted capability proceeds without prompting', async () => {
    const store = new WidgetPermissionsStore({ adapter: new MemoryStorageAdapter() })
    store.grant('w.nine', 'devices')
    const prompt = vi.fn()
    const broker = new WidgetCapabilityBroker({
      store,
      declaredCapabilities: declared(['devices']),
      prompt,
    })
    await broker.ensure('w.nine', 'devices')
    expect(prompt).not.toHaveBeenCalled()
  })

  it('coalesces concurrent first-use requests into a single prompt', async () => {
    const store = new WidgetPermissionsStore({ adapter: new MemoryStorageAdapter() })
    let resolvePrompt: (d: 'granted') => void = () => {}
    const prompt = vi.fn().mockImplementation(
      () => new Promise<'granted'>((res) => (resolvePrompt = res)),
    )
    const broker = new WidgetCapabilityBroker({
      store,
      declaredCapabilities: declared(['network']),
      prompt,
    })
    const a = broker.ensure('w.ten', 'network')
    const b = broker.ensure('w.ten', 'network')
    resolvePrompt('granted')
    await Promise.all([a, b])
    expect(prompt).toHaveBeenCalledTimes(1)
  })
})
