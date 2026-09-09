import { expect, test } from '@playwright/test'
import { expectMinTapSize, expectNoHorizontalOverflow } from './helpers'

test('admin events list is usable on a phone without a persistent sidebar', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/events')
  await expect(page.getByRole('heading', { name: 'Your events' })).toBeVisible()
  await expectNoHorizontalOverflow(page)

  const toggle = page.getByRole('button', { name: 'Show sidebar' })
  await expect(toggle).toBeVisible()
  await expectMinTapSize(toggle)

  await toggle.click()
  await expect(page.getByRole('link', { name: 'Overview' })).toBeVisible()
  await expect(page.locator('aside')).not.toHaveAttribute('inert')
  await page.getByRole('button', { name: 'Hide sidebar' }).click()
  // Collapsing makes the sidebar inert (removed from the tab/interaction
  // order and the a11y tree) rather than unmounting it.
  await expect(page.locator('aside')).toHaveAttribute('inert')
  await expectNoHorizontalOverflow(page)
})
