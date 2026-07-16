// Canvas settings context (CD-307). Exposes the kernel's persisted canvas-settings
// store (snap toggle + grid size) to the authoring panels. The status bar segment
// and the pane both read the same store — one source.
import { createContext, useContext } from 'react'
import { useStore, type Store } from '@/stores'

export interface CanvasSettings {
  snap: boolean
  grid: number
}

const CanvasSettingsContext = createContext<Store<CanvasSettings> | null>(null)
export const CanvasSettingsProvider = CanvasSettingsContext.Provider

export function useCanvasSettingsStore(): Store<CanvasSettings> {
  const store = useContext(CanvasSettingsContext)
  if (!store) throw new Error('useCanvasSettings must be used within a CanvasSettingsProvider')
  return store
}

export function useCanvasSettings(): CanvasSettings {
  return useStore(useCanvasSettingsStore(), (s) => s)
}
