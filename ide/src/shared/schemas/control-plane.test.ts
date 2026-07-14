// CD-113: control-plane envelope, error model and route-registry format
// validate their fixtures. The envelope $refs the error schema, so it is
// registered first. Go twin: engine/core/schemas/control_plane_test.go.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Ajv2020 } from 'ajv/dist/2020'

const cpDir = join(__dirname, '..', '..', '..', '..', 'shared', 'schemas', 'control-plane')
const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>

const ajv = new Ajv2020({ strict: false, allErrors: true })
// error is referenced by envelope via $id — register before compiling envelope.
ajv.addSchema(readJson(join(cpDir, 'error.schema.json')))
const validators = {
  envelope: ajv.compile(readJson(join(cpDir, 'envelope.schema.json'))),
  error: ajv.getSchema('https://cyberdeck.shishir.com/schemas/control-plane/error.schema.json')!,
  'route-registry': ajv.compile(readJson(join(cpDir, 'route-registry.schema.json'))),
} as const

describe.each(['envelope', 'error', 'route-registry'] as const)('control-plane: %s', (name) => {
  const validate = validators[name]
  const fixtureDir = join(cpDir, 'fixtures', name)
  const fixtures = readdirSync(fixtureDir)
  const valid = fixtures.filter((f) => f.startsWith('valid-'))
  const invalid = fixtures.filter((f) => f.startsWith('invalid-'))

  it('has >=2 valid and >=2 invalid fixtures', () => {
    expect(valid.length).toBeGreaterThanOrEqual(2)
    expect(invalid.length).toBeGreaterThanOrEqual(2)
  })

  it.each(valid)('accepts %s', (f) => {
    const ok = validate(readJson(join(fixtureDir, f)))
    expect(validate.errors ?? []).toEqual([])
    expect(ok).toBe(true)
  })

  it.each(invalid)('rejects %s', (f) => {
    expect(validate(readJson(join(fixtureDir, f)))).toBe(false)
  })
})
