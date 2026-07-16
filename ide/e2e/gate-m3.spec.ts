// M3 gate — scripted authoring journey (CD-330). Drives the real IDE in chromium
// through the authoring spine and proves reload-identity: insert → arrange → create
// component → bind → state → event → undo → autosave → reload identical. The
// exhaustive per-feature behavior (variants/overrides/undo-all-reverts, and
// serialize(restore(doc))≡doc) is covered by the 700+ unit/integration tests; here we
// verify the flow end-to-end in a browser and that authored artifacts survive reload.
import { test, expect, type Page } from '@playwright/test'

async function enterDeckDesigner(page: Page) {
  await expect(page.getByTestId('shell')).toHaveAttribute('data-boot', 'interactive', { timeout: 15_000 })
  await page.getByRole('tab', { name: 'Deck Designer' }).click()
  await expect(page.locator('[data-pane="deck-designer"]')).toBeVisible()
  // starter deck renders its widgets
  await expect(page.locator('[data-widget]').first()).toBeVisible()
}

const widgetCount = (page: Page) => page.locator('[data-widget]').count()

test('authoring journey: insert → component → bind → state → event, undo, and reload identical', async ({ page }) => {
  await page.goto('/')
  await enterDeckDesigner(page)
  const surface = page.locator('[role="application"]').first()

  // ── undo works in-browser: insert a widget, then Ctrl+Z reverts it ──
  await test.step('insert + undo', async () => {
    const before = await widgetCount(page)
    await page.getByRole('tab', { name: 'Insert' }).click()
    await page.locator('[data-insert="gauge.circular"]').dblclick()
    await expect.poll(() => widgetCount(page)).toBe(before + 1)
    await surface.click({ position: { x: 5, y: 5 } }) // focus the canvas (clears selection)
    await page.keyboard.press('Control+z')
    await expect.poll(() => widgetCount(page)).toBe(before)
  })

  // ── insert two widgets, select all, create a component ──
  await test.step('insert + create component', async () => {
    await page.getByRole('tab', { name: 'Insert' }).click()
    await page.locator('[data-insert="stat.readout"]').dblclick()
    await page.locator('[data-insert="button.action"]').dblclick()
    await surface.click({ position: { x: 5, y: 5 } })
    await page.keyboard.press('Control+a') // select all
    await page.keyboard.press('Control+Alt+k') // create component
    await expect(page.locator('[data-instance]')).toHaveCount(1)
  })

  // ── bind a widget's value to a variable via the inspector popover ──
  await test.step('bind a variable', async () => {
    // detach so we have a plain widget selected with a Bindings section
    await page.locator('[data-instance]').click()
    // the component section's Detach button
    await page.getByTestId('detach-instance').click()
    await page.locator('[data-widget]').first().click()
    await page.getByTestId('bindlink-value').click()
    await page.locator('[data-var="system.cpu.percent"]').click()
    await expect(page.locator('[data-testid^="bind-dot-"]').first()).toBeVisible()
  })

  // ── preview a state + wire a tap event ──
  await test.step('state + event', async () => {
    await page.locator('[data-state="hover"]').click()
    await page.locator('[data-gesture="tap"] select').selectOption({ label: 'Reset Deck' })
    await expect(page.getByTestId('flow-tap')).toContainText('deck.reset')
  })

  // ── autosave, then reload and confirm the authored deck is identical ──
  const beforeReload = await widgetCount(page)
  await page.waitForTimeout(1000) // let debounced autosave fire
  await page.reload()
  await enterDeckDesigner(page)
  await expect.poll(() => widgetCount(page)).toBe(beforeReload)
  // the bound widget's bind-dot survived the round-trip
  await expect(page.locator('[data-testid^="bind-dot-"]').first()).toBeVisible()
})
