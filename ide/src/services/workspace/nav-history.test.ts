import { describe, expect, it } from 'vitest'
import { WorkspaceService, type WorkspaceContribution } from '@/services/workspace'

const wc = (id: string, order: number): WorkspaceContribution => ({
  id,
  label: id,
  icon: 'x',
  order,
  lazyPane: async () => ({ default: () => null }),
})

function svcWith(ids: string[]) {
  const svc = new WorkspaceService()
  svc.registerAll(ids.map((id, i) => wc(id, i)))
  return svc
}

describe('WorkspaceService — context preservation', () => {
  it('switch → return restores the saved context', () => {
    const svc = svcWith(['home', 'flows'])
    // save Home context (e.g. scroll/zoom/selection), then leave
    svc.saveContext('home', { scroll: 120, selection: ['w1'] })
    svc.setActive('flows')
    // ... return
    svc.setActive('home')
    expect(svc.getContext('home')).toEqual({ scroll: 120, selection: ['w1'] })
  })

  it('context is per-workspace and independent', () => {
    const svc = svcWith(['home', 'flows'])
    svc.saveContext('home', { scroll: 10 })
    svc.saveContext('flows', { scroll: 99 })
    expect(svc.getContext('home')).toEqual({ scroll: 10 })
    expect(svc.getContext('flows')).toEqual({ scroll: 99 })
    expect(svc.getContext('never-saved')).toBeUndefined()
  })
})

describe('WorkspaceService — nav history (⌘[ / ⌘])', () => {
  it('walks back/forward across ≥3 workspaces', () => {
    const svc = svcWith(['home', 'flows', 'variables', 'devices'])
    svc.setActive('flows')
    svc.setActive('variables')
    svc.setActive('devices')
    expect(svc.historyStack()).toEqual({ entries: ['home', 'flows', 'variables', 'devices'], index: 3 })

    expect(svc.back()).toBe('variables')
    expect(svc.back()).toBe('flows')
    expect(svc.active()).toBe('flows')
    expect(svc.forward()).toBe('variables')
    expect(svc.active()).toBe('variables')
  })

  it('back/forward flags reflect stack position', () => {
    const svc = svcWith(['home', 'flows'])
    expect(svc.canBack).toBe(false) // at the start
    svc.setActive('flows')
    expect(svc.canBack).toBe(true)
    expect(svc.canForward).toBe(false)
    svc.back()
    expect(svc.canBack).toBe(false)
    expect(svc.canForward).toBe(true)
  })

  it('navigating after going back truncates the forward tail', () => {
    const svc = svcWith(['home', 'flows', 'variables', 'devices'])
    svc.setActive('flows')
    svc.setActive('variables')
    svc.back() // → flows
    svc.setActive('devices') // truncates 'variables'
    expect(svc.historyStack()).toEqual({ entries: ['home', 'flows', 'devices'], index: 2 })
    expect(svc.canForward).toBe(false)
  })

  it('back/forward at the ends return null', () => {
    const svc = svcWith(['home', 'flows'])
    expect(svc.back()).toBeNull() // at start
    svc.setActive('flows')
    expect(svc.forward()).toBeNull() // at end
  })
})
