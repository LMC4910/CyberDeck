// Project templates (CD-405 dashboard cards / CD-406 wizard). A template is a
// document factory: given a name and a target device it returns a schema-valid
// cyberdeck.project, freshly keyed. Templates never share ids between builds —
// every call mints its own through the model's IdAllocator (AUDIT C3: ids are
// opaque and never derived from the name the user typed).
import { IdAllocator, ID_PREFIX, starterProject, type ProjectDocument, type WidgetInstance } from '@/shared/project'
import type { ProjectRecord } from '@/services/project'
import { DESIGN_WORKSPACE } from './use-projects-env'

/** Authoring canvas per target device — a new project is framed for its screen. */
export interface DeviceTarget {
  id: string
  label: string
  canvas: { w: number; h: number }
}

export const DEVICE_TARGETS: DeviceTarget[] = [
  { id: 'ipad', label: 'Tablet — 1180 × 820', canvas: { w: 1180, h: 820 } },
  { id: 'pixel', label: 'Phone — 915 × 412', canvas: { w: 915, h: 412 } },
  { id: 'deck', label: 'Stream Deck — 480 × 270', canvas: { w: 480, h: 270 } },
  { id: 'desktop', label: 'Desktop — 1440 × 900', canvas: { w: 1440, h: 900 } },
]

export function deviceTarget(id: string): DeviceTarget | undefined {
  return DEVICE_TARGETS.find((d) => d.id === id)
}

export interface TemplateInput {
  name: string
  deviceId: string
  /** ISO stamp for meta.createdAt (injectable for tests). */
  now?: () => string
}

export interface ProjectTemplate {
  id: string
  label: string
  description: string
  /** Builds the page widgets; frames are authored against `canvas`. */
  build: (ids: IdAllocator, canvas: { w: number; h: number }) => WidgetInstance[]
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'blank',
    label: 'Blank',
    description: 'One empty page, framed for your device. Start from nothing.',
    build: () => [],
  },
  {
    id: 'starter',
    label: 'Starter Deck',
    description: 'A CPU gauge, an FPS readout and an action button — the shipped starter.',
    // Reuses the canonical starter (CD-304) so there is one definition of "starter"
    // in the codebase; only the ids are re-minted so two starters never collide.
    build: (ids) => starterProject().pages[0].widgets.map((w) => ({ ...w, id: ids.next(ID_PREFIX.widget) })),
  },
  {
    id: 'telemetry',
    label: 'Telemetry Wall',
    description: 'A four-up grid of stat readouts for system telemetry.',
    build: (ids, canvas) => {
      const cols = 2
      const gap = 16
      const w = Math.floor((canvas.w - gap * (cols + 1)) / cols)
      const h = Math.floor(Math.min(160, (canvas.h - gap * 3) / 2))
      return ['CPU', 'GPU', 'RAM', 'FPS'].map((name, i) => ({
        id: ids.next(ID_PREFIX.widget),
        type: 'stat.readout',
        name,
        frame: {
          x: gap + (i % cols) * (w + gap),
          y: gap + Math.floor(i / cols) * (h + gap),
          w,
          h,
        },
      }))
    },
  },
]

export function projectTemplate(id: string): ProjectTemplate | undefined {
  return PROJECT_TEMPLATES.find((t) => t.id === id)
}

export class UnknownTemplateError extends Error {
  constructor(what: string, id: string) {
    super(`unknown ${what}: "${id}"`)
    this.name = 'UnknownTemplateError'
  }
}

/**
 * Build a stored-ready project record from a template. The record carries its own
 * storage key so the caller knows the id before the create round-trips.
 *
 * No `devices` assignment is written: a device target frames the canvas, it does not
 * pair hardware — pairing is the Devices workspace's job (CD-415+).
 */
export function buildProject(templateId: string, input: TemplateInput): ProjectRecord {
  const template = projectTemplate(templateId)
  if (!template) throw new UnknownTemplateError('template', templateId)
  const device = deviceTarget(input.deviceId)
  if (!device) throw new UnknownTemplateError('device target', input.deviceId)

  const ids = new IdAllocator()
  const now = input.now ?? (() => new Date().toISOString())
  const pageId = ids.next(ID_PREFIX.page)
  const doc: ProjectDocument = {
    format: 'cyberdeck.project',
    version: 1,
    meta: { name: input.name, workspace: DESIGN_WORKSPACE, createdAt: now() },
    pages: [
      {
        id: pageId,
        name: 'Main Deck',
        canvas: { ...device.canvas },
        widgets: template.build(ids, device.canvas),
      },
    ],
  }
  return { ...doc, id: ids.next('proj') }
}

/** Clone a record under a new storage key + name (the row menu's Duplicate). */
export function duplicateProject(record: ProjectRecord, name: string): ProjectRecord {
  const copy = structuredClone(record) as ProjectRecord
  // Entity ids are per-document, so the subtree keeps its keys; only the storage
  // key and the display name change.
  return { ...copy, id: new IdAllocator().next('proj'), meta: { ...copy.meta, name } }
}

/** "Battlestation" → "Battlestation copy", then "… copy 2" against existing names. */
export function copyName(name: string, taken: readonly string[]): string {
  const base = `${name} copy`
  if (!taken.includes(base)) return base
  for (let n = 2; ; n++) {
    const candidate = `${base} ${n}`
    if (!taken.includes(candidate)) return candidate
  }
}
