import { describe, expect, it } from 'vitest'
import { MemoryStorageAdapter } from '@/services/persistence'
import { StoreManager } from '@/stores'
import {
  createBootCriticalStores,
  createAuthStore,
  AUTH_ALLOWED_KEYS,
} from '@/stores'

describe('boot-critical stores — restore at declared stages', () => {
  it('all four restore at boot-blocking (except UI which is temp/memory)', () => {
    const stores = createBootCriticalStores()
    expect(stores.preferences.descriptor.restoreAt).toBe('boot-blocking')
    expect(stores.workspace.descriptor.restoreAt).toBe('boot-blocking')
    expect(stores.auth.descriptor.restoreAt).toBe('boot-blocking')
    expect(stores.ui.descriptor.kind).toBe('temp') // not persisted
  })

  it('the StoreManager restores persisted boot-critical stores from storage', () => {
    const adapter = new MemoryStorageAdapter({
      'cdk-prefs': JSON.stringify({ version: 1, density: 'compact' }),
      'cdk-layout': JSON.stringify({ version: 1, workspaceId: 'deck-designer', panels: [] }),
      'cdk-auth': JSON.stringify({ token: 't0ken', sessionId: 's1', expiresAt: 999 }),
    })
    const mgr = new StoreManager({ adapter })
    const stores = createBootCriticalStores()
    mgr.register(stores.preferences)
    mgr.register(stores.workspace)
    mgr.register(stores.auth)
    mgr.register(stores.ui)
    const order = mgr.restore()

    expect(order).toEqual(['preferences', 'workspace', 'auth']) // ui is temp → not restored
    expect(stores.preferences.getState().density).toBe('compact')
    expect(stores.workspace.getState().workspaceId).toBe('deck-designer')
    expect(stores.auth.getState().token).toBe('t0ken')
  })
})

describe('boot-critical stores — no credential material in web storage', () => {
  it('the auth store persists only token/sessionId/expiresAt (no secrets)', () => {
    const store = createAuthStore({ token: 'abc', sessionId: 's', expiresAt: 1 })
    const persisted = JSON.parse(JSON.stringify(store.getState())) as Record<string, unknown>
    expect(Object.keys(persisted).sort()).toEqual([...AUTH_ALLOWED_KEYS].sort())
  })

  it('nothing a persisted boot-critical store would write contains credential material', () => {
    // The real proof: serialize what each persisted store would write to storage
    // and assert no credential field name appears in the persisted JSON.
    const forbidden = /\b(password|passwd|secret|apiKey|api_key|privateKey|refreshToken|credentials)\b/i
    const adapter = new MemoryStorageAdapter()
    const mgr = new StoreManager({ adapter, scheduler: (fn) => { fn(); return () => {} } })
    const stores = createBootCriticalStores()
    mgr.register(stores.preferences)
    mgr.register(stores.workspace)
    mgr.register(stores.auth)
    // touch each persisted store so a write is produced (auth carries a token)
    stores.preferences.setState({ version: 1, density: 'compact' })
    stores.workspace.setState({ version: 1, workspaceId: 'home', panels: [] })
    stores.auth.setState({ token: 'sometoken2', sessionId: 's2', expiresAt: 2 })
    mgr.flush()

    for (const key of ['cdk-prefs', 'cdk-layout', 'cdk-auth']) {
      const blob = adapter.get(key) ?? ''
      expect(forbidden.test(blob)).toBe(false)
    }
  })
})
