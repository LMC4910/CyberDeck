// Row menu: open / duplicate / delete-with-confirm + undo toast (CD-405).
import { describe, it, expect } from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { harness, projectDoc, renderWithEnv } from './test-harness'
import { ProjectsWorkspace } from './projects-workspace'

async function renderPane() {
  const h = harness({
    seed: [projectDoc('proj_000001', 'Battlestation'), projectDoc('proj_000002', 'Rig')],
  })
  const view = renderWithEnv(<ProjectsWorkspace />, h.env)
  await screen.findByTestId('row-menu-proj_000001')
  return { ...h, ...view }
}

function openMenu(id: string) {
  fireEvent.click(screen.getByTestId(`row-menu-${id}`))
}
function rowNames(): string[] {
  return Array.from(document.querySelectorAll('.pj-row:not(.pj-row-head) .pj-row-name')).map(
    (el) => el.textContent ?? '',
  )
}

describe('Projects row menu (CD-405)', () => {
  it('Open loads the project through the service and lands in Design', async () => {
    const { navigated, project, opened, recents } = await renderPane()
    openMenu('proj_000001')
    await act(async () => void fireEvent.click(screen.getByRole('menuitem', { name: 'Open' })))

    await waitFor(() => expect(project.openId).toBe('proj_000001'))
    expect(navigated).toEqual(['deck-designer'])
    expect(opened[0]).toMatchObject({ projectId: 'proj_000001', name: 'Battlestation' })
    expect(recents.list()[0]?.id).toBe('proj_000001')
  })

  it('Delete asks first — cancelling leaves the project alone', async () => {
    const { catalog } = await renderPane()
    openMenu('proj_000001')
    fireEvent.click(screen.getByTestId('delete-proj_000001'))

    expect(screen.getByTestId('confirm-dialog')).toHaveTextContent('Battlestation')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument()
    expect(catalog.docs.has('proj_000001')).toBe(true)
  })

  it('Delete → confirm removes it via the repository and toasts an Undo', async () => {
    const { catalog, notifications, recents } = await renderPane()
    // a recent for the doomed project, so we can watch it get cleaned up
    recents.record({ id: 'proj_000001', name: 'Battlestation', openedAt: '2026-07-17T10:00:00.000Z' })

    openMenu('proj_000001')
    fireEvent.click(screen.getByTestId('delete-proj_000001'))
    await act(async () => void fireEvent.click(screen.getByTestId('confirm-accept')))

    await waitFor(() => expect(catalog.docs.has('proj_000001')).toBe(false))
    await waitFor(() => expect(rowNames()).toEqual(['Rig']))
    expect(recents.list()).toHaveLength(0)

    const toast = notifications.at(-1)!
    expect(toast.title).toContain('Battlestation')
    expect(toast.actions).toEqual([{ id: 'undo', label: 'Undo' }])
    // The shell's Toaster only shows a toast when the policy says so; an action forces it.
    expect(toast.toast).toBe(true)
  })

  it('the undo toast restores the project — the same inverse ⌘Z runs', async () => {
    const { catalog, undo } = await renderPane()
    openMenu('proj_000001')
    fireEvent.click(screen.getByTestId('delete-proj_000001'))
    await act(async () => void fireEvent.click(screen.getByTestId('confirm-accept')))
    await waitFor(() => expect(catalog.docs.has('proj_000001')).toBe(false))

    // The toast's Undo action id is routed to UndoStack.undo() by the shell.
    expect(undo.list().at(-1)?.label).toBe('Delete project')
    await act(async () => {
      undo.undo()
      await Promise.resolve()
    })

    await waitFor(() => expect(catalog.docs.get('proj_000001')?.meta.name).toBe('Battlestation'))
    await waitFor(() => expect(rowNames()).toContain('Battlestation'))
  })

  it('redo re-deletes — the entry is a full round trip, not a one-shot patch', async () => {
    const { catalog, undo } = await renderPane()
    openMenu('proj_000001')
    fireEvent.click(screen.getByTestId('delete-proj_000001'))
    await act(async () => void fireEvent.click(screen.getByTestId('confirm-accept')))
    await waitFor(() => expect(catalog.docs.has('proj_000001')).toBe(false))

    await act(async () => {
      undo.undo()
      await Promise.resolve()
    })
    await waitFor(() => expect(catalog.docs.has('proj_000001')).toBe(true))

    await act(async () => {
      undo.redo()
      await Promise.resolve()
    })
    await waitFor(() => expect(catalog.docs.has('proj_000001')).toBe(false))
  })

  it('Duplicate creates a copy under a fresh key with a non-colliding name', async () => {
    const { catalog } = await renderPane()
    openMenu('proj_000001')
    await act(async () => void fireEvent.click(screen.getByRole('menuitem', { name: 'Duplicate' })))

    await waitFor(() => expect(catalog.docs.size).toBe(3))
    const copy = [...catalog.docs.values()].find((d) => d.meta.name === 'Battlestation copy')
    expect(copy).toBeDefined()
    expect(copy!.id).not.toBe('proj_000001')
    await waitFor(() => expect(rowNames()).toContain('Battlestation copy'))
  })

  it('Duplicate is undoable too', async () => {
    const { catalog, undo, notifications } = await renderPane()
    openMenu('proj_000001')
    await act(async () => void fireEvent.click(screen.getByRole('menuitem', { name: 'Duplicate' })))
    await waitFor(() => expect(catalog.docs.size).toBe(3))
    expect(notifications.at(-1)?.actions).toEqual([{ id: 'undo', label: 'Undo' }])

    await act(async () => {
      undo.undo()
      await Promise.resolve()
    })
    await waitFor(() => expect(catalog.docs.size).toBe(2))
  })

  it('a failing delete reports the reason instead of pretending it worked', async () => {
    const { catalog, notifications } = await renderPane()
    catalog.remove = async () => {
      throw new Error('gateway down')
    }
    openMenu('proj_000001')
    fireEvent.click(screen.getByTestId('delete-proj_000001'))
    await act(async () => void fireEvent.click(screen.getByTestId('confirm-accept')))

    await waitFor(() => expect(notifications.at(-1)?.level).toBe('error'))
    expect(notifications.at(-1)?.body).toContain('gateway down')
    expect(rowNames()).toContain('Battlestation')
  })

  it('the row menu is keyboard reachable and Esc closes it', async () => {
    await renderPane()
    openMenu('proj_000001')
    const menu = screen.getByRole('menu', { name: 'Actions for Battlestation' })
    // focus lands on the first item so the menu is operable without a mouse
    await waitFor(() => expect(document.activeElement).toBe(within_first(menu)))
    fireEvent.keyDown(menu, { key: 'Escape' })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(document.activeElement).toBe(screen.getByTestId('row-menu-proj_000001'))
  })
})

function within_first(menu: HTMLElement): HTMLElement | null {
  return menu.querySelector<HTMLElement>('[role="menuitem"]')
}
