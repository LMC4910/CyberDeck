// Test-container skeleton (CD-107). A minimal token→instance registry that
// mirrors the resolve-by-interface shape the real ServiceContainer (CD-119)
// will have; tests written against it migrate to the real container by
// swapping this factory, not the tests.

export interface TestContainer {
  register<T>(token: string, instance: T): void
  resolve<T>(token: string): T
  has(token: string): boolean
}

export function createTestContainer(): TestContainer {
  const registry = new Map<string, unknown>()
  return {
    register(token, instance) {
      registry.set(token, instance)
    },
    resolve<T>(token: string): T {
      if (!registry.has(token)) {
        throw new Error(`TestContainer: nothing registered for token "${token}"`)
      }
      return registry.get(token) as T
    },
    has(token) {
      return registry.has(token)
    },
  }
}
