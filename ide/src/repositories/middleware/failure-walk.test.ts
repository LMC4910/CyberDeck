// M1 gate (CD-139): failure-injection walk — loading → error → retry → success —
// exercised through the real middleware stack.
import { describe, expect, it } from 'vitest'
import {
  compose,
  latencyMiddleware,
  failureMiddleware,
  retryMiddleware,
  GatewayError,
  type RequestContext,
} from '@/repositories/middleware'

describe('M1 gate — failure-injection walk', () => {
  it('surfaces an injected failure then recovers via retry (loading→error→retry→success)', async () => {
    const states: string[] = []
    let attempts = 0
    const terminal = async () => {
      if (++attempts === 1) throw new GatewayError('unavailable', 'injected', true)
      return { items: [], page: 1, limit: 50, total: 0 }
    }

    const chain = compose([
      retryMiddleware({ delay: async () => void states.push('retry') }),
      latencyMiddleware({
        enabled: true,
        minMs: 1,
        maxMs: 1,
        random: () => 0,
        delay: async () => void states.push('loading'),
      }),
      failureMiddleware({ enabled: false, rate: 0 }),
    ])

    states.push('start')
    const ctx: RequestContext = { route: 'variables.query' }
    const result = await chain(ctx, terminal)

    expect(states[0]).toBe('start')
    expect(states).toContain('loading') // loading state shown
    expect(states).toContain('retry') // retried after the error
    expect(result).toMatchObject({ items: [], total: 0 }) // success
    expect(attempts).toBe(2)
  })

  it('a non-retryable injected failure surfaces an error (no infinite retry)', async () => {
    const chain = compose([retryMiddleware({ delay: async () => {} })])
    const terminal = async () => {
      throw new GatewayError('validation_failed', 'bad', false)
    }
    await expect(chain({ route: 'flows.create' }, terminal)).rejects.toMatchObject({
      code: 'validation_failed',
    })
  })

  it('the injected failure rate is inert in a non-dev config', async () => {
    const chain = compose([failureMiddleware({ enabled: false, rate: 1, random: () => 0 })])
    await expect(chain({ route: 'x' }, async () => 'ok')).resolves.toBe('ok')
  })
})
