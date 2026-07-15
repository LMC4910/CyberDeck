// React binding for ProjectModel (CD-303). The model is the single source of truth
// (the DOM never is). These hooks give render(dirtyIds) granularity via
// useSyncExternalStore:
//   • useWidgetIds re-renders the board list ONLY on structural changes.
//   • useWidget re-renders a single widget view ONLY when that widget's id is dirty.
// A field edit to one widget therefore repaints exactly one <WidgetView>, never the
// board or its siblings.
import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from 'react'
import type { ProjectModel, WidgetInstance, Page } from '@/shared/project'

const ModelContext = createContext<ProjectModel | null>(null)
export const ProjectModelProvider = ModelContext.Provider

export function useProjectModel(): ProjectModel {
  const model = useContext(ModelContext)
  if (!model) throw new Error('useProjectModel must be used within a ProjectModelProvider')
  return model
}

/** Ordered ids of a page's top-level (unparented) widgets; updates on structural changes. */
export function useRootWidgetIds(model: ProjectModel, pageId: string): string[] {
  const subscribe = useCallback(
    (cb: () => void) => model.subscribe((c) => c.structural && cb()),
    [model],
  )
  const rev = useSyncExternalStore(subscribe, () => model.structuralRev)
  return useMemo(
    () => model.rootWidgets(pageId).map((w) => w.id),
    [model, pageId, rev],
  )
}

/** Ordered ids of ALL widgets on a page (flat z-order); updates on structural changes.
 *  The board paints widgets flat at absolute frames — nesting is a layers/selection
 *  concern, not a paint one. */
export function useAllWidgetIds(model: ProjectModel, pageId: string): string[] {
  const subscribe = useCallback(
    (cb: () => void) => model.subscribe((c) => c.structural && cb()),
    [model],
  )
  const rev = useSyncExternalStore(subscribe, () => model.structuralRev)
  return useMemo(
    () => model.widgetsOf(pageId).map((w) => w.id),
    [model, pageId, rev],
  )
}

/** A single widget's current value; re-reads only when that widget's id is dirty. */
export function useWidget(model: ProjectModel, id: string): WidgetInstance | undefined {
  const subscribe = useCallback(
    (cb: () => void) => model.subscribe((c) => c.dirtyIds.includes(id) && cb()),
    [model, id],
  )
  const ver = useSyncExternalStore(subscribe, () => model.version(id))
  return useMemo(() => model.widget(id), [model, id, ver])
}

/** The active page object; updates on structural changes (rename/canvas/widgets). */
export function usePage(model: ProjectModel, pageId: string): Page | undefined {
  const subscribe = useCallback(
    (cb: () => void) => model.subscribe((c) => (c.structural || c.dirtyIds.includes(pageId)) && cb()),
    [model, pageId],
  )
  const rev = useSyncExternalStore(subscribe, () => model.structuralRev + model.version(pageId))
  return useMemo(() => model.page(pageId), [model, pageId, rev])
}
