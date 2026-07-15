import { describe, expect, it, vi } from 'vitest'
import {
  WorkspaceService,
  InvalidWorkspaceError,
  DuplicateWorkspaceError,
  UnknownWorkspaceError,
  type WorkspaceContribution,
} from '@/services/workspace'

const wc = (over: Partial<WorkspaceContribution> = {}): WorkspaceContribution => ({
  id: 'home',
  label: 'Home',
  icon: 'home',
  order: 0,
  lazyPane: async () => ({ default: () => null }),
  ...over,
})

describe('WorkspaceService — registration + validation', () => {
  it('adding a workspace is a config entry only (a test workspace just appears)', () => {
    const svc = new WorkspaceService()
    svc.register(wc({ id: 'home', order: 0 }))
    svc.register(wc({ id: 'test-ws', label: 'Test', icon: 'flask', order: 5 }))
    expect(svc.list().map((w) => w.id)).toEqual(['home', 'test-ws'])
    // routable with no other code change
    svc.setActive('test-ws')
    expect(svc.active()).toBe('test-ws')
  })

  it('sorts by declared order', () => {
    const svc = new WorkspaceService()
    svc.registerAll([wc({ id: 'c', order: 3 }), wc({ id: 'a', order: 1 }), wc({ id: 'b', order: 2 })])
    expect(svc.list().map((w) => w.id)).toEqual(['a', 'b', 'c'])
  })

  it('rejects invalid contributions', () => {
    const svc = new WorkspaceService()
    expect(() => svc.register(wc({ id: 'Bad Id' }))).toThrow(InvalidWorkspaceError)
    expect(() => svc.register(wc({ id: 'ok', label: '' }))).toThrow(InvalidWorkspaceError)
    expect(() => svc.register(wc({ id: 'ok2', icon: '' }))).toThrow(InvalidWorkspaceError)
    expect(() =>
      svc.register(wc({ id: 'ok3', order: Number.NaN })),
    ).toThrow(InvalidWorkspaceError)
    expect(() =>
      // @ts-expect-error intentional bad lazyPane
      svc.register(wc({ id: 'ok4', lazyPane: 'nope' })),
    ).toThrow(InvalidWorkspaceError)
  })

  it('rejects duplicate ids', () => {
    const svc = new WorkspaceService()
    svc.register(wc({ id: 'home' }))
    expect(() => svc.register(wc({ id: 'home' }))).toThrow(DuplicateWorkspaceError)
  })
})

describe('WorkspaceService — routing + events', () => {
  it('first registered workspace is active by default', () => {
    const svc = new WorkspaceService()
    svc.register(wc({ id: 'home' }))
    expect(svc.active()).toBe('home')
  })

  it('setActive routes, notifies subscribers, and emits WorkspaceChanged', () => {
    const onChanged = vi.fn()
    const svc = new WorkspaceService({ onChanged })
    const seen: string[] = []
    svc.registerAll([wc({ id: 'home', order: 0 }), wc({ id: 'flows', order: 1 })])
    svc.subscribe((id) => seen.push(id))

    svc.setActive('flows')
    expect(svc.active()).toBe('flows')
    expect(seen).toEqual(['flows'])
    expect(onChanged).toHaveBeenCalledWith('flows')

    // no-op when already active
    svc.setActive('flows')
    expect(seen).toEqual(['flows'])
  })

  it('setActive on an unknown id throws', () => {
    const svc = new WorkspaceService()
    svc.register(wc({ id: 'home' }))
    expect(() => svc.setActive('ghost')).toThrow(UnknownWorkspaceError)
  })

  it('unsubscribe stops notifications', () => {
    const svc = new WorkspaceService()
    svc.registerAll([wc({ id: 'home', order: 0 }), wc({ id: 'flows', order: 1 })])
    const cb = vi.fn()
    const off = svc.subscribe(cb)
    off()
    svc.setActive('flows')
    expect(cb).not.toHaveBeenCalled()
  })
})
