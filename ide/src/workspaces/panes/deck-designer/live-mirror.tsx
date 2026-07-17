// Live Mirror (CD-314). A registered dock tool window: a device-frame thumbnail of
// the board, rendered from the SAME board-model selector as the minimap, so both
// update live on any board change (AC). Cycle through device classes to preview the
// deck at different aspect ratios.
import { useState } from 'react'
import { useProjectModel } from './use-project-model'
import { useBoardModel } from './board-model'
import './live-mirror.css'

interface Device {
  id: string
  label: string
  w: number
  h: number
}

const DEVICES: Device[] = [
  { id: 'ipad', label: 'iPad', w: 1180, h: 820 },
  { id: 'pixel', label: 'Pixel', w: 915, h: 412 },
  { id: 'deck', label: 'Deck', w: 1280, h: 800 },
]

export function LiveMirror({ pageId }: { pageId: string }) {
  const model = useProjectModel()
  const board = useBoardModel(model, pageId)
  const [deviceIndex, setDeviceIndex] = useState(0)
  const device = DEVICES[deviceIndex]!

  const FRAME_W = 240
  const scale = FRAME_W / device.w
  const FRAME_H = device.h * scale
  // Board fills the device frame proportionally to the page bounds.
  const boardScale = board.bounds.w > 0 ? FRAME_W / board.bounds.w : scale

  return (
    <div className="dd-mirror" data-testid="live-mirror">
      <div className="dd-mirror-toolbar">
        <button
          type="button"
          className="dd-mirror-device"
          data-testid="mirror-device"
          aria-label={`Device: ${device.label}. Click to cycle.`}
          onClick={() => setDeviceIndex((i) => (i + 1) % DEVICES.length)}
        >
          {device.label} ▸
        </button>
      </div>
      <div className="dd-mirror-frame" data-device={device.id} style={{ width: FRAME_W, height: FRAME_H }}>
        {board.cells
          .filter((c) => !c.hidden)
          .map((c) => (
            <div
              key={c.id}
              className="dd-mirror-cell"
              data-cell={c.id}
              style={{
                left: (c.frame.x - board.origin.x) * boardScale,
                top: (c.frame.y - board.origin.y) * boardScale,
                width: Math.max(1, c.frame.w * boardScale),
                height: Math.max(1, c.frame.h * boardScale),
                background: c.color ?? undefined,
              }}
            />
          ))}
      </div>
    </div>
  )
}
