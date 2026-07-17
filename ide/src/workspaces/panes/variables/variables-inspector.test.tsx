// CD-403 — computed variables + inspector + references, driven through the real pane.
// The three things the ACs demand, observed end-to-end:
//   • a computed var's cell updates when a dependency ticks (live, not the snapshot)
//   • a dependency cycle is rejected and its message is shown in the inspector
//   • a "used by" reference click navigates + selects the target (via the env seam)
import { describe, it, expect, vi } from 'vitest'
import { act, fireEvent, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '@/shared/test'
import VariablesPane from '../variables-pane'
import { VariablesSourceProvider } from './variables-source'
import { VariablesEnvProvider, type VariablesEnv } from './variables-env'
import { MockVariablesSource } from './mock-variables-source'
import type { VariableRecord } from './variables-model'

function renderPane(source: MockVariablesSource, env?: VariablesEnv) {
  const ui = (
    <VariablesSourceProvider value={source}>
      <VariablesPane />
    </VariablesSourceProvider>
  )
  return renderWithProviders(env ? <VariablesEnvProvider value={env}>{ui}</VariablesEnvProvider> : ui)
}

const rows = (c: HTMLElement) => c.querySelectorAll('[data-variable]')
const rowFor = (c: HTMLElement, id: string) => c.querySelector<HTMLElement>(`[data-variable="${id}"]`)
const valueOf = (c: HTMLElement, id: string) => c.querySelector<HTMLElement>(`[data-testid="value-${id}"]`)
const ready = (c: HTMLElement) => waitFor(() => expect(rows(c).length).toBeGreaterThan(0))

describe('Variables computed + inspector + refs (CD-403)', () => {
  it('AC: a computed var updates when its dependency ticks', async () => {
    const source = new MockVariablesSource()
    const { container } = renderPane(source)
    await ready(container)

    // calc.cpu.headroom = 100 - sys.cpu.load; seeded at 37 → 63%.
    await waitFor(() => expect(valueOf(container, 'calc.cpu.headroom')).toHaveTextContent('63%'))

    // Tick the dependency; the derived cell must re-evaluate to 100 - 10 = 90%.
    act(() => source.tick('sys.cpu.load', 10))
    await waitFor(() => expect(valueOf(container, 'calc.cpu.headroom')).toHaveTextContent('90%'))
  })

  it('AC: a dependency cycle is rejected with a message shown in the inspector', async () => {
    const base = 1_760_000_000_000
    const seed: VariableRecord[] = [
      { id: 'calc.a', name: 'Alpha', scope: 'computed', type: 'number', value: 0, expr: 'calc.b + 1', updatedAt: base },
      { id: 'calc.b', name: 'Beta', scope: 'computed', type: 'number', value: 0, expr: 'calc.a + 1', updatedAt: base },
    ]
    const source = new MockVariablesSource({ seed, references: {} })
    const { container } = renderPane(source)
    await ready(container)

    // The cell shows an honest error marker rather than a stale value.
    await waitFor(() => expect(valueOf(container, 'calc.a')).toHaveAttribute('data-computed', 'error'))

    // Selecting the row opens the inspector; its Status carries the cycle message.
    fireEvent.click(rowFor(container, 'calc.a')!)
    const inspector = await waitFor(() => container.querySelector<HTMLElement>('[data-testid="vars-inspector"]')!)
    await waitFor(() =>
      expect(within(inspector).getByTestId('computed-status')).toHaveTextContent(/cycle/i),
    )
  })

  it('AC: clicking a reference navigates to and selects the target', async () => {
    const navigate = vi.fn()
    const source = new MockVariablesSource()
    const { container } = renderPane(source, { navigate })
    await ready(container)

    // Select a variable that is used elsewhere → inspector opens.
    fireEvent.click(rowFor(container, 'sys.cpu.load')!)
    const inspector = await waitFor(() => container.querySelector<HTMLElement>('[data-testid="vars-inspector"]')!)

    // Move to the Refs tab and click the "used by" entry.
    fireEvent.click(within(inspector).getByRole('tab', { name: 'Refs' }))
    const refBtn = await waitFor(() =>
      within(inspector).getByTestId('ref-deck-designer-w_cpu_gauge'),
    )
    fireEvent.click(refBtn)

    // The pane's single navigate+select intent fired with the full reference —
    // the shell binds this to WorkspaceService.setActive + target selection.
    expect(navigate).toHaveBeenCalledTimes(1)
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({ workspace: 'deck-designer', targetId: 'w_cpu_gauge' }),
    )
  })

  it('references are disabled with a reason when navigation is not wired', async () => {
    const source = new MockVariablesSource()
    const { container } = renderPane(source) // no env provider
    await ready(container)

    fireEvent.click(rowFor(container, 'sys.cpu.load')!)
    const inspector = await waitFor(() => container.querySelector<HTMLElement>('[data-testid="vars-inspector"]')!)
    fireEvent.click(within(inspector).getByRole('tab', { name: 'Refs' }))
    const refBtn = await waitFor(() => within(inspector).getByTestId('ref-deck-designer-w_cpu_gauge'))
    expect(refBtn).toBeDisabled()
    expect(refBtn).toHaveAttribute('title', expect.stringMatching(/not wired/i))
  })
})
