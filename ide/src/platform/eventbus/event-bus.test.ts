import { describe, expect, it, vi } from 'vitest'
import { EventBus, TypedEventBus, EVENT_NAMES } from '@/platform/eventbus'

// Manual scheduler: collect scheduled drains and run them on demand so delivery
// timing is deterministic.
function manualScheduler() {
  const q: Array<() => void> = []
  return {
    schedule: (fn: () => void) => q.push(fn),
    flush: () => {
      while (q.length) q.shift()!()
    },
  }
}

describe('EventBus — delivery + ordering', () => {
  it('delivers asynchronously (not during emit) and in FIFO order', () => {
    const s = manualScheduler()
    const bus = new EventBus({ schedule: s.schedule })
    const seen: number[] = []
    bus.subscribe<number>('t', (n) => seen.push(n))
    bus.emit('t', 1)
    bus.emit('t', 2)
    expect(seen).toEqual([]) // nothing delivered synchronously
    s.flush()
    expect(seen).toEqual([1, 2])
  })
})

describe('EventBus — wildcard', () => {
  it('* receives every topic; prefix.* receives matching topics', () => {
    const s = manualScheduler()
    const bus = new EventBus({ schedule: s.schedule })
    const all: string[] = []
    const varOnly: string[] = []
    bus.subscribe('*', (_p, topic) => all.push(topic))
    bus.subscribe('variable.*', (_p, topic) => varOnly.push(topic))
    bus.emit('variable.changed', 1)
    bus.emit('theme.changed', 2)
    s.flush()
    expect(all).toEqual(['variable.changed', 'theme.changed'])
    expect(varOnly).toEqual(['variable.changed'])
  })
})

describe('EventBus — replay-on-subscribe', () => {
  it('replays recent events on a replayable topic to a new subscriber', () => {
    const s = manualScheduler()
    const bus = new EventBus({ replayable: { runtime: 2 }, schedule: s.schedule })
    bus.emit('runtime', 'a')
    bus.emit('runtime', 'b')
    bus.emit('runtime', 'c') // ring size 2 → keeps b, c
    const seen: string[] = []
    bus.subscribe<string>('runtime', (v) => seen.push(v))
    s.flush()
    expect(seen).toEqual(['b', 'c'])
  })

  it('does not replay non-replayable topics', () => {
    const s = manualScheduler()
    const bus = new EventBus({ schedule: s.schedule })
    bus.emit('plain', 1)
    const seen: number[] = []
    bus.subscribe<number>('plain', (v) => seen.push(v))
    s.flush()
    expect(seen).toEqual([])
  })
})

describe('EventBus — overflow', () => {
  it('drops the oldest event and logs when the subscriber queue overflows', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    // never auto-drain, so the queue can build past the limit
    const bus = new EventBus({ schedule: () => {} })
    const unsub = bus.subscribe('t', () => {}, { queueLimit: 2 })
    bus.emit('t', 1)
    bus.emit('t', 2)
    bus.emit('t', 3) // overflow → drop event 1
    expect(bus.droppedCount).toBe(1)
    expect(warn).toHaveBeenCalled()
    unsub()
    warn.mockRestore()
  })
})

describe('EventBus — unsubscribe + tap', () => {
  it('unsubscribe stops further delivery', () => {
    const s = manualScheduler()
    const bus = new EventBus({ schedule: s.schedule })
    const seen: number[] = []
    const off = bus.subscribe<number>('t', (n) => seen.push(n))
    bus.emit('t', 1)
    off()
    s.flush()
    expect(seen).toEqual([]) // removed before the drain ran
  })

  it('tap observes every event synchronously', () => {
    const bus = new EventBus({ schedule: () => {} })
    const tapped: string[] = []
    bus.tap((e) => tapped.push(e.topic))
    bus.emit('a', 1)
    bus.emit('b', 2)
    expect(tapped).toEqual(['a', 'b'])
  })

  it('a throwing handler does not stall others', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const s = manualScheduler()
    const bus = new EventBus({ schedule: s.schedule })
    const seen: number[] = []
    bus.subscribe('t', () => {
      throw new Error('boom')
    })
    bus.subscribe<number>('t', (n) => seen.push(n))
    bus.emit('t', 42)
    s.flush()
    expect(seen).toEqual([42])
    err.mockRestore()
  })
})

describe('TypedEventBus — 13 catalog events', () => {
  it('exposes exactly the 13 EVCAT event names', () => {
    expect(EVENT_NAMES).toHaveLength(13)
  })

  it('emit/on are typed and deliver', () => {
    const s = manualScheduler()
    const typed = new TypedEventBus(new EventBus({ schedule: s.schedule }))
    const seen: string[] = []
    typed.on('ThemeChanged', (p) => seen.push(p.themeId))
    typed.emit('ThemeChanged', { themeId: 'cyber-dark', mode: 'dark' })
    s.flush()
    expect(seen).toEqual(['cyber-dark'])
  })
})
