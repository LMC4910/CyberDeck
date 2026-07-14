import { describe, expect, it, vi } from 'vitest'
import {
  compose,
  latencyMiddleware,
  failureMiddleware,
  GatewayError,
  type Middleware,
  type RequestContext,
} from '@/repositories/middleware'

const ctx: RequestContext = { route: 'projects.list' }
const terminal = async () => 'result'

describe('compose', () => {
  it('runs middlewares in order (onion) around the terminal', async () => {
    const order: string[] = []
    const mw = (name: string): Middleware => async (c, next) => {
      order.push(`>${name}`)
      const r = await next(c)
      order.push(`<${name}`)
      return r
    }
    const chain = compose([mw('a'), mw('b')])
    const result = await chain(ctx, terminal)
    expect(result).toBe('result')
    expect(order).toEqual(['>a', '>b', '<b', '<a'])
  })

  it('a middleware can short-circuit without calling next', async () => {
    const short: Middleware = async () => 'short'
    const inner = vi.fn(async () => 'inner')
    const chain = compose([short])
    expect(await chain(ctx, inner)).toBe('short')
    expect(inner).not.toHaveBeenCalled()
  })
})

describe('latencyMiddleware', () => {
  it('delays within [min,max] when enabled', async () => {
    const delays: number[] = []
    const mw = latencyMiddleware({
      enabled: true,
      minMs: 15,
      maxMs: 200,
      random: () => 0.5,
      delay: async (ms) => void delays.push(ms),
    })
    await mw(ctx, terminal)
    expect(delays).toEqual([Math.round(15 + 0.5 * (200 - 15))]) // 108
  })

  it('is passthrough (no delay) when disabled', async () => {
    const delay = vi.fn(async () => {})
    const mw = latencyMiddleware({ enabled: false, delay })
    expect(await mw(ctx, terminal)).toBe('result')
    expect(delay).not.toHaveBeenCalled()
  })
})

describe('failureMiddleware', () => {
  it('throws a retryable GatewayError when the roll is under the rate', async () => {
    const mw = failureMiddleware({ enabled: true, rate: 0.02, random: () => 0.01 })
    await expect(mw(ctx, terminal)).rejects.toBeInstanceOf(GatewayError)
    await expect(mw(ctx, terminal)).rejects.toMatchObject({ code: 'unavailable', retryable: true })
  })

  it('passes through when the roll is over the rate', async () => {
    const mw = failureMiddleware({ enabled: true, rate: 0.02, random: () => 0.9 })
    expect(await mw(ctx, terminal)).toBe('result')
  })

  it('never injects when disabled (non-dev config)', async () => {
    const mw = failureMiddleware({ enabled: false, rate: 1, random: () => 0 })
    expect(await mw(ctx, terminal)).toBe('result') // rate 1 but disabled → no failure
  })
})
