// Gateway port (CD-124). Repositories are the only layer that talks to a gateway,
// and only through this interface — MockApiGateway (CD-127) and EngineGateway
// (M5) are interchangeable implementations. A request-log tap feeds the Platform
// Inspector.
import type { RouteId } from '@/shared/contract'

export interface RequestOptions {
  /** Path/query params, e.g. { id: 'p1', filter: {...} }. */
  params?: Record<string, unknown>
  /** Request body (create/update). */
  body?: unknown
  /** Cancellation. */
  signal?: AbortSignal
}

export interface RequestLogEntry {
  route: string
  params?: Record<string, unknown>
  startedAt: number
  durationMs?: number
  ok?: boolean
  error?: string
}

export interface Gateway {
  request<T>(route: RouteId | string, options?: RequestOptions): Promise<T>
  subscribe<T>(
    route: RouteId | string,
    params: Record<string, unknown> | undefined,
    handler: (event: T) => void,
  ): () => void
  /** Observe every request (dev surface). Returns an untap. */
  tap?(fn: (entry: RequestLogEntry) => void): () => void
}
