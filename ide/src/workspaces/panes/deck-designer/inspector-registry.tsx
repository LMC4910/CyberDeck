// Contextual inspector registry (CD-312). `sectionFor(type)` returns the per-type
// section component keyed by widget manifest type; CD-313 registers the 10 canon
// kinds. Until a kind is registered, the Generic section renders the widget's config
// keys with the right field primitive. Config keys owned by other sections
// (geometry, layer chrome) are excluded here.
import { NumberField, TextField, ToggleField, InspectorSection } from './inspector-fields'
import type { WidgetInstance } from '@/shared/project'

export interface TypeSectionProps {
  widget: WidgetInstance
  /** Commit a shallow config patch as one undoable step (coalesced per prop). */
  commitConfig: (patch: Record<string, unknown>, label: string) => void
}

export type TypeSection = (props: TypeSectionProps) => React.ReactElement | null

const REGISTRY = new Map<string, TypeSection>()

export function registerTypeSection(type: string, section: TypeSection): void {
  REGISTRY.set(type, section)
}

export function sectionFor(type: string): TypeSection {
  return REGISTRY.get(type) ?? GenericSection
}

/** Config keys the geometry / layer sections own — never shown in a type section. */
const RESERVED = new Set(['childIds', 'hidden', 'colorLabel', 'rotation', 'opacity'])

export function GenericSection({ widget, commitConfig }: TypeSectionProps): React.ReactElement | null {
  const config = (widget.config ?? {}) as Record<string, unknown>
  const keys = Object.keys(config).filter((k) => !RESERVED.has(k))
  if (keys.length === 0) return null
  return (
    <InspectorSection title="Configuration">
      {keys.map((k) => {
        const val = config[k]
        if (typeof val === 'number') {
          return <NumberField key={k} label={k} value={val} onCommit={(v) => commitConfig({ [k]: v }, `Set ${k}`)} />
        }
        if (typeof val === 'boolean') {
          return <ToggleField key={k} label={k} value={val} onCommit={(v) => commitConfig({ [k]: v }, `Set ${k}`)} />
        }
        if (typeof val === 'string') {
          return <TextField key={k} label={k} value={val} onCommit={(v) => commitConfig({ [k]: v }, `Set ${k}`)} />
        }
        return null
      })}
    </InspectorSection>
  )
}
