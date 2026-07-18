// Canon module resolver (CD-423). Maps each canon manifest to a dynamic `import()` of
// its module — so every widget is a separate code-split chunk loaded on first render,
// never statically imported. This is the WidgetModuleResolver the host (CD-420) calls;
// assembly injects it. The `zero statically-imported widgets` gate asserts that these
// dynamic imports are the ONLY references to the module files.
import type { ComponentType } from 'react'
import type { WidgetManifest } from '@/services/widgets'

/** A canon widget module: a default-exported component. Structurally matches the host's
 *  WidgetModule (CD-420) — so `canonResolver` drops into a WidgetHost `resolve` prop —
 *  without importing across the widget-element boundary (canon stays self-contained). */
export interface CanonModule {
  default: ComponentType<{ config?: unknown }>
}

/** id → lazy module loader. Each value is a per-widget dynamic import (own chunk). */
const LOADERS: Record<string, () => Promise<CanonModule>> = {
  'gauge.circular': () => import('./modules/gauge'),
  'stat.readout': () => import('./modules/stat'),
  'chart.line': () => import('./modules/chart'),
  'button.action': () => import('./modules/button'),
  'toggle.switch': () => import('./modules/toggle'),
  'slider.range': () => import('./modules/slider'),
  'input.field': () => import('./modules/input'),
  'text.label': () => import('./modules/text'),
  'image.static': () => import('./modules/image'),
  'media.video': () => import('./modules/media'),
  'container.stack': () => import('./modules/container'),
}

/** Whether a manifest id has a canon module. */
export function hasCanonModule(id: string): boolean {
  return id in LOADERS
}

/** The resolver the platform host uses to lazily load a canon widget's module. */
export const canonResolver = (manifest: WidgetManifest): Promise<CanonModule> => {
  const load = LOADERS[manifest.id]
  if (!load) return Promise.reject(new Error(`no canon widget module registered for "${manifest.id}"`))
  return load()
}
