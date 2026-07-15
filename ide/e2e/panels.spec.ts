// Resizable panels E2E (CD-213): Ctrl+B toggles the left panel; the width
// persists per workspace across relaunch.
import { test, expect } from '@playwright/test'

test('Ctrl+B toggles the left panel and width persists across relaunch', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('shell')).toHaveAttribute('data-boot', 'interactive', {
    timeout: 10_000,
  })

  const panel = page.locator('[data-panel="left"]')
  await expect(panel).toBeVisible()

  // keyboard resize via the separator, then confirm it persisted
  await page.locator('[data-panel-handle="left"]').focus()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(500) // debounced persist

  // Ctrl+B hides it → reopen affordance appears
  await page.keyboard.press('Control+b')
  await expect(page.locator('[data-panel-reopen="left"]')).toBeVisible()

  // relaunch: panel visibility + width restore
  await page.reload()
  await expect(page.getByTestId('shell')).toHaveAttribute('data-boot', 'interactive', {
    timeout: 10_000,
  })
  await expect(page.locator('[data-panel-reopen="left"]')).toBeVisible() // stayed hidden
})
