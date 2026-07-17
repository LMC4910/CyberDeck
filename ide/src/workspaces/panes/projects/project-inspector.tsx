// Project inspector (CD-405). Renders the SELECTED row — meta, stats and device
// assignments are all derived from that project's document (see project-summary),
// so the panel can never show a number the document does not actually contain.
import { formatStamp, type ProjectSummary } from './project-summary'

export interface ProjectInspectorProps {
  summary: ProjectSummary | null
  /** True when this project is the one open in the authoring workspace. */
  isOpen: boolean
  onOpen: (summary: ProjectSummary) => void
}

export function ProjectInspector({ summary, isOpen, onOpen }: ProjectInspectorProps) {
  if (!summary) {
    return (
      <aside className="pj-inspector" aria-label="Project inspector" data-testid="project-inspector">
        <p className="pj-empty">Select a project to inspect it.</p>
      </aside>
    )
  }

  const { stats } = summary
  return (
    <aside className="pj-inspector" aria-label="Project inspector" data-testid="project-inspector">
      <header className="pj-inspector-head">
        <h2 className="pj-inspector-title" data-testid="inspector-name">
          {summary.name}
        </h2>
        <button
          type="button"
          className="pj-btn pj-btn-primary"
          onClick={() => onOpen(summary)}
          disabled={isOpen}
          title={isOpen ? 'This project is already open' : undefined}
        >
          {isOpen ? 'Open' : 'Open project'}
        </button>
      </header>

      <Section title="Meta">
        <Field label="ID" value={summary.id} mono />
        <Field label="Workspace" value={summary.workspace ?? '—'} />
        <Field label="Created" value={formatStamp(summary.createdAt)} />
        <Field label="Updated" value={formatStamp(summary.savedAt)} />
      </Section>

      <Section title="Stats">
        <Field label="Pages" value={String(stats.pages)} />
        <Field label="Widgets" value={String(stats.widgets)} />
        <Field label="Components" value={String(stats.components)} />
        <Field label="Bound widgets" value={String(stats.bound)} />
        <Field label="Shared styles" value={String(stats.styles)} />
        <Field label="Assets" value={String(stats.assets)} />
      </Section>

      <Section title={`Devices (${summary.devices.length})`}>
        {summary.devices.length === 0 ? (
          <p className="pj-muted" data-testid="inspector-no-devices">
            No devices assigned. Pair one in the Devices workspace.
          </p>
        ) : (
          <ul className="pj-devices">
            {summary.devices.map((d) => (
              <li key={d.id} className="pj-device" data-device={d.id}>
                <span className="pj-device-name">{d.name ?? d.id}</span>
                <span className="pj-device-class">{d.deviceClass}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </aside>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="pj-inspector-section" aria-label={title}>
      <h3 className="pj-inspector-section-title">{title}</h3>
      {children}
    </section>
  )
}

function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="pj-field">
      <span className="pj-field-label">{label}</span>
      <span className={mono ? 'pj-field-value pj-mono' : 'pj-field-value'}>{value}</span>
    </div>
  )
}
