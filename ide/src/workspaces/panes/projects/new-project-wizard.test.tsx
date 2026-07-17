// New-project wizard (CD-406). Closes the AC gap: "invalid wizard input blocked with
// inline errors" and the create → author → reopen round-trip driven through the UI.
//
// Two layers, matching the workspace's split:
//   • the wizard on its own — validation, inline errors, Enter/Esc, dirty-guard —
//     rendered with plain props (it takes no env);
//   • the whole ProjectsWorkspace — a real create lands in Design, the authored edit
//     survives a reopen, through the injected catalog/service (test-harness).
import { describe, it, expect, vi } from 'vitest'
import type { ComponentProps } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { WidgetInstance } from '@/shared/project'
import { harness, renderWithEnv } from './test-harness'
import { ProjectsWorkspace } from './projects-workspace'
import { NewProjectWizard, validateWizard, NAME_MAX } from './new-project-wizard'

// --- Pure validation (the wizard's rules, no DOM) ---
describe('validateWizard (CD-406)', () => {
  const ok = { name: 'Rig', templateId: 'blank', deviceId: 'ipad' }

  it('accepts a filled-in, non-colliding project', () => {
    expect(validateWizard(ok, [])).toEqual({})
  })

  it('flags an empty name and an unpicked device', () => {
    const errors = validateWizard({ name: '  ', templateId: 'blank', deviceId: '' }, [])
    expect(errors.name).toMatch(/name/i)
    expect(errors.deviceId).toMatch(/device/i)
  })

  it('rejects a name over the length cap', () => {
    const errors = validateWizard({ ...ok, name: 'x'.repeat(NAME_MAX + 1) }, [])
    expect(errors.name).toMatch(new RegExp(String(NAME_MAX)))
  })

  it('rejects a name already taken, case-insensitively', () => {
    expect(validateWizard({ ...ok, name: 'battlestation' }, ['Battlestation']).name).toMatch(/exists/i)
  })

  it('rejects unknown template/device ids that never came from a control', () => {
    expect(validateWizard({ ...ok, deviceId: 'nope' }, []).deviceId).toBeDefined()
    expect(validateWizard({ ...ok, templateId: 'nope' }, []).templateId).toBeDefined()
  })
})

// --- The wizard in isolation ---
type WizardProps = ComponentProps<typeof NewProjectWizard>

function renderWizard(overrides: Partial<WizardProps> = {}) {
  const onCreate = vi.fn<WizardProps['onCreate']>()
  const onCancel = vi.fn<WizardProps['onCancel']>()
  const props: WizardProps = { open: true, takenNames: [], onCancel, onCreate, ...overrides }
  render(<NewProjectWizard {...props} />)
  return { onCreate, onCancel }
}

const nameInput = () => screen.getByLabelText('Name') as HTMLInputElement
const deviceSelect = () => screen.getByLabelText('Target device') as HTMLSelectElement
const wizardForm = () => screen.getByTestId('new-project-wizard')
const clickCreate = () => fireEvent.click(screen.getByTestId('wizard-create'))
const pickDevice = (id: string) => fireEvent.change(deviceSelect(), { target: { value: id } })
const typeName = (value: string) => fireEvent.change(nameInput(), { target: { value } })

describe('NewProjectWizard — invalid input blocked with inline errors (CD-406)', () => {
  it('blocks an empty submit and surfaces inline, field-tied errors', () => {
    const { onCreate } = renderWizard()
    clickCreate()

    // Both offending fields carry a visible, role="alert" inline error — not a toast,
    // not a silently disabled button.
    expect(screen.getByTestId('error-name')).toBeInTheDocument()
    expect(screen.getByTestId('error-device')).toBeInTheDocument()
    expect(screen.getByTestId('error-name')).toHaveAttribute('role', 'alert')
    // The error is tied to its input for AT (aria-invalid + aria-describedby).
    expect(nameInput()).toHaveAttribute('aria-invalid', 'true')
    expect(nameInput().getAttribute('aria-describedby')).toBe(screen.getByTestId('error-name').id)
    // Nothing was created.
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('blocks a name that collides with a sibling', () => {
    const { onCreate } = renderWizard({ takenNames: ['Battlestation'] })
    typeName('battlestation')
    pickDevice('ipad')
    clickCreate()

    expect(screen.getByTestId('error-name')).toHaveTextContent(/exists/i)
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('blocks an over-long name', () => {
    const { onCreate } = renderWizard()
    typeName('x'.repeat(NAME_MAX + 1))
    pickDevice('ipad')
    clickCreate()

    expect(screen.getByTestId('error-name')).toHaveTextContent(new RegExp(String(NAME_MAX)))
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('clears an inline error the moment the field is corrected', () => {
    renderWizard()
    clickCreate() // reveal errors
    expect(screen.getByTestId('error-name')).toBeInTheDocument()

    typeName('Rig')
    expect(screen.queryByTestId('error-name')).not.toBeInTheDocument()
    // The device error is untouched — only the corrected field cleared.
    expect(screen.getByTestId('error-device')).toBeInTheDocument()
  })
})

describe('NewProjectWizard — Enter/Esc semantics + dirty-guard (CD-406)', () => {
  it('creates from a valid template + name + device', () => {
    const { onCreate } = renderWizard()
    typeName('  Rig  ') // trimmed before it reaches the record
    pickDevice('ipad')
    clickCreate()

    expect(onCreate).toHaveBeenCalledTimes(1)
    const record = onCreate.mock.calls[0]![0]
    expect(record.meta.name).toBe('Rig')
    expect(record.pages[0]!.canvas).toEqual({ w: 1180, h: 820 }) // the ipad target
    expect(record.id).toMatch(/^proj/)
  })

  it('Enter submits — blocked while invalid, then creates once valid', () => {
    const { onCreate } = renderWizard()
    fireEvent.submit(wizardForm()) // implicit submit (Enter from a field)
    expect(onCreate).not.toHaveBeenCalled()
    expect(screen.getByTestId('error-name')).toBeInTheDocument()

    typeName('Rig')
    pickDevice('deck')
    fireEvent.submit(wizardForm())
    expect(onCreate).toHaveBeenCalledTimes(1)
  })

  it('Esc on an untouched wizard just closes — no discard prompt', () => {
    const { onCancel } = renderWizard()
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'New project' }), { key: 'Escape' })

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument()
  })

  it('Esc after typing asks first, and only Discard drops the work', () => {
    const { onCancel } = renderWizard()
    typeName('Half-typed')
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'New project' }), { key: 'Escape' })

    // The dirty-guard interposes — nothing cancelled yet.
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
    expect(onCancel).not.toHaveBeenCalled()

    // "Keep editing" backs out of the guard, wizard stays.
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument()
    expect(onCancel).not.toHaveBeenCalled()

    // Esc again → guard → Discard actually closes.
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'New project' }), { key: 'Escape' })
    fireEvent.click(screen.getByTestId('confirm-accept'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('pre-picks the template a dashboard card handed it', () => {
    renderWizard({ initialTemplateId: 'starter' })
    expect((screen.getByRole('radio', { name: /Starter Deck/ }) as HTMLInputElement).checked).toBe(true)
    expect((screen.getByRole('radio', { name: /Blank/ }) as HTMLInputElement).checked).toBe(false)
  })
})

// --- The whole workspace: create → author → reopen ---
function widget(id: string): WidgetInstance {
  return { id, type: 'core.gauge', frame: { x: 0, y: 0, w: 10, h: 10 } }
}

describe('Projects wizard round-trip (CD-406)', () => {
  it('create → author → reopen: the authored edit survives a reload', async () => {
    const h = harness() // empty store
    renderWithEnv(<ProjectsWorkspace />, h.env)
    await screen.findByTestId('new-project')

    // Open the wizard from the dashboard and fill it in.
    fireEvent.click(screen.getByTestId('new-project'))
    const wizard = screen.getByTestId('new-project-wizard')
    fireEvent.change(within(wizard).getByLabelText('Name'), { target: { value: 'Mission Deck' } })
    fireEvent.change(within(wizard).getByLabelText('Target device'), { target: { value: 'ipad' } })

    await act(async () => {
      fireEvent.click(within(wizard).getByTestId('wizard-create'))
    })

    // Landed in Design with the new project open, and it was stored + announced.
    expect(h.navigated).toEqual(['deck-designer'])
    const id = h.project.openId!
    expect(id).toMatch(/^proj/)
    expect(h.catalog.docs.has(id)).toBe(true)
    expect(h.opened.at(-1)).toMatchObject({ projectId: id, name: 'Mission Deck' })
    expect(h.recents.list()[0]?.id).toBe(id)

    // Author: add a widget, then let autosave write it through to the catalog.
    const model = h.project.model!
    await act(async () => {
      model.addWidget(model.pages()[0]!.id, widget('w_authr0'))
      await h.project.flush()
    })

    // Reopen the same id from scratch — the reload sees the authored widget.
    await act(async () => {
      await h.project.openById(id)
    })
    const reloaded = h.project.model!
    expect(reloaded.pages()[0]!.widgets.map((w) => w.id)).toContain('w_authr0')
  })

  it('the wizard blocks an invalid create from the workspace too', async () => {
    const h = harness({ seed: [] })
    renderWithEnv(<ProjectsWorkspace />, h.env)
    await screen.findByTestId('new-project')

    fireEvent.click(screen.getByTestId('new-project'))
    const wizard = screen.getByTestId('new-project-wizard')
    // Name left empty, no device chosen → Create is blocked with inline errors.
    fireEvent.click(within(wizard).getByTestId('wizard-create'))

    expect(within(wizard).getByTestId('error-name')).toBeInTheDocument()
    expect(within(wizard).getByTestId('error-device')).toBeInTheDocument()
    expect(h.navigated).toEqual([]) // never navigated away
    expect(h.project.openId).toBeNull()
  })
})
