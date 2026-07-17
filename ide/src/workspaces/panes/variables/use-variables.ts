// React binding for the Variables controller (CD-401). Mirrors the deck-designer's
// model/selection hooks: the controller is the source of truth, components subscribe
// to the slice they render, so a value tick repaints one row and not the table.
import { useEffect, useState } from 'react'
import { useStore } from '@/stores'
import { VariablesController, type VariablesState } from './variables-controller'
import type { VariablesSource } from './variables-source'

/** One controller per pane instance, rebound if the shell swaps the source. */
export function useVariablesController(source: VariablesSource): VariablesController {
  const [controller] = useState(() => new VariablesController(source))
  useEffect(() => {
    controller.bind(source)
  }, [controller, source])
  // First load: the constructor stays side-effect free, so the mount kicks it off.
  useEffect(() => {
    controller.refresh()
  }, [controller])
  return controller
}

export function useVariablesState<T>(
  controller: VariablesController,
  selector: (state: VariablesState) => T,
  isEqual?: (a: T, b: T) => boolean,
): T {
  return useStore(controller.store, selector, isEqual)
}

export function shallowArrayEqual(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i])
}
