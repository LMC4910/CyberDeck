// Variables workspace (CD-401 → CD-403). Scopes rail | virtualized table | inspector,
// all reading one VariablesSource (variables/variables-source.ts). The workspace may
// not import repositories, so the shell binds a VariablesRepository-backed adapter
// through VariablesSourceProvider; until it does, the pane serves the in-memory mock
// — the same M4/M5 swap `variables-catalog.ts` (CD-324) set up for bindings.
import { useCallback, useState } from 'react'
import { ScopesRail } from './variables/scopes-rail'
import { VariablesTable } from './variables/variables-table'
import { VariablesToolbar } from './variables/variables-toolbar'
import { ValueCell } from './variables/value-cell'
import { NewVariableDialog } from './variables/new-variable-dialog'
import { DeleteVariableDialog } from './variables/delete-variable-dialog'
import { MockVariablesSource } from './variables/mock-variables-source'
import { VariablesInspector } from './variables/variables-inspector'
import { useVariablesSourceOptional, type VariableDraft } from './variables/variables-source'
import { useVariablesController, useVariablesState, shallowArrayEqual } from './variables/use-variables'
import { isReadOnly, type VariableRecord } from './variables/variables-model'
import './variables/variables.css'

export default function VariablesPane() {
  const provided = useVariablesSourceOptional()
  const [fallback] = useState(() => new MockVariablesSource())
  const source = provided ?? fallback
  const controller = useVariablesController(source)

  const scope = useVariablesState(controller, (s) => s.filter.scope)
  const notice = useVariablesState(controller, (s) => s.notice)
  const selectedIds = useVariablesState(controller, (s) => s.selectedIds, shallowArrayEqual)

  // One editor at a time — the pane owns which row is open so the table's Enter and
  // the cell's double-click are the same gesture.
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newOpen, setNewOpen] = useState(false)
  const [deleting, setDeleting] = useState<string[] | null>(null)

  const beginEdit = useCallback((row: VariableRecord) => {
    if (!isReadOnly(row)) setEditingId(row.id)
  }, [])

  const renderValue = useCallback(
    (row: VariableRecord) => (
      <ValueCell
        controller={controller}
        row={row}
        editing={editingId === row.id}
        onBeginEdit={() => beginEdit(row)}
        onEndEdit={() => setEditingId(null)}
      />
    ),
    [controller, editingId, beginEdit],
  )

  const onCreate = useCallback(
    (draft: VariableDraft) => {
      void controller.createVariable(draft)
    },
    [controller],
  )

  const onConfirmDelete = useCallback(() => {
    const ids = deleting ?? []
    setDeleting(null)
    void controller.removeMany(ids)
  }, [controller, deleting])

  const inspectorOpen = selectedIds.length === 1

  return (
    <section
      className="vars-pane"
      data-pane="variables"
      data-inspector={inspectorOpen ? 'open' : undefined}
      aria-label="Variables workspace"
    >
      <ScopesRail value={scope} onChange={(next) => controller.setFilter({ scope: next })} />

      <div className="vars-main">
        <VariablesToolbar
          controller={controller}
          source={source}
          actions={
            <>
              <button type="button" className="a11y-btn" data-testid="new-variable" onClick={() => setNewOpen(true)}>
                New Variable
              </button>
              <button
                type="button"
                className="a11y-btn"
                data-testid="delete-selected"
                disabled={selectedIds.length === 0}
                title={selectedIds.length === 0 ? 'Select one or more rows to delete' : undefined}
                onClick={() => setDeleting(selectedIds)}
              >
                Delete{selectedIds.length > 1 ? ` (${selectedIds.length})` : ''}
              </button>
            </>
          }
        />

        <VariablesTable controller={controller} renderValue={renderValue} onActivate={beginEdit} />

        {notice ? (
          <p className="vars-notice" data-kind={notice.kind} data-testid="vars-notice" role="status">
            {notice.text}
          </p>
        ) : null}
      </div>

      <VariablesInspector controller={controller} source={source} />

      <NewVariableDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreate={onCreate}
        existingIds={controller.knownIds()}
        defaultScope={scope}
      />

      <DeleteVariableDialog
        open={deleting !== null}
        ids={deleting ?? []}
        source={source}
        onClose={() => setDeleting(null)}
        onConfirm={onConfirmDelete}
      />
    </section>
  )
}
