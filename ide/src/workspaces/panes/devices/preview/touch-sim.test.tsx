import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { CyberDeckPublishedLayoutDocumentCyberdeckLayout as LayoutDocument } from '@/shared/contract'
import { classifyTouch, verbFor } from './touch-sim'
import { LayoutView } from './layout-view'

describe('touch-sim model (CD-418)', () => {
  it('classifies a short press as a tap and a long one as a hold', () => {
    expect(classifyTouch(0, 100)).toBe('tap')
    expect(classifyTouch(0, 500)).toBe('hold')
    expect(classifyTouch(1000, 1600)).toBe('hold')
  })

  it('produces kind-specific verbs (button/toggle/slider/…) and hold verbs', () => {
    expect(verbFor('cyberdeck.button', 'tap')).toBe('pressed')
    expect(verbFor('cyberdeck.toggle', 'tap')).toBe('toggled')
    expect(verbFor('cyberdeck.slider', 'tap')).toBe('adjusted')
    expect(verbFor('cyberdeck.gauge', 'tap')).toBe('tapped gauge')
    expect(verbFor('cyberdeck.button', 'hold')).toBe('held button')
  })
})

function doc(): LayoutDocument {
  return {
    format: 'cyberdeck.layout',
    version: 1,
    device: { deviceClass: 'preview' },
    pages: [
      {
        id: 'pg_home0001',
        grid: { columns: 4, rows: 4 },
        widgets: [{ id: 'w_button001', type: 'cyberdeck.button', placement: { col: 0, row: 0 } }],
      },
    ],
  } as LayoutDocument
}

describe('LayoutView touch mode (CD-418)', () => {
  it('presses a widget (scale) and emits a tap event with its verb', () => {
    const onTouch = vi.fn()
    render(<LayoutView layout={doc()} interactive onTouch={onTouch} />)
    const widget = screen.getByTestId('layout-view').querySelector('[data-widget-id="w_button001"]') as HTMLElement

    fireEvent.pointerDown(widget)
    expect(widget).toHaveAttribute('data-pressed')

    fireEvent.pointerUp(widget)
    expect(widget).not.toHaveAttribute('data-pressed')
    expect(onTouch).toHaveBeenCalledTimes(1)
    expect(onTouch).toHaveBeenCalledWith(
      expect.objectContaining({ widgetId: 'w_button001', gesture: 'tap', verb: 'pressed' }),
    )
  })

  it('does not press or emit when not interactive', () => {
    const onTouch = vi.fn()
    render(<LayoutView layout={doc()} onTouch={onTouch} />)
    const widget = screen.getByTestId('layout-view').querySelector('[data-widget-id="w_button001"]') as HTMLElement
    fireEvent.pointerDown(widget)
    fireEvent.pointerUp(widget)
    expect(widget).not.toHaveAttribute('data-pressed')
    expect(onTouch).not.toHaveBeenCalled()
  })
})
