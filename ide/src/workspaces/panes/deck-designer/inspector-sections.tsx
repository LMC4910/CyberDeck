// Per-type inspector sections (CD-313) — the 10 canon kinds. Each renders the fields
// distinctive to that widget kind, reading config with sensible defaults and writing
// through the undoable commitConfig from the registry. Registered by kind (gauge,
// button, …); the Generic fallback (registry) covers anything unregistered.
//
// Importing this module registers the sections as a side effect.
import { registerTypeSection, type TypeSectionProps } from './inspector-registry'
import {
  InspectorSection,
  NumberField,
  TextField,
  ToggleField,
  SelectField,
  SegmentedField,
} from './inspector-fields'

type Cfg = Record<string, unknown>
const num = (c: Cfg, k: string, d: number) => (typeof c[k] === 'number' ? (c[k] as number) : d)
const str = (c: Cfg, k: string, d = '') => (typeof c[k] === 'string' ? (c[k] as string) : d)
const bool = (c: Cfg, k: string, d = false) => (typeof c[k] === 'boolean' ? (c[k] as boolean) : d)

function GaugeSection({ widget, commitConfig }: TypeSectionProps) {
  const c = (widget.config ?? {}) as Cfg
  return (
    <InspectorSection title="Gauge">
      <NumberField label="Value" value={num(c, 'value', 0)} onCommit={(v) => commitConfig({ value: v }, 'Value')} />
      <NumberField label="Min" value={num(c, 'min', 0)} onCommit={(v) => commitConfig({ min: v }, 'Min')} />
      <NumberField label="Max" value={num(c, 'max', 100)} onCommit={(v) => commitConfig({ max: v }, 'Max')} />
      <NumberField label="Warn at" value={num(c, 'warn', 80)} onCommit={(v) => commitConfig({ warn: v }, 'Warn')} />
      <SegmentedField label="Arc" value={str(c, 'arc', 'full')} options={opt('full', 'half', 'quarter')} onCommit={(v) => commitConfig({ arc: v }, 'Arc')} />
      <ToggleField label="Ticks" value={bool(c, 'ticks', true)} onCommit={(v) => commitConfig({ ticks: v }, 'Ticks')} />
    </InspectorSection>
  )
}

function ButtonSection({ widget, commitConfig }: TypeSectionProps) {
  const c = (widget.config ?? {}) as Cfg
  return (
    <InspectorSection title="Button">
      <TextField label="Label" value={str(c, 'label')} onCommit={(v) => commitConfig({ label: v }, 'Label')} />
      <TextField label="Icon" value={str(c, 'icon')} onCommit={(v) => commitConfig({ icon: v }, 'Icon')} />
      <TextField label="Action" value={str(c, 'action')} onCommit={(v) => commitConfig({ action: v }, 'Action')} />
      <SegmentedField label="Style" value={str(c, 'style', 'solid')} options={opt('solid', 'outline', 'ghost')} onCommit={(v) => commitConfig({ style: v }, 'Style')} />
      <ToggleField label="Haptic" value={bool(c, 'haptic', true)} onCommit={(v) => commitConfig({ haptic: v }, 'Haptic')} />
    </InspectorSection>
  )
}

function TextSection({ widget, commitConfig }: TypeSectionProps) {
  const c = (widget.config ?? {}) as Cfg
  return (
    <InspectorSection title="Text">
      <TextField label="Text" value={str(c, 'text')} onCommit={(v) => commitConfig({ text: v }, 'Text')} />
      <NumberField label="Size" value={num(c, 'size', 14)} onCommit={(v) => commitConfig({ size: v }, 'Size')} />
      <SegmentedField label="Align" value={str(c, 'align', 'left')} options={opt('left', 'center', 'right')} onCommit={(v) => commitConfig({ align: v }, 'Align')} />
      <SelectField label="Weight" value={str(c, 'weight', 'regular')} options={opt('regular', 'medium', 'bold')} onCommit={(v) => commitConfig({ weight: v }, 'Weight')} />
    </InspectorSection>
  )
}

function ChartSection({ widget, commitConfig }: TypeSectionProps) {
  const c = (widget.config ?? {}) as Cfg
  return (
    <InspectorSection title="Chart">
      <TextField label="Series" value={str(c, 'series')} onCommit={(v) => commitConfig({ series: v }, 'Series')} />
      <SegmentedField label="Type" value={str(c, 'chartType', 'line')} options={opt('line', 'bar', 'area')} onCommit={(v) => commitConfig({ chartType: v }, 'Chart type')} />
      <NumberField label="Max pts" value={num(c, 'maxPoints', 60)} onCommit={(v) => commitConfig({ maxPoints: v }, 'Max points')} />
      <ToggleField label="Legend" value={bool(c, 'legend', true)} onCommit={(v) => commitConfig({ legend: v }, 'Legend')} />
    </InspectorSection>
  )
}

function StatSection({ widget, commitConfig }: TypeSectionProps) {
  const c = (widget.config ?? {}) as Cfg
  return (
    <InspectorSection title="Stat">
      <TextField label="Label" value={str(c, 'label')} onCommit={(v) => commitConfig({ label: v }, 'Label')} />
      <TextField label="Unit" value={str(c, 'unit')} onCommit={(v) => commitConfig({ unit: v }, 'Unit')} />
      <NumberField label="Decimals" value={num(c, 'precision', 0)} onCommit={(v) => commitConfig({ precision: v }, 'Decimals')} />
      <ToggleField label="Trend" value={bool(c, 'trend', false)} onCommit={(v) => commitConfig({ trend: v }, 'Trend')} />
    </InspectorSection>
  )
}

function ImageSection({ widget, commitConfig }: TypeSectionProps) {
  const c = (widget.config ?? {}) as Cfg
  return (
    <InspectorSection title="Image">
      <TextField label="Source" value={str(c, 'src')} onCommit={(v) => commitConfig({ src: v }, 'Source')} />
      <SegmentedField label="Fit" value={str(c, 'fit', 'cover')} options={opt('cover', 'contain', 'fill')} onCommit={(v) => commitConfig({ fit: v }, 'Fit')} />
      <NumberField label="Radius" value={num(c, 'radius', 0)} onCommit={(v) => commitConfig({ radius: v }, 'Radius')} />
    </InspectorSection>
  )
}

function MediaSection({ widget, commitConfig }: TypeSectionProps) {
  const c = (widget.config ?? {}) as Cfg
  return (
    <InspectorSection title="Media">
      <TextField label="Source" value={str(c, 'src')} onCommit={(v) => commitConfig({ src: v }, 'Source')} />
      <ToggleField label="Autoplay" value={bool(c, 'autoplay', false)} onCommit={(v) => commitConfig({ autoplay: v }, 'Autoplay')} />
      <ToggleField label="Loop" value={bool(c, 'loop', false)} onCommit={(v) => commitConfig({ loop: v }, 'Loop')} />
      <ToggleField label="Muted" value={bool(c, 'muted', true)} onCommit={(v) => commitConfig({ muted: v }, 'Muted')} />
    </InspectorSection>
  )
}

function InputSection({ widget, commitConfig }: TypeSectionProps) {
  const c = (widget.config ?? {}) as Cfg
  return (
    <InspectorSection title="Input">
      <TextField label="Placeholder" value={str(c, 'placeholder')} onCommit={(v) => commitConfig({ placeholder: v }, 'Placeholder')} />
      <SelectField label="Kind" value={str(c, 'inputKind', 'text')} options={opt('text', 'number', 'toggle')} onCommit={(v) => commitConfig({ inputKind: v }, 'Kind')} />
      <NumberField label="Min" value={num(c, 'min', 0)} onCommit={(v) => commitConfig({ min: v }, 'Min')} />
      <NumberField label="Max" value={num(c, 'max', 100)} onCommit={(v) => commitConfig({ max: v }, 'Max')} />
    </InspectorSection>
  )
}

function ContainerSection({ widget, commitConfig }: TypeSectionProps) {
  const c = (widget.config ?? {}) as Cfg
  return (
    <InspectorSection title="Container">
      <SegmentedField label="Layout" value={str(c, 'layout', 'free')} options={opt('free', 'row', 'col')} onCommit={(v) => commitConfig({ layout: v }, 'Layout')} />
      <NumberField label="Gap" value={num(c, 'gap', 8)} onCommit={(v) => commitConfig({ gap: v }, 'Gap')} />
      <NumberField label="Padding" value={num(c, 'padding', 0)} onCommit={(v) => commitConfig({ padding: v }, 'Padding')} />
    </InspectorSection>
  )
}

function opt(...values: string[]): { value: string; label: string }[] {
  return values.map((v) => ({ value: v, label: v[0]!.toUpperCase() + v.slice(1) }))
}

registerTypeSection('gauge', GaugeSection)
registerTypeSection('button', ButtonSection)
registerTypeSection('text', TextSection)
registerTypeSection('chart', ChartSection)
registerTypeSection('stat', StatSection)
registerTypeSection('image', ImageSection)
registerTypeSection('media', MediaSection)
registerTypeSection('input', InputSection)
registerTypeSection('container', ContainerSection)

/** The registered canon kinds (for tests + tooling). Generic is the fallback. */
export const CANON_KINDS = ['gauge', 'button', 'text', 'chart', 'stat', 'image', 'media', 'input', 'container', 'generic'] as const
