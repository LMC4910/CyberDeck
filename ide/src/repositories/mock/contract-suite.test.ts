// Contract-test suite (CD-135). Iterates the route registry and, against a
// Gateway, asserts every route resolves, list responses are well-formed Pages,
// and the CD-113 error model holds. Parameterized by gateway (via runContractSuite)
// so the SAME assertions run vs MockApiGateway now and EngineGateway at M5.
// Failures name the route (+ ajv schema path for the error model).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Ajv2020 } from 'ajv/dist/2020'
import { MockApiGateway, type Gateway } from '@/repositories'

interface RouteDef {
  id: string
  kind: 'unary' | 'subscription'
  response?: string
  event?: string
  errors?: string[]
}

const SCHEMAS_DIR = join(__dirname, '..', '..', '..', '..', 'shared', 'schemas')
const loadRoutes = (): RouteDef[] =>
  (JSON.parse(readFileSync(join(SCHEMAS_DIR, 'control-plane', 'routes.v1.json'), 'utf8')) as {
    routes: RouteDef[]
  }).routes

const ajv = new Ajv2020({ strict: false, allErrors: true })
const errorValidator = ajv.compile(
  JSON.parse(readFileSync(join(SCHEMAS_DIR, 'control-plane', 'error.schema.json'), 'utf8')),
)

function seedId(route: string): string {
  if (route.startsWith('projects')) return 'proj_seed001'
  if (route.startsWith('flows')) return 'flow_strt0001'
  if (route.startsWith('variables')) return 'sys.cpu.load'
  if (route.startsWith('widgets')) return 'gauge.circular'
  if (route.startsWith('assets')) return 'ast_cam0001'
  if (route.startsWith('devices')) return 'dev_ipad001'
  return 'seed'
}

interface ContractResult {
  route: string
  ok: boolean
  detail?: string
}

// A fresh gateway per route isolates mutating routes (delete/update) from reads
// like open/get. The factory is the parameterization seam — M5 passes an engine
// gateway factory and the SAME assertions run.
async function runContractSuite(gatewayFactory: () => Gateway): Promise<ContractResult[]> {
  const out: ContractResult[] = []
  for (const route of loadRoutes()) {
    const gateway = gatewayFactory()
    const op = route.id.split('.').pop()!
    const id = seedId(route.id)
    try {
      if (route.kind === 'subscription') {
        gateway.subscribe(route.id, { id }, () => {})()
        out.push({ route: route.id, ok: true })
        continue
      }
      const body = op === 'create' || op === 'update' ? { id, version: 1 } : undefined
      const response = await gateway.request<{ items?: unknown; page?: unknown; total?: unknown }>(
        route.id,
        { params: { id }, body },
      )
      if (op === 'list' || op === 'query' || op === 'manifests') {
        if (!Array.isArray(response.items) || typeof response.page !== 'number' || typeof response.total !== 'number') {
          out.push({ route: route.id, ok: false, detail: 'list response is not a well-formed Page' })
          continue
        }
      }
      out.push({ route: route.id, ok: true })
    } catch (err) {
      out.push({ route: route.id, ok: false, detail: `request threw: ${String(err)}` })
    }
  }
  return out
}

describe('contract suite vs MockApiGateway (CD-135)', () => {
  it('every route in the registry passes', async () => {
    const results = await runContractSuite(() => new MockApiGateway())
    const failures = results.filter((r) => !r.ok)
    // name the route + detail on failure
    expect(failures, failures.map((f) => `${f.route}: ${f.detail}`).join('\n')).toEqual([])
    expect(results.length).toBe(loadRoutes().length)
  })

  it('the error model holds: a bad id rejects with a CD-113 error shape', async () => {
    const gw = new MockApiGateway()
    let threw: unknown
    try {
      await gw.request('projects.get', { params: { id: 'nope-xyz' } })
    } catch (e) {
      threw = e
    }
    expect(threw).toBeDefined()
    const shaped = {
      code: (threw as { code?: string }).code,
      message: String((threw as Error).message),
      retryable: (threw as { retryable?: boolean }).retryable,
    }
    const ok = errorValidator(shaped)
    expect(ok, `error shape invalid: ${ajv.errorsText(errorValidator.errors)}`).toBe(true)
    expect(shaped.code).toBe('not_found')
  })

  it('the suite is gateway-parameterized (same call shape for M5 engine)', async () => {
    // Demonstrate the parameterization seam: a second mock instance runs identically.
    const results = await runContractSuite(() => new MockApiGateway())
    expect(results.every((r) => r.ok)).toBe(true)
  })
})
