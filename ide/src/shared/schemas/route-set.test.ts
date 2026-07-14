// CD-114: the route set v1 validates against the route-registry meta-schema,
// every referenced request/response/event schema file exists (referential
// integrity), all 15 event payload schemas compile, and the committed OpenAPI
// export is in sync with the registry (drift guard).
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Ajv2020 } from 'ajv/dist/2020'

const schemasDir = join(__dirname, '..', '..', '..', '..', 'shared', 'schemas')
const cpDir = join(schemasDir, 'control-plane')
const readJson = (p: string) => JSON.parse(readFileSync(p, 'utf8')) as Record<string, unknown>

const ajv = new Ajv2020({ strict: false, allErrors: true })
interface Route {
  id: string
  method: string
  path: string
  kind: string
  request?: string
  response?: string
  event?: string
  errors?: string[]
}
const registry = readJson(join(cpDir, 'routes.v1.json'))
const routes = registry.routes as Route[]

describe('route set v1', () => {
  it('validates against the route-registry meta-schema', () => {
    const validate = ajv.compile(readJson(join(cpDir, 'route-registry.schema.json')))
    const ok = validate(registry)
    expect(validate.errors ?? []).toEqual([])
    expect(ok).toBe(true)
  })

  it('has ~30 routes across the 7 REPOS domains', () => {
    expect(routes.length).toBe(30)
    const domains = new Set(routes.map((r) => r.id.split('.')[0]))
    // projects, variables, widgets, flows, runtime, devices, permissions, ai
    for (const d of ['projects', 'variables', 'widgets', 'flows', 'runtime', 'devices', 'permissions', 'ai']) {
      expect(domains).toContain(d)
    }
  })

  it('every referenced request/response/event schema file exists', () => {
    for (const r of routes) {
      for (const key of ['request', 'response', 'event'] as const) {
        const ref = r[key]
        if (ref) expect(existsSync(join(schemasDir, ref))).toBe(true)
      }
    }
  })

  it('every subscription route declares an event schema', () => {
    for (const r of routes) {
      if (r.kind === 'subscription') expect(r.event).toBeTruthy()
    }
  })
})

describe('event payload schemas', () => {
  const files = readdirSync(join(cpDir, 'events')).filter((f) => f.endsWith('.schema.json'))
  it('all 15 event schemas compile', () => {
    expect(files.length).toBe(15)
    for (const f of files) {
      expect(() => ajv.compile(readJson(join(cpDir, 'events', f)))).not.toThrow()
    }
  })
})

describe('OpenAPI export', () => {
  it('is in sync with the registry (regenerating is a no-op)', () => {
    const before = readFileSync(join(cpDir, 'openapi.v1.json'), 'utf8')
    execFileSync('node', ['scripts/gen-openapi.mjs'], { cwd: join(__dirname, '..', '..', '..') })
    const after = readFileSync(join(cpDir, 'openapi.v1.json'), 'utf8')
    expect(after).toBe(before)
  })
})
