// Command palette E2E (CD-206): ⌘K/Ctrl+K opens the palette, filters, and
// executes a command via the keyboard.
import { test, expect } from '@playwright/test'

test('Ctrl+K opens the palette and a command executes', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('shell')).toHaveAttribute('data-boot', 'interactive', {
    timeout: 10_000,
  })

  await page.keyboard.press('Control+k')
  const dialog = page.getByRole('dialog', { name: 'Command Palette' })
  await expect(dialog).toBeVisible()

  // filter to a workspace-navigation-adjacent command and run it
  await page.getByRole('combobox', { name: 'Command Palette' }).fill('Toggle Left Panel')
  await expect(page.locator('[data-command="togL"]')).toBeVisible()
  await page.keyboard.press('Enter')

  // palette closes after execution
  await expect(dialog).toBeHidden()
})
