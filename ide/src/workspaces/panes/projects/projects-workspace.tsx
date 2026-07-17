// Projects workspace (CD-405 dashboard/browse/inspector + CD-406 wizard/open flow).
// The first-boot landing surface: recents and templates make a cold start useful,
// the browse table is the repository's view of every stored project, and the
// inspector renders whichever row is selected.
//
// Data reaches this pane through the injected ProjectsEnv (catalog + services) —
// never a repository import. Without that wiring the pane says so plainly rather
// than rendering a convincing-looking empty table.
import { useCallback, useMemo, useState, useSyncExternalStore } from 'react'
import { ProjectsDashboard } from './projects-dashboard'
import { ProjectsTable } from './projects-table'
import { ProjectInspector } from './project-inspector'
import { NewProjectWizard } from './new-project-wizard'
import { createAndOpen, useProjectActions } from './project-actions'
import { useProjectTable } from './use-project-table'
import { useProjectsEnvOptional, type ProjectsEnv } from './use-projects-env'
import type { ProjectRecord } from '@/services/project'
import './projects.css'

export function ProjectsWorkspace() {
  const env = useProjectsEnvOptional()
  if (!env) {
    return (
      <section className="pj-pane" data-pane="projects" aria-label="Projects workspace">
        <p className="pj-error" role="status" data-testid="projects-unwired">
          Projects is not connected to a project store. The shell wires the catalog at
          startup — see ProjectsEnvProvider.
        </p>
      </section>
    )
  }
  return <ProjectsBody env={env} />
}

function ProjectsBody({ env }: { env: ProjectsEnv }) {
  const { catalog, project } = env
  const table = useProjectTable(catalog)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardTemplate, setWizardTemplate] = useState<string | undefined>(undefined)

  const actions = useProjectActions(table, {
    onDuplicated: (id) => setSelectedId(id),
    onDeleted: (id) => setSelectedId((cur) => (cur === id ? null : cur)),
  })

  // The open project's id, live: the shell can swap the model out from under us
  // (session restore, another surface opening a project).
  const openId = useSyncExternalStore(
    useCallback((cb) => project.subscribeModel(cb), [project]),
    () => project.openId,
  )

  const selected = useMemo(
    () => table.rows.find((r) => r.id === selectedId) ?? null,
    [table.rows, selectedId],
  )
  const takenNames = useMemo(() => table.rows.map((r) => r.name), [table.rows])

  const startWizard = (templateId?: string) => {
    setWizardTemplate(templateId)
    setWizardOpen(true)
  }

  const create = async (record: ProjectRecord) => {
    setWizardOpen(false)
    try {
      await createAndOpen(env, record)
    } catch (err) {
      env.notifications.notify({
        level: 'error',
        source: 'Projects',
        title: `Could not create “${record.meta.name}”`,
        body: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return (
    <section className="pj-pane" data-pane="projects" aria-label="Projects workspace">
      <header className="pj-pane-head">
        <h1 className="pj-h1">Projects</h1>
      </header>

      <ProjectsDashboard
        onOpenRecent={(id) => {
          const name = env.recents.list().find((r) => r.id === id)?.name ?? id
          void actions.open({ id, name })
        }}
        onNewProject={startWizard}
      />

      <div className="pj-browse-layout">
        <ProjectsTable
          table={table}
          actions={actions}
          selectedId={selectedId}
          onSelect={setSelectedId}
          openId={openId}
        />
        <ProjectInspector
          summary={selected}
          isOpen={selected !== null && selected.id === openId}
          onOpen={(s) => void actions.open(s)}
        />
      </div>

      <NewProjectWizard
        open={wizardOpen}
        initialTemplateId={wizardTemplate}
        takenNames={takenNames}
        onCancel={() => setWizardOpen(false)}
        onCreate={(record) => void create(record)}
      />
    </section>
  )
}
