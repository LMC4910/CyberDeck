// CD-405 AC: "table sorted/paged via repo; inspector renders the selected row (not
// hardcoded)". The FakeCatalog answers in insertion order whatever sort it is asked
// for, so any test that passes here is proving the query reached the data layer —
// a client-side sort would show up immediately as rows in the wrong order.
import { describe, it, expect } from 'vitest'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { harness, projectDoc, renderWithEnv, FakeCatalog } from './test-harness'
import { ProjectsWorkspace } from './projects-workspace'
import { DEFAULT_SORT } from './use-project-table'

function seedProjects(n: number, prefix = 'Deck') {
  return Array.from({ length: n }, (_, i) =>
    projectDoc(`proj_${String(i).padStart(6, '0')}`, `${prefix} ${i}`, {
      savedAt: `2026-07-${String(10 + i).padStart(2, '0')}T10:00:00.000Z`,
    }),
  )
}

async function renderTable(records = seedProjects(3)) {
  const h = harness({ seed: records })
  const view = renderWithEnv(<ProjectsWorkspace />, h.env)
  await screen.findByTestId('row-count')
  await waitFor(() => expect(h.catalog.queries.length).toBeGreaterThan(0))
  return { ...h, ...view }
}

function rowNames(): string[] {
  return Array.from(document.querySelectorAll('.pj-row:not(.pj-row-head) .pj-row-name')).map(
    (el) => el.textContent ?? '',
  )
}

describe('Projects browse table (CD-405)', () => {
  it('queries the repository on mount with the default sort + page window', async () => {
    const { catalog } = await renderTable()
    expect(catalog.queries[0]).toEqual({ sort: DEFAULT_SORT, page: 1, limit: 50 })
  })

  it('renders exactly the rows the repository returned, in the order it returned them', async () => {
    // Deliberately NOT date-ordered: the client must not "fix" the server's order.
    const { catalog } = await renderTable([
      projectDoc('proj_000001', 'Zulu', { savedAt: '2026-01-01T00:00:00.000Z' }),
      projectDoc('proj_000002', 'Alpha', { savedAt: '2026-09-09T00:00:00.000Z' }),
    ])
    expect(rowNames()).toEqual(['Zulu', 'Alpha'])
    expect(catalog.queries).toHaveLength(1)
  })

  it('a sort click re-queries the repository — field and direction travel as params', async () => {
    const { catalog } = await renderTable()

    fireEvent.click(screen.getByTestId('sort-savedAt'))
    await waitFor(() => expect(catalog.queries).toHaveLength(2))
    // savedAt is the default (desc) — clicking the active field flips it.
    expect(catalog.queries[1]).toEqual({ sort: { field: 'savedAt', dir: 'asc' }, page: 1, limit: 50 })

    fireEvent.click(screen.getByTestId('sort-savedAt'))
    await waitFor(() => expect(catalog.queries).toHaveLength(3))
    expect(catalog.queries[2]?.sort).toEqual({ field: 'savedAt', dir: 'desc' })

    // switching field starts that field ascending
    fireEvent.click(screen.getByTestId('sort-id'))
    await waitFor(() => expect(catalog.queries).toHaveLength(4))
    expect(catalog.queries[3]?.sort).toEqual({ field: 'id', dir: 'asc' })
  })

  it('reflects the active sort on the column header (aria-sort)', async () => {
    await renderTable()
    const header = () => document.querySelector('[data-col="savedAt"]')
    expect(header()?.getAttribute('aria-sort')).toBe('descending')
    fireEvent.click(screen.getByTestId('sort-savedAt'))
    await waitFor(() => expect(header()?.getAttribute('aria-sort')).toBe('ascending'))
    expect(document.querySelector('[data-col="id"]')?.getAttribute('aria-sort')).toBe('none')
  })

  it('pages through the repository — Next asks for the next window, not a client slice', async () => {
    const { catalog } = await renderTable(seedProjects(120))
    expect(screen.getByTestId('pager-label')).toHaveTextContent('Page 1 of 3')
    expect(screen.getByTestId('row-count')).toHaveTextContent('120 projects')
    expect(rowNames()[0]).toBe('Deck 0')

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(catalog.queries).toHaveLength(2))
    expect(catalog.queries[1]).toMatchObject({ page: 2, limit: 50 })
    await waitFor(() => expect(screen.getByTestId('pager-label')).toHaveTextContent('Page 2 of 3'))
    // page 2 holds the NEXT 50 records, which only the repository could have chosen
    await waitFor(() => expect(rowNames()[0]).toBe('Deck 50'))
  })

  it('pager ends are honestly disabled, never dead', async () => {
    await renderTable(seedProjects(60))
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled())
    expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled()
  })

  it('a sort click resets to page 1 (the old offset is meaningless under a new order)', async () => {
    const { catalog } = await renderTable(seedProjects(120))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(catalog.queries).toHaveLength(2))
    fireEvent.click(screen.getByTestId('sort-id'))
    await waitFor(() => expect(catalog.queries).toHaveLength(3))
    expect(catalog.queries[2]).toMatchObject({ page: 1, sort: { field: 'id', dir: 'asc' } })
  })

  it('windows the rows — a 120-project page mounts a fraction of them', async () => {
    await renderTable(seedProjects(120))
    const mounted = document.querySelectorAll('.pj-row:not(.pj-row-head)').length
    expect(mounted).toBeGreaterThan(0)
    expect(mounted).toBeLessThan(50)
  })

  it('surfaces a repository failure instead of an empty table', async () => {
    const h = harness({ catalog: new FakeCatalog({ failQuery: 'gateway down' }) })
    renderWithEnv(<ProjectsWorkspace />, h.env)
    const error = await screen.findByTestId('table-error')
    expect(error).toHaveTextContent('gateway down')
  })

  it('says so plainly when the shell has not wired a catalog', () => {
    // No provider at all — the landing surface must not fake a working table.
    const { getByTestId } = renderWithEnv(<ProjectsWorkspace />, undefined as never)
    expect(getByTestId('projects-unwired')).toBeInTheDocument()
  })
})

describe('Projects table — selection + inspector (CD-405)', () => {
  it('selecting a row renders THAT row in the inspector, from its own document', async () => {
    await renderTable([
      projectDoc('proj_000001', 'Zulu', { savedAt: '2026-01-02T00:00:00.000Z' }),
      projectDoc('proj_000002', 'Alpha', {
        components: [
          { id: 'cmp_aaaaaa', name: 'Card', widgets: [{ id: 'w_aaaaaa', type: 'core.box', frame: { x: 0, y: 0, w: 1, h: 1 } }] },
        ],
        devices: [{ id: 'dev_aaaaaa', name: 'Studio iPad', deviceClass: 'ipad', pageId: 'page_000002' }],
      }),
    ])
    const inspector = screen.getByTestId('project-inspector')
    expect(inspector).toHaveTextContent('Select a project to inspect it.')

    fireEvent.click(document.querySelector('[data-row="proj_000001"]')!)
    expect(screen.getByTestId('inspector-name')).toHaveTextContent('Zulu')
    expect(screen.getByTestId('inspector-no-devices')).toBeInTheDocument()
    expect(within(inspector).getByText('proj_000001')).toBeInTheDocument()

    // A different row → different meta, stats and devices; nothing carried over.
    fireEvent.click(document.querySelector('[data-row="proj_000002"]')!)
    expect(screen.getByTestId('inspector-name')).toHaveTextContent('Alpha')
    expect(within(inspector).getByText('Studio iPad')).toBeInTheDocument()
    expect(screen.queryByTestId('inspector-no-devices')).not.toBeInTheDocument()
    expect(fieldValue('Components')).toBe('1')
    expect(fieldValue('Pages')).toBe('1')
  })

  it('rows are keyboard navigable: arrows move the selection, Enter opens', async () => {
    const { navigated, project } = await renderTable(seedProjects(3))
    const grid = screen.getByRole('grid')
    const first = document.querySelector<HTMLElement>('[data-row="proj_000000"]')!
    first.focus()
    fireEvent.click(first)
    expect(screen.getByTestId('inspector-name')).toHaveTextContent('Deck 0')

    fireEvent.keyDown(grid, { key: 'ArrowDown' })
    expect(screen.getByTestId('inspector-name')).toHaveTextContent('Deck 1')
    fireEvent.keyDown(grid, { key: 'ArrowUp' })
    expect(screen.getByTestId('inspector-name')).toHaveTextContent('Deck 0')

    await act(async () => {
      fireEvent.keyDown(document.querySelector('[data-row="proj_000000"]')!, { key: 'Enter' })
    })
    await waitFor(() => expect(navigated).toEqual(['deck-designer']))
    expect(project.openId).toBe('proj_000000')
  })

  it('marks the open project and disables the inspector Open button for it', async () => {
    const { project } = await renderTable(seedProjects(2))
    await act(async () => void (await project.openById('proj_000001')))

    await waitFor(() =>
      expect(document.querySelector('[data-row="proj_000001"]')).toHaveAttribute('data-open'),
    )
    fireEvent.click(document.querySelector('[data-row="proj_000001"]')!)
    expect(screen.getByRole('button', { name: 'Open' })).toBeDisabled()

    fireEvent.click(document.querySelector('[data-row="proj_000000"]')!)
    expect(screen.getByRole('button', { name: 'Open project' })).toBeEnabled()
  })
})

function fieldValue(label: string): string | undefined {
  const row = Array.from(document.querySelectorAll('.pj-field')).find(
    (el) => el.querySelector('.pj-field-label')?.textContent === label,
  )
  return row?.querySelector('.pj-field-value')?.textContent ?? undefined
}
