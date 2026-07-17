// Dashboard cards (CD-405). Projects is the first-boot landing workspace, so a cold
// start has to be useful: Recents gets you back into what you were building, and
// Templates gets you into something new in one click. Recents is the persisted MRU
// (CD-406) — it re-reads on every open, so the card is never stale.
import { useSyncExternalStore } from 'react'
import { formatStamp } from './project-summary'
import { PROJECT_TEMPLATES } from './templates'
import { useProjectsEnv } from './use-projects-env'

export interface ProjectsDashboardProps {
  /** Open a recent by id (the row-menu open path). */
  onOpenRecent: (id: string) => void
  /** Start the wizard, optionally pre-picking a template. */
  onNewProject: (templateId?: string) => void
}

export function ProjectsDashboard({ onOpenRecent, onNewProject }: ProjectsDashboardProps) {
  const { recents } = useProjectsEnv()
  const entries = useSyncExternalStore(
    (cb) => recents.subscribe(cb),
    () => recents.list(),
  )

  return (
    <div className="pj-dashboard">
      <section className="pj-card" aria-label="Recent projects">
        <h2 className="pj-h2">Recent</h2>
        {entries.length === 0 ? (
          <p className="pj-muted" data-testid="recents-empty">
            Projects you open show up here.
          </p>
        ) : (
          <ul className="pj-recents">
            {entries.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  className="pj-recent"
                  data-testid={`recent-${r.id}`}
                  onClick={() => onOpenRecent(r.id)}
                >
                  <span className="pj-recent-name">{r.name}</span>
                  <span className="pj-recent-when">{formatStamp(r.openedAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="pj-card" aria-label="Templates">
        <div className="pj-card-head">
          <h2 className="pj-h2">Templates</h2>
          <button
            type="button"
            className="pj-btn pj-btn-primary"
            data-testid="new-project"
            onClick={() => onNewProject()}
          >
            New project
          </button>
        </div>
        <ul className="pj-templates">
          {PROJECT_TEMPLATES.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                className="pj-template"
                data-testid={`template-${t.id}`}
                onClick={() => onNewProject(t.id)}
              >
                <span className="pj-template-label">{t.label}</span>
                <span className="pj-template-desc">{t.description}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
