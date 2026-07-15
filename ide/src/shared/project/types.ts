// ProjectModel domain types (CD-302). Friendly aliases over the generated
// cyberdeck.project contract (src/shared/contract) plus a few authoring-only helper
// shapes. The generated interface is the persisted truth; these names just make the
// model readable. Nothing here invents persisted fields the schema forbids.
import type {
  CyberDeckProjectDocumentCyberdeckProject,
  WidgetInstance,
  Frame,
  Binding,
} from '@/shared/contract'

export type ProjectDocument = CyberDeckProjectDocumentCyberdeckProject
export type { WidgetInstance, Frame, Binding }

export type Page = ProjectDocument['pages'][number]
export type ComponentDef = NonNullable<ProjectDocument['components']>[number]
export type Variant = NonNullable<ComponentDef['variants']>[number]
export type StateDef = NonNullable<ProjectDocument['states']>[string]

/** Container/group widget type. Groups persist as ordinary widgets whose
 *  `config.childIds` lists their children (schema `config` allows any keys), so the
 *  document stays flat + schema-valid while the model derives the nesting tree. */
export const GROUP_TYPE = 'core.group'

/** Reverses a mutation. Every ProjectModel mutation returns one (undo contract). */
export type Inverse = () => void

/** A validation violation from ProjectModel.validate(). */
export interface Diagnostic {
  code:
    | 'duplicate-id'
    | 'dangling-ref'
    | 'circular-nesting'
    | 'name-keyed'
    | 'schema-shape'
    | 'orphan-child'
  message: string
  /** Entity id the diagnostic concerns, when applicable. */
  id?: string
}

export function isContainer(w: WidgetInstance): boolean {
  const cfg = w.config as { childIds?: unknown } | undefined
  return Array.isArray(cfg?.childIds)
}

export function childIdsOf(w: WidgetInstance): string[] {
  const cfg = w.config as { childIds?: unknown } | undefined
  return Array.isArray(cfg?.childIds) ? (cfg!.childIds as string[]) : []
}
