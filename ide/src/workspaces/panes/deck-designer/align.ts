// Align + distribute math (CD-312). Pure: given the selected widgets' frames, return
// the new frame for each. The inspector applies the result in one undo entry.
import type { Frame } from '@/shared/project'

export type AlignKind = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom'
export type DistributeKind = 'horizontal' | 'vertical'

interface Item {
  id: string
  frame: Frame
}

export function alignFrames(items: Item[], kind: AlignKind): Map<string, Frame> {
  const out = new Map<string, Frame>()
  if (items.length < 2) return out
  const minX = Math.min(...items.map((i) => i.frame.x))
  const maxR = Math.max(...items.map((i) => i.frame.x + i.frame.w))
  const minY = Math.min(...items.map((i) => i.frame.y))
  const maxB = Math.max(...items.map((i) => i.frame.y + i.frame.h))
  const cx = (minX + maxR) / 2
  const cy = (minY + maxB) / 2
  for (const { id, frame } of items) {
    let { x, y } = frame
    switch (kind) {
      case 'left': x = minX; break
      case 'right': x = maxR - frame.w; break
      case 'hcenter': x = cx - frame.w / 2; break
      case 'top': y = minY; break
      case 'bottom': y = maxB - frame.h; break
      case 'vcenter': y = cy - frame.h / 2; break
    }
    if (x !== frame.x || y !== frame.y) out.set(id, { ...frame, x, y })
  }
  return out
}

export function distributeFrames(items: Item[], kind: DistributeKind): Map<string, Frame> {
  const out = new Map<string, Frame>()
  if (items.length < 3) return out
  const horizontal = kind === 'horizontal'
  const sorted = [...items].sort((a, b) =>
    horizontal ? a.frame.x - b.frame.x : a.frame.y - b.frame.y,
  )
  const first = sorted[0]!.frame
  const last = sorted[sorted.length - 1]!.frame
  const start = horizontal ? first.x : first.y
  const end = horizontal ? last.x : last.y
  const gap = (end - start) / (sorted.length - 1)
  sorted.forEach((item, i) => {
    if (i === 0 || i === sorted.length - 1) return
    const pos = start + gap * i
    const cur = horizontal ? item.frame.x : item.frame.y
    if (pos !== cur) {
      out.set(item.id, horizontal ? { ...item.frame, x: pos } : { ...item.frame, y: pos })
    }
  })
  return out
}
