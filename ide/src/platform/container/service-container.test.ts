import { describe, expect, it, vi } from 'vitest'
import {
  ServiceContainer,
  createTestContainer,
  token,
  ServiceCycleError,
  ServiceNotFoundError,
} from '@/platform/container'

interface Logger {
  log: (m: string) => string
}
const Logger = token<Logger>('logger')

describe('ServiceContainer — laziness', () => {
  it('lazy (default): factory runs on first property access, not on get', () => {
    const c = new ServiceContainer()
    const factory = vi.fn(() => ({ log: (m: string) => m }))
    c.register(Logger, factory)

    const proxy = c.get(Logger)
    expect(factory).not.toHaveBeenCalled() // registered lazy → not built yet
    expect(proxy.log('hi')).toBe('hi') // first touch constructs it
    expect(factory).toHaveBeenCalledOnce()
  })

  it('eager: factory runs at get time', () => {
    const c = new ServiceContainer()
    const factory = vi.fn(() => ({ log: (m: string) => m }))
    c.register(Logger, factory, { lazy: false })
    c.get(Logger)
    expect(factory).toHaveBeenCalledOnce()
  })
})

describe('ServiceContainer — singleton', () => {
  it('constructs once across multiple gets/accesses', () => {
    const c = new ServiceContainer()
    const factory = vi.fn(() => ({ log: (m: string) => m }))
    c.register(Logger, factory)
    c.get(Logger).log('a')
    c.get(Logger).log('b')
    expect(factory).toHaveBeenCalledOnce()
  })
})

describe('ServiceContainer — override + missing', () => {
  it('override replaces the service with a ready instance', () => {
    const c = new ServiceContainer()
    c.register(Logger, () => ({ log: (m: string) => `real:${m}` }))
    c.override(Logger, { log: (m) => `fake:${m}` })
    expect(c.get(Logger).log('x')).toBe('fake:x')
  })

  it('get on an unregistered token throws ServiceNotFoundError', () => {
    const c = new ServiceContainer()
    expect(() => c.get(token('missing'))).toThrow(ServiceNotFoundError)
  })
})

describe('ServiceContainer — cycle detection', () => {
  it('eager mutual dependency throws ServiceCycleError with the path', () => {
    interface A { a: () => void }
    interface B { b: () => void }
    const A = token<A>('A')
    const B = token<B>('B')
    const c = new ServiceContainer()
    // Both resolve the other DURING construction (eager) → genuine cycle.
    c.register(
      A,
      (ct) => {
        const b = ct.get(B)
        return { a: () => b.b() }
      },
      { lazy: false },
    )
    c.register(
      B,
      (ct) => {
        const a = ct.get(A) // forces A while A is resolving
        return { b: () => a.a() }
      },
      { lazy: false },
    )
    let err: unknown
    try {
      c.get(A)
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(ServiceCycleError)
    expect((err as ServiceCycleError).cycle).toEqual(['A', 'B', 'A'])
  })

  it('lazy registration breaks the cycle (services can co-depend)', () => {
    interface A { ping: () => string }
    interface B { pong: () => string }
    const A = token<A>('A')
    const B = token<B>('B')
    const c = new ServiceContainer()
    // each stashes the other's proxy but does not touch it during construction
    c.register(A, (ct) => {
      const b = ct.get(B)
      return { ping: () => 'ping+' + b.pong() }
    })
    c.register(B, () => ({ pong: () => 'pong' }))
    expect(c.get(A).ping()).toBe('ping+pong')
  })
})

describe('createTestContainer', () => {
  it('get is eager (no proxy) and override injects fakes (real test uses it)', () => {
    const c = createTestContainer()
    const factory = vi.fn(() => ({ log: (m: string) => m }))
    c.register(Logger, factory)
    expect(factory).not.toHaveBeenCalled() // register stores; does not construct
    c.get(Logger) // eager → constructs on get, without a property access
    expect(factory).toHaveBeenCalledOnce()
    c.override(Logger, { log: () => 'stub' })
    expect(c.get(Logger).log('x')).toBe('stub')
  })
})
