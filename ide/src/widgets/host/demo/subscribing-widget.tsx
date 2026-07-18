// Demo widget that registers a subscription + timer in its scope (CD-420). Proves
// the dispose contract: on unmount the host disposes the scope and both are torn
// down (the leak test asserts the disposer ran and scope.size is 0).
import { useEffect } from 'react'
import type { WidgetModuleProps } from '../types'
import { markLoaded } from './demo-load-log'

markLoaded('subscribing')

export default function SubscribingWidget({ manifest, scope }: WidgetModuleProps) {
  useEffect(() => {
    // A fake bus subscription + a timer, both scope-owned.
    scope.add(() => {
      /* unsubscribe */
    })
    scope.setInterval(() => {}, 1000)
  }, [scope])
  return <div data-demo-widget="subscribing">{manifest.id}</div>
}
