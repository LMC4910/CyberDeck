// Canvas perf harness (CD-309). Loads a 200-widget board (?perf=200), then probes
// sustained frame rate while panning + zooming the canvas. The number is RECORDED
// now (logged + attached to the report); the ≥ 55 fps gate is enforced at CD-330.
// Reference: run headed on the reference machine for the authoritative number.
import { test, expect } from '@playwright/test'

const WIDGETS = 200
// M3 gate (CD-330): the 55 fps floor is now ENFORCED in CI (was a soft report at CD-309).
const GATE_FLOOR_FPS = 55

test('canvas sustains frame rate at 200 widgets during pan/zoom', async ({ page }, testInfo) => {
  await page.goto(`/?perf=${WIDGETS}`)
  await expect(page.getByTestId('shell')).toHaveAttribute('data-boot', 'interactive', { timeout: 15_000 })

  // Enter the Deck Designer and confirm the full fixture rendered.
  await page.getByRole('tab', { name: 'Deck Designer' }).click()
  await expect(page.locator('[data-widget]')).toHaveCount(WIDGETS, { timeout: 15_000 })

  // Sample rAF frame deltas while driving pan (wheel) + periodic zoom (ctrl+wheel).
  const sample = await page.evaluate(async () => {
    const surface = document.querySelector('[role="application"]') as HTMLElement
    const rect = surface.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const deltas: number[] = []
    let last = performance.now()
    return await new Promise<{ frames: number; medianMs: number; fps: number }>((resolve) => {
      let n = 0
      const tick = (t: number) => {
        deltas.push(t - last)
        last = t
        surface.dispatchEvent(new WheelEvent('wheel', { deltaX: 9, deltaY: 7, bubbles: true, cancelable: true }))
        if (n % 15 === 0) {
          surface.dispatchEvent(
            new WheelEvent('wheel', { deltaY: n % 30 === 0 ? -40 : 40, ctrlKey: true, clientX: cx, clientY: cy, bubbles: true, cancelable: true }),
          )
        }
        if (++n < 100) {
          requestAnimationFrame(tick)
        } else {
          deltas.shift() // discard the first (warm-up) frame
          const sorted = [...deltas].sort((a, b) => a - b)
          const medianMs = sorted[Math.floor(sorted.length / 2)] || 16.7
          resolve({ frames: deltas.length, medianMs, fps: 1000 / medianMs })
        }
      }
      requestAnimationFrame(tick)
    })
  })

  const fps = Math.round(sample.fps)
  const line = `Canvas perf @ ${WIDGETS} widgets: ~${fps} fps (median frame ${sample.medianMs.toFixed(2)} ms over ${sample.frames} frames)`
  // Record the number for the CI perf job + the CD-330 gate.
  console.log(line)
  await testInfo.attach('canvas-perf', { body: line, contentType: 'text/plain' })

  expect(fps, line).toBeGreaterThanOrEqual(GATE_FLOOR_FPS)
})
