import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Ajv2020 } from 'ajv/dist/2020'
import { ProjectModel, type WidgetInstance } from '@/shared/project'
import { createSelectionStore, SelectionEngine } from '@/stores'
import { UndoStack } from '@/platform/undo'
import { newStyleFromWidget, linkStyle, unlinkStyle, setStyleProp, effectiveStyleProps, linkedStyleId } from './style-ops'

const schema = JSON.parse(readFileSync(resolve(process.cwd(), '..', 'shared/schemas/documents/project.schema.json'), 'utf8'))
const validateSchema = new Ajv2020({ strict: false, allErrors: true }).compile(schema)

function w(id: string, x: number): WidgetInstance {
  return { id, type: 'button.action', frame: { x, y: 0, w: 60, h: 40 }, config: { fill: { color: '#111' } } }
}

function setup() {
  const model = new ProjectModel({
    format: 'cyberdeck.project',
    version: 1,
    meta: { name: 'S' },
    pages: [{ id: 'page_stytst', name: 'P', canvas: { w: 800, h: 600 }, widgets: [w('w_aaaaaa', 0), w('w_bbbbbb', 100), w('w_cccccc', 200)] }],
  })
  const engine = new SelectionEngine(createSelectionStore())
  const undo = new UndoStack()
  return { model, engine, undo, ctx: { model, undo, engine } }
}

describe('shared styles (CD-321)', () => {
  it('editing a style propagates to every linked widget; ref count is live', () => {
    const { model, ctx } = setup()
    const styleId = newStyleFromWidget(ctx, 'w_aaaaaa', 'fill', 'Brand')!
    linkStyle(ctx, 'w_bbbbbb', 'fill', styleId)
    linkStyle(ctx, 'w_cccccc', 'fill', styleId)
    expect(model.styleRefCount(styleId)).toBe(3)

    setStyleProp(ctx, styleId, 'color', '#ff0000')
    // all three resolve the new value from the ONE registry entry
    for (const id of ['w_aaaaaa', 'w_bbbbbb', 'w_cccccc']) {
      expect(effectiveStyleProps(model, model.widget(id)!, 'fill').color).toBe('#ff0000')
    }
  })

  it('new-from-selection seeds props from the widget config and links it', () => {
    const { model, ctx } = setup()
    const styleId = newStyleFromWidget(ctx, 'w_aaaaaa', 'fill', 'Brand')!
    expect(linkedStyleId(model.widget('w_aaaaaa')!, 'fill')).toBe(styleId)
    expect(model.style(styleId)!.props!.color).toBe('#111') // seeded
  })

  it('detach drops the link and the ref count (undoable)', () => {
    const { model, undo, ctx } = setup()
    const styleId = newStyleFromWidget(ctx, 'w_aaaaaa', 'fill', 'Brand')!
    linkStyle(ctx, 'w_bbbbbb', 'fill', styleId)
    expect(model.styleRefCount(styleId)).toBe(2)
    unlinkStyle(ctx, 'w_bbbbbb', 'fill')
    expect(model.styleRefCount(styleId)).toBe(1)
    undo.undo()
    expect(model.styleRefCount(styleId)).toBe(2)
  })

  it('removing a style unlinks every widget (undoable)', () => {
    const { model, undo, ctx } = setup()
    const styleId = newStyleFromWidget(ctx, 'w_aaaaaa', 'fill', 'Brand')!
    linkStyle(ctx, 'w_bbbbbb', 'fill', styleId)
    undo.execUndoable('rm', () => model.removeStyle(styleId))
    expect(model.style(styleId)).toBeUndefined()
    expect(linkedStyleId(model.widget('w_aaaaaa')!, 'fill')).toBeUndefined()
    expect(model.validate()).toEqual([])
    undo.undo()
    expect(model.style(styleId)).toBeDefined()
    expect(model.styleRefCount(styleId)).toBe(2)
  })

  it('a dangling style link is flagged by validate', () => {
    const { model } = setup()
    model.linkStyle('w_aaaaaa', 'fill', 'sty_ghost1')
    expect(model.validate().some((d) => d.code === 'dangling-ref')).toBe(true)
  })

  it('serializes to a schema-valid document (new styles field)', () => {
    const { model, ctx } = setup()
    const styleId = newStyleFromWidget(ctx, 'w_aaaaaa', 'fill', 'Brand')!
    linkStyle(ctx, 'w_bbbbbb', 'fill', styleId)
    const doc = model.serialize()
    const ok = validateSchema(doc)
    expect(validateSchema.errors ?? []).toEqual([])
    expect(ok).toBe(true)
  })
})
