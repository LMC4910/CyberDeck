// CD-108: TS-side validation of the six config-area schemas + fixtures in
// shared/schemas/config (the Go-side twin lives in engine/core/schemas).
// Every valid-*.json fixture must pass its schema; every invalid-*.json must
// fail. The feature-flags schema must mirror the design's FLAGDEFS() exactly.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Ajv2020 } from 'ajv/dist/2020'

const configDir = join(__dirname, '..', '..', '..', '..', 'shared', 'schemas', 'config')
const areas = [
  'application',
  'user-prefs',
  'workspace-layout',
  'session',
  'feature-flags',
  'keymap',
] as const

const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>

// strict:false — schemas carry the x-editability annotation from 01 §4
const ajv = new Ajv2020({ strict: false, allErrors: true })

describe.each(areas)('config schema: %s', (area) => {
  const schema = readJson(join(configDir, `${area}.schema.json`))
  const validate = ajv.compile(schema)
  const fixtureDir = join(configDir, 'fixtures', area)
  const fixtures = readdirSync(fixtureDir)

  const valid = fixtures.filter((f) => f.startsWith('valid-'))
  const invalid = fixtures.filter((f) => f.startsWith('invalid-'))

  it('has at least 2 valid and 2 invalid fixtures', () => {
    expect(valid.length).toBeGreaterThanOrEqual(2)
    expect(invalid.length).toBeGreaterThanOrEqual(2)
  })

  it.each(valid)('accepts %s', (fixture) => {
    const ok = validate(readJson(join(fixtureDir, fixture)))
    expect(validate.errors ?? []).toEqual([])
    expect(ok).toBe(true)
  })

  it.each(invalid)('rejects %s', (fixture) => {
    expect(validate(readJson(join(fixtureDir, fixture)))).toBe(false)
  })
})

describe('feature-flags schema mirrors FLAGDEFS()', () => {
  // Transcribed from design/CyberDeck IDE (Phase 4).dc.html FLAGDEFS() (line ~2613)
  const FLAGDEFS: Record<string, boolean> = {
    expWidgets: false,
    devTools: true,
    aiProviders: true,
    marketplace: false,
    cloudSync: false,
    automation: true,
    pluginSandbox: true,
  }

  const schema = readJson(join(configDir, 'feature-flags.schema.json'))
  const features = (schema.properties as Record<string, unknown>).features as {
    required: string[]
    properties: Record<string, { type: string; default: boolean }>
  }

  it('declares exactly the 7 flag ids', () => {
    expect(Object.keys(features.properties).sort()).toEqual(Object.keys(FLAGDEFS).sort())
    expect([...features.required].sort()).toEqual(Object.keys(FLAGDEFS).sort())
  })

  it.each(Object.entries(FLAGDEFS))('default for %s is %s', (id, on) => {
    expect(features.properties[id]?.type).toBe('boolean')
    expect(features.properties[id]?.default).toBe(on)
  })
})
