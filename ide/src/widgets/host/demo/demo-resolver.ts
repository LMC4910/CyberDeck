// Demo module resolver (CD-420). Maps a manifest id to a per-widget dynamic
// `import()` — each `import()` is a distinct chunk boundary, loaded only when the
// host renders that widget. This is the shape assembly (CD-421) implements against
// the registry; here it serves the demo/test widgets.
import type { WidgetModule, WidgetModuleResolver } from '../types'

export const demoResolver: WidgetModuleResolver = (manifest): Promise<WidgetModule> => {
  const kind = manifest.id.split('.')[0]
  switch (kind) {
    case 'throwing':
      return import('./throwing-widget')
    case 'subscribing':
      return import('./subscribing-widget')
    case 'ok':
      return import('./ok-widget')
    default:
      return Promise.reject(new Error(`no demo widget module for "${manifest.id}"`))
  }
}
