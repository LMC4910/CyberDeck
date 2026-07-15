import { describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { renderWithProviders } from '@/shared/test'
import { createStore } from '@/stores'
import { Breadcrumb, StatusBar, crumbFor } from '@/workspaces'

describe('breadcrumb segments — per-workspace mapping', () => {
  it('segments swap per workspace', () => {
    expect(crumbFor('deck-designer', { projectName: 'Deck' }).map((s) => s.label)).toEqual([
      'Deck',
      'Deck Designer',
    ])
    expect(crumbFor('flows', { projectName: 'Deck', leaf: 'Stream Start' }).map((s) => s.label)).toEqual([
      'Deck',
      'Flows',
      'Stream Start',
    ])
    expect(crumbFor('projects', {}).map((s) => s.label)).toEqual(['Projects'])
  })
})

describe('Breadcrumb — clickable segments navigate', () => {
  it('renders segments and navigates on click (not the current/last one)', () => {
    const onNavigate = vi.fn()
    const { getByRole } = renderWithProviders(
      <Breadcrumb
        activeWorkspace="flows"
        context={{ projectName: 'Deck', leaf: 'Stream Start' }}
        onNavigate={onNavigate}
      />,
    )
    // 'Flows' is a clickable segment (not the leaf)
    act(() => getByRole('button', { name: 'Flows' }).click())
    expect(onNavigate).toHaveBeenCalledWith('flows')
    // 'Stream Start' (leaf) is the current page, not a button
    expect(getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument()
  })

  it('the last segment is aria-current=page and not a link', () => {
    const { container } = renderWithProviders(
      <Breadcrumb activeWorkspace="home" context={{ projectName: 'Deck' }} onNavigate={() => {}} />,
    )
    const current = container.querySelector('[aria-current="page"]')
    expect(current).toHaveTextContent('Home')
    expect(container.querySelector('[data-crumb="projects"]')).toBeInTheDocument() // Project link
  })
})

describe('StatusBar — pure store subscriber', () => {
  it('reflects Editor-store selection changes reactively (no imperative sync)', () => {
    const editor = createStore({ selection: [] as string[] }, { name: 'editor', kind: 'persisted' })
    const { getByText, container } = renderWithProviders(
      <StatusBar activeWorkspaceLabel="Flows" editorStore={editor} savedLabel="saved · 09:41" />,
    )
    expect(container.querySelector('[data-status-selection]')).toHaveTextContent('No selection')
    expect(getByText('saved · 09:41')).toBeInTheDocument()

    // mutate the store → the status bar updates via subscription, not a prop
    act(() => editor.setState({ selection: ['w1', 'w2'] }))
    expect(container.querySelector('[data-status-selection]')).toHaveTextContent('2 selected')
  })
})
