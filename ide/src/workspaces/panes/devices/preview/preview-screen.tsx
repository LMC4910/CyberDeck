// Full-screen player preview (CD-417). Flattens the current project to a published
// layout (CD-416) and renders it in a chosen device frame + orientation, with a device
// selector and a rotate toggle. Closes back to the device cards. On mocks it flattens
// the starter project; the assigned-layout-per-device path lands with CD-418.
import { useMemo, useState } from 'react'
import type { CyberDeckPublishedLayoutDocumentCyberdeckLayout as LayoutDocument } from '@/shared/contract'
import { PlayerPreview } from './player-preview'
import { DEVICE_SPECS, deviceSpec, type Orientation } from './device-specs'
import type { TouchSimEvent } from './touch-sim'
import './preview.css'

const MAX_EVENTS = 6

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
  const [touch, setTouch] = useState(false)
  const [events, setEvents] = useState<TouchSimEvent[]>([])
  const device = useMemo(() => deviceSpec(deviceId), [deviceId])

  const onTouch = (e: TouchSimEvent) => setEvents((prev) => [e, ...prev].slice(0, MAX_EVENTS))

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
        <button
          type="button"
          className="pv-touch-toggle"
          aria-pressed={touch}
          data-testid="touch-toggle"
          onClick={() => setTouch((t) => !t)}
        >
          {touch ? '✋ Touch: on' : '✋ Touch: off'}
        </button>
        <button type="button" className="pv-close" aria-label="Close preview" onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="pv-stage">
        <PlayerPreview
          layout={layout}
          device={device}
          orientation={orientation}
          interactive={touch}
          onTouch={onTouch}
        />
        {touch && (
          <aside className="pv-events" aria-label="Touch events" data-testid="touch-events">
            <header className="pv-events__head">Events</header>
            {events.length === 0 ? (
              <p className="pv-events__empty">Press a widget to simulate touch.</p>
            ) : (
              <ol className="pv-events__list">
                {events.map((e, i) => (
                  <li key={`${e.ts}-${i}`} data-event-widget={e.widgetId} data-event-gesture={e.gesture}>
                    <code>{e.widgetId}</code> — {e.verb}
                  </li>
                ))}
              </ol>
            )}
          </aside>
        )}
      </div>
    </div>
  )
}
