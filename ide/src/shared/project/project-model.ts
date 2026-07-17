// ProjectModel (CD-302) — the in-memory authoring document for cyberdeck.project.
// It is the single source of truth for the canvas (the DOM never is — AUDIT C2/C3).
//
// Contract:
//   • Every entity is keyed by an opaque stable id (never a display name).
//   • Every MUTATION method performs its change and returns an `Inverse` (a zero-arg
//     function that exactly reverts it) — this is what the undo stack records. Ids
//     passed into creating mutations are minted ONCE by the caller (model.newId),
//     so redo (re-apply) reuses the same id and never regenerates keys.
//   • Groups persist as ordinary widgets whose `config.childIds` lists members, so
//     the serialized document stays flat + schema-valid; the model derives the tree.
//   • validate() enforces the invariants the JSON schema can't express (referential
//     closure, uniqueness, acyclic nesting, no name-keyed registries).
import { IdAllocator, ID_PREFIX, isStableId } from './id'
import {
  GROUP_TYPE,
  childIdsOf,
  isContainer,
  type Binding,
  type ComponentDef,
  type Diagnostic,
  type Frame,
  type Inverse,
  type Page,
  type ProjectDocument,
  type StateDef,
  type Variant,
  type WidgetInstance,
} from './types'

export interface ModelChange {
  /** Structural changes (add/remove/reorder/group) invalidate index-derived views. */
  structural: boolean
  /** Entities the change touched, for render(dirtyIds) granularity (CD-303). */
  dirtyIds: string[]
}

export type ModelListener = (change: ModelChange) => void

let blankSeq = 0

function blankDocument(name = 'Untitled'): ProjectDocument {
  // Deterministic starter ids (valid stable ids); the allocator reserves them.
  const n = (blankSeq++).toString(36).padStart(6, '0')
  return {
    format: 'cyberdeck.project',
    version: 1,
    meta: { name },
    pages: [{ id: `page_${n}`, name: 'Page 1', widgets: [] }],
  }
}

export class ProjectModel {
  private doc: ProjectDocument
  private readonly ids: IdAllocator
  private readonly listeners = new Set<ModelListener>()
  /** widget id → page id, rebuilt on structural change. */
  private widgetPage = new Map<string, string>()
  /** child widget id → parent container id (derived from childIds). */
  private parent = new Map<string, string>()
  /** Per-entity change counters + a structural revision, for render(dirtyIds)
   *  granularity (CD-303): a React view keyed on version(id) re-renders only when
   *  its own id is touched; the board list keyed on structuralRev re-renders only
   *  on add/remove/reorder. */
  private versions = new Map<string, number>()
  private structuralRevCounter = 0
  private globalRevCounter = 0

  constructor(doc?: ProjectDocument) {
    this.doc = doc ? structuredClone(doc) : blankDocument()
    this.ids = new IdAllocator(undefined, collectIds(this.doc))
    this.reindex()
  }

  static empty(name?: string): ProjectModel {
    return new ProjectModel(blankDocument(name))
  }

  // ── ids ───────────────────────────────────────────────────────────────────
  /** Mint a fresh stable id; call ONCE per created entity, before the mutation. */
  newId(prefix: keyof typeof ID_PREFIX): string {
    return this.ids.next(ID_PREFIX[prefix])
  }

  // ── subscription ──────────────────────────────────────────────────────────
  subscribe(listener: ModelListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(dirtyIds: string[], structural = false): void {
    if (structural) {
      this.reindex()
      this.structuralRevCounter++
    }
    for (const id of dirtyIds) this.versions.set(id, (this.versions.get(id) ?? 0) + 1)
    this.globalRevCounter++
    const change: ModelChange = { structural, dirtyIds }
    for (const l of this.listeners) l(change)
  }

  /** Change counter for one entity — bumps whenever that id is a dirty target. */
  version(id: string): number {
    return this.versions.get(id) ?? 0
  }
  /** Monotonic counter that bumps on ANY change (for coarse "follow" views). */
  get revision(): number {
    return this.globalRevCounter
  }
  /** Revision that bumps on any structural change (add/remove/reorder/group). */
  get structuralRev(): number {
    return this.structuralRevCounter
  }

  // ── reads ─────────────────────────────────────────────────────────────────
  get document(): Readonly<ProjectDocument> {
    return this.doc
  }
  snapshot(): ProjectDocument {
    return structuredClone(this.doc)
  }

  /** Canonical, schema-valid serialization of the document. Optionally stamps
   *  `savedAt`. Mutations keep the document canonical (empty registries pruned), so
   *  serialize→restore→serialize is idempotent (the CD-304 round-trip property). */
  serialize(opts: { savedAt?: string } = {}): ProjectDocument {
    const doc = structuredClone(this.doc)
    if (opts.savedAt) doc.savedAt = opts.savedAt
    return doc
  }

  /** Restore a model from a serialized document, enforcing referential closure. */
  static restore(doc: ProjectDocument): ProjectModel {
    const model = new ProjectModel(doc)
    model.assertValid()
    return model
  }
  pages(): readonly Page[] {
    return this.doc.pages
  }
  page(id: string): Page | undefined {
    return this.doc.pages.find((p) => p.id === id)
  }
  pageOf(widgetId: string): string | undefined {
    return this.widgetPage.get(widgetId)
  }
  widget(id: string): WidgetInstance | undefined {
    const pageId = this.widgetPage.get(id)
    return pageId ? this.page(pageId)?.widgets.find((w) => w.id === id) : undefined
  }
  widgetsOf(pageId: string): readonly WidgetInstance[] {
    return this.page(pageId)?.widgets ?? []
  }
  childrenOf(containerId: string): WidgetInstance[] {
    const container = this.widget(containerId)
    if (!container) return []
    return childIdsOf(container)
      .map((id) => this.widget(id))
      .filter((w): w is WidgetInstance => !!w)
  }
  parentOf(widgetId: string): string | undefined {
    return this.parent.get(widgetId)
  }
  /** Top-level (unparented) widgets of a page, in z-order. */
  rootWidgets(pageId: string): WidgetInstance[] {
    return this.widgetsOf(pageId).filter((w) => !this.parent.has(w.id))
  }
  components(): readonly ComponentDef[] {
    return this.doc.components ?? []
  }
  component(id: string): ComponentDef | undefined {
    return this.doc.components?.find((c) => c.id === id)
  }
  bindingsOf(widgetId: string): Record<string, Binding> | undefined {
    return this.doc.bindings?.[widgetId]
  }
  stateOf(widgetId: string): StateDef | undefined {
    return this.doc.states?.[widgetId]
  }
  eventsOf(widgetId: string): Record<string, string> | undefined {
    return this.doc.events?.[widgetId]
  }
  styles(): Readonly<NonNullable<ProjectDocument['styles']>> {
    return this.doc.styles ?? {}
  }
  style(id: string) {
    return this.doc.styles?.[id]
  }

  // ── shared styles (CD-321) ──────────────────────────────────────────────────
  addStyle(id: string, style: NonNullable<ProjectDocument['styles']>[string]): Inverse {
    this.ids.reserve(id)
    ;(this.doc.styles ??= {})[id] = style
    this.emit([id])
    return () => {
      if (this.doc.styles) {
        delete this.doc.styles[id]
        if (Object.keys(this.doc.styles).length === 0) delete this.doc.styles
      }
      this.emit([id])
    }
  }

  removeStyle(id: string): Inverse {
    const prev = this.doc.styles?.[id]
    if (!prev) return () => {}
    // Unlink from every widget that referenced it.
    const relinks: Inverse[] = []
    for (const p of this.doc.pages) {
      for (const w of p.widgets) {
        const links = (w.config as { styles?: Record<string, string> } | undefined)?.styles
        if (links) for (const k of Object.keys(links)) if (links[k] === id) relinks.push(this.unlinkStyle(w.id, k))
      }
    }
    delete this.doc.styles![id]
    if (Object.keys(this.doc.styles!).length === 0) delete this.doc.styles
    this.emit([id])
    return () => {
      ;(this.doc.styles ??= {})[id] = prev
      relinks.reverse().forEach((inv) => inv())
      this.emit([id])
    }
  }

  setStyleProp(id: string, prop: string, value: unknown): Inverse {
    const s = this.doc.styles?.[id]
    if (!s) return () => {}
    const had = s.props && prop in s.props
    const prev = had ? (s.props as Record<string, unknown>)[prop] : undefined
    if (value === undefined) {
      if (s.props) delete s.props[prop]
    } else {
      ;(s.props ??= {})[prop] = value
    }
    this.emit([id])
    return () => {
      const t = this.doc.styles?.[id]
      if (!t) return
      if (had) (t.props ??= {})[prop] = prev
      else if (t.props) delete t.props[prop]
      this.emit([id])
    }
  }

  renameStyle(id: string, name: string): Inverse {
    const s = this.doc.styles?.[id]
    if (!s) return () => {}
    const prev = s.name
    s.name = name
    this.emit([id])
    return () => {
      const t = this.doc.styles?.[id]
      if (t) t.name = prev
      this.emit([id])
    }
  }

  /** Link `kind` of widget's appearance to a shared style (config.styles[kind]=id). */
  linkStyle(widgetId: string, kind: string, styleId: string): Inverse {
    return this.mutateStyleLink(widgetId, kind, styleId)
  }
  unlinkStyle(widgetId: string, kind: string): Inverse {
    return this.mutateStyleLink(widgetId, kind, undefined)
  }
  private mutateStyleLink(widgetId: string, kind: string, styleId: string | undefined): Inverse {
    const w = this.widget(widgetId)
    if (!w) return () => {}
    const cfg = (w.config ?? {}) as { styles?: Record<string, string> }
    const prev = cfg.styles?.[kind]
    const links = { ...(cfg.styles ?? {}) }
    if (styleId === undefined) delete links[kind]
    else links[kind] = styleId
    w.config = { ...cfg, styles: Object.keys(links).length ? links : undefined }
    if (!(w.config as { styles?: unknown }).styles) delete (w.config as { styles?: unknown }).styles
    this.emit([widgetId, styleId ?? kind])
    return () => {
      const t = this.widget(widgetId)
      if (!t) return
      const c = (t.config ?? {}) as { styles?: Record<string, string> }
      const l = { ...(c.styles ?? {}) }
      if (prev === undefined) delete l[kind]
      else l[kind] = prev
      t.config = { ...c, styles: Object.keys(l).length ? l : undefined }
      if (!(t.config as { styles?: unknown }).styles) delete (t.config as { styles?: unknown }).styles
      this.emit([widgetId])
    }
  }

  /** Number of widgets currently linking `styleId` (any kind) — live ref count. */
  styleRefCount(styleId: string): number {
    let n = 0
    for (const p of this.doc.pages) {
      for (const w of p.widgets) {
        const links = (w.config as { styles?: Record<string, string> } | undefined)?.styles
        if (links && Object.values(links).includes(styleId)) n++
      }
    }
    return n
  }

  private reindex(): void {
    this.widgetPage.clear()
    this.parent.clear()
    for (const p of this.doc.pages) {
      for (const w of p.widgets) {
        this.widgetPage.set(w.id, p.id)
        if (isContainer(w)) {
          for (const childId of childIdsOf(w)) this.parent.set(childId, w.id)
        }
      }
    }
  }

  // ── page mutations ──────────────────────────────────────────────────────────
  addPage(page: Page, index = this.doc.pages.length): Inverse {
    this.ids.reserve(page.id)
    for (const w of page.widgets) this.ids.reserve(w.id)
    this.doc.pages.splice(index, 0, page)
    this.emit([page.id], true)
    return () => {
      const i = this.doc.pages.findIndex((p) => p.id === page.id)
      if (i >= 0) this.doc.pages.splice(i, 1)
      this.emit([page.id], true)
    }
  }

  removePage(pageId: string): Inverse {
    const index = this.doc.pages.findIndex((p) => p.id === pageId)
    if (index < 0) return () => {}
    if (this.doc.pages.length <= 1) throw new Error('cannot remove the last page')
    const [removed] = this.doc.pages.splice(index, 1)
    this.emit([pageId], true)
    return () => {
      this.doc.pages.splice(index, 0, removed!)
      this.emit([pageId], true)
    }
  }

  setPageCanvas(pageId: string, canvas: { w?: number; h?: number }): Inverse {
    const page = this.page(pageId)
    if (!page) return () => {}
    const prev = page.canvas ? { ...page.canvas } : undefined
    page.canvas = { ...page.canvas, ...canvas }
    this.emit([pageId])
    return () => {
      const p = this.page(pageId)
      if (p) p.canvas = prev
      this.emit([pageId])
    }
  }

  renamePage(pageId: string, name: string): Inverse {
    const page = this.page(pageId)
    if (!page) return () => {}
    const prev = page.name
    page.name = name
    this.emit([pageId])
    return () => {
      const p = this.page(pageId)
      if (p) p.name = prev
      this.emit([pageId])
    }
  }

  // ── widget mutations ─────────────────────────────────────────────────────────
  addWidget(pageId: string, widget: WidgetInstance, index?: number): Inverse {
    const page = this.page(pageId)
    if (!page) throw new Error(`no such page: ${pageId}`)
    this.ids.reserve(widget.id)
    const at = index ?? page.widgets.length
    page.widgets.splice(at, 0, widget)
    this.emit([widget.id], true)
    return () => {
      const p = this.page(pageId)
      const i = p?.widgets.findIndex((w) => w.id === widget.id) ?? -1
      if (p && i >= 0) p.widgets.splice(i, 1)
      this.emit([widget.id], true)
    }
  }

  /** Remove a widget and, if it is a container, its whole subtree. Cascades registry
   *  cleanup (bindings/states/events) and unlinks it from its parent container. */
  removeWidget(widgetId: string): Inverse {
    const pageId = this.widgetPage.get(widgetId)
    const page = pageId ? this.page(pageId) : undefined
    if (!page) return () => {}

    const subtree = this.collectSubtree(widgetId)
    const removed = page.widgets.filter((w) => subtree.has(w.id))
    const indices = new Map(removed.map((w) => [w.id, page.widgets.indexOf(w)]))

    // Snapshot registry slices + parent linkage so the inverse is exact.
    const savedBindings = pickKeys(this.doc.bindings, subtree)
    const savedStates = pickKeys(this.doc.states, subtree)
    const savedEvents = pickKeys(this.doc.events, subtree)
    const parentId = this.parent.get(widgetId)
    const parentChildren = parentId ? [...childIdsOf(this.widget(parentId)!)] : null

    page.widgets = page.widgets.filter((w) => !subtree.has(w.id))
    for (const id of subtree) {
      deleteKey(this.doc.bindings, id)
      deleteKey(this.doc.states, id)
      deleteKey(this.doc.events, id)
    }
    if (parentId) {
      const c = this.widget(parentId)!
      setChildIds(c, childIdsOf(c).filter((id) => id !== widgetId))
    }
    pruneEmptyRegistries(this.doc)
    this.emit([widgetId, ...(parentId ? [parentId] : [])], true)

    return () => {
      const p = this.page(pageId!)!
      // Reinsert removed widgets at their original indices (ascending).
      const ordered = removed
        .slice()
        .sort((a, b) => (indices.get(a.id)! - indices.get(b.id)!))
      for (const w of ordered) p.widgets.splice(indices.get(w.id)!, 0, w)
      restoreKeys((this.doc.bindings ??= {}), savedBindings)
      restoreKeys((this.doc.states ??= {}), savedStates)
      restoreKeys((this.doc.events ??= {}), savedEvents)
      if (parentId && parentChildren) setChildIds(this.widget(parentId)!, parentChildren)
      pruneEmptyRegistries(this.doc)
      this.emit([widgetId, ...(parentId ? [parentId] : [])], true)
    }
  }

  updateFrame(widgetId: string, frame: Frame): Inverse {
    const w = this.widget(widgetId)
    if (!w) return () => {}
    const prev = w.frame
    w.frame = frame
    this.emit([widgetId])
    return () => {
      const t = this.widget(widgetId)
      if (t) t.frame = prev
      this.emit([widgetId])
    }
  }

  /** Shallow-merge a config patch (undefined values delete the key). */
  updateConfig(widgetId: string, patch: Record<string, unknown>): Inverse {
    const w = this.widget(widgetId)
    if (!w) return () => {}
    const prev = w.config ? structuredClone(w.config) : undefined
    const next: Record<string, unknown> = { ...(w.config as object) }
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) delete next[k]
      else next[k] = v
    }
    w.config = next
    this.emit([widgetId])
    return () => {
      const t = this.widget(widgetId)
      if (t) t.config = prev
      this.emit([widgetId])
    }
  }

  setName(widgetId: string, name: string | undefined): Inverse {
    return this.setWidgetField(widgetId, 'name', name)
  }
  setLocked(widgetId: string, locked: boolean): Inverse {
    return this.setWidgetField(widgetId, 'locked', locked)
  }

  private setWidgetField<K extends keyof WidgetInstance>(
    widgetId: string,
    key: K,
    value: WidgetInstance[K],
  ): Inverse {
    const w = this.widget(widgetId)
    if (!w) return () => {}
    const prev = w[key]
    w[key] = value
    this.emit([widgetId])
    return () => {
      const t = this.widget(widgetId)
      if (t) t[key] = prev
      this.emit([widgetId])
    }
  }

  /** Reorder a widget within the flat page array (z-order among all page widgets). */
  reorderWidget(widgetId: string, toIndex: number): Inverse {
    const pageId = this.widgetPage.get(widgetId)
    const page = pageId ? this.page(pageId) : undefined
    if (!page) return () => {}
    const from = page.widgets.findIndex((w) => w.id === widgetId)
    if (from < 0) return () => {}
    const [w] = page.widgets.splice(from, 1)
    const clamped = Math.max(0, Math.min(toIndex, page.widgets.length))
    page.widgets.splice(clamped, 0, w!)
    this.emit([widgetId], true)
    return () => {
      const p = this.page(pageId!)!
      const i = p.widgets.findIndex((x) => x.id === widgetId)
      const [x] = p.widgets.splice(i, 1)
      p.widgets.splice(from, 0, x!)
      this.emit([widgetId], true)
    }
  }

  // ── grouping ─────────────────────────────────────────────────────────────────
  /** Wrap `memberIds` (already on the page) in a new container widget. `groupId` and
   *  `frame` are supplied by the caller (frame usually the members' bounding box). */
  group(pageId: string, groupId: string, memberIds: string[], frame: Frame): Inverse {
    const page = this.page(pageId)
    if (!page) throw new Error(`no such page: ${pageId}`)
    // Detach members from any current parent so nesting stays a forest.
    const priorParents = new Map<string, string[]>()
    for (const id of memberIds) {
      const pid = this.parent.get(id)
      if (pid && !priorParents.has(pid)) priorParents.set(pid, [...childIdsOf(this.widget(pid)!)])
    }
    for (const [pid] of priorParents) {
      const c = this.widget(pid)!
      setChildIds(c, childIdsOf(c).filter((id) => !memberIds.includes(id)))
    }
    const container: WidgetInstance = {
      id: groupId,
      type: GROUP_TYPE,
      name: 'Group',
      frame,
      config: { childIds: [...memberIds] },
    }
    this.ids.reserve(groupId)
    page.widgets.push(container)
    this.emit([groupId, ...memberIds], true)
    return () => {
      const p = this.page(pageId)!
      p.widgets = p.widgets.filter((w) => w.id !== groupId)
      for (const [pid, kids] of priorParents) setChildIds(this.widget(pid)!, kids)
      this.emit([groupId, ...memberIds], true)
    }
  }

  /** Dissolve a container; its children re-parent to the container's parent (or page). */
  ungroup(groupId: string): Inverse {
    const container = this.widget(groupId)
    const pageId = this.widgetPage.get(groupId)
    if (!container || !pageId || !isContainer(container)) return () => {}
    const memberIds = childIdsOf(container)
    const grandParentId = this.parent.get(groupId)
    const grandChildren = grandParentId ? [...childIdsOf(this.widget(grandParentId)!)] : null
    const page = this.page(pageId)!
    const index = page.widgets.findIndex((w) => w.id === groupId)

    page.widgets.splice(index, 1)
    if (grandParentId) {
      const gp = this.widget(grandParentId)!
      // Replace the group with its members in the grandparent's child list.
      setChildIds(gp, childIdsOf(gp).flatMap((id) => (id === groupId ? memberIds : [id])))
    }
    this.emit([groupId, ...memberIds], true)
    return () => {
      const p = this.page(pageId)!
      p.widgets.splice(index, 0, container)
      if (grandParentId && grandChildren) setChildIds(this.widget(grandParentId)!, grandChildren)
      this.emit([groupId, ...memberIds], true)
    }
  }

  /**
   * Move `id` under `newParentId` (a container) at `index`, or to page root when
   * `newParentId` is null. Rejects nesting a container into its own descendant
   * (cycle guard). Returns an inverse restoring the prior parent linkage.
   */
  reparent(id: string, newParentId: string | null, index?: number): Inverse {
    if (id === newParentId) return () => {}
    if (newParentId && this.collectSubtree(id).has(newParentId)) {
      throw new Error('cannot nest a container into its own descendant')
    }
    const oldParentId = this.parent.get(id)
    if (oldParentId === (newParentId ?? undefined) && index === undefined) {
      // no structural change requested
    }
    const oldParentPrev = oldParentId ? [...childIdsOf(this.widget(oldParentId)!)] : null
    const newParentPrev = newParentId ? [...childIdsOf(this.widget(newParentId)!)] : null

    if (oldParentId) {
      const p = this.widget(oldParentId)!
      setChildIds(p, childIdsOf(p).filter((x) => x !== id))
    }
    if (newParentId) {
      const c = this.widget(newParentId)!
      const kids = childIdsOf(c).filter((x) => x !== id)
      kids.splice(index ?? kids.length, 0, id)
      setChildIds(c, kids)
    }
    this.emit([id, ...(oldParentId ? [oldParentId] : []), ...(newParentId ? [newParentId] : [])], true)
    return () => {
      if (oldParentId && oldParentPrev) setChildIds(this.widget(oldParentId)!, oldParentPrev)
      if (newParentId && newParentPrev) setChildIds(this.widget(newParentId)!, newParentPrev)
      this.emit([id, ...(oldParentId ? [oldParentId] : []), ...(newParentId ? [newParentId] : [])], true)
    }
  }

  /** Set a container's ordered child list (reorder / nest / unnest). Rejects a
   *  child list that would nest the container inside itself (same guard as
   *  reparent — the forest must stay acyclic). */
  setChildren(containerId: string, childIds: string[]): Inverse {
    const c = this.widget(containerId)
    if (!c) return () => {}
    for (const childId of childIds) {
      if (childId === containerId || this.collectSubtree(childId).has(containerId)) {
        throw new Error('cannot nest a container into its own descendant')
      }
    }
    const prev = [...childIdsOf(c)]
    setChildIds(c, [...childIds])
    this.emit([containerId, ...childIds, ...prev], true)
    return () => {
      const t = this.widget(containerId)
      if (t) setChildIds(t, prev)
      this.emit([containerId, ...childIds, ...prev], true)
    }
  }

  // ── components ────────────────────────────────────────────────────────────────
  addComponent(def: ComponentDef): Inverse {
    this.ids.reserve(def.id)
    for (const w of def.widgets) this.ids.reserve(w.id)
    ;(this.doc.components ??= []).push(def)
    this.emit([def.id], true)
    return () => {
      if (this.doc.components) {
        this.doc.components = this.doc.components.filter((c) => c.id !== def.id)
        if (this.doc.components.length === 0) delete this.doc.components
      }
      this.emit([def.id], true)
    }
  }

  renameComponent(componentId: string, name: string): Inverse {
    const c = this.component(componentId)
    if (!c) return () => {}
    const prev = c.name
    c.name = name
    this.emit([componentId])
    return () => {
      const t = this.component(componentId)
      if (t) t.name = prev
      this.emit([componentId])
    }
  }

  /** Set (or clear, value=undefined) a component prop/default (also holds meta keys). */
  setComponentProp(componentId: string, prop: string, value: unknown): Inverse {
    const c = this.component(componentId)
    if (!c) return () => {}
    const had = c.props && prop in c.props
    const prev = had ? (c.props as Record<string, unknown>)[prop] : undefined
    if (value === undefined) {
      if (c.props) {
        delete c.props[prop]
        if (Object.keys(c.props).length === 0) delete c.props
      }
    } else {
      ;(c.props ??= {})[prop] = value as never
    }
    this.emit([componentId])
    return () => {
      const t = this.component(componentId)
      if (!t) return
      if (had) (t.props ??= {})[prop] = prev as never
      else if (t.props) {
        delete t.props[prop]
        if (Object.keys(t.props).length === 0) delete t.props
      }
      this.emit([componentId])
    }
  }

  /** Remove a component def. Instances referencing it are unlinked (their
   *  component/variant/overrides cleared) so no dangling refs survive — the
   *  inverse restores both the def and every instance's linkage. */
  removeComponent(componentId: string): Inverse {
    const list = this.doc.components
    const index = list?.findIndex((c) => c.id === componentId) ?? -1
    if (!list || index < 0) return () => {}
    const [def] = list.splice(index, 1)
    if (list.length === 0) delete this.doc.components
    const unlinked: { id: string; variant?: string; overrides?: WidgetInstance['overrides'] }[] = []
    for (const p of this.doc.pages) {
      for (const w of p.widgets) {
        if (w.component !== componentId) continue
        unlinked.push({ id: w.id, variant: w.variant, overrides: w.overrides ? structuredClone(w.overrides) : undefined })
        delete w.component
        delete w.variant
        delete w.overrides
      }
    }
    this.emit([componentId, ...unlinked.map((u) => u.id)], true)
    return () => {
      ;(this.doc.components ??= []).splice(index, 0, def!)
      for (const u of unlinked) {
        const w = this.widget(u.id)
        if (!w) continue
        w.component = componentId
        if (u.variant !== undefined) w.variant = u.variant
        if (u.overrides !== undefined) w.overrides = u.overrides
      }
      this.emit([componentId, ...unlinked.map((u) => u.id)], true)
    }
  }

  addVariant(componentId: string, variant: Variant): Inverse {
    const c = this.component(componentId)
    if (!c) return () => {}
    this.ids.reserve(variant.id)
    ;(c.variants ??= []).push(variant)
    this.emit([componentId, variant.id])
    return () => {
      const t = this.component(componentId)
      if (t?.variants) {
        t.variants = t.variants.filter((v) => v.id !== variant.id)
        if (t.variants.length === 0) delete t.variants
      }
      this.emit([componentId, variant.id])
    }
  }

  removeVariant(componentId: string, variantId: string): Inverse {
    const c = this.component(componentId)
    const index = c?.variants?.findIndex((v) => v.id === variantId) ?? -1
    if (!c?.variants || index < 0) return () => {}
    const [v] = c.variants.splice(index, 1)
    if (c.variants.length === 0) delete c.variants
    this.emit([componentId, variantId])
    return () => {
      const t = this.component(componentId)!
      ;(t.variants ??= []).splice(index, 0, v!)
      this.emit([componentId, variantId])
    }
  }

  renameVariant(componentId: string, variantId: string, name: string): Inverse {
    const v = this.component(componentId)?.variants?.find((x) => x.id === variantId)
    if (!v) return () => {}
    const prev = v.name
    v.name = name
    this.emit([componentId, variantId])
    return () => {
      const t = this.component(componentId)?.variants?.find((x) => x.id === variantId)
      if (t) t.name = prev
      this.emit([componentId, variantId])
    }
  }

  /** Set (or clear, value=undefined) one prop in a variant's override table. */
  setVariantOverride(componentId: string, variantId: string, prop: string, value: unknown): Inverse {
    const v = this.component(componentId)?.variants?.find((x) => x.id === variantId)
    if (!v) return () => {}
    const had = v.overrides && prop in v.overrides
    const prev = had ? (v.overrides as Record<string, unknown>)[prop] : undefined
    if (value === undefined) {
      if (v.overrides) {
        delete v.overrides[prop]
        if (Object.keys(v.overrides).length === 0) delete v.overrides
      }
    } else {
      ;(v.overrides ??= {})[prop] = value as never
    }
    this.emit([componentId, variantId])
    return () => {
      const t = this.component(componentId)?.variants?.find((x) => x.id === variantId)
      if (!t) return
      if (had) (t.overrides ??= {})[prop] = prev as never
      else if (t.overrides) {
        delete t.overrides[prop]
        if (Object.keys(t.overrides).length === 0) delete t.overrides
      }
      this.emit([componentId, variantId])
    }
  }

  // ── instances (a widget carrying component/variant/overrides) ────────────────
  setVariant(widgetId: string, variantId: string | undefined): Inverse {
    return this.setWidgetField(widgetId, 'variant', variantId)
  }

  /** Set (or clear, value=undefined) one instance override. Deleting on undefined
   *  (rather than storing it) keeps `prop in overrides` aligned with what a JSON
   *  round-trip preserves (CD-304 idempotency). */
  setOverride(widgetId: string, prop: string, value: unknown): Inverse {
    const w = this.widget(widgetId)
    if (!w) return () => {}
    const had = w.overrides && prop in w.overrides
    const prev = had ? (w.overrides as Record<string, unknown>)[prop] : undefined
    if (value === undefined) {
      if (w.overrides) {
        delete w.overrides[prop]
        if (Object.keys(w.overrides).length === 0) delete w.overrides
      }
    } else {
      ;(w.overrides ??= {})[prop] = value as never
    }
    this.emit([widgetId])
    return () => {
      const t = this.widget(widgetId)
      if (!t) return
      if (had) (t.overrides ??= {})[prop] = prev as never
      else if (t.overrides) {
        delete t.overrides[prop]
        if (Object.keys(t.overrides).length === 0) delete t.overrides
      }
      this.emit([widgetId])
    }
  }

  clearOverride(widgetId: string, prop: string): Inverse {
    const w = this.widget(widgetId)
    if (!w?.overrides || !(prop in w.overrides)) return () => {}
    const prev = (w.overrides as Record<string, unknown>)[prop]
    delete w.overrides[prop]
    if (Object.keys(w.overrides).length === 0) delete w.overrides
    this.emit([widgetId])
    return () => {
      const t = this.widget(widgetId)
      if (t) (t.overrides ??= {})[prop] = prev as never
      this.emit([widgetId])
    }
  }

  // ── bindings ──────────────────────────────────────────────────────────────────
  setBinding(widgetId: string, prop: string, binding: Binding): Inverse {
    const map = (this.doc.bindings ??= {})
    const forWidget = (map[widgetId] ??= {})
    const had = prop in forWidget
    const prev = forWidget[prop]
    forWidget[prop] = binding
    this.emit([widgetId])
    return () => {
      const w = this.doc.bindings?.[widgetId]
      if (!w) return
      if (had) w[prop] = prev!
      else delete w[prop]
      pruneEmptyRegistries(this.doc)
      this.emit([widgetId])
    }
  }

  clearBinding(widgetId: string, prop: string): Inverse {
    const forWidget = this.doc.bindings?.[widgetId]
    if (!forWidget || !(prop in forWidget)) return () => {}
    const prev = forWidget[prop]
    delete forWidget[prop]
    pruneEmptyRegistries(this.doc)
    this.emit([widgetId])
    return () => {
      ;((this.doc.bindings ??= {})[widgetId] ??= {})[prop] = prev!
      this.emit([widgetId])
    }
  }

  // ── states ────────────────────────────────────────────────────────────────────
  setActiveState(widgetId: string, active: string | undefined): Inverse {
    const states = (this.doc.states ??= {})
    const s = (states[widgetId] ??= {})
    const prev = s.active
    if (active === undefined) delete s.active
    else s.active = active
    pruneEmptyRegistries(this.doc)
    this.emit([widgetId])
    return () => {
      if (prev === undefined) {
        const t = this.doc.states?.[widgetId]
        if (t) delete t.active
        pruneEmptyRegistries(this.doc)
      } else {
        // Rebuild the entry — the forward prune may have removed it.
        ;((this.doc.states ??= {})[widgetId] ??= {}).active = prev
      }
      this.emit([widgetId])
    }
  }

  /** Set (or clear, value=undefined) one prop in a state's delta. Deleting on
   *  undefined keeps the document canonical (no `{prop: undefined}` residue that a
   *  JSON round-trip would silently drop — CD-304 idempotency). */
  setStateOverride(widgetId: string, state: string, prop: string, value: unknown): Inverse {
    const states = (this.doc.states ??= {})
    const s = (states[widgetId] ??= {})
    const ov = (s.ov ??= {})
    const forState = (ov[state] ??= {})
    const had = prop in forState
    const prev = forState[prop]
    if (value === undefined) delete forState[prop]
    else forState[prop] = value
    pruneEmptyRegistries(this.doc)
    this.emit([widgetId])
    return () => {
      if (had) {
        // Rebuild the scaffolding — the forward prune may have removed it.
        const st = ((this.doc.states ??= {})[widgetId] ??= {})
        ;((st.ov ??= {})[state] ??= {})[prop] = prev
      } else {
        const forStateNow = this.doc.states?.[widgetId]?.ov?.[state]
        if (forStateNow) delete forStateNow[prop]
        pruneEmptyRegistries(this.doc)
      }
      this.emit([widgetId])
    }
  }

  setCustomStates(widgetId: string, custom: string[]): Inverse {
    const states = (this.doc.states ??= {})
    const s = (states[widgetId] ??= {})
    const prev = s.custom ? [...s.custom] : undefined
    if (custom.length === 0) delete s.custom
    else s.custom = [...custom]
    pruneEmptyRegistries(this.doc)
    this.emit([widgetId])
    return () => {
      if (prev) {
        // Rebuild the entry — the forward prune may have removed it.
        ;((this.doc.states ??= {})[widgetId] ??= {}).custom = prev
      } else {
        const t = this.doc.states?.[widgetId]
        if (t) delete t.custom
        pruneEmptyRegistries(this.doc)
      }
      this.emit([widgetId])
    }
  }

  // ── events ────────────────────────────────────────────────────────────────────
  setEvent(widgetId: string, gesture: string, flowId: string): Inverse {
    const events = (this.doc.events ??= {})
    const forWidget = (events[widgetId] ??= {})
    const had = gesture in forWidget
    const prev = forWidget[gesture]
    forWidget[gesture] = flowId
    this.emit([widgetId])
    return () => {
      const w = this.doc.events?.[widgetId]
      if (!w) return
      if (had) w[gesture] = prev!
      else delete w[gesture]
      pruneEmptyRegistries(this.doc)
      this.emit([widgetId])
    }
  }

  clearEvent(widgetId: string, gesture: string): Inverse {
    const forWidget = this.doc.events?.[widgetId]
    if (!forWidget || !(gesture in forWidget)) return () => {}
    const prev = forWidget[gesture]
    delete forWidget[gesture]
    pruneEmptyRegistries(this.doc)
    this.emit([widgetId])
    return () => {
      ;((this.doc.events ??= {})[widgetId] ??= {})[gesture] = prev!
      this.emit([widgetId])
    }
  }

  // ── invariants ────────────────────────────────────────────────────────────────
  private collectSubtree(rootId: string): Set<string> {
    const out = new Set<string>()
    const walk = (id: string) => {
      if (out.has(id)) return
      out.add(id)
      const w = this.widget(id)
      if (w && isContainer(w)) for (const c of childIdsOf(w)) walk(c)
    }
    walk(rootId)
    return out
  }

  /** Validate the invariants JSON Schema cannot express. Empty array ⇒ valid. */
  validate(): Diagnostic[] {
    return validateDocument(this.doc)
  }

  assertValid(): void {
    const problems = this.validate()
    if (problems.length) {
      throw new Error(`invalid project: ${problems.map((p) => p.message).join('; ')}`)
    }
  }
}

// ── free helpers ──────────────────────────────────────────────────────────────
function setChildIds(w: WidgetInstance, childIds: string[]): void {
  w.config = { ...(w.config as object), childIds }
}

function collectIds(doc: ProjectDocument): string[] {
  const ids: string[] = []
  for (const p of doc.pages) {
    ids.push(p.id)
    for (const w of p.widgets) ids.push(w.id)
  }
  for (const c of doc.components ?? []) {
    ids.push(c.id)
    for (const w of c.widgets) ids.push(w.id)
    for (const v of c.variants ?? []) ids.push(v.id)
  }
  for (const d of doc.devices ?? []) ids.push(d.id)
  for (const a of doc.assets ?? []) ids.push(a.id)
  for (const sid of Object.keys(doc.styles ?? {})) ids.push(sid)
  return ids
}

function pickKeys<V>(
  obj: Record<string, V> | undefined,
  keys: Set<string>,
): Record<string, V> {
  const out: Record<string, V> = {}
  if (!obj) return out
  for (const k of keys) if (k in obj) out[k] = structuredClone(obj[k]!)
  return out
}

function restoreKeys<V>(obj: Record<string, V>, saved: Record<string, V>): void {
  for (const [k, v] of Object.entries(saved)) obj[k] = v
}

function deleteKey(obj: Record<string, unknown> | undefined, key: string): void {
  if (obj) delete obj[key]
}

function isEmptyObj(v: unknown): boolean {
  return !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0
}

function pruneEmptyRegistries(doc: ProjectDocument): void {
  // bindings/events are widget-id → { key → value } — prune empty widget entries.
  for (const reg of ['bindings', 'events'] as const) {
    const map = doc[reg] as Record<string, unknown> | undefined
    if (!map) continue
    for (const [k, v] of Object.entries(map)) if (isEmptyObj(v)) delete map[k]
    if (isEmptyObj(map)) delete doc[reg]
  }
  // states nest one level deeper (ov → state → { prop → value }); deep-prune so an
  // inverse that removed the last override leaves no empty scaffolding behind.
  const states = doc.states
  if (states) {
    for (const [wid, s] of Object.entries(states)) {
      if (s.ov) {
        for (const [stateName, props] of Object.entries(s.ov)) {
          if (isEmptyObj(props)) delete s.ov[stateName]
        }
        if (isEmptyObj(s.ov)) delete s.ov
      }
      if (s.active === undefined && !(s.custom && s.custom.length) && !s.ov) delete states[wid]
    }
    if (isEmptyObj(states)) delete doc.states
  }
}

/** Standalone invariant checker (used by ProjectModel + ProjectService on save). */
export function validateDocument(doc: ProjectDocument): Diagnostic[] {
  const out: Diagnostic[] = []
  const seen = new Set<string>()
  const widgetIds = new Set<string>()
  const pageIds = new Set<string>()
  const componentIds = new Set<string>()

  const claim = (id: string) => {
    if (seen.has(id)) out.push({ code: 'duplicate-id', id, message: `duplicate id: ${id}` })
    seen.add(id)
  }

  for (const p of doc.pages) {
    claim(p.id)
    pageIds.add(p.id)
    for (const w of p.widgets) {
      claim(w.id)
      widgetIds.add(w.id)
    }
  }
  for (const c of doc.components ?? []) {
    claim(c.id)
    componentIds.add(c.id)
    for (const w of c.widgets) claim(w.id)
    for (const v of c.variants ?? []) claim(v.id)
  }

  // Referential closure + name-keyed detection for registries.
  for (const reg of ['bindings', 'states', 'events'] as const) {
    const map = doc[reg] as Record<string, unknown> | undefined
    for (const key of Object.keys(map ?? {})) {
      if (!isStableId(key)) {
        out.push({ code: 'name-keyed', id: key, message: `${reg} keyed by non-id "${key}"` })
      } else if (!widgetIds.has(key)) {
        out.push({ code: 'dangling-ref', id: key, message: `${reg} references missing widget ${key}` })
      }
    }
  }
  for (const lock of doc.locks ?? []) {
    if (!widgetIds.has(lock)) {
      out.push({ code: 'dangling-ref', id: lock, message: `lock references missing widget ${lock}` })
    }
  }
  for (const d of doc.devices ?? []) {
    if (!pageIds.has(d.pageId)) {
      out.push({ code: 'dangling-ref', id: d.id, message: `device ${d.id} → missing page ${d.pageId}` })
    }
  }
  // Style links must resolve to a style in the registry (CD-321).
  const styleIds = new Set(Object.keys(doc.styles ?? {}))
  for (const p of doc.pages) {
    for (const w of p.widgets) {
      const links = (w.config as { styles?: Record<string, string> } | undefined)?.styles
      for (const ref of Object.values(links ?? {})) {
        if (!styleIds.has(ref)) out.push({ code: 'dangling-ref', id: w.id, message: `style link → missing style ${ref}` })
      }
    }
  }

  // Circular component nesting: a component template must not (transitively)
  // instantiate itself (CD-319).
  const componentById = new Map((doc.components ?? []).map((c) => [c.id, c]))
  const refsOf = (id: string): string[] =>
    (componentById.get(id)?.widgets ?? []).map((w) => w.component).filter((r): r is string => !!r)
  for (const c of doc.components ?? []) {
    const path = new Set<string>()
    const visit = (id: string): boolean => {
      if (id === c.id && path.size > 0) return true
      if (path.has(id)) return false
      path.add(id)
      return refsOf(id).some(visit)
    }
    if (refsOf(c.id).some(visit)) {
      out.push({ code: 'circular-nesting', id: c.id, message: `component ${c.id} nests itself` })
    }
  }

  // Instance component/variant refs + container child refs + cycles.
  for (const p of doc.pages) {
    const onPage = new Set(p.widgets.map((w) => w.id))
    for (const w of p.widgets) {
      if (w.component && !componentIds.has(w.component)) {
        out.push({ code: 'dangling-ref', id: w.id, message: `instance ${w.id} → missing component ${w.component}` })
      }
      if (w.variant && w.component) {
        const comp = doc.components?.find((c) => c.id === w.component)
        if (comp && !comp.variants?.some((v) => v.id === w.variant)) {
          out.push({ code: 'dangling-ref', id: w.id, message: `instance ${w.id} → missing variant ${w.variant}` })
        }
      }
      for (const childId of childIdsOf(w)) {
        if (!onPage.has(childId)) {
          out.push({ code: 'orphan-child', id: childId, message: `container ${w.id} → missing child ${childId}` })
        }
      }
    }
    // Detect cycles / multi-parent in the container forest.
    const parentOf = new Map<string, string>()
    for (const w of p.widgets) {
      for (const childId of childIdsOf(w)) {
        if (parentOf.has(childId)) {
          out.push({ code: 'circular-nesting', id: childId, message: `child ${childId} has multiple parents` })
        }
        parentOf.set(childId, w.id)
      }
    }
    for (const start of onPage) {
      const path = new Set<string>()
      let cur: string | undefined = start
      while (cur !== undefined) {
        if (path.has(cur)) {
          out.push({ code: 'circular-nesting', id: start, message: `cycle in container nesting at ${cur}` })
          break
        }
        path.add(cur)
        cur = parentOf.get(cur)
      }
    }
  }

  return out
}
