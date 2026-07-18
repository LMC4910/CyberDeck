// Publish / flatten v0 (CD-416). A PURE, deterministic projection of a
// `cyberdeck.project` authoring document into one per-device `cyberdeck.layout`
// document — resolving component instances/variants/overrides/nesting, mapping
// authored px frames onto the device grid, folding the binding/state/event
// registries into the player-facing appearance/interaction, and stripping every
// authoring-only concern (names, locks, group containers, style links).
//
// This is a CONTRACT: the Go engine ports it at CD-506 and must match the golden
// fixtures byte-for-byte. Therefore this module:
//   • imports ONLY other `shared` code (types + pure helpers from @/shared/project),
//   • performs NO IO and touches NO DOM / React / stores / repositories,
//   • never reads the clock or a RNG — every non-deterministic input (publish
//     version, timestamp) is supplied by the caller through FlattenOptions.
//
// Resolution order (must agree with deck-designer/component-ops.ts expandComponentDeep):
//   props = { ...component.props, ...variant.overrides, ...instance.overrides }
//   nested instances resolve their OWN variant/overrides chain at their own level;
//   a resolved prop is baked into a template widget's config only for keys the
//   widget's config already declares (bakeProps semantics).
import {
  GROUP_TYPE,
  childIdsOf,
  type Binding,
  type ComponentDef,
  type Frame,
  type ProjectDocument,
  type WidgetInstance,
} from '@/shared/project'
import type {
  CyberDeckPublishedLayoutDocumentCyberdeckLayout as LayoutDocument,
  Appearance,
  Grid,
  Placement,
  Widget as LayoutWidget,
} from '@/shared/contract'

type Device = NonNullable<ProjectDocument['devices']>[number]
type LayoutPage = LayoutDocument['pages'][number]

export interface FlattenOptions {
  /** Monotonic publish revision stamped on every produced layout (schema-required).
   *  Supplied by the caller — the lib never mints it. */
  version: number
  /** ISO-8601 publish timestamp. Emitted only when provided (never read from a clock). */
  publishedAt?: string
  /** Project stable id echoed into `layout.projectId` (emitted only when provided). */
  projectId?: string
  /** Device grid the frames are snapped onto. Defaults to the layout-schema grid
   *  (24 columns × 18 rows). */
  grid?: { columns?: number; rows?: number }
  /** Canvas size used to map px frames → grid cells when a page has no `canvas`.
   *  Defaults to 1280 × 800. */
  defaultCanvas?: { w: number; h: number }
  /** `version` stamped on each layout page (staleness/delta semantics). Default 0. */
  pageVersion?: number
}

export interface DeviceLayout {
  deviceId?: string
  deviceClass: string
  layout: LayoutDocument
}

const DEFAULT_GRID = { columns: 24, rows: 18 } as const
const DEFAULT_CANVAS = { w: 1280, h: 800 } as const

/** Round half UP toward +Infinity. Identical to Go `math.Floor(x + 0.5)` for ALL x
 *  (including negatives) — deliberately NOT Go's `math.Round`, which rounds halves
 *  away from zero and would disagree on negative frame coordinates. */
function roundHalfUp(x: number): number {
  return Math.floor(x + 0.5)
}

/** Error thrown when a component template (transitively) instantiates itself. */
export class CircularComponentError extends Error {
  constructor(chain: string[]) {
    super(`circular component nesting: ${chain.join(' > ')}`)
    this.name = 'CircularComponentError'
  }
}

// ── public entry points ─────────────────────────────────────────────────────────

/** Flatten a project into one layout per assigned device, in `project.devices`
 *  order. A project with no devices yields an empty array. */
export function flattenProject(project: ProjectDocument, options: FlattenOptions): DeviceLayout[] {
  return (project.devices ?? []).map((device) => ({
    deviceId: device.id,
    deviceClass: device.deviceClass,
    layout: flattenForDevice(project, device, options),
  }))
}

/** Flatten the single page a device is assigned to into that device's layout doc. */
export function flattenForDevice(
  project: ProjectDocument,
  device: Device,
  options: FlattenOptions,
): LayoutDocument {
  const page = project.pages.find((p) => p.id === device.pageId)
  if (!page) throw new Error(`device ${device.id} → missing page ${device.pageId}`)

  const layout: LayoutDocument = {
    format: 'cyberdeck.layout',
    version: options.version,
    ...(options.projectId !== undefined ? { projectId: options.projectId } : {}),
    ...(options.publishedAt !== undefined ? { publishedAt: options.publishedAt } : {}),
    device: {
      ...(device.id !== undefined ? { id: device.id } : {}),
      ...(device.name !== undefined ? { name: device.name } : {}),
      deviceClass: device.deviceClass,
    },
    pages: [flattenPage(project, page, device.deviceClass, options)],
  }
  return layout
}

// ── page + widget flattening ──────────────────────────────────────────────────

function flattenPage(
  project: ProjectDocument,
  page: ProjectDocument['pages'][number],
  deviceClass: string,
  options: FlattenOptions,
): LayoutPage {
  const columns = options.grid?.columns ?? DEFAULT_GRID.columns
  const rows = options.grid?.rows ?? DEFAULT_GRID.rows
  const grid: Grid = { columns, rows, deviceClass }
  const canvas = {
    w: page.canvas?.w ?? options.defaultCanvas?.w ?? DEFAULT_CANVAS.w,
    h: page.canvas?.h ?? options.defaultCanvas?.h ?? DEFAULT_CANVAS.h,
  }

  const widgets: LayoutWidget[] = []
  for (const w of page.widgets) {
    if (w.component) {
      // Component instance → expand to plain widgets (the instance node itself is
      // never emitted). Frames accumulate from the instance origin.
      for (const node of expandComponent(
        project,
        w.component,
        { x: w.frame.x, y: w.frame.y },
        [w.id],
        [w.component],
        w.variant,
        w.overrides,
      )) {
        widgets.push(buildWidget(project, node, columns, rows, canvas))
      }
    } else if (isGroupContainer(w)) {
      // Group container is authoring-only scaffolding — dissolved. Its children are
      // separate page widgets and get emitted on their own.
      continue
    } else {
      widgets.push(
        buildWidget(
          project,
          { layoutId: w.id, sourceId: w.id, type: w.type, frame: w.frame, config: cloneConfig(w.config) },
          columns,
          rows,
          canvas,
        ),
      )
    }
  }

  return {
    id: page.id,
    ...(page.name !== undefined ? { name: page.name } : {}),
    grid,
    version: options.pageVersion ?? 0,
    widgets,
  }
}

interface ExpandedNode {
  /** Deterministic layout id (see composeExpandedId). */
  layoutId: string
  /** Authoring id used to resolve registries (the template/plain widget's own id). */
  sourceId: string
  type: string
  frame: Frame
  config: Record<string, unknown>
}

/** Deterministic expanded id for a component-instance descendant.
 *
 *  ID_AND_FLATTEN.md specifies `<instanceId>-<templateWidgetId>`, chained through
 *  nesting. The literal concatenation, however, produces ids with more than one
 *  underscore (e.g. `w_inst001a-w_tmpl001a`), which VIOLATE the layout `stableId`
 *  pattern `^[a-z][a-z0-9]*_[a-z0-9][a-z0-9-]{5,}$` (that pattern permits exactly one
 *  underscore). To stay schema-valid while remaining deterministic and reversible,
 *  every segment after the first (the real page-widget instance id, which keeps its
 *  own single underscore as the prefix separator) has its underscores normalized to
 *  hyphens and is joined with a hyphen:
 *
 *    chain = [w_inst001a, w_tmpl001a]        → w_inst001a-w-tmpl001a
 *    chain = [w_inst001a, w_nest01b, w_leaf1] → w_inst001a-w-nest01b-w-leaf1
 *
 *  This is stable across republish (state survives player-side) and is the exact
 *  discrepancy the Go port (CD-506) must adopt too — see the module report. */
function composeExpandedId(chain: string[]): string {
  const [head, ...rest] = chain
  return head + rest.map((s) => '-' + s.replaceAll('_', '-')).join('')
}

/** The effective prop bag: master defaults ← variant overrides ← instance overrides
 *  (component-ops resolvedProps). */
function resolvedProps(
  def: ComponentDef,
  variantId: string | undefined,
  overrides: WidgetInstance['overrides'],
): Record<string, unknown> {
  const variant = variantId ? def.variants?.find((v) => v.id === variantId) : undefined
  return { ...(def.props ?? {}), ...(variant?.overrides ?? {}), ...(overrides ?? {}) }
}

/** Bake resolved props into a config copy for the keys the config already declares —
 *  mirrors component-ops bakeProps (detach keeps what the user resolved to, not the
 *  bare master default; keys the widget does not consume are not injected). */
function bakeProps(config: Record<string, unknown>, props: Record<string, unknown>): Record<string, unknown> {
  const out = { ...config }
  for (const [k, v] of Object.entries(props)) {
    if (k in out) out[k] = v
  }
  return out
}

/** Recursively expand a component into flat ExpandedNodes. Positions accumulate from
 *  `at`; nested instances resolve their OWN variant/overrides. Throws on a cycle. */
function expandComponent(
  project: ProjectDocument,
  componentId: string,
  at: { x: number; y: number },
  idChain: string[],
  seen: string[],
  variantId: string | undefined,
  overrides: WidgetInstance['overrides'],
): ExpandedNode[] {
  const def = project.components?.find((c) => c.id === componentId)
  if (!def) return []
  const props = resolvedProps(def, variantId, overrides)
  const out: ExpandedNode[] = []
  for (const t of def.widgets) {
    const pos = { x: t.frame.x + at.x, y: t.frame.y + at.y }
    if (t.component) {
      if (seen.includes(t.component)) throw new CircularComponentError([...seen, t.component])
      out.push(
        ...expandComponent(
          project,
          t.component,
          pos,
          [...idChain, t.id],
          [...seen, t.component],
          t.variant,
          t.overrides,
        ),
      )
    } else {
      out.push({
        layoutId: composeExpandedId([...idChain, t.id]),
        sourceId: t.id,
        type: t.type,
        frame: { x: pos.x, y: pos.y, w: t.frame.w, h: t.frame.h },
        config: bakeProps(cloneConfig(t.config), props),
      })
    }
  }
  return out
}

/** Build one player-facing layout widget from an expanded/plain node, folding the
 *  registries (looked up by `sourceId`) into placement / appearance / interaction /
 *  config and stripping authoring-only keys. */
function buildWidget(
  project: ProjectDocument,
  node: ExpandedNode,
  columns: number,
  rows: number,
  canvas: { w: number; h: number },
): LayoutWidget {
  const config = cloneConfig(node.config)
  const styleLinks = extractStyleLinks(config)
  // Authoring-only config keys never reach the player.
  delete config.childIds
  delete config.styles

  const appearance: Appearance = {}
  const valueRules: unknown[] = []

  // Shared styles (CD-321): resolve config.styles[kind] → merge style.props into
  // appearance.style, applying kinds in sorted order so the result is deterministic.
  for (const kind of Object.keys(styleLinks).sort()) {
    const style = project.styles?.[styleLinks[kind]!]
    if (style?.props) appearance.style = { ...(appearance.style ?? {}), ...structuredClone(style.props) }
  }

  // Bindings (registries.bindings[sourceId]): prop → binding.
  const bindings = project.bindings?.[node.sourceId]
  if (bindings) {
    for (const prop of Object.keys(bindings).sort()) {
      const b = bindings[prop] as Binding
      if (b.mode === 'variable') {
        // Widget follows a variable's engine state.
        if (b.src !== undefined) appearance.stateBinding = b.src
      } else if (b.mode === 'static') {
        // Literal folds back into config.
        config[prop] = structuredClone(b.val)
      } else if (b.mode === 'expression') {
        // v0: presentation-only expression → a value rule. CD-506 additionally
        // registers a derived engine state and points stateBinding at it.
        valueRules.push({ kind: 'expr', prop, expr: b.expr })
      }
    }
  }

  // States (registries.states[sourceId]): active override baked into config now; the
  // whole machine shipped as value rules for the player to evaluate.
  const state = project.states?.[node.sourceId]
  if (state?.ov) {
    const active = state.active
    if (active && state.ov[active]) {
      for (const [prop, value] of Object.entries(state.ov[active])) config[prop] = structuredClone(value)
    }
    for (const name of Object.keys(state.ov).sort()) {
      valueRules.push({ kind: 'state', state: name, active: name === active, props: structuredClone(state.ov[name]) })
    }
  }

  if (valueRules.length > 0) appearance.valueRules = valueRules

  // Events (registries.events[sourceId]): gesture → flow id becomes an interaction ref.
  const events = project.events?.[node.sourceId]
  const interaction: Record<string, unknown> = {}
  if (events) {
    for (const gesture of Object.keys(events).sort()) interaction[gesture] = { flow: events[gesture] }
  }

  const widget: LayoutWidget = {
    id: node.layoutId,
    type: node.type,
    placement: frameToPlacement(node.frame, columns, rows, canvas),
  }
  if (Object.keys(appearance).length > 0) widget.appearance = appearance
  if (Object.keys(interaction).length > 0) widget.interaction = interaction
  if (Object.keys(config).length > 0) widget.config = config
  return widget
}

/** Map a px frame (authored against the page canvas) onto integer grid cells. col/row
 *  clamp to ≥ 0, spans to ≥ 1 (schema minimums). All four fields are always emitted. */
function frameToPlacement(
  frame: Frame,
  columns: number,
  rows: number,
  canvas: { w: number; h: number },
): Placement {
  const cellW = canvas.w / columns
  const cellH = canvas.h / rows
  return {
    col: Math.max(0, roundHalfUp(frame.x / cellW)),
    row: Math.max(0, roundHalfUp(frame.y / cellH)),
    colSpan: Math.max(1, roundHalfUp(frame.w / cellW)),
    rowSpan: Math.max(1, roundHalfUp(frame.h / cellH)),
  }
}

// ── helpers ───────────────────────────────────────────────────────────────────

function isGroupContainer(w: WidgetInstance): boolean {
  return w.type === GROUP_TYPE || childIdsOf(w).length > 0
}

function extractStyleLinks(config: Record<string, unknown>): Record<string, string> {
  const links = config.styles
  if (!links || typeof links !== 'object') return {}
  return links as Record<string, string>
}

function cloneConfig(config: unknown): Record<string, unknown> {
  return config && typeof config === 'object' ? (structuredClone(config) as Record<string, unknown>) : {}
}
