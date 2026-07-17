import { describe, it, expect, vi } from 'vitest'
import { MemoryStorageAdapter } from '@/services/persistence'
import { ProjectRecents, type RecentProject } from './project-recents'

function entry(id: string, name = id, openedAt = '2026-07-17T10:00:00.000Z'): RecentProject {
  return { id, name, openedAt }
}

describe('ProjectRecents (CD-406)', () => {
  it('records most-recent-first, dedupes by id, caps, and persists', () => {
    const storage = new MemoryStorageAdapter()
    const r = new ProjectRecents({ storage, cap: 3 })
    r.record(entry('a'))
    r.record(entry('b'))
    r.record(entry('a', 'A again')) // moves a to front, keeps one entry
    r.record(entry('c'))
    r.record(entry('d')) // caps at 3 → drops b
    expect(r.list().map((e) => e.id)).toEqual(['d', 'c', 'a'])

    const restored = new ProjectRecents({ storage, cap: 3 })
    expect(restored.list().map((e) => e.id)).toEqual(['d', 'c', 'a'])
    expect(restored.list()[0]?.name).toBe('d')
  })

  it('remove() drops a deleted project and leaves the rest ordered', () => {
    const r = new ProjectRecents({ storage: new MemoryStorageAdapter() })
    r.record(entry('a'))
    r.record(entry('b'))
    r.remove('a')
    expect(r.list().map((e) => e.id)).toEqual(['b'])
    r.remove('nope') // no-op
    expect(r.list().map((e) => e.id)).toEqual(['b'])
  })

  it('list() is a stable snapshot until the list changes (useSyncExternalStore contract)', () => {
    const r = new ProjectRecents({ storage: new MemoryStorageAdapter() })
    r.record(entry('a'))
    const first = r.list()
    expect(r.list()).toBe(first)
    r.remove('nope') // unchanged → same reference
    expect(r.list()).toBe(first)
    r.record(entry('b'))
    expect(r.list()).not.toBe(first)
  })

  it('notifies subscribers on change', () => {
    const r = new ProjectRecents({ storage: new MemoryStorageAdapter() })
    const seen = vi.fn()
    const off = r.subscribe(seen)
    r.record(entry('a'))
    expect(seen).toHaveBeenCalledTimes(1)
    r.remove('a')
    expect(seen).toHaveBeenCalledTimes(2)
    off()
    r.record(entry('b'))
    expect(seen).toHaveBeenCalledTimes(2)
  })

  it('degrades to an empty list on a corrupt or non-list blob', () => {
    const storage = new MemoryStorageAdapter()
    storage.set('cdk-project-recents', '{not json')
    expect(new ProjectRecents({ storage }).list()).toEqual([])

    storage.set('cdk-project-recents', '{"nope":1}')
    expect(new ProjectRecents({ storage }).list()).toEqual([])

    // partial entries are dropped, well-formed ones survive
    storage.set('cdk-project-recents', JSON.stringify([{ id: 'a' }, entry('b')]))
    expect(new ProjectRecents({ storage }).list().map((e) => e.id)).toEqual(['b'])
  })
})
