// CD-401 — table + scopes + filters/sort. The two ACs are the first two tests:
// a 10k fixture mounts a viewport of rows (not 10k), and every filter/sort control
// round-trips as a repository query param instead of filtering rows client-side.
import { describe, it, expect, vi } from 'vitest'
import { act, fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/shared/test'
import VariablesPane from '../variables-pane'
import { VariablesSourceProvider, type VariablePage, type VariableQuery, type VariablesSource } from './variables-source'
import { MockVariablesSource, makeVariableFixtures } from './mock-variables-source'
import type { VariableRecord } from './variables-model'

function renderPane(source: VariablesSource) {
  return renderWithProviders(
    <VariablesSourceProvider value={source}>
      <VariablesPane />
    </VariablesSourceProvider>,
  )
}

const rows = (c: HTMLElement) => c.querySelectorAll('[data-variable]')
const rowFor = (c: HTMLElement, id: string) => c.querySelector<HTMLElement>(`[data-variable="${id}"]`)
const lastQuery = (s: MockVariablesSource): VariableQuery => s.queries[s.queries.length - 1]!

describe('VariablesTable (CD-401)', () => {
  it('AC: 10 000-row fixture mounts a viewport of rows, not 10 000', async () => {
    const source = new MockVariablesSource({ seed: makeVariableFixtures(10_000) })
    const { container } = renderPane(source)

    await waitFor(() => expect(rows(container).length).toBeGreaterThan(0))
    // The virtualizer renders ~viewport ÷ 28px + overscan. Anything near 10k means
    // the window is not doing its job — that is the 60 fps proof (CD-310 precedent).
    expect(rows(container).length).toBeLessThan(80)
    // …while the grid still reports the full server count to assistive tech.
    expect(container.querySelector('[role="grid"]')).toHaveAttribute('aria-rowcount', '10001')
    expect(container.querySelector('[data-testid="vars-count"]')).toHaveTextContent('10,000 variables')

    // And it only ever asked for the pages the window overlaps — not all 100.
    expect(source.queries.length).toBeLessThanOrEqual(2)
    expect(source.queries.every((q) => q.limit === 100)).toBe(true)
  })

  it('AC: scrolling fetches only the pages the window moves over', async () => {
    const source = new MockVariablesSource({ seed: makeVariableFixtures(10_000) })
    const { container } = renderPane(source)
    await waitFor(() => expect(rows(container).length).toBeGreaterThan(0))
    source.queries.length = 0

    const scroll = container.querySelector<HTMLElement>('[data-testid="vars-scroll"]')!
    // Jump to ~row 5000 (28px rows) — pages 51-ish, nothing in between.
    Object.defineProperty(scroll, 'scrollTop', { value: 5000 * 28, writable: true })
    await act(async () => {
      fireEvent.scroll(scroll)
    })

    await waitFor(() => expect(source.queries.length).toBeGreaterThan(0))
    const pagesAsked = source.queries.map((q) => q.page)
    expect(pagesAsked.every((p) => p! >= 50 && p! <= 53)).toBe(true)
  })

  it('AC: search round-trips as a repo filter param (the table renders what came back)', async () => {
    const source = new MockVariablesSource()
    const { container } = renderPane(source)
    await waitFor(() => expect(rows(container).length).toBeGreaterThan(0))

    fireEvent.change(container.querySelector('[data-testid="vars-search"]')!, { target: { value: 'cpu' } })

    await waitFor(() => expect(lastQuery(source).filter?.search).toBe('cpu'))
    await waitFor(() => expect(rowFor(container, 'sys.cpu.load')).toBeTruthy())
    // The rows that do not match are gone because the SERVER dropped them.
    expect(rowFor(container, 'deck.title')).toBeNull()
  })

  it('AC: the table never filters — it renders exactly the page it was handed', async () => {
    // A deliberately lying source: it reports a filter was applied but returns a row
    // that does not match it. A client-side .filter() would hide the row; a table that
    // renders its page shows it. This is what "not client hacks" has to mean.
    const liar: VariablesSource = {
      query: async (q: VariableQuery): Promise<VariablePage> => ({
        items: [{ id: 'zzz.unmatched', name: 'Unmatched', scope: 'global', type: 'string', value: 'x' }],
        page: q.page ?? 1,
        limit: q.limit ?? 100,
        total: 1,
      }),
      write: vi.fn(),
      create: vi.fn(),
      remove: vi.fn(),
      reveal: vi.fn(),
    }
    const { container } = renderPane(liar)
    await waitFor(() => expect(rows(container).length).toBe(1))

    fireEvent.change(container.querySelector('[data-testid="vars-search"]')!, { target: { value: 'nothing-matches' } })
    await waitFor(() => expect(rowFor(container, 'zzz.unmatched')).toBeTruthy())
  })

  it('AC: scope rail and plugin filter round-trip as filter params', async () => {
    const source = new MockVariablesSource()
    const { container } = renderPane(source)
    await waitFor(() => expect(rows(container).length).toBeGreaterThan(0))

    fireEvent.click(container.querySelector('[data-scope-option="plugin"]')!)
    await waitFor(() => expect(lastQuery(source).filter?.scope).toBe('plugin'))
    await waitFor(() => expect(rowFor(container, 'sys.cpu.load')).toBeNull())

    // The facet options came from the source, not a hardcoded list.
    await waitFor(() =>
      expect(container.querySelector('[data-testid="vars-plugin-filter"]')!.querySelectorAll('option').length).toBe(3),
    )
    fireEvent.change(container.querySelector('[data-testid="vars-plugin-filter"]')!, { target: { value: 'obs' } })
    await waitFor(() => expect(lastQuery(source).filter?.plugin).toBe('obs'))
    await waitFor(() => expect(rowFor(container, 'plug.obs.scene')).toBeTruthy())
    expect(rowFor(container, 'plug.spotify.key')).toBeNull()
  })

  it('AC: sort round-trips as a repo sort param and toggles direction', async () => {
    const source = new MockVariablesSource()
    const { container } = renderPane(source)
    await waitFor(() => expect(rows(container).length).toBeGreaterThan(0))

    // Default sort is declared, not implicit.
    expect(source.queries[0]!.sort).toEqual({ field: 'name', dir: 'asc' })

    fireEvent.click(container.querySelector('[data-testid="sort-id"]')!)
    await waitFor(() => expect(lastQuery(source).sort).toEqual({ field: 'id', dir: 'asc' }))

    fireEvent.click(container.querySelector('[data-testid="sort-id"]')!)
    await waitFor(() => expect(lastQuery(source).sort).toEqual({ field: 'id', dir: 'desc' }))

    // …and the header advertises it to assistive tech.
    const header = container.querySelector('[data-testid="sort-id"]')!.closest('[role="columnheader"]')
    expect(header).toHaveAttribute('aria-sort', 'descending')

    // Rows arrive in the server's order — first cached row is the last path desc.
    await waitFor(() => {
      const first = rows(container)[0]!
      expect(first.getAttribute('data-variable')).toBe('sys.ram')
    })
  })

  it('re-queries from page 1 when the filter changes (no stale window)', async () => {
    const source = new MockVariablesSource({ seed: makeVariableFixtures(10_000) })
    const { container } = renderPane(source)
    await waitFor(() => expect(rows(container).length).toBeGreaterThan(0))
    source.queries.length = 0

    fireEvent.change(container.querySelector('[data-testid="vars-search"]')!, { target: { value: 'Fixture 000' } })
    await waitFor(() => expect(source.queries.some((q) => q.filter?.search === 'Fixture 000')).toBe(true))
    expect(source.queries.filter((q) => q.filter?.search === 'Fixture 000')[0]!.page).toBe(1)
  })

  it('drops a superseded query response (last query wins)', async () => {
    // A source that resolves the first query slowly and the second immediately: if
    // the controller kept the late response, the table would show stale rows.
    let resolveFirst: ((p: VariablePage) => void) | undefined
    const slow: VariablesSource = {
      query: (q: VariableQuery) => {
        if (q.filter?.search === 'slow') {
          return new Promise<VariablePage>((res) => {
            resolveFirst = res
          })
        }
        return Promise.resolve<VariablePage>({
          items: [{ id: 'fast.row', name: 'Fast', scope: 'global', type: 'string', value: 'f' }],
          page: 1,
          limit: 100,
          total: 1,
        })
      },
      write: vi.fn(),
      create: vi.fn(),
      remove: vi.fn(),
      reveal: vi.fn(),
    }
    const { container } = renderPane(slow)
    await waitFor(() => expect(rowFor(container, 'fast.row')).toBeTruthy())

    fireEvent.change(container.querySelector('[data-testid="vars-search"]')!, { target: { value: 'slow' } })
    fireEvent.change(container.querySelector('[data-testid="vars-search"]')!, { target: { value: '' } })
    await waitFor(() => expect(rowFor(container, 'fast.row')).toBeTruthy())

    // The stale response lands late and must be ignored.
    await act(async () => {
      resolveFirst?.({
        items: [{ id: 'stale.row', name: 'Stale', scope: 'global', type: 'string', value: 's' } as VariableRecord],
        page: 1,
        limit: 100,
        total: 1,
      })
    })
    expect(rowFor(container, 'stale.row')).toBeNull()
    expect(rowFor(container, 'fast.row')).toBeTruthy()
  })

  it('row click selects; ⇧-click extends; ⌘-click toggles', async () => {
    const source = new MockVariablesSource()
    const { container } = renderPane(source)
    await waitFor(() => expect(rows(container).length).toBeGreaterThan(0))

    const ordered = [...rows(container)].map((r) => r.getAttribute('data-variable')!)
    fireEvent.click(rowFor(container, ordered[0]!)!)
    expect(rowFor(container, ordered[0]!)).toHaveAttribute('data-selected')
    expect(rowFor(container, ordered[0]!)).toHaveAttribute('aria-selected', 'true')

    fireEvent.click(rowFor(container, ordered[2]!)!, { shiftKey: true })
    for (const id of ordered.slice(0, 3)) expect(rowFor(container, id)).toHaveAttribute('data-selected')

    fireEvent.click(rowFor(container, ordered[1]!)!, { metaKey: true })
    expect(rowFor(container, ordered[1]!)).not.toHaveAttribute('data-selected')
  })

  it('is keyboard operable: arrows move focus, Space selects', async () => {
    const source = new MockVariablesSource()
    const { container } = renderPane(source)
    await waitFor(() => expect(rows(container).length).toBeGreaterThan(0))

    const first = container.querySelector<HTMLElement>('[data-row-index="0"]')!
    expect(first).toHaveAttribute('tabindex', '0') // roving tabindex entry point
    first.focus()
    fireEvent.keyDown(first, { key: 'ArrowDown' })
    expect(container.querySelector('[data-row-index="1"]')).toHaveFocus()

    fireEvent.keyDown(document.activeElement!, { key: ' ' })
    expect(container.querySelector('[data-row-index="1"]')).toHaveAttribute('data-selected')
  })

  it('scopes rail is a keyboard-operable radiogroup', async () => {
    const source = new MockVariablesSource()
    const { container } = renderPane(source)
    await waitFor(() => expect(rows(container).length).toBeGreaterThan(0))

    const all = container.querySelector<HTMLElement>('[data-scope-option="__all__"]')!
    expect(all).toHaveAttribute('aria-checked', 'true')
    all.focus()
    fireEvent.keyDown(all, { key: 'ArrowDown' })

    await waitFor(() => expect(lastQuery(source).filter?.scope).toBe('global'))
    expect(container.querySelector('[data-scope-option="global"]')).toHaveAttribute('aria-checked', 'true')
  })

  it('shows an honest empty state rather than a blank table', async () => {
    const source = new MockVariablesSource()
    const { container } = renderPane(source)
    await waitFor(() => expect(rows(container).length).toBeGreaterThan(0))

    fireEvent.change(container.querySelector('[data-testid="vars-search"]')!, { target: { value: 'no-such-variable' } })
    await waitFor(() => expect(container.querySelector('[data-testid="vars-empty"]')).toBeTruthy())
  })

  it('surfaces a query failure instead of an empty table', async () => {
    const broken: VariablesSource = {
      query: () => Promise.reject(new Error('gateway unavailable')),
      write: vi.fn(),
      create: vi.fn(),
      remove: vi.fn(),
      reveal: vi.fn(),
    }
    const { container } = renderPane(broken)
    await waitFor(() => expect(container.querySelector('[data-testid="vars-notice"]')).toHaveTextContent('gateway unavailable'))
  })

  it('disables the plugin filter with a reason when the source cannot index plugins', async () => {
    const noFacets: VariablesSource = {
      query: async () => ({ items: [], page: 1, limit: 100, total: 0 }),
      write: vi.fn(),
      create: vi.fn(),
      remove: vi.fn(),
      reveal: vi.fn(),
    }
    const { container } = renderPane(noFacets)
    const filter = container.querySelector<HTMLSelectElement>('[data-testid="vars-plugin-filter"]')!
    await waitFor(() => expect(filter).toBeDisabled())
    expect(filter.title).toContain('does not index plugin owners')
  })
})
