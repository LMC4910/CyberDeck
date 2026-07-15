import { describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { renderWithProviders } from '@/shared/test'
import { createStore } from '@/stores'
import {
  BUILTIN_PRESETS,
  applyPreset,
  currentPresetName,
  setPanelWidth,
  LayoutPresetMenu,
  CUSTOM,
  type PanelsState,
  type LayoutPreset,
} from '@/workspaces'

const store = () =>
  createStore<PanelsState>({ panels: {} }, { name: 'workspace', kind: 'persisted', location: 'cdk-layout' })
const preset = (name: string) => BUILTIN_PRESETS.find((p) => p.name === name)!

describe('layout presets — apply + match round-trip', () => {
  it('applies a preset and matches it back', () => {
    const s = store()
    applyPreset(s, 'flows', preset('Focus'))
    expect(currentPresetName(s.getState(), 'flows')).toBe('Focus')
    // Focus hides both panels
    const st = s.getState().panels['flows']!
    expect(st.leftVisible).toBe(false)
    expect(st.rightVisible).toBe(false)

    applyPreset(s, 'flows', preset('Balanced'))
    expect(currentPresetName(s.getState(), 'flows')).toBe('Balanced')
    expect(s.getState().panels['flows']!.leftVisible).toBe(true)
  })

  it('a manual change that matches no preset shows as Custom', () => {
    const s = store()
    applyPreset(s, 'flows', preset('Balanced'))
    setPanelWidth(s, 'flows', 'left', 401) // no built-in has lpw 401
    expect(currentPresetName(s.getState(), 'flows')).toBe(CUSTOM)
  })
})

describe('layout presets — per-workspace independence', () => {
  it('different workspaces hold different presets', () => {
    const s = store()
    applyPreset(s, 'flows', preset('Focus'))
    applyPreset(s, 'variables', preset('Explorer'))
    expect(currentPresetName(s.getState(), 'flows')).toBe('Focus')
    expect(currentPresetName(s.getState(), 'variables')).toBe('Explorer')
  })
})

describe('LayoutPresetMenu — UI', () => {
  it('shows the current preset and applies one on click', () => {
    const s = store()
    applyPreset(s, 'flows', preset('Balanced'))
    const { getByRole, container } = renderWithProviders(
      <LayoutPresetMenu store={s} workspaceId="flows" userPresets={[]} onSaveUserPreset={() => {}} onDeleteUserPreset={() => {}} />,
    )
    expect(getByRole('button', { name: /Layout: Balanced/ })).toBeInTheDocument()
    act(() => (container.querySelector('[data-preset-current]') as HTMLElement).click())
    act(() => (container.querySelector('[data-preset="Focus"]') as HTMLElement).click())
    expect(currentPresetName(s.getState(), 'flows')).toBe('Focus')
  })

  it('offers save when Custom, and save/delete user presets round-trip', () => {
    const s = store()
    applyPreset(s, 'flows', preset('Balanced'))
    setPanelWidth(s, 'flows', 'left', 411) // → Custom
    const saved: LayoutPreset[] = []
    const onSave = (p: LayoutPreset) => saved.push(p)
    const onDelete = vi.fn()

    const { container, rerender } = renderWithProviders(
      <LayoutPresetMenu store={s} workspaceId="flows" userPresets={saved} onSaveUserPreset={onSave} onDeleteUserPreset={onDelete} />,
    )
    act(() => (container.querySelector('[data-preset-current]') as HTMLElement).click())
    act(() => (container.querySelector('[data-preset-save]') as HTMLElement).click())
    expect(saved).toHaveLength(1)
    expect(saved[0]!.lpw).toBe(411) // captured the custom width

    // re-render with the user preset present → it appears + is deletable
    rerender(
      <LayoutPresetMenu store={s} workspaceId="flows" userPresets={saved} onSaveUserPreset={onSave} onDeleteUserPreset={onDelete} />,
    )
    act(() => (container.querySelector('[data-preset-current]') as HTMLElement).click())
    expect(container.querySelector(`[data-preset="${saved[0]!.name}"]`)).toBeInTheDocument()
    act(() => (container.querySelector(`[data-preset-delete="${saved[0]!.name}"]`) as HTMLElement).click())
    expect(onDelete).toHaveBeenCalledWith(saved[0]!.name)
  })
})
