// Gateway selection + offline mode (CD-128). `runtime.gateway` config selects
// mock ↔ engine ↔ offline. Offline degrades gracefully: reads return empty
// (a banner state, not breakage), mutations soft-fail as retryable. The
// EngineGateway lands in M5; selecting it before then throws a clear error.
import type { Gateway, RequestOptions, RequestLogEntry } from './gateway'
import { GatewayError } from './middleware'
import { MockApiGateway, type MockGatewayOptions } from './mock'

export type GatewayMode = 'mock' | 'engine' | 'offline'

export interface GatewaySelection {
  mode: GatewayMode
  gateway: Gateway
}

export interface SelectGatewayDeps {
  mock?: MockGatewayOptions
  /** Provided in M5; selecting 'engine' without it throws. */
  engineFactory?: () => Gateway
}

export function selectGateway(mode: GatewayMode, deps: SelectGatewayDeps = {}): GatewaySelection {
  switch (mode) {
    case 'mock':
      return { mode, gateway: new MockApiGateway(deps.mock) }
    case 'offline':
      return { mode, gateway: new OfflineGateway() }
    case 'engine':
      if (!deps.engineFactory) {
        throw new GatewayError('not_implemented', 'engine gateway is not available until M5', false)
      }
      return { mode, gateway: deps.engineFactory() }
  }
}

/**
 * Offline gateway: no engine reachable. Reads resolve to empty result sets so the
 * UI shows an empty/banner state rather than crashing; mutations reject with a
 * retryable error so they can be queued and re-tried when back online.
 */
export class OfflineGateway implements Gateway {
  readonly offline = true
  private readonly taps = new Set<(e: RequestLogEntry) => void>()

  async request<T>(route: string, options: RequestOptions = {}): Promise<T> {
    this.taps.forEach((t) => t({ route, startedAt: 0, ok: false, error: 'offline' }))
    const op = route.split('.').pop()
    if (op === 'list' || op === 'query' || op === 'manifests') {
      return { items: [], page: 1, limit: options.params?.limit ?? 50, total: 0 } as T
    }
    throw new GatewayError('unavailable', `offline: cannot ${route}`, true)
  }

  subscribe<T>(_route: string, _params: unknown, _handler: (e: T) => void): () => void {
    return () => {} // no live stream while offline
  }

  tap(fn: (entry: RequestLogEntry) => void): () => void {
    this.taps.add(fn)
    return () => this.taps.delete(fn)
  }
}
