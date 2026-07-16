// CD-304 AC: fuzzed round-trip = deep-equal, and serialize() output validates
// against the cyberdeck.project JSON schema. A randomized op sequence builds a
// document; serialize→restore→serialize must be identical, and every serialization
// must satisfy the schema. Go/engine twin: engine ProjectService save-path tests.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Ajv2020 } from 'ajv/dist/2020'
import { ProjectModel } from './project-model'
import { type WidgetInstance } from './types'

const schemaPath = resolve(process.cwd(), '..', 'shared/schemas/documents/project.schema.json')
const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as Record<string, unknown>
const ajv = new Ajv2020({ strict: false, allErrors: true })
const validateSchema = ajv.compile(schema)

function w(id: string, over: Partial<WidgetInstance> = {}): WidgetInstance {
  return { id, type: 'gauge.circular', frame: { x: 0, y: 0, w: 20, h: 20 }, ...over }
}

// Deterministic LCG so CI is reproducible.
function rng(seed: number) {
  let s = seed >>> 0
  return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
}

function fuzzModel(seed: number, ops = 60): ProjectModel {
  const rnd = rng(seed)
  const pick = <T>(xs: T[]): T | undefined => (xs.length ? xs[Math.floor(rnd() * xs.length)] : undefined)
  const model = ProjectModel.empty(`Fuzz ${seed}`)
  const pageId = model.pages()[0]!.id

  for (let i = 0; i < ops; i++) {
    const ids = model.rootWidgets(pageId).map((x) => x.id)
    const op = Math.floor(rnd() * 9)
    const target = pick(ids)
    try {
      switch (op) {
        case 0:
          model.addWidget(pageId, w(model.newId('widget'), { frame: { x: rnd() * 500, y: rnd() * 500, w: 10 + rnd() * 100, h: 10 + rnd() * 100 } }))
          break
        case 1:
          if (ids.length > 1 && target) model.removeWidget(target)
          break
        case 2:
          if (target) model.updateFrame(target, { x: rnd() * 500, y: rnd() * 500, w: 10 + rnd() * 100, h: 10 + rnd() * 100 })
          break
        case 3:
          if (target) model.setName(target, `Widget ${i}`)
          break
        case 4:
          if (target) model.setLocked(target, rnd() > 0.5)
          break
        case 5:
          if (target) model.setBinding(target, 'value', rnd() > 0.5 ? { mode: 'variable', src: 'cpu.load' } : { mode: 'expression', expr: 'a + b' })
          break
        case 6:
          if (target) {
            model.setActiveState(target, 'hover')
            model.setStateOverride(target, 'hover', 'opacity', rnd())
          }
          break
        case 7:
          if (target) model.setEvent(target, 'tap', model.newId('widget'))
          break
        case 8:
          if (ids.length >= 2) {
            const a = pick(ids)!
            const b = pick(ids.filter((x) => x !== a))
            if (b) model.group(pageId, model.newId('group'), [a, b], { x: 0, y: 0, w: 50, h: 50 })
          }
          break
      }
    } catch {
      // ignore no-op edges (empty selection, etc.)
    }
  }
  return model
}

describe('serialize/restore round-trip (CD-304)', () => {
  const seeds = [1, 7, 42, 128, 999, 2026]

  it.each(seeds)('seed %i: serialize→restore→serialize is deep-equal', (seed) => {
    const model = fuzzModel(seed)
    const once = model.serialize()
    const restored = ProjectModel.restore(once)
    const twice = restored.serialize()
    expect(twice).toEqual(once)
  })

  it.each(seeds)('seed %i: serialization validates against the project schema', (seed) => {
    const doc = fuzzModel(seed).serialize({ savedAt: '2026-07-16T00:00:00Z' })
    const ok = validateSchema(doc)
    expect(validateSchema.errors ?? []).toEqual([])
    expect(ok).toBe(true)
  })

  it.each(seeds)('seed %i: restored model preserves referential integrity', (seed) => {
    const model = fuzzModel(seed)
    const restored = ProjectModel.restore(model.serialize())
    expect(restored.validate()).toEqual([])
  })

  it('restore rejects a document that violates referential closure', () => {
    expect(() =>
      ProjectModel.restore({
        format: 'cyberdeck.project',
        version: 1,
        meta: { name: 'bad' },
        pages: [{ id: 'page_aaaaaa', name: 'P', widgets: [] }],
        locks: ['w_ghost1'],
      }),
    ).toThrow()
  })
})
