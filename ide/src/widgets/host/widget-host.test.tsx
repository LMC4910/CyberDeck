// CD-420: lazy chunks + error boundaries + dispose cleanup. Proves the ACs:
//  • per-widget dynamic import fires on first render (nothing loads until rendered)
//  • a throwing widget renders the fallback and the board (siblings) survives
//  • dispose leak test — the widget's scope subscriptions/timers are released
// plus retry (re-imports) and the telemetry breadcrumbs the host drops.
import { useEffect } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { WidgetHost } from './widget-host'
import type { WidgetScope } from './widget-scope'
import type { WidgetBreadcrumb, WidgetModule, WidgetModuleProps } from './types'
import { demoResolver } from './demo/demo-resolver'
import { demoLoadLog } from './demo/demo-load-log'
import type { WidgetManifest } from '@/services/widgets'

const man = (id: string): WidgetManifest => ({ id, version: '1.0.0', metadata: { label: id } })

// Wrap a component into a resolvable module (behaviour tests stay deterministic).
const moduleOf = (c: (p: WidgetModuleProps) => unknown): WidgetModule =>
  ({ default: c } as unknown as WidgetModule)

const demoEl = (name: string): Element | null =>
  document.querySelector(`[data-demo-widget="${name}"]`)

// Wait for a lazily-rendered demo widget to appear.
const findDemo = (name: string): Promise<Element> =>
  waitFor(() => {
    const el = demoEl(name)
    if (!el) throw new Error(`demo widget "${name}" not rendered yet`)
    return el
  })

describe('WidgetHost — states + lazy load', () => {
  it('renders the empty card when no manifest is bound', () => {
    render(<WidgetHost resolve={demoResolver} />)
    expect(screen.getByRole('group')).toHaveAttribute('data-widget-state', 'empty')
  })

  it('shows loading then the widget, importing the module on first render', async () => {
    // Nothing loaded before we render the host.
    expect(demoLoadLog.includes('ok')).toBe(false)
    render(<WidgetHost manifest={man('ok.demo')} resolve={demoResolver} />)
    // First paint: loading card.
    expect(screen.getByRole('group')).toHaveAttribute('data-widget-state', 'loading')
    // Then the lazily-imported module resolves and renders.
    expect(await findDemo('ok')).toBeInTheDocument()
    expect(demoLoadLog.includes('ok')).toBe(true)
  })

  it('code-splits per widget: rendering ok does not load the throwing/subscribing chunks', async () => {
    render(<WidgetHost manifest={man('ok.demo')} resolve={demoResolver} />)
    await findDemo('ok')
    // The sibling demo modules were never imported by this render.
    expect(demoLoadLog.includes('throwing')).toBe(false)
    expect(demoLoadLog.includes('subscribing')).toBe(false)
  })

  it('drops load-start/load-ok telemetry breadcrumbs', async () => {
    const crumbs: WidgetBreadcrumb[] = []
    render(
      <WidgetHost
        manifest={man('ok.demo')}
        resolve={demoResolver}
        onTelemetry={(b) => crumbs.push(b)}
      />,
    )
    await findDemo('ok')
    expect(crumbs.map((c) => c.phase)).toEqual(['load-start', 'load-ok'])
  })
})

describe('WidgetHost — crash isolation (AC: throwing widget → fallback, board survives)', () => {
  beforeEach(() => {
    // React logs caught boundary errors; keep the test output clean.
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('renders the error card for a throwing widget and reports a breadcrumb', async () => {
    const crumbs: WidgetBreadcrumb[] = []
    render(
      <WidgetHost
        manifest={man('throwing.demo')}
        resolve={demoResolver}
        onTelemetry={(b) => crumbs.push(b)}
      />,
    )
    await screen.findByText('throwing.demo failed')
    expect(screen.getByRole('group')).toHaveAttribute('data-widget-state', 'error')
    expect(crumbs.some((c) => c.phase === 'render-error')).toBe(true)
  })

  it('a crashing widget does not take down a sibling widget on the same board', async () => {
    render(
      <div>
        <WidgetHost manifest={man('throwing.demo')} resolve={demoResolver} />
        <WidgetHost manifest={man('ok.demo')} resolve={demoResolver} />
      </div>,
    )
    // The good widget renders...
    expect(await findDemo('ok')).toBeInTheDocument()
    // ...while the bad one is isolated in its fallback.
    expect(await screen.findByText('throwing.demo failed')).toBeInTheDocument()
  })

  it('surfaces a resolver rejection as the error card (load-error breadcrumb)', async () => {
    const crumbs: WidgetBreadcrumb[] = []
    render(
      <WidgetHost
        manifest={man('nope.demo')}
        resolve={demoResolver}
        onTelemetry={(b) => crumbs.push(b)}
      />,
    )
    await screen.findByText('nope.demo failed')
    expect(crumbs.some((c) => c.phase === 'load-error')).toBe(true)
  })

  it('retry re-runs the import so a transient failure can recover', async () => {
    let attempts = 0
    const Good = ({ manifest }: WidgetModuleProps) => <div data-demo-widget="recovered">{manifest.id}</div>
    const flaky = () => {
      attempts += 1
      return attempts === 1
        ? Promise.reject(new Error('transient'))
        : Promise.resolve(moduleOf(Good))
    }
    render(<WidgetHost manifest={man('flaky.demo')} resolve={flaky} />)
    fireEvent.click(await screen.findByText('Retry'))
    expect(await findDemo('recovered')).toBeInTheDocument()
    expect(attempts).toBe(2)
  })
})

describe('WidgetHost — dispose cleanup (AC: subscriptions released)', () => {
  it('disposes the widget scope on unmount', async () => {
    const unsub = vi.fn()
    let captured: WidgetScope | null = null
    const Subscriber = ({ scope, config }: WidgetModuleProps) => {
      ;(config as (s: WidgetScope) => void)(scope)
      useEffect(() => {
        scope.add(unsub) // a subscription
        scope.setInterval(() => {}, 1000) // a timer
      }, [scope])
      return <div data-demo-widget="subscriber">live</div>
    }
    const { unmount } = render(
      <WidgetHost
        manifest={man('sub.demo')}
        resolve={() => Promise.resolve(moduleOf(Subscriber))}
        config={(s: WidgetScope) => {
          captured = s
        }}
      />,
    )
    await findDemo('subscriber')
    const scope = captured as unknown as WidgetScope
    expect(scope.size).toBe(2) // subscription + timer registered

    unmount()
    await waitFor(() => expect(scope.isDisposed).toBe(true))
    expect(unsub).toHaveBeenCalledTimes(1)
    expect(scope.size).toBe(0) // all released — no leak
  })
})
