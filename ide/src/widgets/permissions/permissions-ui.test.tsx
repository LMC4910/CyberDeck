// CD-422 (UI): the permission surfaces — per-widget inspector list, first-use
// prompt, and the Platform Inspector perms tab. Proves the ACs at the React layer:
// deny/grant flip the visible state, the prompt resolves the broker's promise, and
// the tab reflects the store live. Services-layer ACs live in ../../services/widgets.
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'
import { MemoryStorageAdapter } from '@/services/persistence'
import { WidgetPermissionsStore } from '@/services/widgets'
import { makeManifest } from '@/services/widgets/__fixtures__/manifests'
import { WidgetPermissionsPanel } from './widget-permissions-panel'
import { WidgetPermissionPrompt } from './permission-prompt'
import { PlatformPermissionsTab } from './platform-permissions-tab'
import { PermissionPromptController } from './prompt-controller'

const store = () => new WidgetPermissionsStore({ adapter: new MemoryStorageAdapter() })

describe('WidgetPermissionsPanel', () => {
  it('lists each declared capability and flips its state on Grant/Deny (AC: deny blocks, visible)', () => {
    const s = store()
    const manifest = makeManifest('w.gauge', { permissions: ['network', 'clipboard'] })
    render(<WidgetPermissionsPanel manifest={manifest} store={s} />)

    const netRow = screen.getByText('network').closest('[data-perm-cap]') as HTMLElement
    expect(netRow).toHaveAttribute('data-perm-state', 'unset')

    fireEvent.click(within(netRow).getByRole('button', { name: 'Deny' }))
    expect(netRow).toHaveAttribute('data-perm-state', 'denied')
    expect(s.decision('w.gauge', 'network')).toBe('denied')

    fireEvent.click(within(netRow).getByRole('button', { name: 'Grant' }))
    expect(netRow).toHaveAttribute('data-perm-state', 'granted')
  })

  it('signposts a widget that declares no capabilities (no silent gap)', () => {
    render(<WidgetPermissionsPanel manifest={makeManifest('w.plain', { permissions: [] })} store={store()} />)
    expect(screen.getByText(/declares no capabilities/i)).toBeInTheDocument()
  })
})

describe('WidgetPermissionPrompt', () => {
  it('renders nothing while idle', () => {
    const { container } = render(<WidgetPermissionPrompt controller={new PermissionPromptController()} />)
    expect(container.querySelector('[data-perm-prompt]')).toBeNull()
  })

  it('shows the queued request and resolves the broker promise on Grant (AC: prompt on first use)', async () => {
    const controller = new PermissionPromptController()
    render(<WidgetPermissionPrompt controller={controller} />)

    let decided: string | undefined
    act(() => {
      void controller.prompt({ widgetId: 'w.spotify', capability: 'network', reason: 'fetch now-playing' }).then((d) => {
        decided = d
      })
    })

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('w.spotify')).toBeInTheDocument()
    expect(screen.getByText(/fetch now-playing/)).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Grant' }))
    })
    expect(decided).toBe('granted')
    // queue drained → idle again
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('PlatformPermissionsTab', () => {
  it('lists every gated widget × capability and updates live (AC: perms tab goes live)', () => {
    const s = store()
    const widgets = [
      makeManifest('w.gauge', { permissions: ['network'] }),
      makeManifest('w.text', { permissions: [] }), // not gated — excluded
    ]
    render(<PlatformPermissionsTab widgets={widgets} store={s} />)

    const row = screen.getByText('w.gauge').closest('[data-perm-row]') as HTMLElement
    expect(row).toHaveAttribute('data-perm-state', 'unset')
    // ungated widget never appears
    expect(screen.queryByText('w.text')).toBeNull()

    act(() => s.grant('w.gauge', 'network'))
    expect(screen.getByText('w.gauge').closest('[data-perm-row]')).toHaveAttribute('data-perm-state', 'granted')
  })

  it('signposts when no widget declares a capability', () => {
    render(<PlatformPermissionsTab widgets={[makeManifest('w.text', { permissions: [] })]} store={store()} />)
    expect(screen.getByText(/No widget declares any capability/i)).toBeInTheDocument()
  })
})
