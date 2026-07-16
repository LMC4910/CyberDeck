import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, act, fireEvent } from '@testing-library/react'
import { ProjectModel, type WidgetInstance } from '@/shared/project'
import { renderInspector, docWith } from './test-harness'
import { Board } from './board'

function w(id: string): WidgetInstance {
  return { id, type: 'button.action', frame: { x: 0, y: 0, w: 80, h: 60 } }
}

beforeEach(() => {
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = vi.fn()
    Element.prototype.releasePointerCapture = vi.fn()
  }
})

describe('states model (CD-327)', () => {
  it('state overrides persist + restore with the document', () => {
    const model = new ProjectModel(docWith([w('w_aaaaaa')]))
    model.setActiveState('w_aaaaaa', 'hover')
    model.setStateOverride('w_aaaaaa', 'hover', 'opacity', 0.5)
    const restored = ProjectModel.restore(model.serialize())
    expect(restored.stateOf('w_aaaaaa')).toMatchObject({ active: 'hover', ov: { hover: { opacity: 0.5 } } })
  })
})

describe('states inspector + live preview (CD-327)', () => {
  function setup() {
    const view = renderInspector(docWith([w('w_aaaaaa')]))
    act(() => view.engine.selectOnly('w_aaaaaa'))
    return view
  }

  it('selecting a state chip previews it (active state set)', () => {
    const { container, model } = setup()
    expect(container.querySelector('[data-state="hover"]')).toBeTruthy()
    act(() => (container.querySelector('[data-state="hover"]') as HTMLButtonElement).click())
    expect(model.stateOf('w_aaaaaa')!.active).toBe('hover')
  })

  it('editing a delta stores it per-state (undoable)', () => {
    const { container, model, undo } = setup()
    act(() => (container.querySelector('[data-state="pressed"]') as HTMLButtonElement).click())
    const statesSection = [...container.querySelectorAll('.dd-insp-section')].find((s) => s.querySelector('.dd-insp-heading')?.textContent === 'States')!
    const opacityRow = [...statesSection.querySelectorAll('.dd-field')].find((r) => r.textContent?.startsWith('Opacity'))!
    const input = opacityRow.querySelector('input') as HTMLInputElement
    fireEvent.change(input, { target: { value: '0.3' } })
    fireEvent.blur(input)
    expect(model.stateOf('w_aaaaaa')!.ov!.pressed).toMatchObject({ opacity: 0.3 })
    act(() => undo.undo())
    expect(model.stateOf('w_aaaaaa')?.ov?.pressed?.opacity).toBeUndefined()
  })

  it('add + remove custom states', () => {
    const { container, model } = setup()
    act(() => (container.querySelector('[data-testid="add-state"]') as HTMLButtonElement).click())
    const custom = model.stateOf('w_aaaaaa')!.custom!
    expect(custom).toHaveLength(1)
  })
})

describe('states live preview on canvas (CD-327)', () => {
  it('the active state delta toggles cleanly on the board', () => {
    const model = new ProjectModel(docWith([w('w_aaaaaa')]))
    model.setStateOverride('w_aaaaaa', 'hover', 'opacity', 0.4)
    model.setStateOverride('w_aaaaaa', 'hover', 'scale', 1.2)
    const { container } = render(<Board model={model} pageId={model.pages()[0]!.id} />)
    const el = () => container.querySelector('[data-widget="w_aaaaaa"]') as HTMLElement

    // default → no state delta applied
    expect(el().style.opacity).toBe('')
    // preview hover
    act(() => model.setActiveState('w_aaaaaa', 'hover'))
    expect(el().style.opacity).toBe('0.4')
    expect(el().style.transform).toContain('scale(1.2)')
    expect(el()).toHaveAttribute('data-state', 'hover')
    // back to default → delta removed cleanly
    act(() => model.setActiveState('w_aaaaaa', undefined))
    expect(el().style.opacity).toBe('')
    expect(el().style.transform).not.toContain('scale')
  })
})
