import { describe, expect, it } from 'vitest'
import { ROUTE_IDS } from '@/shared/contract'
import { MemoryStorageAdapter } from '@/services/persistence'
import { MockApiGateway, ContractError } from '@/repositories/mock'
import { RepositoryRegistry } from '@/repositories'

describe('MockApiGateway — router', () => {
  it('resolves every route in the contract registry (no unknown-route error)', async () => {
    const gw = new MockApiGateway()
    for (const route of ROUTE_IDS) {
      // seed an id where a get/update/delete/open needs one
      const params = { id: seedIdFor(route) }
      // Some ops legitimately 404 on a bad id, but must NOT throw ContractError.
      try {
        await gw.request(route, { params, body: { id: params.id } })
      } catch (err) {
        expect(err).not.toBeInstanceOf(ContractError)
      }
    }
  })

  it('an unknown route errors loudly (ContractError)', async () => {
    const gw = new MockApiGateway()
    await expect(gw.request('projects.teleport')).rejects.toBeInstanceOf(ContractError)
  })
})

// Pick a seeded id so get/open succeed for the collections that have seed data.
function seedIdFor(route: string): string {
  if (route.startsWith('projects')) return 'proj_seed001'
  if (route.startsWith('flows')) return 'flow_strt0001'
  if (route.startsWith('variables')) return 'sys.cpu.load'
  if (route.startsWith('widgets')) return 'gauge.circular'
  if (route.startsWith('assets')) return 'ast_cam0001'
  if (route.startsWith('devices')) return 'dev_ipad001'
  return 'x'
}

describe('MockApiGateway — query semantics', () => {
  it('filters, sorts and paginates list results', async () => {
    const gw = new MockApiGateway()
    const all = await gw.request<{ total: number; items: unknown[] }>('variables.query', {
      params: { limit: 100 },
    })
    expect(all.total).toBe(6)

    const filtered = await gw.request<{ items: Array<{ kind: string }> }>('variables.query', {
      params: { filter: { kind: 'scalar' } },
    })
    expect(filtered.items.every((v) => v.kind === 'scalar')).toBe(true)

    const paged = await gw.request<{ items: unknown[]; page: number }>('variables.query', {
      params: { page: 2, limit: 2 },
    })
    expect(paged.items).toHaveLength(2)
    expect(paged.page).toBe(2)

    const sorted = await gw.request<{ items: Array<{ value: number }> }>('variables.query', {
      params: { sort: { field: 'value', dir: 'desc' }, limit: 100 },
    })
    const values = sorted.items.map((v) => v.value)
    expect(values).toEqual([...values].sort((a, b) => b - a))
  })
})

describe('MockApiGateway — mutations persist', () => {
  it('create/update/delete round-trips and persists to storage', async () => {
    const storage = new MemoryStorageAdapter()
    const gw = new MockApiGateway({ storage })

    const created = await gw.request<{ id: string; label: string }>('flows.create', {
      body: { id: 'flow_new0001', label: 'New Flow', version: 1 },
    })
    expect(created.id).toBe('flow_new0001')
    // persisted under the mock storage key
    expect(storage.get('cdk-mock-flows')).toContain('flow_new0001')

    const updated = await gw.request<{ label: string }>('flows.update', {
      params: { id: 'flow_new0001' },
      body: { label: 'Renamed' },
    })
    expect(updated.label).toBe('Renamed')

    await gw.request('flows.delete', { params: { id: 'flow_new0001' } })
    await expect(gw.request('flows.get', { params: { id: 'flow_new0001' } })).rejects.toMatchObject({
      code: 'not_found',
    })
  })

  it('a second gateway on the same storage sees persisted mutations', async () => {
    const storage = new MemoryStorageAdapter()
    const gw1 = new MockApiGateway({ storage })
    await gw1.request('flows.create', { body: { id: 'flow_persist1', label: 'P', version: 1 } })

    const gw2 = new MockApiGateway({ storage })
    const got = await gw2.request<{ id: string }>('flows.get', { params: { id: 'flow_persist1' } })
    expect(got.id).toBe('flow_persist1')
  })
})

describe('MockApiGateway — repositories run against it', () => {
  it('the RepositoryRegistry queries + mutates through the mock', async () => {
    const gw = new MockApiGateway()
    const repos = new RepositoryRegistry(gw)
    const page = await repos.variables.query({ limit: 100 })
    expect(page.total).toBe(6)

    const project = await repos.projects.open('proj_seed001')
    expect((project as unknown as { id: string }).id).toBe('proj_seed001')

    const tap: string[] = []
    gw.tap((e) => tap.push(e.route))
    await repos.flows.query()
    expect(tap).toContain('flows.list')
  })
})
