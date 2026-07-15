import { describe, it, expect, vi } from 'vitest'
import { render, act } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ProjectModel, type ProjectDocument, type WidgetInstance } from '@/shared/project'
import { Board } from './board'
import { useProjectModel } from './use-project-model'

function w(id: string, over: Partial<WidgetInstance> = {}): WidgetInstance {
  return { id, type: 'gauge.circular', frame: { x: 0, y: 0, w: 40, h: 40 }, ...over }
}

function threeWidgetModel() {
  const model = ProjectModel.empty('T')
  const pageId = model.pages()[0]!.id
  model.addWidget(pageId, w('w_aaaaaa', { frame: { x: 0, y: 0, w: 40, h: 40 } }))
  model.addWidget(pageId, w('w_bbbbbb', { frame: { x: 60, y: 0, w: 40, h: 40 } }))
  model.addWidget(pageId, w('w_cccccc', { frame: { x: 120, y: 0, w: 40, h: 40 } }))
  return { model, pageId }
}

describe('Board reconciliation (CD-303)', () => {
  it('renders one frame per widget from the model', () => {
    const { model, pageId } = threeWidgetModel()
    const { container } = render(<Board model={model} pageId={pageId} />)
    expect(container.querySelectorAll('.dd-widget')).toHaveLength(3)
  })

  it('a model change re-renders ONLY the affected widget (render-count)', () => {
    const { model, pageId } = threeWidgetModel()
    const renders = new Map<string, number>()
    const onWidgetRender = (id: string) => renders.set(id, (renders.get(id) ?? 0) + 1)

    render(<Board model={model} pageId={pageId} onWidgetRender={onWidgetRender} />)
    // Each widget painted exactly once on mount.
    expect([...renders.values()]).toEqual([1, 1, 1])

    act(() => {
      model.updateFrame('w_bbbbbb', { x: 60, y: 20, w: 40, h: 40 })
    })

    expect(renders.get('w_bbbbbb')).toBe(2) // the edited widget repainted
    expect(renders.get('w_aaaaaa')).toBe(1) // siblings untouched
    expect(renders.get('w_cccccc')).toBe(1)
  })

  it('reflects the widget frame as an absolute transform + size', () => {
    const { model, pageId } = threeWidgetModel()
    const { container } = render(<Board model={model} pageId={pageId} />)
    const el = container.querySelector('[data-widget="w_bbbbbb"]') as HTMLElement
    expect(el.style.transform).toBe('translate(60px, 0px)')
    expect(el.style.width).toBe('40px')
  })

  it('renders selection ring + lock badge from state', () => {
    const { model, pageId } = threeWidgetModel()
    act(() => {
      model.setLocked('w_aaaaaa', true)
    })
    const { container } = render(
      <Board model={model} pageId={pageId} selectedIds={new Set(['w_bbbbbb'])} />,
    )
    expect(container.querySelector('[data-widget="w_bbbbbb"] .dd-widget-ring')).toBeTruthy()
    expect(container.querySelector('[data-widget="w_aaaaaa"] .dd-widget-lock')).toBeTruthy()
    expect(container.querySelector('[data-widget="w_aaaaaa"]')).toHaveAttribute('data-locked')
  })

  it('adding/removing a widget updates the board list (structural)', () => {
    const { model, pageId } = threeWidgetModel()
    const { container } = render(<Board model={model} pageId={pageId} />)
    act(() => {
      model.addWidget(pageId, w('w_dddddd'))
    })
    expect(container.querySelectorAll('.dd-widget')).toHaveLength(4)
    act(() => {
      model.removeWidget('w_aaaaaa')
    })
    expect(container.querySelectorAll('.dd-widget')).toHaveLength(3)
    expect(container.querySelector('[data-widget="w_aaaaaa"]')).toBeNull()
  })

  it('renders a CD-111 fixture document 1:1', () => {
    // cwd is the ide/ package dir under vitest; the schema fixtures live at repo root.
    const path = resolve(process.cwd(), '..', 'shared/schemas/documents/fixtures/project/valid-nested-component.json')
    const doc = JSON.parse(readFileSync(path, 'utf8')) as ProjectDocument
    const model = new ProjectModel(doc)
    expect(model.validate()).toEqual([]) // fixture is a valid document
    const page = doc.pages[0]!
    const { container } = render(<Board model={model} pageId={page.id} />)

    // Every widget in the fixture page appears, with its exact frame + type + name.
    for (const widget of page.widgets) {
      const el = container.querySelector(`[data-widget="${widget.id}"]`) as HTMLElement
      expect(el, `widget ${widget.id} rendered`).toBeTruthy()
      expect(el).toHaveAttribute('data-type', widget.type)
      expect(el.style.transform).toBe(`translate(${widget.frame.x}px, ${widget.frame.y}px)`)
      expect(el.style.width).toBe(`${widget.frame.w}px`)
      expect(el.style.height).toBe(`${widget.frame.h}px`)
      if (widget.name) expect(el).toHaveAttribute('aria-label', widget.name)
    }
    expect(container.querySelectorAll('.dd-widget')).toHaveLength(page.widgets.length)
  })

  it('useProjectModel throws outside a provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    function Bad() {
      useProjectModel()
      return null
    }
    expect(() => render(<Bad />)).toThrow(/ProjectModelProvider/)
    spy.mockRestore()
  })
})
