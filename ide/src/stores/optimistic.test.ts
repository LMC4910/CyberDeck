import { describe, expect, it, vi } from 'vitest'
import { createStore, optimistic } from '@/stores'
import { GatewayError } from '@/repositories'

interface ListState {
  items: string[]
}
const makeStore = () => createStore<ListState>({ items: ['a'] }, { name: 'test', kind: 'temp' })

describe('optimistic — success path', () => {
  it('applies immediately and keeps the change on commit success', async () => {
    const store = makeStore()
    const result = await optimistic({
      store,
      apply: (s) => ({ items: [...s.items, 'b'] }),
      commit: async () => 'ok',
    })
    expect(result).toBe('ok')
    expect(store.getState().items).toEqual(['a', 'b'])
  })

  it('reconciles with the server result when provided', async () => {
    const store = makeStore()
    await optimistic({
      store,
      apply: (s) => ({ items: [...s.items, 'temp'] }),
      commit: async () => ['a', 'server'],
      reconcile: (_s, result) => ({ items: result }),
    })
    expect(store.getState().items).toEqual(['a', 'server'])
  })
})

describe('optimistic — failure path (rollback + corrective event)', () => {
  it('rolls back to the snapshot and fires onRollback on commit failure', async () => {
    const store = makeStore()
    const corrective = vi.fn()

    // apply optimistically, then the commit fails → rollback + corrective event
    await expect(
      optimistic({
        store,
        apply: (s) => ({ items: [...s.items, 'ghost'] }),
        commit: async () => {
          throw new GatewayError('unavailable', 'down', true)
        },
        onRollback: corrective,
      }),
    ).rejects.toBeInstanceOf(GatewayError)

    // store restored to before the optimistic apply
    expect(store.getState().items).toEqual(['a'])
    // corrective event observed with the error + restored state
    expect(corrective).toHaveBeenCalledOnce()
    expect(corrective.mock.calls[0]![1]).toEqual({ items: ['a'] })
  })

  it('the optimistic value was visible before the failure resolved', async () => {
    const store = makeStore()
    let seenDuringFlight: string[] | undefined
    await optimistic({
      store,
      apply: (s) => ({ items: [...s.items, 'inflight'] }),
      commit: async () => {
        seenDuringFlight = store.getState().items // observed mid-flight
        throw new Error('boom')
      },
    }).catch(() => {})
    expect(seenDuringFlight).toEqual(['a', 'inflight']) // was applied
    expect(store.getState().items).toEqual(['a']) // then rolled back
  })
})
