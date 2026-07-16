// Canvas view context (CD-314): shares the kernel's CanvasViewBus with the pane and
// the minimap / Live Mirror dock tool windows.
import { createContext, useContext, useSyncExternalStore } from 'react'
import type { CanvasView, CanvasViewBus } from '@/stores'

const CanvasViewContext = createContext<CanvasViewBus | null>(null)
export const CanvasViewProvider = CanvasViewContext.Provider

export function useCanvasViewBus(): CanvasViewBus {
  const bus = useContext(CanvasViewContext)
  if (!bus) throw new Error('useCanvasView must be used within a CanvasViewProvider')
  return bus
}

export function useCanvasView(): CanvasView {
  const bus = useCanvasViewBus()
  return useSyncExternalStore((cb) => bus.subscribe(cb), () => bus.getView())
}
