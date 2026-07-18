// Full-screen player preview (CD-417). Flattens the current project to a published
// layout (CD-416) and renders it in a chosen device frame + orientation, with a device
// selector and a rotate toggle. Closes back to the device cards. On mocks it flattens
// the starter project; the assigned-layout-per-device path lands with CD-418.
import { useMemo, useState } from 'react'
import type { CyberDeckPublishedLayoutDocumentCyberdeckLayout as LayoutDocument } from '@/shared/contract'
import { PlayerPreview } from './player-preview'
import { DEVICE_SPECS, deviceSpec, type Orientation } from './device-specs'
import './preview.css'

export interface PreviewScreenProps {
  /** The published layout to render (already flattened, CD-416 output). */
  layout: LayoutDocument
  onClose: () => void
  /** Preselected device/orientation (defaults to the first device, portrait). */
  initialDeviceId?: string
}

export function PreviewScreen({ layout, onClose, initialDeviceId }: PreviewScreenProps) {
  const [deviceId, setDeviceId] = useState(initialDeviceId ?? DEVICE_SPECS[0]!.id)
  const [orientation, setOrientation] = useState<Orientation>('portrait')
  const device = useMemo(() => deviceSpec(deviceId), [deviceId])

  return (
    <div className="pv-screen-overlay" role="dialog" aria-modal="true" aria-label="Player preview" data-testid="preview-screen">
      <div className="pv-toolbar">
        <div className="pv-device-tabs" role="tablist" aria-label="Preview device">
          {DEVICE_SPECS.map((d) => (
            <button
              key={d.id}
              type="button"
              role="tab"
              aria-selected={d.id === deviceId}
              className="pv-device-tab"
              onClick={() => setDeviceId(d.id)}
            >
              {d.name}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="pv-rotate"
          onClick={() => setOrientation((o) => (o === 'portrait' ? 'landscape' : 'portrait'))}
        >
          ⟳ Rotate
        </button>
        <button type="button" className="pv-close" aria-label="Close preview" onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="pv-stage">
        <PlayerPreview layout={layout} device={device} orientation={orientation} />
      </div>
    </div>
  )
}
