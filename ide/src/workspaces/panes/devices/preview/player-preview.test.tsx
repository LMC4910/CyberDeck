import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import type { CyberDeckPublishedLayoutDocumentCyberdeckLayout as LayoutDocument } from '@/shared/contract'
import { PlayerPreview } from './player-preview'
import { PreviewScreen } from './preview-screen'
import { LayoutView } from './layout-view'
import { DEVICE_SPECS, ORIENTATIONS, deviceSpec, resolutionOf } from './device-specs'

function layoutDoc(): LayoutDocument {
  return {
    format: 'cyberdeck.layout',
    version: 1,
    device: { deviceClass: 'preview' },
    pages: [
      {
        id: 'pg_home0001',
        grid: { columns: 12, rows: 8 },
        widgets: [
          { id: 'w_gauge0001', type: 'cyberdeck.gauge', placement: { col: 0, row: 0, colSpan: 3, rowSpan: 2 } },
          { id: 'w_button001', type: 'cyberdeck.button', placement: { col: 3, row: 0 } },
          { id: 'w_stat00001', type: 'cyberdeck.stat', placement: { col: 0, row: 2, colSpan: 2, rowSpan: 1 } },
        ],
      },
    ],
  } as LayoutDocument
}

describe('LayoutView (CD-417)', () => {
  it('renders every published widget and places it on the grid by col/row/span', () => {
    render(<LayoutView layout={layoutDoc()} />)
    const view = screen.getByTestId('layout-view')
    expect(view).toHaveAttribute('data-widget-count', '3')
    const gauge = view.querySelector('[data-widget-id="w_gauge0001"]') as HTMLElement
    expect(gauge).toHaveStyle({ gridColumn: '1 / span 3', gridRow: '1 / span 2' })
    expect(within(gauge).getByText('gauge')).toBeInTheDocument()
  })

  it('signposts an empty page', () => {
    const doc = layoutDoc()
    doc.pages[0]!.widgets = []
    render(<LayoutView layout={doc} />)
    expect(screen.getByText(/no widgets/i)).toBeInTheDocument()
  })
})

describe('PlayerPreview — all 3 × 2 combinations (CD-417 AC)', () => {
  const combos = DEVICE_SPECS.flatMap((d) => ORIENTATIONS.map((o) => [d.id, o] as const))

  it.each(combos)('renders the flattened doc on %s in %s with a correct readout', (deviceId, orientation) => {
    const device = deviceSpec(deviceId)
    const { unmount } = render(<PlayerPreview layout={layoutDoc()} device={device} orientation={orientation} />)

    const frame = screen.getByTestId(`preview-${deviceId}-${orientation}`)
    expect(frame).toHaveAttribute('data-orientation', orientation)
    // the published widgets render inside the frame
    expect(within(frame).getByTestId('layout-view')).toHaveAttribute('data-widget-count', '3')
    // footer readout: device, resolution (orientation-correct), orientation, scale, layout name
    const res = resolutionOf(device, orientation)
    expect(within(frame).getByText(device.name)).toBeInTheDocument()
    expect(within(frame).getByText(`${res.w}×${res.h}`)).toBeInTheDocument()
    expect(within(frame).getByText(orientation)).toBeInTheDocument()
    expect(within(frame).getByText(/×$/)).toBeInTheDocument() // scale like "0.21×"
    expect(within(frame).getByText('pg_home0001')).toBeInTheDocument()
    unmount()
  })

  it('swaps the resolution axes between portrait and landscape', () => {
    const ipad = deviceSpec('ipad')
    expect(resolutionOf(ipad, 'portrait')).toEqual({ w: 1620, h: 2160 })
    expect(resolutionOf(ipad, 'landscape')).toEqual({ w: 2160, h: 1620 })
  })
})

describe('PreviewScreen (CD-417)', () => {
  it('selects a device and rotates orientation', () => {
    render(<PreviewScreen layout={layoutDoc()} onClose={() => {}} />)
    // defaults to the first device, portrait
    expect(screen.getByTestId('preview-ipad-portrait')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Pixel' }))
    expect(screen.getByTestId('preview-pixel-portrait')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /rotate/i }))
    expect(screen.getByTestId('preview-pixel-landscape')).toBeInTheDocument()
  })

  it('closes via the close control', () => {
    let closed = false
    render(<PreviewScreen layout={layoutDoc()} onClose={() => (closed = true)} />)
    fireEvent.click(screen.getByRole('button', { name: /close preview/i }))
    expect(closed).toBe(true)
  })
})
