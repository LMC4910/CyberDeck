// M2 gate journeys (CD-219): keyboard-only walkthrough of the full chrome + a
// warm workspace-switch timing (< 100 ms).
import { test, expect } from '@playwright/test'

test('keyboard-only walkthrough of the chrome', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('shell')).toHaveAttribute('data-boot', 'interactive', { timeout: 10_000 })

  // Rail: focus the active tab, arrow to the next workspace, activate with Enter
  await page.getByRole('tab', { name: 'Home' }).focus()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('main')).toContainText('Deck Designer')

  // Palette: ⌘K, type, Enter — all keyboard
  await page.keyboard.press('Control+k')
  await expect(page.getByRole('dialog', { name: 'Command Palette' })).toBeVisible()
  await page.keyboard.type('Flows')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Command Palette' })).toBeHidden()

  // Preferences: ⌘, opens, Escape closes
  await page.keyboard.press('Control+,')
  await expect(page.getByRole('dialog', { name: 'Preferences' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Preferences' })).toBeHidden()

  // Panels: ⌘B toggles the left panel
  await page.keyboard.press('Control+b')
  await expect(page.locator('[data-panel-reopen="left"]')).toBeVisible()
  await page.keyboard.press('Control+b')
  await expect(page.locator('[data-panel="left"]')).toBeVisible()
})

test('warm workspace switch is < 100 ms', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('shell')).toHaveAttribute('data-boot', 'interactive', { timeout: 10_000 })

  // warm both panes (load their chunks once)
  await page.getByRole('tab', { name: 'Flows' }).click()
  await expect(page.getByRole('main')).toContainText('Flows')
  await page.getByRole('tab', { name: 'Home' }).click()
  await expect(page.getByRole('main')).toContainText('Home')

  // measure a warm re-switch (chunk already loaded)
  const ms = await page.evaluate(async () => {
    const t0 = performance.now()
    const tab = [...document.querySelectorAll('[role="tab"]')].find((t) => t.textContent?.includes('Flows'))
    ;(tab as HTMLElement).click()
    // wait a frame for React to commit
    await new Promise((r) => requestAnimationFrame(() => r(null)))
    return performance.now() - t0
  })
  expect(ms).toBeLessThan(100)
})
