// Honest-stub / chrome audit E2E (CD-218): the notification bell opens the drawer,
// mark-all-read works, and every workspace pane shows an honest "arrives in a
// later milestone" placeholder (no blank/silent panes).
import { test, expect } from '@playwright/test'

test('notification bell opens the drawer and mark-all-read works', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('shell')).toHaveAttribute('data-boot', 'interactive', { timeout: 10_000 })

  // welcome notification → unread badge on the bell
  const bell = page.getByTestId('notifications-bell')
  await expect(bell).toContainText('1')

  await bell.click()
  const drawer = page.getByRole('dialog', { name: 'Notifications' })
  await expect(drawer).toBeVisible()
  await expect(drawer).toContainText('Welcome to CyberDeck')

  await page.locator('[data-ntf-mark-all]').click()
  await expect(page.locator('[data-ntf-mark-all]')).toBeDisabled() // nothing unread
})

test('every workspace pane shows an honest placeholder', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('shell')).toHaveAttribute('data-boot', 'interactive', { timeout: 10_000 })

  // Deck Designer is a real workspace as of M3 — it mounts the authoring canvas.
  await page.getByRole('tab', { name: 'Deck Designer' }).click()
  await expect(page.locator('[data-pane="deck-designer"]')).toBeVisible()
  await expect(page.locator('[data-widget]').first()).toBeVisible()

  // The remaining panes still show an honest "arrives later" placeholder — never blank.
  for (const ws of ['Flows', 'Variables', 'Library', 'Devices', 'Projects', 'Home']) {
    await page.getByRole('tab', { name: ws }).click()
    await expect(page.getByRole('main')).toContainText(ws)
    await expect(page.getByRole('main')).toContainText(/arrives in|workspace/i)
  }
})
