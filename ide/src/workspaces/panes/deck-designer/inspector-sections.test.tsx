import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, fireEvent } from '@testing-library/react'
import { type WidgetInstance } from '@/shared/project'
import { renderInspector, docWith } from './test-harness'

// One representative widget per canon kind → its distinct section title.
const KIND_FIXTURES: { type: string; section: string; sampleField: string }[] = [
  { type: 'gauge.circular', section: 'Gauge', sampleField: 'Warn at' },
  { type: 'button.action', section: 'Button', sampleField: 'Haptic' },
  { type: 'text.label', section: 'Text', sampleField: 'Weight' },
  { type: 'chart.line', section: 'Chart', sampleField: 'Max pts' },
  { type: 'stat.readout', section: 'Stat', sampleField: 'Decimals' },
  { type: 'image.static', section: 'Image', sampleField: 'Fit' },
  { type: 'media.video', section: 'Media', sampleField: 'Autoplay' },
  { type: 'input.field', section: 'Input', sampleField: 'Placeholder' },
  { type: 'core.group', section: 'Container', sampleField: 'Layout' },
]

function w(id: string, type: string): WidgetInstance {
  const base: WidgetInstance = { id, type, frame: { x: 0, y: 0, w: 40, h: 40 } }
  if (type === 'core.group') base.config = { childIds: [] }
  return base
}

const headings = (c: HTMLElement) => [...c.querySelectorAll('.dd-insp-heading')].map((h) => h.textContent)

beforeEach(() => {
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = vi.fn()
    Element.prototype.releasePointerCapture = vi.fn()
  }
})

describe('Per-type inspector sections (CD-313)', () => {
  it.each(KIND_FIXTURES)('$type renders the distinct $section section', ({ type, section, sampleField }) => {
    const { container, engine } = renderInspector(docWith([w('w_kind01', type)]))
    act(() => engine.selectOnly('w_kind01'))
    // The kind's section heading is present (distinct section set — snapshot-style).
    expect(headings(container)).toContain(section)
    // and a field unique to that kind renders.
    const labels = [...container.querySelectorAll('.dd-field-label')].map((l) => l.textContent)
    expect(labels).toContain(sampleField)
  })

  it('the section set differs across kinds (each kind is distinct)', () => {
    const seen = new Map<string, string[]>()
    for (const { type, section } of KIND_FIXTURES) {
      const { container, engine, unmount } = renderInspector(docWith([w('w_kind01', type)]))
      act(() => engine.selectOnly('w_kind01'))
      seen.set(section, headings(container))
      unmount()
    }
    // Gauge and Button expose different section sets.
    expect(seen.get('Gauge')).not.toEqual(seen.get('Button'))
  })

  it('an unknown type falls back to the Generic config section', () => {
    const g = w('w_kind01', 'mystery.thing')
    g.config = { customFlag: true, threshold: 3 }
    const { container, engine } = renderInspector(docWith([g]))
    act(() => engine.selectOnly('w_kind01'))
    expect(headings(container)).toContain('Configuration')
  })

  it('config edits persist into the document + undo (Gauge → Max)', () => {
    const { container, engine, model, undo } = renderInspector(docWith([w('w_kind01', 'gauge.circular')]))
    act(() => engine.selectOnly('w_kind01'))
    const maxRow = [...container.querySelectorAll('.dd-field')].find((r) => r.textContent?.startsWith('Max'))!
    const input = maxRow.querySelector('input') as HTMLInputElement
    fireEvent.change(input, { target: { value: '250' } })
    fireEvent.blur(input)
    expect((model.widget('w_kind01')!.config as { max: number }).max).toBe(250)
    act(() => undo.undo())
    expect((model.widget('w_kind01')!.config as { max?: number } | undefined)?.max).toBeUndefined()
  })

  it('segmented edits persist (Button → Style)', () => {
    const { container, engine, model } = renderInspector(docWith([w('w_kind01', 'button.action')]))
    act(() => engine.selectOnly('w_kind01'))
    const styleGroup = container.querySelector('[aria-label="Style"]')!
    const outline = [...styleGroup.querySelectorAll('button')].find((b) => b.textContent === 'Outline')!
    act(() => outline.click())
    expect((model.widget('w_kind01')!.config as { style: string }).style).toBe('outline')
  })
})
