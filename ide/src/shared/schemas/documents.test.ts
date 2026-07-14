// CD-111: cyberdeck.project + cyberdeck.layout schemas validate their fixtures
// (incl. the nested-component project and the 3 DPVLAYOUTS-derived layouts);
// invalid fixtures rejected. Go twin: engine/core/schemas/documents_test.go.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Ajv2020 } from 'ajv/dist/2020'

const docsDir = join(__dirname, '..', '..', '..', '..', 'shared', 'schemas', 'documents')
const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
const ajv = new Ajv2020({ strict: false, allErrors: true })
// Compile each schema once — ajv throws if the same $id is compiled twice.
const validators = {
  project: ajv.compile(readJson(join(docsDir, 'project.schema.json'))),
  layout: ajv.compile(readJson(join(docsDir, 'layout.schema.json'))),
} as const

describe.each(['project', 'layout'] as const)('document schema: %s', (doc) => {
  const validate = validators[doc]
  const fixtureDir = join(docsDir, 'fixtures', doc)
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

describe('the 3 DPVLAYOUTS ship as valid layout fixtures', () => {
  it.each(['ipad', 'pixel', 'deck'])('valid-%s.json exists and validates', (dev) => {
    expect(
      validators.layout(readJson(join(docsDir, 'fixtures', 'layout', `valid-${dev}.json`))),
    ).toBe(true)
  })
})
