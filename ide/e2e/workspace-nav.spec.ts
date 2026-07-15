// Workspace navigation E2E (CD-203): the rail switches workspaces and the pane
// host lazy-loads each pane.
import { test, expect } from '@playwright/test'

test('rail navigates between workspaces (lazy panes mount)', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('shell')).toHaveAttribute('data-boot', 'interactive', {
    timeout: 10_000,
  })

  // Home is active by default
  await expect(page.getByRole('main')).toContainText('Home')

  // click Flows in the rail → its pane lazy-loads
  await page.getByRole('tab', { name: 'Flows' }).click()
  await expect(page.getByRole('main')).toContainText('Flows')

  // keyboard: focus the rail and Arrow to another workspace
  await page.getByRole('tab', { name: 'Flows' }).focus()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('main')).toContainText('Variables')
})
