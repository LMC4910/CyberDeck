// Undo context (CD-306). Exposes the kernel's single UndoStack to the authoring
// panels so canvas gestures, inspector edits, and layers commands all record onto
// one history (the same stack ⌘Z/⌘⇧Z drive from the shell).
import { createContext, useContext } from 'react'
import type { UndoStack } from '@/platform/undo'

const UndoContext = createContext<UndoStack | null>(null)
export const UndoProvider = UndoContext.Provider

export function useUndo(): UndoStack {
  const undo = useContext(UndoContext)
  if (!undo) throw new Error('useUndo must be used within an UndoProvider')
  return undo
}
