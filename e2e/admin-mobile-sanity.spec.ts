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
  await page.getByRole('button', { name: 'Hide sidebar' }).click()
  await expect(page.getByRole('link', { name: 'Overview' })).toHaveCount(0)
  await expectNoHorizontalOverflow(page)
})
