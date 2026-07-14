import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  RepositoryBase,
  RepositoryRegistry,
  UnsupportedOperationError,
  type Gateway,
  type RequestLogEntry,
} from '@/repositories'

// A fake gateway that records calls and returns canned data, with a request tap.
function fakeGateway() {
  const calls: Array<{ route: string; options?: unknown }> = []
  const taps: Array<(e: RequestLogEntry) => void> = []
  const gateway: Gateway = {
    async request<T>(route: string, options?: unknown): Promise<T> {
      calls.push({ route, options })
      taps.forEach((t) => t({ route, startedAt: 0, ok: true, durationMs: 1 }))
      return { items: [], page: 1, limit: 50 } as T
    },
    subscribe<T>(route: string, params: unknown, handler: (e: T) => void) {
      calls.push({ route, options: params })
      void handler
      return () => {}
    },
    tap(fn) {
      taps.push(fn)
      return () => {}
    },
  }
  return { gateway, calls }
}

describe('RepositoryBase', () => {
  it('query passes pagination/filter/sort to the list route', async () => {
    const { gateway, calls } = fakeGateway()
    const repo = new RepositoryBase<unknown>(gateway, { list: 'projects.list' })
    await repo.query({ filter: { channel: 'stable' }, sort: { field: 'name' }, page: 2, limit: 10 })
    expect(calls[0]?.route).toBe('projects.list')
    expect(calls[0]?.options).toMatchObject({
      params: { filter: { channel: 'stable' }, sort: { field: 'name' }, page: 2, limit: 10 },
    })
  })

  it('get/create/update/remove hit the bound routes', async () => {
    const { gateway, calls } = fakeGateway()
    const repo = new RepositoryBase<unknown>(gateway, {
      get: 'projects.get',
      create: 'projects.create',
      update: 'projects.update',
      remove: 'projects.delete',
    })
    await repo.get('p1')
    await repo.create({})
    await repo.update('p1', {})
    await repo.remove('p1')
    expect(calls.map((c) => c.route)).toEqual([
      'projects.get',
      'projects.create',
      'projects.update',
      'projects.delete',
    ])
  })

  it('an unbound operation throws UnsupportedOperationError', () => {
    const { gateway } = fakeGateway()
    const repo = new RepositoryBase<unknown>(gateway, { list: 'assets.list' })
    expect(() => repo.get('x')).toThrow(UnsupportedOperationError)
  })

  it('the request tap observes each request', async () => {
    const { gateway } = fakeGateway()
    const seen: string[] = []
    gateway.tap?.((e) => seen.push(e.route))
    const repo = new RepositoryBase<unknown>(gateway, { list: 'flows.list' })
    await repo.query()
    expect(seen).toEqual(['flows.list'])
  })
})

describe('RepositoryRegistry — 7 domain repos bound to CD-114 route groups', () => {
  const routeIds = new Set(
    (
      JSON.parse(
        readFileSync(
          join(__dirname, '..', '..', '..', 'shared', 'schemas', 'control-plane', 'routes.v1.json'),
          'utf8',
        ),
      ).routes as Array<{ id: string }>
    ).map((r) => r.id),
  )

  it('instantiates all 7 repositories', () => {
    const { gateway } = fakeGateway()
    const reg = new RepositoryRegistry(gateway)
    expect(reg.all().map((r) => r.name)).toEqual([
      'variables',
      'projects',
      'flows',
      'widgetManifests',
      'assets',
      'devices',
      'aiThreads',
    ])
  })

  it('every bound route id exists in routes.v1.json', () => {
    const { gateway } = fakeGateway()
    const reg = new RepositoryRegistry(gateway)
    for (const { routes } of reg.all()) {
      for (const id of Object.values(routes)) {
        if (id) expect(routeIds.has(id)).toBe(true)
      }
    }
  })

  it('domain-specific ops call their routes', async () => {
    const { gateway, calls } = fakeGateway()
    const reg = new RepositoryRegistry(gateway)
    await reg.projects.open('p1')
    await reg.flows.deploy('f1')
    await reg.devices.assign('d1', 'page1')
    await reg.aiThreads.suggestLayout({})
    const routes = calls.map((c) => c.route)
    expect(routes).toContain('projects.open')
    expect(routes).toContain('flows.deploy')
    expect(routes).toContain('devices.assign')
    expect(routes).toContain('ai.threads.suggest')
  })
})
