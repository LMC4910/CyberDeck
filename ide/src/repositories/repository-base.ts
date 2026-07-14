// Repository base (CD-124). Typed query/get/mutate/subscribe over a route group,
// with pagination/filter/sort params. Domain repositories bind a RouteGroup (ids
// from the CD-114 route set) and add domain-specific operations on top.
import type { RouteId } from '@/shared/contract'
import type { Gateway, RequestOptions } from './gateway'

export interface SortSpec {
  field: string
  dir?: 'asc' | 'desc'
}

export interface QueryParams {
  filter?: Record<string, unknown>
  sort?: SortSpec
  page?: number
  limit?: number
}

export interface Page<T> {
  items: T[]
  page: number
  limit: number
  total?: number
}

/** Route ids bound to CRUD/subscribe operations (a subset may be present). */
export interface RouteGroup {
  list?: RouteId
  get?: RouteId
  create?: RouteId
  update?: RouteId
  remove?: RouteId
  subscribe?: RouteId
}

export class UnsupportedOperationError extends Error {
  constructor(op: string) {
    super(`repository does not support "${op}" (no route bound)`)
    this.name = 'UnsupportedOperationError'
  }
}

export class RepositoryBase<T> {
  protected readonly gateway: Gateway
  readonly routes: RouteGroup

  constructor(gateway: Gateway, routes: RouteGroup) {
    this.gateway = gateway
    this.routes = routes
  }

  query(params: QueryParams = {}): Promise<Page<T>> {
    return this.gateway.request<Page<T>>(this.route('list'), {
      params: {
        ...(params.filter ? { filter: params.filter } : {}),
        ...(params.sort ? { sort: params.sort } : {}),
        page: params.page ?? 1,
        limit: params.limit ?? 50,
      },
    })
  }

  get(id: string, options?: RequestOptions): Promise<T> {
    return this.gateway.request<T>(this.route('get'), { ...options, params: { ...options?.params, id } })
  }

  create(body: unknown): Promise<T> {
    return this.gateway.request<T>(this.route('create'), { body })
  }

  update(id: string, body: unknown): Promise<T> {
    return this.gateway.request<T>(this.route('update'), { params: { id }, body })
  }

  remove(id: string): Promise<void> {
    return this.gateway.request<void>(this.route('remove'), { params: { id } })
  }

  subscribe(handler: (event: T) => void, params?: Record<string, unknown>): () => void {
    return this.gateway.subscribe<T>(this.route('subscribe'), params, handler)
  }

  private route(op: keyof RouteGroup): RouteId {
    const id = this.routes[op]
    if (!id) throw new UnsupportedOperationError(op)
    return id
  }
}
