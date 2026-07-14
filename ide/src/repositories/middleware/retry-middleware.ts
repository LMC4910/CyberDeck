// Retry + cancellation middleware (CD-126). Retries only errors flagged
// `retryable` (CD-113 error model) with exponential backoff, honoring a
// retryAfterMs hint. AbortSignal is respected end-to-end: an abort before, during
// the backoff, or between attempts stops retrying and rejects with an AbortError.
import { GatewayError, type Middleware } from './types'

export class AbortError extends Error {
  constructor(message = 'request aborted') {
    super(message)
    this.name = 'AbortError'
  }
}

export interface RetryOptions {
  /** Max retry attempts after the first try. Default 3. */
  maxRetries?: number
  /** Base backoff (ms). Default 100. */
  baseDelayMs?: number
  /** Backoff multiplier. Default 2. */
  factor?: number
  /** Injected delay (tests). Must reject if the signal aborts. */
  delay?: (ms: number, signal?: AbortSignal) => Promise<void>
}

function isRetryable(err: unknown): boolean {
  return err instanceof GatewayError && err.retryable
}

function retryAfter(err: unknown): number | undefined {
  return err instanceof GatewayError ? err.retryAfterMs : undefined
}

const abortableDelay = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new AbortError())
    const h = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(h)
      reject(new AbortError())
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })

export function retryMiddleware(options: RetryOptions = {}): Middleware {
  const maxRetries = options.maxRetries ?? 3
  const baseDelayMs = options.baseDelayMs ?? 100
  const factor = options.factor ?? 2
  const delay = options.delay ?? abortableDelay

  return async (ctx, next) => {
    let attempt = 0
    for (;;) {
      if (ctx.signal?.aborted) throw new AbortError()
      try {
        return await next(ctx)
      } catch (err) {
        // Never retry an abort or a non-retryable error.
        if (err instanceof AbortError) throw err
        if (!isRetryable(err) || attempt >= maxRetries) throw err
        const backoff = retryAfter(err) ?? baseDelayMs * factor ** attempt
        await delay(backoff, ctx.signal) // rejects with AbortError if aborted
        attempt++
      }
    }
  }
}
