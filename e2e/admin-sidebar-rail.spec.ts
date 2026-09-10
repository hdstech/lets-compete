import { expect, test } from '@playwright/test'

// On a desktop viewport the sidebar never leaves the screen: its own collapse
// control shrinks it to an icon rail, so the nav is still one click away
// instead of being hidden behind a header button in the content area.
test('the desktop sidebar collapses to an icon rail from a control on the panel', async ({
  page,
}) => {
  await page.goto('/dashboard')

  const sidebar = page.locator('aside')
  const overview = sidebar.getByRole('link', { name: 'Overview' })
  // The text half of the nav row; the icon beside it is an <svg>.
  const overviewLabel = overview.locator('span')
  await expect(overviewLabel).toBeVisible()

  // The phone-only header toggle stays out of the way at this width.
  await expect(page.getByRole('button', { name: 'Hide sidebar' })).toBeHidden()

  const expandedWidth = (await sidebar.boundingBox())!.width
  await sidebar.getByRole('button', { name: 'Collapse sidebar' }).click()

  // Collapsed still means visible and operable — a narrower panel whose rows
  // have dropped their text labels down to icons. The width is polled because
  // the panel animates to its rail size.
  await expect(sidebar).not.toHaveAttribute('inert')
  await expect(overview).toBeVisible()
  await expect(overviewLabel).toBeHidden()
  await expect
    .poll(async () => (await sidebar.boundingBox())!.width)
    .toBeLessThan(expandedWidth)

  // The rail's nav icons still navigate.
  await sidebar.getByRole('link', { name: 'Events' }).click()
  await page.waitForURL('**/events')
  await expect(page.getByRole('heading', { name: 'Your events' })).toBeVisible()

  // And the same control on the panel puts the labels back.
  await sidebar.getByRole('button', { name: 'Expand sidebar' }).click()
  await expect(overviewLabel).toBeVisible()
})
