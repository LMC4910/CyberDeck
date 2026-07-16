// Contextual inspector (CD-312). One panel, three faces driven by the shared
// selection store: nothing selected → Page Properties; a single widget → Layer +
// Transform + its type section (CD-313 registry); a multi-selection → Arrange
// (align / distribute / group). Every field writes through an undoable model command.
import { useSyncExternalStore } from 'react'
import { isContainer, type ProjectModel } from '@/shared/project'
import type { UndoStack } from '@/platform/undo'
import { useProjectModel } from './use-project-model'
import { useSelection, useSelectionState } from './use-selection'
import { useUndo } from './use-undo'
import type { SelectionEngine } from '@/stores'
import { addVariant, swapVariant, deleteVariantAndRemap } from './component-ops'
import { useCanvasSettings, useCanvasSettingsStore } from './use-canvas-settings'
import {
  InspectorSection,
  NumberField,
  TextField,
  ToggleField,
  SegmentedField,
  SelectField,
} from './inspector-fields'
import { sectionFor } from './inspector-registry'
import './inspector-sections' // registers the 10 canon kinds (CD-313)
import { alignFrames, distributeFrames, type AlignKind, type DistributeKind } from './align'
import { CANVAS_COMMANDS } from './canvas-commands'
import { useCommands } from './use-commands'
import './inspector.css'

function useModelRevision(model: ProjectModel): number {
  return useSyncExternalStore((cb) => model.subscribe(cb), () => model.revision)
}

export function InspectorPanel({ pageId }: { pageId: string }) {
  const model = useProjectModel()
  const engine = useSelection()
  const undo = useUndo()
  const selection = useSelectionState()
  useModelRevision(model)

  const ids = selection.kind === 'widget' ? selection.ids : []
  const single = ids.length === 1 ? model.widget(ids[0]!) : undefined
  return (
    <div className="dd-inspector" data-testid="inspector-panel" data-mode={inspectorMode(selection.kind, ids.length)}>
      {ids.length === 0 && <PageProperties model={model} pageId={pageId} undo={undo} />}
      {ids.length === 1 && <SingleWidget model={model} id={ids[0]!} undo={undo} />}
      {single?.component && <VariantSection model={model} instanceId={single.id} componentId={single.component} undo={undo} engine={engine} pageId={pageId} />}
      {ids.length > 1 && <MultiArrange model={model} ids={ids} undo={undo} />}
    </div>
  )
}

// ── instance variants (CD-317) ──────────────────────────────────────────────────
function VariantSection({ model, instanceId, componentId, undo, engine, pageId }: { model: ProjectModel; instanceId: string; componentId: string; undo: UndoStack; engine: SelectionEngine; pageId: string }) {
  const def = model.component(componentId)
  if (!def) return null
  const variants = def.variants ?? []
  const instance = model.widget(instanceId)
  const ctx = { model, undo, engine, pageId }
  return (
    <InspectorSection title="Variants">
      <SelectField
        label="Variant"
        value={instance?.variant ?? ''}
        options={[{ value: '', label: 'Default' }, ...variants.map((v) => ({ value: v.id, label: v.name }))]}
        onCommit={(v) => swapVariant(ctx, instanceId, v || undefined)}
      />
      <div className="dd-insp-row">
        <button type="button" className="dd-insp-btn" data-testid="variant-add" onClick={() => addVariant(ctx, componentId, `Variant ${variants.length + 1}`)}>
          Add variant
        </button>
        {instance?.variant && (
          <button type="button" className="dd-insp-btn" data-testid="variant-delete" onClick={() => deleteVariantAndRemap(ctx, componentId, instance.variant!)}>
            Delete
          </button>
        )}
      </div>
      {variants.length > 0 && (
        <div className="dd-variant-chips" role="group" aria-label="Variants">
          {variants.map((v) => (
            <button
              key={v.id}
              type="button"
              className="dd-variant-chip"
              aria-pressed={instance?.variant === v.id}
              data-variant={v.id}
              onClick={() => swapVariant(ctx, instanceId, v.id)}
            >
              {v.name}
            </button>
          ))}
        </div>
      )}
    </InspectorSection>
  )
}

function inspectorMode(kind: string, count: number): 'none' | 'single' | 'multi' | 'page' {
  if (kind === 'page') return 'page'
  if (count === 0) return 'none'
  return count === 1 ? 'single' : 'multi'
}

// ── none → Page Properties ───────────────────────────────────────────────────
function PageProperties({ model, pageId, undo }: { model: ProjectModel; pageId: string; undo: UndoStack }) {
  const page = model.page(pageId)
  const settingsStore = useCanvasSettingsStore()
  const settings = useCanvasSettings()
  const canvas = page?.canvas ?? {}
  const commitCanvas = (patch: { w?: number; h?: number }, label: string) =>
    undo.execUndoable(label, () => model.setPageCanvas(pageId, patch), { coalesceKey: `canvas:${label}` })
  return (
    <>
      <InspectorSection title="Page">
        <TextField label="Name" value={page?.name ?? ''} onCommit={(v) => undo.execUndoable('Rename page', () => model.renamePage(pageId, v))} />
        <NumberField label="Width" value={canvas.w ?? 0} onCommit={(v) => commitCanvas({ w: v }, 'Canvas width')} />
        <NumberField label="Height" value={canvas.h ?? 0} onCommit={(v) => commitCanvas({ h: v }, 'Canvas height')} />
      </InspectorSection>
      <InspectorSection title="Grid & Snap">
        <NumberField label="Grid" value={settings.grid} onCommit={(v) => settingsStore.setState((s) => ({ ...s, grid: v }))} />
        <ToggleField label="Snap" value={settings.snap} onCommit={(v) => settingsStore.setState((s) => ({ ...s, snap: v }))} />
      </InspectorSection>
    </>
  )
}

// ── single widget ─────────────────────────────────────────────────────────────
function SingleWidget({ model, id, undo }: { model: ProjectModel; id: string; undo: UndoStack }) {
  const widget = model.widget(id)
  if (!widget) return null
  const cfg = (widget.config ?? {}) as { rotation?: number; opacity?: number }
  const setFrame = (patch: Partial<typeof widget.frame>, label: string) =>
    undo.execUndoable(label, () => model.updateFrame(id, { ...widget.frame, ...patch }), { coalesceKey: `frame:${id}:${label}` })
  const setConfig = (patch: Record<string, unknown>, label: string) =>
    undo.execUndoable(label, () => model.updateConfig(id, patch), { coalesceKey: `config:${id}:${label}` })
  const TypeSection = sectionFor(widget.type)
  return (
    <>
      <InspectorSection title="Layer">
        <TextField label="Name" value={widget.name ?? ''} onCommit={(v) => undo.execUndoable('Rename', () => model.setName(id, v))} />
        <ToggleField label="Locked" value={!!widget.locked} onCommit={(v) => undo.execUndoable(v ? 'Lock' : 'Unlock', () => model.setLocked(id, v))} />
        <NumberField label="Opacity" step={0.1} value={cfg.opacity ?? 1} onCommit={(v) => setConfig({ opacity: v }, 'Opacity')} />
      </InspectorSection>
      <InspectorSection title="Transform">
        <NumberField label="X" value={widget.frame.x} onCommit={(v) => setFrame({ x: v }, 'X')} />
        <NumberField label="Y" value={widget.frame.y} onCommit={(v) => setFrame({ y: v }, 'Y')} />
        <NumberField label="W" value={widget.frame.w} onCommit={(v) => setFrame({ w: Math.max(1, v) }, 'W')} />
        <NumberField label="H" value={widget.frame.h} onCommit={(v) => setFrame({ h: Math.max(1, v) }, 'H')} />
        <NumberField label="Rotation" value={cfg.rotation ?? 0} onCommit={(v) => setConfig({ rotation: v }, 'Rotation')} />
      </InspectorSection>
      <TypeSection widget={widget} commitConfig={setConfig} />
    </>
  )
}

// ── multi → Arrange ─────────────────────────────────────────────────────────────
const ALIGN_OPTIONS: { value: AlignKind; label: string }[] = [
  { value: 'left', label: '⇤' },
  { value: 'hcenter', label: '↔' },
  { value: 'right', label: '⇥' },
  { value: 'top', label: '⤒' },
  { value: 'vcenter', label: '↕' },
  { value: 'bottom', label: '⤓' },
]

function MultiArrange({ model, ids, undo }: { model: ProjectModel; ids: string[]; undo: UndoStack }) {
  const commands = useCommands()
  const items = () => ids.map((id) => ({ id, frame: model.widget(id)!.frame })).filter((i) => i.frame)
  const applyFrames = (next: Map<string, import('@/shared/project').Frame>, label: string) => {
    if (next.size === 0) return
    undo.execUndoable(label, () => {
      const inverses = [...next].map(([id, f]) => model.updateFrame(id, f))
      return () => inverses.reverse().forEach((inv) => inv())
    })
  }
  const containers = ids.some((id) => {
    const w = model.widget(id)
    return w && isContainer(w)
  })
  return (
    <>
      <InspectorSection title={`${ids.length} selected`}>
        <SegmentedField
          label="Align"
          value=""
          options={ALIGN_OPTIONS}
          onCommit={(k) => applyFrames(alignFrames(items(), k as AlignKind), `Align ${k}`)}
        />
        <div className="dd-insp-row">
          <button type="button" className="dd-insp-btn" onClick={() => applyFrames(distributeFrames(items(), 'horizontal' as DistributeKind), 'Distribute H')}>
            Distribute H
          </button>
          <button type="button" className="dd-insp-btn" onClick={() => applyFrames(distributeFrames(items(), 'vertical' as DistributeKind), 'Distribute V')}>
            Distribute V
          </button>
        </div>
        <div className="dd-insp-row">
          <button type="button" className="dd-insp-btn" data-testid="arrange-group" onClick={() => void commands.execute(CANVAS_COMMANDS.group, undefined, {})}>
            Group
          </button>
          {containers && (
            <button type="button" className="dd-insp-btn" onClick={() => void commands.execute(CANVAS_COMMANDS.ungroup, undefined, {})}>
              Ungroup
            </button>
          )}
        </div>
      </InspectorSection>
    </>
  )
}
