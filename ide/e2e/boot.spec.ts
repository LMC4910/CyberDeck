// Boot journey E2E (CD-136): the app boots headless, reaches the interactive
// marker, and renders the shell chrome.
import { test, expect } from '@playwright/test'

test('app boots to interactive and renders the shell', async ({ page }) => {
  await page.goto('/')

  const shell = page.getByTestId('shell')
  await expect(shell).toBeVisible()

  // boot completes → data-boot flips to interactive
  await expect(shell).toHaveAttribute('data-boot', 'interactive', { timeout: 10_000 })

  // shell chrome regions render
  await expect(page.getByRole('banner')).toContainText('CyberDeck IDE')
  await expect(page.getByRole('navigation', { name: 'Workspaces' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toBeVisible()

  // the workspace rail shows all 7 workspaces and the Home pane is mounted
  await expect(page.getByRole('tab')).toHaveCount(7)
  await expect(page.getByRole('main')).toContainText('Home')

  // the interactive perf mark was recorded
  const hasMark = await page.evaluate(
    () => performance.getEntriesByName('cyberdeck:boot:interactive').length > 0,
  )
  expect(hasMark).toBe(true)
})
