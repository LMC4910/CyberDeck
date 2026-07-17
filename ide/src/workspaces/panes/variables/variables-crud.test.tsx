// CD-402 — CRUD + inline edit + secret masking. The two ACs:
//   • CRUD persists via the repo, with the optimistic+rollback path exercised
//   • a secret's value is never in the DOM until it is revealed
import { describe, it, expect, vi } from 'vitest'
import { act, fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/shared/test'
import VariablesPane from '../variables-pane'
import { VariablesSourceProvider, type VariablesSource } from './variables-source'
import { MockVariablesSource } from './mock-variables-source'
import { MASK } from './value-cell'

function renderPane(source: MockVariablesSource) {
  return renderWithProviders(
    <VariablesSourceProvider value={source}>
      <VariablesPane />
    </VariablesSourceProvider>,
  )
}

const rows = (c: HTMLElement) => c.querySelectorAll('[data-variable]')
const rowFor = (c: HTMLElement, id: string) => c.querySelector<HTMLElement>(`[data-variable="${id}"]`)
const valueOf = (c: HTMLElement, id: string) => c.querySelector<HTMLElement>(`[data-testid="value-${id}"]`)
const ready = (c: HTMLElement) => waitFor(() => expect(rows(c).length).toBeGreaterThan(0))

// Search narrows to one row so the target is always inside the virtual window.
async function focusRow(container: HTMLElement, search: string, id: string) {
  fireEvent.change(container.querySelector('[data-testid="vars-search"]')!, { target: { value: search } })
  await waitFor(() => expect(rowFor(container, id)).toBeTruthy())
}

describe('Variables CRUD + inline edit (CD-402)', () => {
  it('AC: inline edit persists through the repo (optimistic, then reconciled)', async () => {
    const source = new MockVariablesSource()
    const { container } = renderPane(source)
    await ready(container)
    await focusRow(container, 'Deck Title', 'deck.title')

    fireEvent.doubleClick(valueOf(container, 'deck.title')!)
    const input = container.querySelector<HTMLInputElement>('[data-testid="edit-deck.title"]')!
    fireEvent.change(input, { target: { value: 'War Room' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    // Persisted through the port…
    await waitFor(() => expect(source.peek('deck.title')!.value).toBe('War Room'))
    // …and the row shows the server's reconciled record.
    await waitFor(() => expect(valueOf(container, 'deck.title')).toHaveTextContent('War Room'))
  })

  it('AC: a failed write rolls the row back to its previous value and says why', async () => {
    // The rollback path, driven for real: the repo rejects, `optimistic` restores the
    // pre-mutation snapshot (CD-133), and the row must show the OLD value again.
    const source = new MockVariablesSource({
      failWrite: (id) => (id === 'deck.title' ? new Error('engine offline') : undefined),
    })
    const { container } = renderPane(source)
    await ready(container)
    await focusRow(container, 'Deck Title', 'deck.title')
    expect(valueOf(container, 'deck.title')).toHaveTextContent('Battlestation')

    fireEvent.doubleClick(valueOf(container, 'deck.title')!)
    const input = container.querySelector<HTMLInputElement>('[data-testid="edit-deck.title"]')!
    fireEvent.change(input, { target: { value: 'War Room' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() =>
      expect(container.querySelector('[data-testid="vars-notice"]')).toHaveTextContent('engine offline'),
    )
    // Rolled back, not left showing a value the server never took.
    expect(valueOf(container, 'deck.title')).toHaveTextContent('Battlestation')
    expect(source.peek('deck.title')!.value).toBe('Battlestation')
  })

  it('Esc cancels an edit without writing', async () => {
    const source = new MockVariablesSource()
    const writeSpy = vi.spyOn(source, 'write')
    const { container } = renderPane(source)
    await ready(container)
    await focusRow(container, 'Deck Title', 'deck.title')

    fireEvent.doubleClick(valueOf(container, 'deck.title')!)
    const input = container.querySelector<HTMLInputElement>('[data-testid="edit-deck.title"]')!
    fireEvent.change(input, { target: { value: 'Discarded' } })
    fireEvent.keyDown(input, { key: 'Escape' })

    await waitFor(() => expect(valueOf(container, 'deck.title')).toHaveTextContent('Battlestation'))
    expect(writeSpy).not.toHaveBeenCalled()
    expect(source.peek('deck.title')!.value).toBe('Battlestation')
  })

  it('rejects an invalid literal inline and keeps the editor open', async () => {
    const source = new MockVariablesSource({
      seed: [{ id: 'deck.brightness', name: 'Brightness', scope: 'global', type: 'percent', value: 60 }],
    })
    const { container } = renderPane(source)
    await ready(container)

    fireEvent.doubleClick(valueOf(container, 'deck.brightness')!)
    const input = container.querySelector<HTMLInputElement>('[data-testid="edit-deck.brightness"]')!
    fireEvent.change(input, { target: { value: '150' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(container.querySelector('[data-testid="edit-error-deck.brightness"]')).toHaveTextContent('Percent must be 0–100')
    expect(container.querySelector('[data-testid="edit-deck.brightness"]')).toBeTruthy() // still editing
    expect(source.peek('deck.brightness')!.value).toBe(60)
  })

  it('plugin-owned rows are read-only with an honest reason (no dead editor)', async () => {
    const source = new MockVariablesSource()
    const { container } = renderPane(source)
    await ready(container)
    await focusRow(container, 'Spotify Track', 'plug.spotify.track')

    const cell = valueOf(container, 'plug.spotify.track')!
    expect(cell).toHaveAttribute('data-readonly')
    expect(cell.title).toContain('Owned by plugin "spotify"')

    fireEvent.doubleClick(cell)
    expect(container.querySelector('[data-testid="edit-plug.spotify.track"]')).toBeNull()
  })

  it('Enter on a focused row opens the same editor as double-click (keyboard parity)', async () => {
    const source = new MockVariablesSource()
    const { container } = renderPane(source)
    await ready(container)
    await focusRow(container, 'Deck Title', 'deck.title')

    const row = rowFor(container, 'deck.title')!
    row.focus()
    fireEvent.keyDown(row, { key: 'Enter' })
    expect(container.querySelector('[data-testid="edit-deck.title"]')).toBeTruthy()
  })

  it('AC: create persists via the repo and the new row is selected', async () => {
    const source = new MockVariablesSource()
    const { container } = renderPane(source)
    await ready(container)

    fireEvent.click(container.querySelector('[data-testid="new-variable"]')!)
    fireEvent.change(container.querySelector('[data-testid="new-var-id"]')!, { target: { value: 'deck.brightness' } })
    fireEvent.change(container.querySelector('[data-testid="new-var-name"]')!, { target: { value: 'Brightness' } })
    fireEvent.change(container.querySelector('[data-testid="new-var-type"]')!, { target: { value: 'percent' } })
    fireEvent.change(container.querySelector('[data-testid="new-var-value"]')!, { target: { value: '80' } })
    fireEvent.click(container.querySelector('[data-testid="new-var-submit"]')!)

    await waitFor(() => expect(source.peek('deck.brightness')).toBeTruthy())
    expect(source.peek('deck.brightness')).toMatchObject({ name: 'Brightness', type: 'percent', value: 80, scope: 'global' })
    await waitFor(() => expect(container.querySelector('[data-testid="vars-notice"]')).toHaveTextContent('Created deck.brightness'))
  })

  it('offers all 13 design types and blocks invalid input with inline errors', async () => {
    const source = new MockVariablesSource()
    const { container } = renderPane(source)
    await ready(container)

    fireEvent.click(container.querySelector('[data-testid="new-variable"]')!)
    expect(container.querySelector('[data-testid="new-var-type"]')!.querySelectorAll('option')).toHaveLength(13)

    // Submitting empty must not create anything.
    fireEvent.click(container.querySelector('[data-testid="new-var-submit"]')!)
    expect(container.querySelector('[data-testid="new-variable-dialog"]')).toBeTruthy() // still open
    expect(source.size()).toBe(20)

    // A duplicate path is caught before the round-trip.
    fireEvent.change(container.querySelector('[data-testid="new-var-id"]')!, { target: { value: 'deck.title' } })
    fireEvent.change(container.querySelector('[data-testid="new-var-name"]')!, { target: { value: 'Dupe' } })
    fireEvent.click(container.querySelector('[data-testid="new-var-submit"]')!)
    await waitFor(() => expect(container.querySelector('[data-testid="new-variable-dialog"]')).toHaveTextContent('already exists'))
    expect(source.size()).toBe(20)
  })

  it('AC: delete persists via the repo, warning about references first', async () => {
    const source = new MockVariablesSource({
      references: {
        'sys.fps': [{ workspace: 'deck-designer', targetId: 'w_gauge01', label: 'FPS Gauge', kind: 'component', via: 'value' }],
      },
    })
    const { container } = renderPane(source)
    await ready(container)
    await focusRow(container, 'FPS', 'sys.fps')

    fireEvent.click(rowFor(container, 'sys.fps')!)
    fireEvent.click(container.querySelector('[data-testid="delete-selected"]')!)

    await waitFor(() => expect(container.querySelector('[data-testid="delete-ref-warning"]')).toHaveTextContent('Still used in 1 place'))
    expect(container.querySelector('[data-testid="delete-variable-dialog"]')).toHaveTextContent('FPS Gauge')

    fireEvent.click(container.querySelector('[data-testid="delete-confirm"]')!)
    await waitFor(() => expect(source.peek('sys.fps')).toBeUndefined())
  })

  it('AC: a failed delete rolls the rows back into the table', async () => {
    const source = new MockVariablesSource()
    vi.spyOn(source, 'remove').mockRejectedValue(new Error('variable is locked'))
    const { container } = renderPane(source)
    await ready(container)
    await focusRow(container, 'Deck Title', 'deck.title')

    fireEvent.click(rowFor(container, 'deck.title')!)
    fireEvent.click(container.querySelector('[data-testid="delete-selected"]')!)
    await waitFor(() => expect(container.querySelector('[data-testid="delete-confirm"]')).toBeEnabled())
    fireEvent.click(container.querySelector('[data-testid="delete-confirm"]')!)

    await waitFor(() => expect(container.querySelector('[data-testid="vars-notice"]')).toHaveTextContent('variable is locked'))
    // Rolled back + re-queried: the row is still there and still real.
    await waitFor(() => expect(rowFor(container, 'deck.title')).toBeTruthy())
    expect(source.peek('deck.title')).toBeTruthy()
  })

  it('multi-select delete removes every selected row in one confirm', async () => {
    const source = new MockVariablesSource()
    const { container } = renderPane(source)
    await ready(container)
    await focusRow(container, 'run.', 'run.stream.live')

    fireEvent.click(rowFor(container, 'run.scene.last')!)
    fireEvent.click(rowFor(container, 'run.stream.live')!, { metaKey: true })
    expect(container.querySelector('[data-testid="delete-selected"]')).toHaveTextContent('Delete (2)')

    fireEvent.click(container.querySelector('[data-testid="delete-selected"]')!)
    await waitFor(() => expect(container.querySelector('[data-testid="delete-confirm"]')).toBeEnabled())
    fireEvent.click(container.querySelector('[data-testid="delete-confirm"]')!)

    await waitFor(() => expect(source.peek('run.scene.last')).toBeUndefined())
    expect(source.peek('run.stream.live')).toBeUndefined()
  })

  it('the delete button is disabled with a reason when nothing is selected', async () => {
    const source = new MockVariablesSource()
    const { container } = renderPane(source)
    await ready(container)

    const btn = container.querySelector<HTMLButtonElement>('[data-testid="delete-selected"]')!
    expect(btn).toBeDisabled()
    expect(btn.title).toContain('Select one or more rows')
  })
})

describe('Secret masking (CD-402)', () => {
  const SECRET = 'hunter2-super-secret'

  it('AC: the secret value is never in the DOM until revealed', async () => {
    const source = new MockVariablesSource()
    const { container } = renderPane(source)
    await ready(container)
    await focusRow(container, 'OBS Token', 'env.obs.token')

    // Literal AC: not in the rendered text, not in the markup (no hidden node, no
    // title/value attribute holding it), because the source masked it on the way out.
    expect(container.textContent).not.toContain(SECRET)
    expect(container.innerHTML).not.toContain(SECRET)
    expect(valueOf(container, 'env.obs.token')).toHaveTextContent(MASK)

    // Hold to reveal → now (and only now) it exists.
    await act(async () => {
      fireEvent.pointerDown(container.querySelector('[data-testid="reveal-env.obs.token"]')!)
    })
    await waitFor(() => expect(container.textContent).toContain(SECRET))

    // Release → gone from the DOM again.
    await act(async () => {
      fireEvent.pointerUp(container.querySelector('[data-testid="reveal-env.obs.token"]')!)
    })
    await waitFor(() => expect(container.textContent).not.toContain(SECRET))
  })

  it("the query payload itself carries no secret — masking is the source's job", async () => {
    const source = new MockVariablesSource()
    const page = await source.query({ filter: { search: 'OBS Token' } })
    expect(page.items[0]!.id).toBe('env.obs.token')
    expect(page.items[0]!.value).toBeNull() // nothing to leak, even before render
    expect(await source.reveal('env.obs.token')).toBe(SECRET)
  })

  it('reveal is keyboard operable (hold Enter) and re-masks on release/blur', async () => {
    const source = new MockVariablesSource()
    const { container } = renderPane(source)
    await ready(container)
    await focusRow(container, 'OBS Token', 'env.obs.token')

    const btn = container.querySelector<HTMLElement>('[data-testid="reveal-env.obs.token"]')!
    expect(btn).toHaveAttribute('aria-label', 'Hold to reveal OBS Token')
    await act(async () => {
      fireEvent.keyDown(btn, { key: 'Enter' })
    })
    await waitFor(() => expect(container.textContent).toContain(SECRET))
    expect(btn).toHaveAttribute('aria-pressed', 'true')

    await act(async () => {
      fireEvent.keyUp(btn, { key: 'Enter' })
    })
    await waitFor(() => expect(container.textContent).not.toContain(SECRET))
  })

  it('copy is blocked on the secret cell by default', async () => {
    const source = new MockVariablesSource()
    const { container } = renderPane(source)
    await ready(container)
    await focusRow(container, 'OBS Token', 'env.obs.token')

    const cell = valueOf(container, 'env.obs.token')!
    const copyEvent = new Event('copy', { bubbles: true, cancelable: true })
    cell.dispatchEvent(copyEvent)
    expect(copyEvent.defaultPrevented).toBe(true)
  })

  it("editing a secret never prefills the old value — you replace it, you don't read it", async () => {
    const source = new MockVariablesSource()
    const { container } = renderPane(source)
    await ready(container)
    await focusRow(container, 'Webhook Token', 'deck.webhook')
    expect(container.textContent).not.toContain('whk-live-9f3a2b')

    fireEvent.doubleClick(valueOf(container, 'deck.webhook')!)
    const input = container.querySelector<HTMLInputElement>('[data-testid="edit-deck.webhook"]')!
    expect(input.value).toBe('') // the old secret is not readable through its own editor

    fireEvent.change(input, { target: { value: 'rotated-token' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(source.peek('deck.webhook')!.value).toBe('rotated-token'))
    // …and it goes straight back to masked.
    await waitFor(() => expect(valueOf(container, 'deck.webhook')).toHaveTextContent(MASK))
    expect(container.textContent).not.toContain('rotated-token')
  })

  it('an environment-owned secret is revealable but not editable', async () => {
    const source = new MockVariablesSource()
    const { container } = renderPane(source)
    await ready(container)
    await focusRow(container, 'OBS Token', 'env.obs.token')

    fireEvent.doubleClick(valueOf(container, 'env.obs.token')!)
    expect(container.querySelector('[data-testid="edit-env.obs.token"]')).toBeNull()
    expect(valueOf(container, 'env.obs.token')!.title).toContain('Host environment value')
  })

  it('a plugin-owned secret cannot be edited at all', async () => {
    const source = new MockVariablesSource()
    const { container } = renderPane(source)
    await ready(container)
    await focusRow(container, 'Spotify API Key', 'plug.spotify.key')

    fireEvent.doubleClick(valueOf(container, 'plug.spotify.key')!)
    expect(container.querySelector('[data-testid="edit-plug.spotify.key"]')).toBeNull()
    expect(container.textContent).not.toContain('sk-live-abcdef')
  })

  it('surfaces a failed reveal rather than silently staying masked', async () => {
    const source = new MockVariablesSource()
    vi.spyOn(source, 'reveal').mockRejectedValue(new Error('permission denied'))
    const { container } = renderPane(source)
    await ready(container)
    await focusRow(container, 'OBS Token', 'env.obs.token')

    await act(async () => {
      fireEvent.pointerDown(container.querySelector('[data-testid="reveal-env.obs.token"]')!)
    })
    await waitFor(() =>
      expect(container.querySelector('[data-testid="vars-notice"]')).toHaveTextContent('permission denied'),
    )
  })
})

describe('Variables source contract (CD-402)', () => {
  it('a source without a reference index says so instead of implying "safe to delete"', async () => {
    const bare: VariablesSource = {
      query: async () => ({
        items: [{ id: 'a.b', name: 'A', scope: 'global', type: 'string', value: 'x' }],
        page: 1,
        limit: 100,
        total: 1,
      }),
      write: vi.fn(),
      create: vi.fn(),
      remove: vi.fn(),
      reveal: vi.fn(),
    }
    const { container } = renderWithProviders(
      <VariablesSourceProvider value={bare}>
        <VariablesPane />
      </VariablesSourceProvider>,
    )
    await waitFor(() => expect(rowFor(container, 'a.b')).toBeTruthy())

    fireEvent.click(rowFor(container, 'a.b')!)
    fireEvent.click(container.querySelector('[data-testid="delete-selected"]')!)
    await waitFor(() => expect(container.querySelector('[data-testid="delete-refs-unknown"]')).toBeTruthy())
  })
})
