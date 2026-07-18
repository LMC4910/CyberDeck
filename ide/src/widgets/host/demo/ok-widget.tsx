// Demo widget module (CD-420 chunk-split proof). A trivial, well-behaved widget in
// its own file so the bundler emits it as an independent chunk and the host loads
// it only on first render. Not shipped UI — canon widgets arrive at CD-423.
import type { WidgetModuleProps } from '../types'
import { markLoaded } from './demo-load-log'

markLoaded('ok')

export default function OkWidget({ manifest }: WidgetModuleProps) {
  return <div data-demo-widget="ok">{manifest.metadata.label}</div>
}
