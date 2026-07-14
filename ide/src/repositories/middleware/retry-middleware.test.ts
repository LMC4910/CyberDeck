import { describe, expect, it, vi } from 'vitest'
import {
  retryMiddleware,
  AbortError,
  GatewayError,
  compose,
  type RequestContext,
} from '@/repositories/middleware'

const ctx: RequestContext = { route: 'projects.list' }
const noDelay = async () => {}

describe('retryMiddleware — retry budget', () => {
  it('retries a retryable error up to maxRetries, then throws', async () => {
    const inner = vi.fn(async () => {
      throw new GatewayError('unavailable', 'down', true)
    })
    const mw = retryMiddleware({ maxRetries: 3, delay: noDelay })
    await expect(mw(ctx, inner)).rejects.toBeInstanceOf(GatewayError)
    expect(inner).toHaveBeenCalledTimes(4) // 1 initial + 3 retries
  })

  it('succeeds on a later attempt', async () => {
    let n = 0
    const inner = vi.fn(async () => {
      if (++n < 3) throw new GatewayError('unavailable', 'down', true)
      return 'ok'
    })
    const mw = retryMiddleware({ maxRetries: 5, delay: noDelay })
    expect(await mw(ctx, inner)).toBe('ok')
    expect(inner).toHaveBeenCalledTimes(3)
  })

  it('does not retry a non-retryable error', async () => {
    const inner = vi.fn(async () => {
      throw new GatewayError('not_found', 'nope', false)
    })
    const mw = retryMiddleware({ maxRetries: 3, delay: noDelay })
    await expect(mw(ctx, inner)).rejects.toMatchObject({ code: 'not_found' })
    expect(inner).toHaveBeenCalledTimes(1)
  })

  it('uses exponential backoff (honoring retryAfterMs hint)', async () => {
    const delays: number[] = []
    const delay = async (ms: number) => void delays.push(ms)
    let n = 0
    const inner = async () => {
      n++
      if (n === 1) throw new GatewayError('unavailable', 'x', true) // → base*2^0 = 100
      if (n === 2) throw new GatewayError('rate_limited', 'x', true, 500) // → hint 500
      return 'ok'
    }
    const mw = retryMiddleware({ baseDelayMs: 100, factor: 2, delay })
    await mw(ctx, inner)
    expect(delays).toEqual([100, 500])
  })
})

describe('retryMiddleware — cancellation', () => {
  it('aborted before the call rejects with AbortError without calling next', async () => {
    const controller = new AbortController()
    controller.abort()
    const inner = vi.fn(async () => 'ok')
    const mw = retryMiddleware({ delay: noDelay })
    await expect(mw({ ...ctx, signal: controller.signal }, inner)).rejects.toBeInstanceOf(AbortError)
    expect(inner).not.toHaveBeenCalled()
  })

  it('abort during the backoff cancels cleanly', async () => {
    const controller = new AbortController()
    const inner = vi.fn(async () => {
      throw new GatewayError('unavailable', 'down', true)
    })
    // real abortable delay; abort while it is waiting
    const mw = retryMiddleware({ maxRetries: 5, baseDelayMs: 1000 })
    const p = mw({ ...ctx, signal: controller.signal }, inner)
    controller.abort()
    await expect(p).rejects.toBeInstanceOf(AbortError)
    expect(inner).toHaveBeenCalledTimes(1) // failed once, then aborted during backoff
  })
})

describe('retryMiddleware — composition', () => {
  it('composes as the outer layer over a failing terminal', async () => {
    let n = 0
    const terminal = async () => {
      if (++n < 2) throw new GatewayError('unavailable', 'x', true)
      return 'done'
    }
    const chain = compose([retryMiddleware({ delay: noDelay })])
    expect(await chain(ctx, terminal)).toBe('done')
  })
})
