import { describe, expect, it, vi } from 'vitest'
import { createStore } from '@/stores'
import { StoreManager } from '@/stores'
import { MemoryStorageAdapter } from '@/services/persistence'

describe('createStore', () => {
  it('getState/setState/subscribe notify on change only', () => {
    const store = createStore({ a: 1, b: 2 }, { name: 'ui', kind: 'temp' })
    const listener = vi.fn()
    store.subscribe(listener)
    store.setState((s) => ({ ...s, a: 5 }))
    expect(store.getState().a).toBe(5)
    expect(listener).toHaveBeenCalledOnce()
    store.setState(store.getState()) // same reference → no notify
    expect(listener).toHaveBeenCalledOnce()
  })

  it('select computes a slice', () => {
    const store = createStore({ a: 1, b: 2 }, { name: 'ui', kind: 'temp' })
    expect(store.select((s) => s.b)).toBe(2)
  })
})

describe('StoreManager — restore ordering', () => {
  it('restores persisted stores in restoreAt order', () => {
    const adapter = new MemoryStorageAdapter({
      'cdk-late': JSON.stringify({ v: 'late' }),
      'cdk-early': JSON.stringify({ v: 'early' }),
      'cdk-mid': JSON.stringify({ v: 'mid' }),
    })
    const mgr = new StoreManager({ adapter })
    // register out of order
    mgr.register(createStore({ v: '' }, { name: 'late', kind: 'persisted', location: 'cdk-late', restoreAt: 'after-shell' }))
    mgr.register(createStore({ v: '' }, { name: 'early', kind: 'persisted', location: 'cdk-early', restoreAt: 'boot-blocking' }))
    mgr.register(createStore({ v: '' }, { name: 'mid', kind: 'persisted', location: 'cdk-mid', restoreAt: 'boot' }))

    expect(mgr.restore()).toEqual(['early', 'mid', 'late'])
  })

  it('a corrupt blob falls back to initial state with a notice (no crash)', () => {
    const adapter = new MemoryStorageAdapter({ 'cdk-x': 'NOT JSON' })
    const notices: string[] = []
    const mgr = new StoreManager({ adapter, onNotice: (n) => notices.push(n.code) })
    const store = createStore({ v: 'initial' }, { name: 'x', kind: 'persisted', location: 'cdk-x' })
    mgr.register(store)
    mgr.restore()
    expect(store.getState().v).toBe('initial') // unchanged, no throw
    expect(notices).toEqual(['corrupt-blob'])
  })

  it('runs a migrate hook on the restored blob', () => {
    const adapter = new MemoryStorageAdapter({ 'cdk-m': JSON.stringify({ old: 7 }) })
    const mgr = new StoreManager({ adapter })
    const store = createStore(
      { n: 0 },
      {
        name: 'm',
        kind: 'persisted',
        location: 'cdk-m',
        migrate: (raw) => ({ n: (raw as { old: number }).old }),
      },
    )
    mgr.register(store)
    mgr.restore()
    expect(store.getState().n).toBe(7)
  })

  it('write-behind debounces, and flush writes pending immediately', () => {
    const adapter = new MemoryStorageAdapter()
    // manual scheduler: never auto-fires, so writes stay pending until flush
    const mgr = new StoreManager({ adapter, scheduler: () => () => {} })
    const store = createStore({ v: 1 }, { name: 'w', kind: 'persisted', location: 'cdk-w' })
    mgr.register(store)
    store.setState({ v: 2 })
    expect(adapter.get('cdk-w')).toBeNull() // debounced, not yet written
    mgr.flush()
    expect(JSON.parse(adapter.get('cdk-w')!)).toEqual({ v: 2 })
  })

  it('write-behind persists on the scheduler tick', () => {
    const adapter = new MemoryStorageAdapter()
    const mgr = new StoreManager({ adapter, scheduler: (fn) => { fn(); return () => {} } })
    const store = createStore({ v: 1 }, { name: 'w2', kind: 'persisted', location: 'cdk-w2' })
    mgr.register(store)
    store.setState({ v: 9 })
    expect(JSON.parse(adapter.get('cdk-w2')!)).toEqual({ v: 9 })
  })
})
