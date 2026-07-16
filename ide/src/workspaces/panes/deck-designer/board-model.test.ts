import { describe, it, expect } from 'vitest'
import { ProjectModel, type WidgetInstance } from '@/shared/project'
import { selectBoardModel } from './board-model'

function w(id: string, over: Partial<WidgetInstance> = {}): WidgetInstance {
  return { id, type: 'gauge.circular', frame: { x: 0, y: 0, w: 40, h: 40 }, ...over }
}

function model() {
  return new ProjectModel({
    format: 'cyberdeck.project',
    version: 1,
    meta: { name: 'B' },
    pages: [{ id: 'page_bmtst0', name: 'P', canvas: { w: 800, h: 600 }, widgets: [w('w_aaaaaa'), w('w_bbbbbb', { config: { colorLabel: '#f0f', hidden: true } })] }],
  })
}

describe('selectBoardModel (CD-314)', () => {
  it('projects id/frame/type/color/hidden and the page bounds', () => {
    const b = selectBoardModel(model(), 'page_bmtst0')
    expect(b.bounds).toEqual({ w: 800, h: 600 })
    expect(b.cells).toHaveLength(2)
    expect(b.cells[1]).toMatchObject({ id: 'w_bbbbbb', color: '#f0f', hidden: true })
  })

  it('falls back to the widgets bounding box when the page has no canvas', () => {
    const m = new ProjectModel({
      format: 'cyberdeck.project',
      version: 1,
      meta: { name: 'B' },
      pages: [{ id: 'page_bmtst1', name: 'P', widgets: [w('w_aaaaaa', { frame: { x: 100, y: 50, w: 40, h: 30 } })] }],
    })
    expect(selectBoardModel(m, 'page_bmtst1').bounds).toEqual({ w: 140, h: 80 })
  })

  it('reflects model changes (live)', () => {
    const m = model()
    m.addWidget('page_bmtst0', w('w_cccccc'))
    expect(selectBoardModel(m, 'page_bmtst0').cells.map((c) => c.id)).toContain('w_cccccc')
  })
})
