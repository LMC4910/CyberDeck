// Dev middlewares (CD-125): latency simulation + failure injection, both behind
// the devTools flag so they are inert in a production/non-dev config. They force
// the UI to handle loading/error/retry states from day one.
import { GatewayError, type Middleware } from './types'

export interface LatencyOptions {
  enabled: boolean
  /** Latency window in ms (default 15–200, design mockapi). */
  minMs?: number
  maxMs?: number
  /** Injected RNG (0..1) + delay for deterministic tests. */
  random?: () => number
  delay?: (ms: number) => Promise<void>
}

const realDelay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/** Adds a random latency drawn from [minMs, maxMs]. Passthrough when disabled. */
export function latencyMiddleware(options: LatencyOptions): Middleware {
  const min = options.minMs ?? 15
  const max = options.maxMs ?? 200
  const random = options.random ?? Math.random
  const delay = options.delay ?? realDelay
  return async (ctx, next) => {
    if (options.enabled) {
      const ms = Math.round(min + random() * (max - min))
      await delay(ms)
    }
    return next(ctx)
  }
}

export interface FailureOptions {
  enabled: boolean
  /** Failure probability 0..1 (default 0.02 = ~2%). */
  rate?: number
  random?: () => number
}

/**
 * Injects a retryable `unavailable` error at `rate`. Passthrough when disabled
 * (so a non-dev config never sees synthetic failures — the AC).
 */
export function failureMiddleware(options: FailureOptions): Middleware {
  const rate = options.rate ?? 0.02
  const random = options.random ?? Math.random
  return async (ctx, next) => {
    if (options.enabled && random() < rate) {
      throw new GatewayError('unavailable', `injected failure for ${ctx.route}`, true)
    }
    return next(ctx)
  }
}
