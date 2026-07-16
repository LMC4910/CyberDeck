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
import { addVariant, swapVariant, deleteVariantAndRemap, detachInstance, findInstances, nestingPath } from './component-ops'
import {
  OVERRIDE_FIELDS,
  effectiveValue,
  isOverridden,
  overrideCount,
  setInstanceOverride,
  revertOverride,
  resetAllOverrides,
} from './override-ops'
import { ColorField } from './inspector-fields'
import { STYLE_KINDS, linkedStyleId, newStyleFromWidget, linkStyle, unlinkStyle, setStyleProp, stylesOfKind } from './style-ops'
import type { StyleKind } from '@/shared/project'
import { BindingsSection } from './bindings-section'
import { allStates, activeState, stateDelta, setActive, setDelta, addCustomState, removeCustomState, STATE_DELTA_FIELDS, STANDARD_STATES } from './state-ops'
import { GESTURES, GESTURE_LABELS, FLOWS_CATALOG, flowById, assignFlow, disconnectFlow } from './flows-catalog'
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
      {ids.length === 1 && !single?.component && <StylesSection model={model} widgetId={ids[0]!} undo={undo} engine={engine} />}
      {ids.length === 1 && <BindingsSection model={model} widgetId={ids[0]!} undo={undo} />}
      {ids.length === 1 && <StatesSection model={model} widgetId={ids[0]!} undo={undo} />}
      {ids.length === 1 && <EventsSection model={model} widgetId={ids[0]!} undo={undo} />}
      {single?.component && <ComponentSection model={model} instanceId={single.id} componentId={single.component} undo={undo} engine={engine} pageId={pageId} />}
      {single?.component && <VariantSection model={model} instanceId={single.id} componentId={single.component} undo={undo} engine={engine} pageId={pageId} />}
      {single?.component && <OverrideSection model={model} instanceId={single.id} undo={undo} engine={engine} />}
      {ids.length > 1 && <MultiArrange model={model} ids={ids} undo={undo} />}
    </div>
  )
}

// ── events + flow drawer (CD-328) ────────────────────────────────────────────────
function EventsSection({ model, widgetId, undo }: { model: ProjectModel; widgetId: string; undo: UndoStack }) {
  const ctx = { model, undo }
  const events = model.eventsOf(widgetId) ?? {}
  return (
    <InspectorSection title="Events">
      {GESTURES.map((g) => {
        const flowId = events[g]
        const flow = flowId ? flowById(flowId) : undefined
        return (
          <div key={g} className="dd-event-row" data-gesture={g}>
            <SelectField
              label={GESTURE_LABELS[g]}
              value={flowId ?? ''}
              options={[{ value: '', label: '— none —' }, ...FLOWS_CATALOG.map((f) => ({ value: f.id, label: f.name }))]}
              onCommit={(v) => (v ? assignFlow(ctx, widgetId, g, v) : disconnectFlow(ctx, widgetId, g))}
            />
            {flow && (
              <div className="dd-flow-drawer" data-testid={`flow-${g}`}>
                <span className="dd-flow-preview" aria-label="Flow preview">
                  {flow.trigger} → {flow.action}
                </span>
                <button type="button" className="dd-flow-open" data-testid={`open-flows-${g}`} disabled title="Opens the Flows workspace (arrives in M4)">
                  Open in Flows ↗
                </button>
                <button type="button" className="dd-bind-x" data-testid={`disconnect-${g}`} aria-label={`Disconnect ${g}`} onClick={() => disconnectFlow(ctx, widgetId, g)}>
                  ×
                </button>
              </div>
            )}
          </div>
        )
      })}
    </InspectorSection>
  )
}

// ── widget states (CD-327) ──────────────────────────────────────────────────────
function StatesSection({ model, widgetId, undo }: { model: ProjectModel; widgetId: string; undo: UndoStack }) {
  const ctx = { model, undo }
  const states = allStates(model, widgetId)
  const active = activeState(model, widgetId)
  const delta = stateDelta(model, widgetId, active)
  return (
    <InspectorSection title="States">
      <div className="dd-state-chips" role="group" aria-label="States">
        {states.map((s) => (
          <button
            key={s}
            type="button"
            className="dd-state-chip"
            aria-pressed={active === s}
            data-state={s}
            onClick={() => setActive(ctx, widgetId, s)}
          >
            {s}
            {!STANDARD_STATES.includes(s as never) && (
              <span className="dd-state-x" role="button" aria-label={`Remove ${s}`} onClick={(e) => { e.stopPropagation(); removeCustomState(ctx, widgetId, s) }}>×</span>
            )}
          </button>
        ))}
        <button type="button" className="dd-chip" data-testid="add-state" onClick={() => addCustomState(ctx, widgetId, `state${states.length}`)}>
          ＋
        </button>
      </div>
      {active !== 'default' &&
        STATE_DELTA_FIELDS.map((f) => (
          <NumberField
            key={f.prop}
            label={f.label}
            step={f.step}
            value={typeof delta[f.prop] === 'number' ? (delta[f.prop] as number) : f.def}
            onCommit={(v) => setDelta(ctx, widgetId, active, f.prop, v)}
          />
        ))}
    </InspectorSection>
  )
}

// ── shared styles (CD-321) ──────────────────────────────────────────────────────
function StylesSection({ model, widgetId, undo, engine }: { model: ProjectModel; widgetId: string; undo: UndoStack; engine: SelectionEngine }) {
  const w = model.widget(widgetId)
  if (!w) return null
  const ctx = { model, undo, engine }
  return (
    <InspectorSection title="Styles">
      {STYLE_KINDS.map(({ kind, label, props }) => {
        const linkedId = linkedStyleId(w, kind as StyleKind)
        const style = linkedId ? model.style(linkedId) : undefined
        const options = stylesOfKind(model, kind as StyleKind)
        return (
          <div key={kind} className="dd-style-row" data-style-kind={kind}>
            {style ? (
              <>
                <span className="dd-style-chip" data-style-linked={linkedId}>
                  {label}: {style.name} <span className="dd-style-refs" data-testid={`refs-${kind}`}>×{model.styleRefCount(linkedId!)}</span>
                </span>
                {props.map((p) => {
                  const val = (style.props ?? {})[p]
                  return p === 'color' ? (
                    <ColorField key={p} label={p} value={typeof val === 'string' ? val : ''} onCommit={(v) => setStyleProp(ctx, linkedId!, p, v)} />
                  ) : (
                    <NumberField key={p} label={p} value={typeof val === 'number' ? val : 0} onCommit={(v) => setStyleProp(ctx, linkedId!, p, v)} />
                  )
                })}
                <button type="button" className="dd-insp-btn" data-testid={`detach-${kind}`} onClick={() => unlinkStyle(ctx, widgetId, kind as StyleKind)}>
                  Detach
                </button>
              </>
            ) : (
              <SelectField
                label={label}
                value=""
                options={[{ value: '', label: '— none —' }, ...options.map((o) => ({ value: o.id, label: o.name })), { value: '__new', label: '＋ New from selection' }]}
                onCommit={(v) => {
                  if (v === '__new') newStyleFromWidget(ctx, widgetId, kind as StyleKind, `${label} ${options.length + 1}`)
                  else if (v) linkStyle(ctx, widgetId, kind as StyleKind, v)
                }}
              />
            )}
          </div>
        )
      })}
    </InspectorSection>
  )
}

// ── component section (CD-320): master info + instance actions, adapts to nesting ──
const META_DESC = '__description'
const META_CAT = '__category'
const META_EXPOSED = '__exposed'

function ComponentSection({ model, instanceId, componentId, undo, engine, pageId }: { model: ProjectModel; instanceId: string; componentId: string; undo: UndoStack; engine: SelectionEngine; pageId: string }) {
  const def = model.component(componentId)
  if (!def) return null
  const props = (def.props ?? {}) as Record<string, unknown>
  const exposed = Array.isArray(props[META_EXPOSED]) ? (props[META_EXPOSED] as string[]) : OVERRIDE_FIELDS.map((f) => f.prop)
  const instances = findInstances(model, componentId)
  const path = nestingPath(model, componentId)
  const setMeta = (key: string, value: unknown) => undo.execUndoable('Component meta', () => model.setComponentProp(componentId, key, value), { coalesceKey: `cmeta:${componentId}:${key}` })

  return (
    <InspectorSection title="Component">
      {path.length > 1 && (
        <p className="dd-nesting-crumb" data-testid="nesting-crumb">
          Nested: {path.join(' › ')}
        </p>
      )}
      <TextField label="Name" value={def.name} onCommit={(v) => undo.execUndoable('Rename component', () => model.renameComponent(componentId, v))} />
      <TextField label="Description" value={typeof props[META_DESC] === 'string' ? (props[META_DESC] as string) : ''} onCommit={(v) => setMeta(META_DESC, v || undefined)} />
      <TextField label="Category" value={typeof props[META_CAT] === 'string' ? (props[META_CAT] as string) : ''} onCommit={(v) => setMeta(META_CAT, v || undefined)} />

      <div className="dd-insp-exposed" role="group" aria-label="Exposed properties">
        <span className="dd-field-label">Exposed</span>
        {OVERRIDE_FIELDS.map((f) => (
          <label key={f.prop} className="dd-expose-chip">
            <input
              type="checkbox"
              checked={exposed.includes(f.prop)}
              onChange={(e) => {
                const next = e.target.checked ? [...new Set([...exposed, f.prop])] : exposed.filter((p) => p !== f.prop)
                setMeta(META_EXPOSED, next)
              }}
            />
            {f.label}
          </label>
        ))}
      </div>

      <div className="dd-insp-row">
        <button type="button" className="dd-insp-btn" data-testid="find-instances" onClick={() => engine.selectMany(instances)}>
          {instances.length} instance{instances.length === 1 ? '' : 's'}
        </button>
        <button type="button" className="dd-insp-btn" data-testid="detach-instance" onClick={() => detachInstance({ model, engine, undo, pageId }, instanceId)}>
          Detach
        </button>
      </div>
    </InspectorSection>
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

// ── instance overrides (CD-318) ─────────────────────────────────────────────────
function OverrideSection({ model, instanceId, undo, engine }: { model: ProjectModel; instanceId: string; undo: UndoStack; engine: SelectionEngine }) {
  const inst = model.widget(instanceId)
  if (!inst) return null
  const ctx = { model, undo, engine }
  const count = overrideCount(inst)
  const asStr = (v: unknown) => (typeof v === 'string' ? v : '')
  const asNum = (v: unknown) => (typeof v === 'number' ? v : 0)
  const asBool = (v: unknown) => v !== false
  return (
    <InspectorSection title={`Overrides${count ? ` (${count})` : ''}`}>
      {OVERRIDE_FIELDS.map(({ prop, label, kind }) => {
        const overridden = isOverridden(inst, prop)
        const value = effectiveValue(model, inst, prop)
        const dot = (
          <span className="dd-override-row" data-prop={prop} data-overridden={overridden || undefined}>
            {overridden && (
              <button type="button" className="dd-override-dot" data-testid={`revert-${prop}`} aria-label={`Revert ${label}`} title="Revert to master" onClick={() => revertOverride(ctx, instanceId, prop)}>
                ●
              </button>
            )}
          </span>
        )
        return (
          <div key={prop} className="dd-override-field">
            {kind === 'text' && <TextField label={label} value={asStr(value)} onCommit={(v) => setInstanceOverride(ctx, instanceId, prop, v)} />}
            {kind === 'number' && <NumberField label={label} value={asNum(value)} onCommit={(v) => setInstanceOverride(ctx, instanceId, prop, v)} />}
            {kind === 'color' && <ColorField label={label} value={asStr(value)} onCommit={(v) => setInstanceOverride(ctx, instanceId, prop, v)} />}
            {kind === 'toggle' && <ToggleField label={label} value={asBool(value)} onCommit={(v) => setInstanceOverride(ctx, instanceId, prop, v)} />}
            {dot}
          </div>
        )
      })}
      {count > 0 && (
        <button type="button" className="dd-insp-btn" data-testid="reset-overrides" onClick={() => resetAllOverrides(ctx, instanceId)}>
          Reset all ({count})
        </button>
      )}
    </InspectorSection>
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
