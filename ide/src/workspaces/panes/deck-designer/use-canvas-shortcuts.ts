// Canvas keyboard shortcuts (CD-308): arrow-key nudge (⇧ = 10 px, coalesced into a
// single undo entry per burst), tool shortcuts (V select / H hand / I insert), and
// Delete/⌘D dispatched as canvas commands. Attached to the focused surface element.
import { useEffect, useRef, useState } from 'react'
import type { ProjectModel, Frame } from '@/shared/project'
import type { SelectionEngine } from '@/stores'
import type { UndoStack } from '@/platform/undo'
import type { CommandRegistry } from '@/platform/commands'
import { CANVAS_COMMANDS } from './canvas-commands'
import { cycleVariant } from './component-ops'

export type CanvasTool = 'select' | 'hand' | 'insert'

interface Options {
  element: HTMLElement | null
  model: ProjectModel
  engine: SelectionEngine
  undo: UndoStack
  commands: CommandRegistry
}

interface NudgeSession {
  key: string
  time: number
  start: Map<string, Frame>
  targets: Map<string, Frame>
}

const COALESCE_MS = 1000

function arrowDelta(key: string): { x: number; y: number } | null {
  switch (key) {
    case 'ArrowLeft': return { x: -1, y: 0 }
    case 'ArrowRight': return { x: 1, y: 0 }
    case 'ArrowUp': return { x: 0, y: -1 }
    case 'ArrowDown': return { x: 0, y: 1 }
    default: return null
  }
}

export function useCanvasShortcuts({ element, model, engine, undo, commands }: Options): CanvasTool {
  const [tool, setTool] = useState<CanvasTool>('select')
  const session = useRef<NudgeSession | null>(null)

  useEffect(() => {
    if (!element) return

    const nudge = (dir: { x: number; y: number }, shift: boolean) => {
      const step = shift ? 10 : 1
      const ids = engine.state.ids.filter((id) => {
        const w = model.widget(id)
        return w && !w.locked
      })
      if (ids.length === 0) return
      const key = `nudge:${[...ids].sort().join(',')}`
      const now = performance.now()
      const s = session.current
      if (!s || s.key !== key || now - s.time > COALESCE_MS) {
        const start = new Map(ids.map((id) => [id, model.widget(id)!.frame] as const))
        session.current = { key, time: now, start, targets: new Map(start) }
      }
      const sess = session.current!
      sess.time = now
      for (const id of ids) {
        const t = sess.targets.get(id)!
        sess.targets.set(id, { ...t, x: t.x + dir.x * step, y: t.y + dir.y * step })
      }
      // Snapshot the session maps: the entry's apply/inverse must not see later
      // keypresses mutate sess.targets (redo would otherwise jump to the final
      // burst position if coalescing was ever interrupted mid-burst).
      const start = new Map(sess.start)
      const targets = new Map(sess.targets)
      // Coalesced by key: rapid nudges of the same selection collapse to one entry
      // whose inverse restores the pre-burst frames.
      undo.execUndoable(
        'Nudge',
        () => {
          for (const [id, f] of targets) model.updateFrame(id, f)
          return () => {
            for (const [id, f] of start) model.updateFrame(id, f)
          }
        },
        { coalesceKey: key },
      )
    }

    const onKeyDown = (e: KeyboardEvent) => {
      const dir = arrowDelta(e.key)
      if (dir) {
        e.preventDefault()
        nudge(dir, e.shiftKey)
        return
      }
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        void commands.execute(CANVAS_COMMANDS.createComponent, undefined, {})
      } else if (mod && e.key.toLowerCase() === 'g') {
        e.preventDefault()
        void commands.execute(e.shiftKey ? CANVAS_COMMANDS.ungroup : CANVAS_COMMANDS.group, undefined, {})
      } else if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        void commands.execute(CANVAS_COMMANDS.duplicate, undefined, {})
      } else if (!mod && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault()
        void commands.execute(CANVAS_COMMANDS.delete, undefined, {})
      } else if (!mod && (e.key === ',' || e.key === '.')) {
        // Cycle the selected instance's variant (CD-317).
        const ids = engine.state.ids
        const id = ids.length === 1 ? ids[0]! : undefined
        const pageId = id ? model.pageOf(id) : undefined
        if (id && pageId && model.widget(id)?.component) {
          e.preventDefault()
          cycleVariant({ model, engine, undo, pageId }, id, e.key === '.' ? 1 : -1)
        }
      } else if (!mod && e.key.toLowerCase() === 'v') {
        setTool('select')
      } else if (!mod && e.key.toLowerCase() === 'h') {
        setTool('hand')
      } else if (!mod && e.key.toLowerCase() === 'i') {
        setTool('insert')
      }
    }

    element.addEventListener('keydown', onKeyDown)
    return () => element.removeEventListener('keydown', onKeyDown)
  }, [element, model, engine, undo, commands])

  return tool
}
