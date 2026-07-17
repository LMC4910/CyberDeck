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
    // Build the derived-variable graph and subscribe to dependency ticks (CD-403).
    // Re-runs on a source swap so the computed engine tracks the new backend.
    void controller.refreshComputed()
  }, [controller, source])
  // First load: the constructor stays side-effect free, so the mount kicks it off.
  useEffect(() => {
    controller.refresh()
    // Release the live tick subscription when the pane unmounts.
    return () => controller.dispose()
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
