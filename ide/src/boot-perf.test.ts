// M1 gate (CD-139): warm-boot performance measured via real boot marks.
import { describe, expect, it } from 'vitest'
import { runAppBoot } from '@/boot-sequence'

describe('M1 gate — warm boot ≤ 150 ms (real marks)', () => {
  it('boots to interactive well under the 150 ms budget', async () => {
    await runAppBoot() // warm the module graph
    const { report } = await runAppBoot()
    // record the measured number for the gate log
    console.log(`[M1 gate] warm boot interactive @ ${report.interactiveAtMs.toFixed(2)} ms`)
    expect(report.ok).toBe(true)
    expect(report.interactiveAtMs).toBeLessThanOrEqual(150)
  })
})
