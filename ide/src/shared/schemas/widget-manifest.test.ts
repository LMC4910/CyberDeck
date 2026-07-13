// CD-110: the 3 canon widget manifests validate against widget-manifest v2;
// invalid fixtures (undeclared permission, bad semver, poll w/o interval)
// are rejected. Go-side twin: engine/core/schemas/widget_manifest_test.go.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Ajv2020 } from 'ajv/dist/2020'

const schemasDir = join(__dirname, '..', '..', '..', '..', 'shared', 'schemas')
const widgetsDir = join(schemasDir, 'widgets')
const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>

const ajv = new Ajv2020({ strict: false, allErrors: true })
const validate = ajv.compile(readJson(join(schemasDir, 'widget-manifest.schema.json')))

describe('widget manifest v2', () => {
  const canon = readdirSync(widgetsDir).filter((f) => f.endsWith('.manifest.json'))
  const invalid = readdirSync(join(widgetsDir, 'fixtures')).filter((f) =>
    f.startsWith('invalid-'),
  )

  it('has the 3 canon manifests', () => {
    expect(canon.sort()).toEqual([
      'button.action.manifest.json',
      'gauge.circular.manifest.json',
      'media.nowplaying.manifest.json',
    ])
  })

  it.each(canon)('accepts %s', (file) => {
    const manifest = readJson(join(widgetsDir, file))
    const ok = validate(manifest)
    expect(validate.errors ?? []).toEqual([])
    expect(ok).toBe(true)
    // manifest id must match the filename
    expect(file).toBe(`${manifest.id as string}.manifest.json`)
  })

  it.each(invalid)('rejects %s', (file) => {
    expect(validate(readJson(join(widgetsDir, 'fixtures', file)))).toBe(false)
  })

  it.each(canon)('defaults in %s validate against its own configSchema', (file) => {
    const manifest = readJson(join(widgetsDir, file))
    if (manifest.configSchema && manifest.defaults) {
      const validateConfig = ajv.compile(manifest.configSchema as object)
      expect(validateConfig(manifest.defaults)).toBe(true)
    }
  })
})
