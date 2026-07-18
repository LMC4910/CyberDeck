// CD-416 publish/flatten v0 — the CONTRACT test suite. These goldens ARE the spec
// the Go engine port (CD-506) must reproduce byte-for-byte, so every assertion here
// is deliberately exhaustive and exact.
//
//   • Golden cases live at repo-root `shared/goldens/publish/<case>/` so the future
//     Go test (engine/core/publish) reads the identical fixtures:
//         project.json           — input cyberdeck.project (authoring truth)
//         options.json           — the exact FlattenOptions (no clock/RNG in the lib)
//         expected/<deviceId>.layout.json — canonical, byte-stable output per device
//   • Regenerate expected goldens with `UPDATE_GOLDENS=1 pnpm vitest run src/shared/publish`.
//     Commit the result; a bare `pnpm vitest run src/shared/publish` then asserts the
//     bytes never move.
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { Ajv2020 } from 'ajv/dist/2020'
import { flattenProject, canonicalStringify, CircularComponentError, type FlattenOptions } from './index'
import type { ProjectDocument } from '@/shared/project'

// repo root is four levels up from ide/src/shared/publish/
const repoRoot = join(__dirname, '..', '..', '..', '..')
const goldensDir = join(repoRoot, 'shared', 'goldens', 'publish')
const schemasDir = join(repoRoot, 'shared', 'schemas', 'documents')

const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
const ajv = new Ajv2020({ strict: false, allErrors: true })
const validateLayout = ajv.compile(readJson(join(schemasDir, 'layout.schema.json')))
const validateProject = ajv.compile(readJson(join(schemasDir, 'project.schema.json')))

const UPDATE = process.env.UPDATE_GOLDENS === '1'

const caseDirs = readdirSync(goldensDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort()

describe('publish/flatten v0 goldens (CD-416)', () => {
  it('has golden cases to check', () => {
    expect(caseDirs.length).toBeGreaterThanOrEqual(5)
  })

  describe.each(caseDirs)('case: %s', (name) => {
    const dir = join(goldensDir, name)
    const project = readJson(join(dir, 'project.json')) as unknown as ProjectDocument
    const options = readJson(join(dir, 'options.json')) as unknown as FlattenOptions
    const expectedDir = join(dir, 'expected')

    const results = flattenProject(project, options)

    it('input project.json is a valid cyberdeck.project', () => {
      const ok = validateProject(project)
      expect(validateProject.errors ?? []).toEqual([])
      expect(ok).toBe(true)
    })

    it('flattens one layout per assigned device, in device order', () => {
      const producedIds = results.map((r) => r.deviceId)
      const declaredIds = (project.devices ?? []).map((d) => d.id)
      expect(producedIds).toEqual(declaredIds)
    })

    if (UPDATE) {
      it(`regenerates ${name} goldens`, () => {
        if (existsSync(expectedDir)) rmSync(expectedDir, { recursive: true })
        mkdirSync(expectedDir, { recursive: true })
        for (const r of results) {
          const id = r.deviceId ?? r.deviceClass
          writeFileSync(join(expectedDir, `${id}.layout.json`), canonicalStringify(r.layout))
        }
        expect(true).toBe(true)
      })
      return
    }

    it('produces exactly the expected set of device layout files', () => {
      const producedFiles = results.map((r) => `${r.deviceId ?? r.deviceClass}.layout.json`).sort()
      const expectedFiles = readdirSync(expectedDir).sort()
      expect(producedFiles).toEqual(expectedFiles)
    })

    for (const r of results) {
      const id = r.deviceId ?? r.deviceClass
      describe(`device ${id}`, () => {
        const goldenPath = join(expectedDir, `${id}.layout.json`)
        const golden = readFileSync(goldenPath, 'utf8')

        it('flatten output is byte-identical to the frozen golden', () => {
          expect(canonicalStringify(r.layout)).toBe(golden)
        })

        it('golden is stored with LF line endings and no trailing newline (byte contract)', () => {
          expect(golden.includes('\r')).toBe(false)
          expect(golden.endsWith('\n')).toBe(false)
        })

        it('flattened layout validates against the cyberdeck.layout schema', () => {
          const ok = validateLayout(r.layout)
          expect(validateLayout.errors ?? []).toEqual([])
          expect(ok).toBe(true)
        })

        it('re-parsing the golden yields the same value the flattener produced (round-trip)', () => {
          expect(JSON.parse(golden)).toEqual(r.layout)
        })
      })
    }
  })
})

describe('canonicalStringify — the byte-stable serialization contract', () => {
  it('emits object keys in ascending code-unit order regardless of insertion order', () => {
    expect(canonicalStringify({ b: 1, a: 2, c: 3 })).toBe('{\n  "a": 2,\n  "b": 1,\n  "c": 3\n}')
  })

  it('is stable across two different insertion orders of the same object', () => {
    const a = canonicalStringify({ z: 1, m: { y: 2, x: 3 }, a: 4 })
    const b = canonicalStringify({ a: 4, m: { x: 3, y: 2 }, z: 1 })
    expect(a).toBe(b)
  })

  it('uses two-space indentation, LF, and no trailing newline', () => {
    const out = canonicalStringify({ a: { b: 1 } })
    expect(out).toBe('{\n  "a": {\n    "b": 1\n  }\n}')
    expect(out.endsWith('\n')).toBe(false)
  })

  it('serializes an empty object and empty array with no interior whitespace', () => {
    expect(canonicalStringify({})).toBe('{}')
    expect(canonicalStringify([])).toBe('[]')
    expect(canonicalStringify({ a: {}, b: [] })).toBe('{\n  "a": {},\n  "b": []\n}')
  })

  it('omits properties whose value is undefined (never coerced to null)', () => {
    expect(canonicalStringify({ a: 1, b: undefined, c: 3 })).toBe('{\n  "a": 1,\n  "c": 3\n}')
  })

  it('coerces explicit undefined / holes inside arrays to null', () => {
    expect(canonicalStringify([1, undefined, 3])).toBe('[\n  1,\n  null,\n  3\n]')
  })

  it('does NOT HTML-escape < > & (Go must SetEscapeHTML(false))', () => {
    expect(canonicalStringify({ html: '<a href="x">&amp;</a>' })).toBe(
      '{\n  "html": "<a href=\\"x\\">&amp;</a>"\n}',
    )
  })

  it('emits null, booleans, and integers as plain JSON scalars', () => {
    expect(canonicalStringify({ a: null, b: true, c: false, d: 0, e: -7, f: 100 })).toBe(
      '{\n  "a": null,\n  "b": true,\n  "c": false,\n  "d": 0,\n  "e": -7,\n  "f": 100\n}',
    )
  })
})

describe('flatten — circular component nesting', () => {
  const base: ProjectDocument = {
    format: 'cyberdeck.project',
    version: 1,
    meta: { name: 'Cycle' },
    pages: [
      {
        id: 'page_cyc001',
        name: 'Cycle',
        widgets: [
          { id: 'w_inst001a', type: 'core.instance', frame: { x: 0, y: 0, w: 100, h: 100 }, component: 'cmp_aaa001' },
        ],
      },
    ],
    components: [
      {
        id: 'cmp_aaa001',
        name: 'A',
        widgets: [{ id: 'w_tmpla01', type: 'core.instance', frame: { x: 0, y: 0, w: 50, h: 50 }, component: 'cmp_bbb001' }],
      },
      {
        id: 'cmp_bbb001',
        name: 'B',
        widgets: [{ id: 'w_tmplb01', type: 'core.instance', frame: { x: 0, y: 0, w: 50, h: 50 }, component: 'cmp_aaa001' }],
      },
    ],
    devices: [{ id: 'dev_cyc0001', deviceClass: 'ipad', pageId: 'page_cyc001' }],
  }

  it('throws CircularComponentError instead of looping forever', () => {
    expect(() => flattenProject(base, { version: 1 })).toThrow(CircularComponentError)
  })
})
