// Request middleware types (CD-125). A composable, config-ordered chain wraps
// every gateway request (latency simulation, failure injection, retry, caching,
// auth). Koa-style onion: each middleware calls next() to continue.
import type { RequestOptions } from '../gateway'

export interface RequestContext {
  route: string
  options?: RequestOptions
  /** Cancellation, threaded end-to-end (CD-126). */
  signal?: AbortSignal
}

export type Next = (ctx: RequestContext) => Promise<unknown>
export type Middleware = (ctx: RequestContext, next: Next) => Promise<unknown>

/** Error carrying the CD-113 control-plane error model (code + retryable). */
export class GatewayError extends Error {
  readonly code: string
  readonly retryable: boolean
  readonly retryAfterMs?: number
  constructor(code: string, message: string, retryable: boolean, retryAfterMs?: number) {
    super(message)
    this.name = 'GatewayError'
    this.code = code
    this.retryable = retryable
    this.retryAfterMs = retryAfterMs
  }
}
