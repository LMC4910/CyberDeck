import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runBoot, BootConfigError, type BootPhase } from '@/platform/boot'

// Deterministic clock: each call advances by 1ms.
function fakeClock() {
  let t = 0
  return () => ++t
}

function phase(id: string, over: Partial<BootPhase> = {}): BootPhase {
  return { id, blocking: true, run: () => {}, ...over }
}

describe('runBoot — ordering', () => {
  it('runs phases in config-declared order, not array order', async () => {
    const seen: string[] = []
    const phases = [
      phase('c', { run: () => void seen.push('c') }),
      phase('a', { run: () => void seen.push('a') }),
      phase('b', { run: () => void seen.push('b') }),
    ]
    await runBoot(phases, { order: ['a', 'b', 'c'], now: fakeClock() })
    expect(seen).toEqual(['a', 'b', 'c'])
  })

  it('runs all blocking phases before any non-blocking phase (barrier)', async () => {
    const seen: string[] = []
    const phases = [
      phase('late', { blocking: false, run: () => void seen.push('late') }),
      phase('early', { blocking: true, run: () => void seen.push('early') }),
    ]
    const report = await runBoot(phases, { now: fakeClock() })
    expect(seen).toEqual(['early', 'late'])
    // interactive is marked at the end of the blocking group, before non-blocking runs
    expect(report.interactiveAtMs).toBeLessThan(report.totalMs)
  })
})

describe('runBoot — failure policies', () => {
  it('fatal (default) aborts boot and skips remaining phases', async () => {
    const seen: string[] = []
    const phases = [
      phase('boom', { run: () => { throw new Error('kaboom') } }),
      phase('after', { run: () => void seen.push('after') }),
    ]
    const report = await runBoot(phases, { order: ['boom', 'after'], now: fakeClock() })
    expect(report.ok).toBe(false)
    expect(seen).toEqual([]) // 'after' never ran
    expect(report.stages.find((s) => s.id === 'boom')?.status).toBe('failed')
    expect(report.stages.find((s) => s.id === 'after')?.status).toBe('skipped')
  })

  it('skip marks the phase skipped and continues', async () => {
    const seen: string[] = []
    const phases = [
      phase('flaky', { failurePolicy: 'skip', run: () => { throw new Error('meh') } }),
      phase('after', { run: () => void seen.push('after') }),
    ]
    const report = await runBoot(phases, { order: ['flaky', 'after'], now: fakeClock() })
    expect(report.ok).toBe(true)
    expect(seen).toEqual(['after'])
    expect(report.stages.find((s) => s.id === 'flaky')?.status).toBe('skipped')
  })

  it('retry-once retries a failing phase and succeeds on the second attempt', async () => {
    let calls = 0
    const phases = [
      phase('retry', {
        failurePolicy: 'retry-once',
        run: () => {
          calls++
          if (calls === 1) throw new Error('first fails')
        },
      }),
    ]
    const report = await runBoot(phases, { now: fakeClock() })
    expect(calls).toBe(2)
    expect(report.ok).toBe(true)
    expect(report.stages[0]?.status).toBe('ok')
    expect(report.stages[0]?.attempts).toBe(2)
  })

  it('retry-once that keeps failing escalates to fatal (aborts)', async () => {
    const seen: string[] = []
    const phases = [
      phase('retry', {
        failurePolicy: 'retry-once',
        run: () => { throw new Error('always') },
      }),
      phase('after', { run: () => void seen.push('after') }),
    ]
    const report = await runBoot(phases, { order: ['retry', 'after'], now: fakeClock() })
    expect(report.ok).toBe(false)
    expect(seen).toEqual([])
    expect(report.stages.find((s) => s.id === 'retry')?.attempts).toBe(2)
  })

  it('calls onError before applying the policy', async () => {
    const onError = vi.fn()
    await runBoot([phase('x', { failurePolicy: 'skip', run: () => { throw new Error('e') }, onError })], {
      now: fakeClock(),
    })
    expect(onError).toHaveBeenCalledOnce()
  })
})

describe('runBoot — manifest validation', () => {
  it('unknown stage in the order is a readable BootConfigError', async () => {
    const promise = runBoot([phase('a')], { order: ['a', 'ghost'] })
    await expect(promise).rejects.toBeInstanceOf(BootConfigError)
    await expect(promise).rejects.toThrow(/stage "ghost" but no phase is registered/)
  })

  it('a phase missing from the order is a readable BootConfigError', async () => {
    const promise = runBoot([phase('a'), phase('b')], { order: ['a'] })
    await expect(promise).rejects.toThrow(/not declared in the boot manifest: b/)
  })
})

describe('runBoot — instrumentation', () => {
  beforeEach(() => performance.clearMarks?.())
  afterEach(() => performance.clearMarks?.())

  it('emits a performance mark per stage (visible to the Performance panel)', async () => {
    await runBoot([phase('theme'), phase('cmd')], { order: ['theme', 'cmd'], now: fakeClock() })
    const names = performance.getEntriesByType('mark').map((m) => m.name)
    expect(names).toContain('cyberdeck:boot:theme:start')
    expect(names).toContain('cyberdeck:boot:theme:end')
    expect(names).toContain('cyberdeck:boot:cmd:start')
  })

  it('emits the timing report to onComplete', async () => {
    const onComplete = vi.fn()
    await runBoot([phase('a')], { now: fakeClock(), onComplete })
    expect(onComplete).toHaveBeenCalledOnce()
    const report = onComplete.mock.calls[0]![0]
    expect(report.stages).toHaveLength(1)
    expect(report.ok).toBe(true)
  })
})
