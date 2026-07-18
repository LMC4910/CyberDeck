// Player-preview device specs (CD-417). The three reference devices the preview
// renders the published layout on, each with its native PORTRAIT pixel resolution;
// landscape swaps the axes. Deck Mini is a landscape-native handheld, so its portrait
// is the tall orientation. These are presentation-only (the real device roster comes
// from DeviceRepository at M5) — enough to letterbox the flattened doc convincingly.
export interface DeviceSpec {
  id: string
  name: string
  deviceClass: string
  /** Native portrait resolution (width < height); landscape swaps w/h. */
  width: number
  height: number
}

export const DEVICE_SPECS: readonly DeviceSpec[] = [
  { id: 'ipad', name: 'iPad', deviceClass: 'tablet', width: 1620, height: 2160 },
  { id: 'pixel', name: 'Pixel', deviceClass: 'phone', width: 1080, height: 2400 },
  { id: 'deckmini', name: 'Deck Mini', deviceClass: 'deck', width: 800, height: 1280 },
]

export type Orientation = 'portrait' | 'landscape'
export const ORIENTATIONS: readonly Orientation[] = ['portrait', 'landscape']

/** Pixel resolution of a device in an orientation (landscape swaps the native axes). */
export function resolutionOf(device: DeviceSpec, orientation: Orientation): { w: number; h: number } {
  return orientation === 'portrait'
    ? { w: device.width, h: device.height }
    : { w: device.height, h: device.width }
}

/** The device spec for an id, or the first spec as a safe fallback. */
export function deviceSpec(id: string): DeviceSpec {
  return DEVICE_SPECS.find((d) => d.id === id) ?? DEVICE_SPECS[0]!
}
