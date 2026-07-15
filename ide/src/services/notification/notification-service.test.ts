import { describe, expect, it, vi } from 'vitest'
import { NotificationService } from '@/services/notification'

function svc(now: () => number, over = {}) {
  const emitted: string[] = []
  const service = new NotificationService({ now, onNotify: (n) => emitted.push(n.id), ...over })
  return { service, emitted }
}

describe('NotificationService — dedupe', () => {
  it('collapses repeated dedupeKeys within the window', () => {
    let t = 0
    const { service } = svc(() => t)
    expect(service.notify({ level: 'info', source: 's', title: 'A', dedupeKey: 'k' })).not.toBeNull()
    t = 500
    expect(service.notify({ level: 'info', source: 's', title: 'A', dedupeKey: 'k' })).toBeNull() // deduped
    t = 3000
    expect(service.notify({ level: 'info', source: 's', title: 'A', dedupeKey: 'k' })).not.toBeNull() // window passed
  })
})

describe('NotificationService — rate limit', () => {
  it('drops beyond max per window', () => {
    let t = 0
    const { service } = svc(() => t, { rateLimit: { max: 2, windowMs: 1000 } })
    expect(service.notify({ level: 'info', source: 's', title: '1' })).not.toBeNull()
    expect(service.notify({ level: 'info', source: 's', title: '2' })).not.toBeNull()
    expect(service.notify({ level: 'info', source: 's', title: '3' })).toBeNull() // rate limited
    t = 1500 // window slides
    expect(service.notify({ level: 'info', source: 's', title: '4' })).not.toBeNull()
  })
})

describe('NotificationService — toast policy (AUDIT M4)', () => {
  it('errors/warnings and actionable notifications toast; ambient success does not', () => {
    const { service } = svc(() => 0)
    expect(service.notify({ level: 'error', source: 's', title: 'boom' })?.toast).toBe(true)
    expect(service.notify({ level: 'warn', source: 's', title: 'hmm' })?.toast).toBe(true)
    expect(service.notify({ level: 'success', source: 's', title: 'saved' })?.toast).toBe(false) // no noise
    expect(
      service.notify({ level: 'success', source: 's', title: 'done', actions: [{ id: 'undo', label: 'Undo' }] })
        ?.toast,
    ).toBe(true) // actionable success does toast
    expect(service.notify({ level: 'info', source: 's', title: 'fyi', toast: true })?.toast).toBe(true) // explicit
  })
})

describe('NotificationService — emit', () => {
  it('emits each accepted notification via onNotify with actions preserved', () => {
    const onNotify = vi.fn()
    const service = new NotificationService({ now: () => 0, onNotify })
    const n = service.notify({
      level: 'info',
      source: 'undo',
      title: 'Moved widget',
      actions: [{ id: 'undo', label: 'Undo' }],
    })
    expect(onNotify).toHaveBeenCalledWith(n)
    expect(n?.actions).toEqual([{ id: 'undo', label: 'Undo' }])
    expect(n?.read).toBe(false)
  })
})
