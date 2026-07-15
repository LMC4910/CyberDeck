// Dock UI E2E (CD-215): the Live Mirror tool window walks
// pin → auto-hide → peek → re-pin → float → relaunch-restore.
import { test, expect } from '@playwright/test'

test('dock lifecycle: auto-hide → peek → re-pin → float → relaunch restores', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('shell')).toHaveAttribute('data-boot', 'interactive', { timeout: 10_000 })

  // starts as a pinned rail
  await expect(page.locator('[data-dock-rail="mirror"]')).toBeVisible()

  // auto-hide (unpin) → edge tab
  await page.locator('[data-dock-unpin="mirror"]').click()
  await expect(page.locator('[data-dock-tab="mirror"]')).toBeVisible()
  await expect(page.locator('[data-dock-rail="mirror"]')).toHaveCount(0)

  // peek → body shows
  await page.locator('[data-dock-peek="mirror"]').click()
  await expect(page.locator('[data-dock-peekbody="mirror"]')).toBeVisible()

  // re-pin → rail again
  await page.locator('[data-dock-pin="mirror"]').click()
  await expect(page.locator('[data-dock-rail="mirror"]')).toBeVisible()

  // float
  await page.locator('[data-dock-float="mirror"]').click()
  await expect(page.locator('[data-dock-float="mirror"]')).toBeVisible()
  await page.waitForTimeout(500) // debounced persist

  // relaunch: floating state restores
  await page.reload()
  await expect(page.getByTestId('shell')).toHaveAttribute('data-boot', 'interactive', { timeout: 10_000 })
  await expect(page.locator('[data-dock-float="mirror"]')).toBeVisible()
})
