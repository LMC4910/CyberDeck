// ServiceContainer (CD-119). Services are resolved by interface through a token,
// never imported directly (01_Architecture_Baseline.md §3). Registration is
// lazy by default — `get` returns a Proxy that constructs the real service on
// first use (boot stage 6 "services registered as lazy proxies"), which also
// lets two services depend on each other without an eager cycle. A genuine
// construction cycle throws a ServiceCycleError printing the path.

export interface Token<T> {
  readonly id: string
  /** phantom — carries the service type for `get` inference; never read. */
  readonly __type?: T
}

/** Create a typed service token. */
export function token<T>(id: string): Token<T> {
  return { id }
}

export type ServiceFactory<T> = (container: ServiceContainer) => T

export interface RegisterOptions {
  /** Lazy (default): construct on first use. Eager: construct on register-resolve. */
  lazy?: boolean
}

export class ServiceCycleError extends Error {
  readonly cycle: string[]
  constructor(cycle: string[]) {
    super(`service dependency cycle: ${cycle.join(' → ')}`)
    this.name = 'ServiceCycleError'
    this.cycle = cycle
  }
}

export class ServiceNotFoundError extends Error {
  constructor(id: string) {
    super(`no service registered for token "${id}"`)
    this.name = 'ServiceNotFoundError'
  }
}

interface Registration {
  factory: ServiceFactory<unknown>
  lazy: boolean
}

export class ServiceContainer {
  private readonly registrations = new Map<string, Registration>()
  private readonly instances = new Map<string, unknown>()
  private readonly resolving = new Set<string>()
  private readonly resolveStack: string[] = []

  register<T>(tk: Token<T>, factory: ServiceFactory<T>, options: RegisterOptions = {}): void {
    this.registrations.set(tk.id, { factory, lazy: options.lazy ?? true })
  }

  has<T>(tk: Token<T>): boolean {
    return this.registrations.has(tk.id) || this.instances.has(tk.id)
  }

  /** Replace a service with a ready instance (tests / boot overrides). */
  override<T>(tk: Token<T>, instance: T): void {
    this.instances.set(tk.id, instance)
    // A pre-built instance is registered so `has` is true and no factory runs.
    if (!this.registrations.has(tk.id)) {
      this.registrations.set(tk.id, { factory: () => instance, lazy: false })
    }
  }

  get<T>(tk: Token<T>): T {
    if (this.instances.has(tk.id)) return this.instances.get(tk.id) as T
    const reg = this.registrations.get(tk.id)
    if (!reg) throw new ServiceNotFoundError(tk.id)
    if (reg.lazy) return this.lazyProxy(tk)
    return this.resolve(tk)
  }

  private resolve<T>(tk: Token<T>): T {
    if (this.instances.has(tk.id)) return this.instances.get(tk.id) as T
    if (this.resolving.has(tk.id)) {
      throw new ServiceCycleError([...this.resolveStack, tk.id])
    }
    const reg = this.registrations.get(tk.id)
    if (!reg) throw new ServiceNotFoundError(tk.id)

    this.resolving.add(tk.id)
    this.resolveStack.push(tk.id)
    try {
      const instance = reg.factory(this)
      this.instances.set(tk.id, instance)
      return instance as T
    } finally {
      this.resolving.delete(tk.id)
      this.resolveStack.pop()
    }
  }

  // A lazy proxy forwards every operation to the real instance, constructing it
  // (via resolve, so cycles are still detected) on first touch.
  private lazyProxy<T>(tk: Token<T>): T {
    let real: object | undefined
    const force = (): object => {
      real ??= this.resolve(tk) as object
      return real
    }
    return new Proxy({} as object, {
      get: (_t, prop, receiver) => Reflect.get(force(), prop, receiver),
      set: (_t, prop, value, receiver) => Reflect.set(force(), prop, value, receiver),
      has: (_t, prop) => Reflect.has(force(), prop),
      ownKeys: () => Reflect.ownKeys(force()),
      getOwnPropertyDescriptor: (_t, prop) => {
        const d = Reflect.getOwnPropertyDescriptor(force(), prop)
        if (d) d.configurable = true // proxy invariant for non-configurable targets
        return d
      },
      getPrototypeOf: () => Reflect.getPrototypeOf(force()),
    }) as T
  }
}

/**
 * A ServiceContainer for tests. Registers everything **eager** by default so
 * construction errors and cycles surface synchronously in the test, and
 * `override` is the ergonomic way to inject fakes.
 */
export function createTestContainer(): ServiceContainer {
  const container = new ServiceContainer()
  const original = container.register.bind(container)
  container.register = <T>(tk: Token<T>, factory: ServiceFactory<T>, options: RegisterOptions = {}) =>
    original(tk, factory, { lazy: options.lazy ?? false })
  return container
}
