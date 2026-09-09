import { expect, test } from '@playwright/test'
import { createDraftEvent, deleteCurrentEvent, uniqueEventName } from './helpers'

// Setup screens that used to render standalone (question authoring, results)
// now live inside the admin shell, so the sidebar collapse toggle is
// available while working on them — the user should ALWAYS be able to expand
// or collapse the side panel in the admin layout, not just on the top-level
// list screens. The results screen is the cheapest such screen to reach (it
// needs only an event), and the shell renders regardless of what the page
// itself loads, so this exercises the toggle there.
test('the results screen sits inside the admin shell with a working sidebar toggle', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 })

  const name = uniqueEventName('Shell Scope')
  await createDraftEvent(page, name)
  const eventId = page.url().match(/\/events\/([0-9a-f-]{36})$/)![1]

  await page.goto(`/events/${eventId}/results`)

  const sidebar = page.locator('aside')
  const showToggle = page.getByRole('button', { name: 'Show sidebar' })
  await expect(showToggle).toBeVisible()

  // Expand: the nav becomes visible and the sidebar is operable (not inert).
  await showToggle.click()
  await expect(page.getByRole('link', { name: 'Overview' })).toBeVisible()
  await expect(sidebar).not.toHaveAttribute('inert')

  // Collapse: the toggle flips back and the sidebar is made inert (removed
  // from the tab/interaction order) — proving the panel can be collapsed here.
  await page.getByRole('button', { name: 'Hide sidebar' }).click()
  await expect(page.getByRole('button', { name: 'Show sidebar' })).toBeVisible()
  await expect(sidebar).toHaveAttribute('inert')

  await page.goto('/events')
  await page.getByRole('link', { name: new RegExp(name) }).click()
  await deleteCurrentEvent(page)
})
