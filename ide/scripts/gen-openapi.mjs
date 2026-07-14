// CD-114: generate an OpenAPI 3.1 export from the machine-readable route
// registry (shared/schemas/control-plane/routes.v1.json). The registry is the
// source of truth; this export is a consumable artifact (docs / external tools)
// and is regenerated + diff-checked (a lightweight drift guard until CD-115's
// full typegen gate). Run: node scripts/gen-openapi.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const schemasDir = fileURLToPath(new URL('../../shared/schemas', import.meta.url))
const cpDir = join(schemasDir, 'control-plane')
const registry = JSON.parse(readFileSync(join(cpDir, 'routes.v1.json'), 'utf8'))

const SCHEMA_BASE = 'https://cyberdeck.shishir.com/schemas/'
const ref = (rel) => (rel ? { $ref: SCHEMA_BASE + rel } : undefined)

// :param → {param} for OpenAPI path templating
const toOpenApiPath = (p) => p.replace(/:([a-zA-Z0-9_]+)/g, '{$1}')
const pathParams = (p) =>
  [...p.matchAll(/:([a-zA-Z0-9_]+)/g)].map((m) => ({
    name: m[1],
    in: 'path',
    required: true,
    schema: { type: 'string' },
  }))

const paths = {}
for (const r of registry.routes) {
  const oaPath = toOpenApiPath(r.path)
  paths[oaPath] ??= {}
  const op = {
    operationId: r.id,
    summary: r.summary ?? r.id,
    parameters: pathParams(r.path),
    responses: {
      '200': {
        description: r.kind === 'subscription' ? 'event stream frame' : 'ok',
        ...((r.response || r.event) && {
          content: { 'application/json': { schema: ref(r.response || r.event) } },
        }),
      },
      ...Object.fromEntries(
        (r.errors ?? []).map((code) => [
          code === 'not_found' ? '404' : code === 'unauthorized' ? '401' : 'default',
          { description: code },
        ]),
      ),
    },
    ...(r.kind === 'subscription' && { 'x-cyberdeck-stream': true }),
  }
  if (r.request) {
    op.requestBody = {
      required: true,
      content: { 'application/json': { schema: ref(r.request) } },
    }
  }
  paths[oaPath][r.method.toLowerCase()] = op
}

const openapi = {
  openapi: '3.1.0',
  info: {
    title: 'CyberDeck Control Plane',
    version: `1.${registry.version}.0`,
    description:
      'Generated from shared/schemas/control-plane/routes.v1.json (CD-114). Do not edit by hand — run ide/scripts/gen-openapi.mjs.',
  },
  paths,
}

const out = join(cpDir, 'openapi.v1.json')
writeFileSync(out, JSON.stringify(openapi, null, 2) + '\n')
console.log(`wrote ${out} (${registry.routes.length} routes)`)
