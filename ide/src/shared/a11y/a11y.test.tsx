import { describe, expect, it, vi } from 'vitest'
import { act, useRef, useState } from 'react'
import { axe } from 'vitest-axe'
import { renderWithProviders } from '@/shared/test'
import {
  Button,
  Tabs,
  TabList,
  Tab,
  TabPanel,
  Tree,
  TreeItem,
  Dialog,
  activateOnKey,
  useFocusTrap,
} from '@/shared/a11y'

// --- activation ---
describe('activateOnKey', () => {
  it('runs on Enter and Space, prevents default', () => {
    const run = vi.fn()
    const handler = activateOnKey<HTMLDivElement>(run)
    for (const key of ['Enter', ' ']) {
      const e = { key, preventDefault: vi.fn() } as unknown as Parameters<typeof handler>[0]
      handler(e)
      expect(e.preventDefault).toHaveBeenCalled()
    }
    expect(run).toHaveBeenCalledTimes(2)
  })
  it('ignores other keys', () => {
    const run = vi.fn()
    const handler = activateOnKey<HTMLDivElement>(run)
    handler({ key: 'a', preventDefault: vi.fn() } as unknown as Parameters<typeof handler>[0])
    expect(run).not.toHaveBeenCalled()
  })
})

// --- focus trap + restore ---
function TrapHarness() {
  const ref = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(true)
  useFocusTrap(ref, open)
  return (
    <div>
      <button data-testid="outside" onClick={() => setOpen(true)}>
        outside
      </button>
      {open && (
        <div ref={ref} data-testid="trap">
          <button data-testid="first">first</button>
          <button data-testid="last">last</button>
          <button data-testid="close" onClick={() => setOpen(false)}>
            close
          </button>
        </div>
      )}
    </div>
  )
}

describe('useFocusTrap', () => {
  it('moves focus into the trap on activation', () => {
    const { getByTestId } = renderWithProviders(<TrapHarness />)
    expect(document.activeElement).toBe(getByTestId('first'))
  })

  it('cycles Tab at the end and Shift+Tab at the start', () => {
    const { getByTestId } = renderWithProviders(<TrapHarness />)
    const trap = getByTestId('trap')
    const first = getByTestId('first')
    const close = getByTestId('close')

    // focus last element, Tab → wraps to first
    act(() => close.focus())
    act(() => {
      trap.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    })
    expect(document.activeElement).toBe(first)

    // at first, Shift+Tab → wraps to last (close)
    act(() => {
      trap.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }))
    })
    expect(document.activeElement).toBe(close)
  })

  it('restores focus to the previously-focused element on deactivation', () => {
    const { getByTestId } = renderWithProviders(<TrapHarness />)
    const outside = getByTestId('outside')
    act(() => outside.focus())
    // re-open path already focused first; now close the trap → focus restores to `outside`
    act(() => getByTestId('close').click())
    expect(document.activeElement).toBe(outside)
  })
})

// --- Tabs roving tabindex + selection ---
describe('Tabs', () => {
  it('selected tab has tabindex 0, others -1; clicking switches panels', () => {
    function Harness() {
      const [v, setV] = useState('a')
      return (
        <Tabs value={v} onValueChange={setV} label="demo">
          <TabList label="demo tabs">
            <Tab value="a">A</Tab>
            <Tab value="b">B</Tab>
          </TabList>
          <TabPanel value="a">panel a</TabPanel>
          <TabPanel value="b">panel b</TabPanel>
        </Tabs>
      )
    }
    const { getByRole, queryByText } = renderWithProviders(<Harness />)
    const tabA = getByRole('tab', { name: 'A' })
    const tabB = getByRole('tab', { name: 'B' })
    expect(tabA).toHaveAttribute('tabindex', '0')
    expect(tabB).toHaveAttribute('tabindex', '-1')
    expect(queryByText('panel a')).toBeInTheDocument()

    act(() => tabB.click())
    expect(getByRole('tab', { name: 'B' })).toHaveAttribute('aria-selected', 'true')
    expect(queryByText('panel b')).toBeInTheDocument()
  })
})

// --- axe: a demo page of all primitives is clean ---
describe('a11y — axe clean', () => {
  it('a page of every primitive has no violations', async () => {
    function DemoPage() {
      const [v, setV] = useState('one')
      return (
        <main>
          <h1>Primitives demo</h1>
          <Button label="Save">Save</Button>
          <Tabs value={v} onValueChange={setV} label="sections">
            <TabList label="section tabs">
              <Tab value="one">One</Tab>
              <Tab value="two">Two</Tab>
            </TabList>
            <TabPanel value="one">First</TabPanel>
            <TabPanel value="two">Second</TabPanel>
          </Tabs>
          <Tree label="files">
            <TreeItem selected>root</TreeItem>
            <TreeItem>child</TreeItem>
          </Tree>
          <Dialog open onClose={() => {}} label="Example dialog">
            <h2>Dialog</h2>
            <Button label="Close">Close</Button>
          </Dialog>
        </main>
      )
    }
    const { container } = renderWithProviders(<DemoPage />)
    const results = await axe(container)
    expect(results.violations).toEqual([])
  })
})
