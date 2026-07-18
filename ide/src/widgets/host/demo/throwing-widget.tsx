// Demo widget that throws on render (CD-420). Proves the per-widget error boundary
// isolates a crash: the fallback shows and sibling widgets keep rendering.
import type { WidgetModuleProps } from '../types'
import { markLoaded } from './demo-load-log'

markLoaded('throwing')

export default function ThrowingWidget(_props: WidgetModuleProps): never {
  throw new Error('demo widget exploded on render')
}
