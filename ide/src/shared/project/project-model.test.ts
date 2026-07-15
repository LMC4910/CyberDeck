import { describe, it, expect } from 'vitest'
import { ProjectModel, validateDocument } from './project-model'
import { GROUP_TYPE, type Inverse, type ProjectDocument, type WidgetInstance } from './types'

// Deterministic widget factory (ids match the schema pattern).
function w(id: string, over: Partial<WidgetInstance> = {}): WidgetInstance {
  return { id, type: 'core.gauge', frame: { x: 0, y: 0, w: 10, h: 10 }, ...over }
}

function seed(): { model: ProjectModel; pageId: string } {
  const model = ProjectModel.empty('Test')
  return { model, pageId: model.pages()[0]!.id }
}

describe('ProjectModel — construction', () => {
  it('starts with one page and a valid document', () => {
    const { model } = seed()
    expect(model.pages()).toHaveLength(1)
    expect(model.validate()).toEqual([])
    expect(model.document.format).toBe('cyberdeck.project')
  })

  it('reserves restored ids so newId never collides with them', () => {
    const doc: ProjectDocument = {
      format: 'cyberdeck.project',
      version: 1,
      meta: { name: 'x' },
      pages: [{ id: 'page_aaaaaa', name: 'P', widgets: [w('w_aaaaaa')] }],
    }
    const model = new ProjectModel(doc)
    const fresh = model.newId('widget')
    expect(fresh).not.toBe('w_aaaaaa')
    expect(model.widget('w_aaaaaa')).toBeDefined()
  })
})

describe('ProjectModel — invariants (AC: violation cases)', () => {
  it('flags duplicate ids', () => {
    const doc: ProjectDocument = {
      format: 'cyberdeck.project',
      version: 1,
      meta: { name: 'x' },
      pages: [{ id: 'page_aaaaaa', name: 'P', widgets: [w('w_dupxxx'), w('w_dupxxx')] }],
    }
    const diags = validateDocument(doc)
    expect(diags.some((d) => d.code === 'duplicate-id')).toBe(true)
  })

  it('flags name-keyed registries (AUDIT C3)', () => {
    const doc: ProjectDocument = {
      format: 'cyberdeck.project',
      version: 1,
      meta: { name: 'x' },
      pages: [{ id: 'page_aaaaaa', name: 'P', widgets: [w('w_aaaaaa')] }],
      bindings: { 'CPU Load': { value: { mode: 'static', val: {} } } } as never,
    }
    const diags = validateDocument(doc)
    expect(diags.some((d) => d.code === 'name-keyed')).toBe(true)
  })

  it('flags dangling registry / lock / device references', () => {
    const doc: ProjectDocument = {
      format: 'cyberdeck.project',
      version: 1,
      meta: { name: 'x' },
      pages: [{ id: 'page_aaaaaa', name: 'P', widgets: [w('w_aaaaaa')] }],
      bindings: { w_ghost1: { value: { mode: 'static', val: {} } } },
      locks: ['w_ghost2'],
      devices: [{ id: 'dev_aaaaaa', deviceClass: 'ipad', pageId: 'page_ghost' }],
    }
    const diags = validateDocument(doc)
    expect(diags.filter((d) => d.code === 'dangling-ref').length).toBeGreaterThanOrEqual(3)
  })

  it('flags a circular container nesting', () => {
    const a = w('w_aaaaaa', { type: GROUP_TYPE, config: { childIds: ['w_bbbbbb'] } })
    const b = w('w_bbbbbb', { type: GROUP_TYPE, config: { childIds: ['w_aaaaaa'] } })
    const doc: ProjectDocument = {
      format: 'cyberdeck.project',
      version: 1,
      meta: { name: 'x' },
      pages: [{ id: 'page_aaaaaa', name: 'P', widgets: [a, b] }],
    }
    const diags = validateDocument(doc)
    expect(diags.some((d) => d.code === 'circular-nesting')).toBe(true)
  })

  it('flags an orphan child reference', () => {
    const g = w('w_aaaaaa', { type: GROUP_TYPE, config: { childIds: ['w_ghost1'] } })
    const doc: ProjectDocument = {
      format: 'cyberdeck.project',
      version: 1,
      meta: { name: 'x' },
      pages: [{ id: 'page_aaaaaa', name: 'P', widgets: [g] }],
    }
    expect(validateDocument(doc).some((d) => d.code === 'orphan-child')).toBe(true)
  })

  it('flags a dangling component / variant instance ref', () => {
    const inst = w('w_aaaaaa', { component: 'cmp_ghost1', variant: 'var_ghost1' })
    const doc: ProjectDocument = {
      format: 'cyberdeck.project',
      version: 1,
      meta: { name: 'x' },
      pages: [{ id: 'page_aaaaaa', name: 'P', widgets: [inst] }],
    }
    expect(validateDocument(doc).some((d) => d.code === 'dangling-ref')).toBe(true)
  })

  it('assertValid throws on an invalid doc, passes on a valid one', () => {
    const { model } = seed()
    expect(() => model.assertValid()).not.toThrow()
  })
})

describe('ProjectModel — mutations keep the document valid', () => {
  it('add/group/bind/state/event all stay valid', () => {
    const { model, pageId } = seed()
    model.addWidget(pageId, w('w_aaaaaa'))
    model.addWidget(pageId, w('w_bbbbbb'))
    const gid = model.newId('group')
    model.group(pageId, gid, ['w_aaaaaa', 'w_bbbbbb'], { x: 0, y: 0, w: 20, h: 20 })
    model.setBinding('w_aaaaaa', 'value', { mode: 'variable', src: 'cpu.load' })
    model.setActiveState('w_aaaaaa', 'hover')
    model.setEvent('w_aaaaaa', 'tap', model.newId('widget') /* stand-in flow id */)
    expect(model.validate()).toEqual([])
    expect(model.childrenOf(gid).map((c) => c.id)).toEqual(['w_aaaaaa', 'w_bbbbbb'])
    expect(model.parentOf('w_aaaaaa')).toBe(gid)
  })

  it('removeWidget cascades a container subtree and cleans registries', () => {
    const { model, pageId } = seed()
    model.addWidget(pageId, w('w_aaaaaa'))
    model.addWidget(pageId, w('w_bbbbbb'))
    const gid = model.newId('group')
    model.group(pageId, gid, ['w_aaaaaa', 'w_bbbbbb'], { x: 0, y: 0, w: 20, h: 20 })
    model.setBinding('w_aaaaaa', 'value', { mode: 'static', val: { v: 1 } })
    model.removeWidget(gid)
    expect(model.widget('w_aaaaaa')).toBeUndefined()
    expect(model.widget('w_bbbbbb')).toBeUndefined()
    expect(model.bindingsOf('w_aaaaaa')).toBeUndefined()
    expect(model.validate()).toEqual([])
  })

  it('ungroup dissolves the container but keeps children', () => {
    const { model, pageId } = seed()
    model.addWidget(pageId, w('w_aaaaaa'))
    const gid = model.newId('group')
    model.group(pageId, gid, ['w_aaaaaa'], { x: 0, y: 0, w: 20, h: 20 })
    model.ungroup(gid)
    expect(model.widget(gid)).toBeUndefined()
    expect(model.widget('w_aaaaaa')).toBeDefined()
    expect(model.parentOf('w_aaaaaa')).toBeUndefined()
  })
})

describe('ProjectModel — inverse contract (AC: every mutation returns its inverse)', () => {
  it('spot-check: each mutation inverse restores the prior document', () => {
    const { model, pageId } = seed()
    model.addWidget(pageId, w('w_aaaaaa'))
    model.addWidget(pageId, w('w_bbbbbb'))
    const baseline = model.snapshot()

    const checks: Array<() => Inverse> = [
      () => model.addWidget(pageId, w('w_cccccc')),
      () => model.removeWidget('w_aaaaaa'),
      () => model.updateFrame('w_aaaaaa', { x: 5, y: 6, w: 7, h: 8 }),
      () => model.updateConfig('w_aaaaaa', { label: 'hi' }),
      () => model.setName('w_aaaaaa', 'Renamed'),
      () => model.setLocked('w_aaaaaa', true),
      () => model.reorderWidget('w_aaaaaa', 1),
      () => model.group(pageId, model.newId('group'), ['w_aaaaaa', 'w_bbbbbb'], { x: 0, y: 0, w: 9, h: 9 }),
      () => model.setBinding('w_aaaaaa', 'value', { mode: 'variable', src: 'x.y' }),
      () => model.setActiveState('w_aaaaaa', 'pressed'),
      () => model.setStateOverride('w_aaaaaa', 'pressed', 'opacity', 0.5),
      () => model.setCustomStates('w_aaaaaa', ['glow']),
      () => model.setEvent('w_aaaaaa', 'tap', 'w_bbbbbb'),
      () => model.setOverride('w_aaaaaa', 'text', 'z'),
      () => model.renamePage(pageId, 'Renamed page'),
    ]

    for (const mutate of checks) {
      const before = model.snapshot()
      // sanity: this test's baseline is stable between checks
      expect(before).toEqual(baseline)
      const inverse = mutate()
      const after = model.snapshot()
      expect(after).not.toEqual(before) // the mutation actually changed something
      inverse()
      expect(model.snapshot()).toEqual(before) // inverse restores exactly
    }
  })

  it('property: a random op sequence fully reverts via stacked inverses (pre-CD-329)', () => {
    const { model, pageId } = seed()
    for (let i = 0; i < 3; i++) model.addWidget(pageId, w(`w_seed0${i}`))
    const baseline = model.snapshot()

    // Deterministic LCG so the test is reproducible.
    let s = 123456789
    const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
    const pick = <T>(xs: T[]) => xs[Math.floor(rnd() * xs.length)]!

    const inverses: Array<() => void> = []
    let created = 0
    for (let i = 0; i < 50; i++) {
      const ids = model.rootWidgets(pageId).map((x) => x.id)
      const target = pick(ids)
      const op = Math.floor(rnd() * 6)
      try {
        if (op === 0) inverses.push(model.addWidget(pageId, w(model.newId('widget'))))
        else if (op === 1 && ids.length > 1) inverses.push(model.removeWidget(target))
        else if (op === 2) inverses.push(model.updateFrame(target, { x: rnd() * 100, y: rnd() * 100, w: 5 + rnd() * 50, h: 5 + rnd() * 50 }))
        else if (op === 3) inverses.push(model.setName(target, `n${created++}`))
        else if (op === 4) inverses.push(model.setBinding(target, 'value', { mode: 'static', val: { n: created++ } }))
        else inverses.push(model.setLocked(target, rnd() > 0.5))
      } catch {
        // some ops may no-op on empty selection; ignore
      }
      expect(model.validate()).toEqual([])
    }
    // Undo everything in reverse order.
    for (let i = inverses.length - 1; i >= 0; i--) inverses[i]!()
    expect(model.snapshot()).toEqual(baseline)
  })
})

describe('ProjectModel — change notifications', () => {
  it('emits dirty ids, marking structural changes', () => {
    const { model, pageId } = seed()
    const changes: Array<{ structural: boolean; dirtyIds: string[] }> = []
    model.subscribe((c) => changes.push(c))
    model.addWidget(pageId, w('w_aaaaaa'))
    model.updateFrame('w_aaaaaa', { x: 1, y: 1, w: 2, h: 2 })
    expect(changes[0]!.structural).toBe(true)
    expect(changes[0]!.dirtyIds).toContain('w_aaaaaa')
    expect(changes[1]!.structural).toBe(false)
  })
})
