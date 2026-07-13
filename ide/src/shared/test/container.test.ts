// Sample unit test (CD-107): exercises the test-container utility.
import { describe, expect, it } from 'vitest'
import { createTestContainer } from '@/shared/test'

describe('createTestContainer', () => {
  it('resolves what was registered', () => {
    const container = createTestContainer()
    const logger = { log: (msg: string) => msg }
    container.register('logger', logger)

    expect(container.has('logger')).toBe(true)
    expect(container.resolve<typeof logger>('logger')).toBe(logger)
  })

  it('throws on an unregistered token', () => {
    const container = createTestContainer()
    expect(() => container.resolve('missing')).toThrow(
      'nothing registered for token "missing"',
    )
  })
})
