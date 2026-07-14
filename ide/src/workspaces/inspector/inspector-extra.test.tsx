import { describe, expect, it } from 'vitest'
import { act } from 'react'
import { renderWithProviders } from '@/shared/test'
import { EventBus } from '@/platform/eventbus'
import { runBoot } from '@/platform/boot'
import {
  ReposTab,
  EventsTab,
  ArchitectureMode,
  BootReplay,
  ARCH_NOTES,
  type RequestRow,
} from '@/workspaces/inspector'

describe('ReposTab — live request log', () => {
  it('shows request rows delivered through the injected tap', () => {
    // simulate the gateway's request-log tap (the app-shell passes gateway.tap)
    let emit: ((entry: RequestRow) => void) | undefined
    const subscribe = (fn: (entry: RequestRow) => void) => {
      emit = fn
      return () => {
        emit = undefined
      }
    }
    const { container } = renderWithProviders(<ReposTab subscribe={subscribe} />)

    act(() => emit?.({ route: 'variables.query', ok: true, durationMs: 38 }))
    const row = container.querySelector('[data-request="variables.query"]')
    expect(row).toBeInTheDocument()
    expect(row).toHaveTextContent('ok')
    expect(row).toHaveTextContent('38 ms')
  })
})

describe('EventsTab — catalog + live stream', () => {
  it('renders the 13-event catalog and streams live events', () => {
    const bus = new EventBus({ schedule: (fn) => fn() }) // sync delivery
    const { container } = renderWithProviders(<EventsTab bus={bus} />)

    // catalog: 13 event types
    expect(container.querySelectorAll('[data-event-type]')).toHaveLength(13)

    // live stream: emit → appears
    act(() => bus.emit('ThemeChanged', { themeId: 'x' }))
    expect(container.querySelector('[data-event="ThemeChanged"]')).toBeInTheDocument()
  })
})

describe('ArchitectureMode — the 21 ARCH notes', () => {
  it('renders all 21 notes', () => {
    const { container } = renderWithProviders(<ArchitectureMode />)
    expect(ARCH_NOTES).toHaveLength(21)
    expect(container.querySelectorAll('[data-arch-note]')).toHaveLength(21)
    expect(container.querySelector('[data-arch-note="eventbus"]')).toHaveTextContent('Event Bus')
  })
})

describe('BootReplay — real recorded marks', () => {
  it('renders recorded stage timings from a real BootReport', async () => {
    const report = await runBoot(
      [
        { id: 'configuration', blocking: true, run: () => {} },
        { id: 'theme', blocking: true, run: () => {} },
        { id: 'widgets', blocking: false, run: () => {} },
      ],
      { order: ['configuration', 'theme', 'widgets'], now: (() => { let t = 0; return () => (t += 10) })() },
    )
    const { container } = renderWithProviders(<BootReplay report={report} />)
    expect(container.querySelectorAll('[data-stage]')).toHaveLength(3)
    expect(container.querySelector('[data-stage="configuration"]')).toHaveAttribute('data-status', 'ok')
    expect(container.querySelector('[data-interactive-at]')).toHaveTextContent('interactive @')
  })
})
