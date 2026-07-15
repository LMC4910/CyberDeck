// Session restore E2E (CD-212): switch workspace, reload (relaunch), and the
// last workspace is restored from the persisted session blob.
import { test, expect } from '@playwright/test'

test('quit/relaunch restores the last workspace', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('shell')).toHaveAttribute('data-boot', 'interactive', {
    timeout: 10_000,
  })

  // switch to Flows and let the debounced session write settle
  await page.getByRole('tab', { name: 'Flows' }).click()
  await expect(page.getByRole('main')).toContainText('Flows')
  await page.waitForTimeout(600) // > debounce window

  // "relaunch": reload the page (localStorage persists)
  await page.reload()
  await expect(page.getByTestId('shell')).toHaveAttribute('data-boot', 'interactive', {
    timeout: 10_000,
  })

  // Flows is restored as the active workspace
  await expect(page.getByRole('main')).toContainText('Flows')
  await expect(page.getByRole('tab', { name: 'Flows' })).toHaveAttribute('aria-selected', 'true')
})

test('corrupt session falls back to defaults (no crash)', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('shell')).toHaveAttribute('data-boot', 'interactive', {
    timeout: 10_000,
  })
  // corrupt the stored session, then relaunch
  await page.evaluate(() => localStorage.setItem('cdk-session', 'GARBAGE'))
  await page.reload()
  // boots fine to the default workspace (Home)
  await expect(page.getByTestId('shell')).toHaveAttribute('data-boot', 'interactive', {
    timeout: 10_000,
  })
  await expect(page.getByRole('main')).toContainText('Home')
})
