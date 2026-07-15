import { describe, expect, it, vi } from 'vitest'
import { MemoryStorageAdapter } from '@/services/persistence'
import { SessionManager } from '@/services/session'

const sync = (fn: () => void) => {
  fn()
  return () => {}
}

describe('SessionManager — save/load round-trip', () => {
  it('persists and restores the session blob', () => {
    const adapter = new MemoryStorageAdapter()
    const m = new SessionManager({ adapter, scheduler: sync })
    m.save({ activeWorkspace: 'flows', selection: ['w1'], zoom: 1.5 })
    // relaunch: a fresh manager on the same storage restores it
    const restored = new SessionManager({ adapter }).load()
    expect(restored).toMatchObject({ version: 1, activeWorkspace: 'flows', selection: ['w1'], zoom: 1.5 })
  })

  it('debounces and flushes', () => {
    const adapter = new MemoryStorageAdapter()
    const m = new SessionManager({ adapter, scheduler: () => () => {} }) // never auto-fires
    m.save({ activeWorkspace: 'home' })
    expect(adapter.get('cdk-session')).toBeNull() // pending
    m.flush()
    expect(JSON.parse(adapter.get('cdk-session')!).activeWorkspace).toBe('home')
  })
})

describe('SessionManager — corrupt blob → defaults + notice', () => {
  it('returns null + notice on unparseable JSON', () => {
    const notices: string[] = []
    const adapter = new MemoryStorageAdapter({ 'cdk-session': 'NOT JSON' })
    const m = new SessionManager({ adapter, onNotice: (n) => notices.push(n.code) })
    expect(m.load()).toBeNull()
    expect(notices).toEqual(['corrupt-session'])
  })

  it('returns null + notice on wrong shape / version', () => {
    const badShape = new SessionManager({
      adapter: new MemoryStorageAdapter({ 'cdk-session': '"just a string"' }),
      onNotice: vi.fn(),
    })
    expect(badShape.load()).toBeNull()

    const notices: string[] = []
    const badVersion = new SessionManager({
      adapter: new MemoryStorageAdapter({ 'cdk-session': JSON.stringify({ version: 99, activeWorkspace: 'x' }) }),
      onNotice: (n) => notices.push(n.code),
    })
    expect(badVersion.load()).toBeNull()
    expect(notices).toEqual(['corrupt-session'])
  })

  it('absent session returns null with no notice (fresh start)', () => {
    const onNotice = vi.fn()
    const m = new SessionManager({ adapter: new MemoryStorageAdapter(), onNotice })
    expect(m.load()).toBeNull()
    expect(onNotice).not.toHaveBeenCalled()
  })
})
