// React binding for the Devices controller (CD-415). Mirrors the Variables hooks:
// the controller is the source of truth, components subscribe to the slice they
// render, so a heartbeat frame repaints one card and not the grid.
import { useEffect, useState } from 'react'
import { useStore } from '@/stores'
import { DevicesController, type DevicesState } from './devices-controller'
import type { DevicesSource } from './devices-source'

/** One controller per pane instance; first mount lists + subscribes, unmount disposes. */
export function useDevicesController(source: DevicesSource): DevicesController {
  const [controller] = useState(() => new DevicesController(source))

  // Rebind if the shell swaps the source (repo adapter arriving after boot).
  useEffect(() => {
    controller.bind(source)
  }, [controller, source])

  // The constructor stays side-effect free, so the mount kicks off the load + stream.
  useEffect(() => {
    controller.refresh()
    controller.subscribeHeartbeat()
    return () => controller.dispose()
  }, [controller])

  return controller
}

export function useDevicesState<T>(
  controller: DevicesController,
  selector: (state: DevicesState) => T,
  isEqual?: (a: T, b: T) => boolean,
): T {
  return useStore(controller.store, selector, isEqual)
}
