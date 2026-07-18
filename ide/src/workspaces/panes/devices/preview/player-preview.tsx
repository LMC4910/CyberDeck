// Player preview frame (CD-417). One device × one orientation: a letterboxed screen
// (locked to the device's pixel aspect) rendering the published layout, with a footer
// readout of device / resolution / orientation / scale / layout name. The rotate
// animation is a CSS transition on the aspect change (data-orientation).
import type { CyberDeckPublishedLayoutDocumentCyberdeckLayout as LayoutDocument } from '@/shared/contract'
import { LayoutView } from './layout-view'
import { resolutionOf, type DeviceSpec, type Orientation } from './device-specs'
import type { TouchSimEvent } from './touch-sim'

/** Nominal on-screen frame height (px) the scale readout is computed against. */
const FRAME_H = 460

export interface PlayerPreviewProps {
  layout: LayoutDocument
  device: DeviceSpec
  orientation: Orientation
  /** Touch-simulation mode (CD-418). */
  interactive?: boolean
  onTouch?: (event: TouchSimEvent) => void
}

export function PlayerPreview({ layout, device, orientation, interactive, onTouch }: PlayerPreviewProps) {
  const res = resolutionOf(device, orientation)
  const scale = FRAME_H / res.h
  const layoutName = layout.pages[0]?.id ?? '—'

  return (
    <figure
      className="pv-frame"
      data-device={device.id}
      data-orientation={orientation}
      data-testid={`preview-${device.id}-${orientation}`}
    >
      <div className="pv-screen" style={{ aspectRatio: `${res.w} / ${res.h}`, height: FRAME_H }}>
        <LayoutView layout={layout} interactive={interactive} onTouch={onTouch} />
      </div>
      <figcaption className="pv-readout">
        <span className="pv-readout__device">{device.name}</span>
        <span data-readout="res">
          {res.w}×{res.h}
        </span>
        <span data-readout="orientation">{orientation}</span>
        <span data-readout="scale">{scale.toFixed(2)}×</span>
        <span data-readout="layout">{layoutName}</span>
      </figcaption>
    </figure>
  )
}
