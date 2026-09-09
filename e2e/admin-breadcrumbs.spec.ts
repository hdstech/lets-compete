import { expect, test } from '@playwright/test'
import {
  addRound,
  createDraftEvent,
  deleteCurrentEvent,
  goToRounds,
  uniqueEventName,
} from './helpers'

// The content header now shows a section-icon root plus a breadcrumb trail of
// where the current screen sits, so an organizer can jump back several levels
// in one click instead of stepping back one screen at a time. Navigating away
// while a form holds unsaved data prompts first.

test('the breadcrumb trail links back to earlier screens in one hop', async ({ page }) => {
  const name = uniqueEventName('Breadcrumb Trail')
  await createDraftEvent(page, name)
  const eventId = page.url().match(/\/events\/([0-9a-f-]{36})$/)![1]
  await goToRounds(page)

  const nav = page.getByRole('navigation', { name: 'Breadcrumb' })
  // The trail carries a link back to the event and marks the current screen.
  await expect(nav.getByRole('link', { name })).toBeVisible()
  await expect(nav.getByText('Rounds', { exact: true })).toBeVisible()

  await page
    .locator('header')
    .first()
    .screenshot({ path: 'test-results/breadcrumb-header.png' })

  // Jump straight back to the event detail via the event-name crumb.
  await nav.getByRole('link', { name }).click()
  await expect(page).toHaveURL(new RegExp(`/events/${eventId}$`))

  // The section icon returns to the events list.
  await nav.getByRole('link', { name: 'Events' }).click()
  await expect(page).toHaveURL(/\/events$/)

  await page.getByRole('link', { name: new RegExp(name) }).click()
  await deleteCurrentEvent(page)
})

test('breadcrumb navigation warns before discarding unsaved form data', async ({ page }) => {
  const name = uniqueEventName('Breadcrumb Guard')
  await createDraftEvent(page, name)
  const eventId = page.url().match(/\/events\/([0-9a-f-]{36})$/)![1]
  await goToRounds(page)

  // Type into the add-round form without saving it.
  await page.getByLabel('Round name').fill('Unsaved round')

  const nav = page.getByRole('navigation', { name: 'Breadcrumb' })
  await nav.getByRole('link', { name }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: 'Unsaved changes' })).toBeVisible()

  // Cancelling keeps us on the rounds screen with the typed value intact.
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(page).toHaveURL(new RegExp(`/events/${eventId}/rounds$`))
  await expect(page.getByLabel('Round name')).toHaveValue('Unsaved round')

  // Confirming discards the unsaved value and navigates.
  await nav.getByRole('link', { name }).click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Leave and lose changes' })
    .click()
  await expect(page).toHaveURL(new RegExp(`/events/${eventId}$`))

  await deleteCurrentEvent(page)
})

// Guard against a regression of the original bug: a saved round should not
// leave the form "dirty" and trip the unsaved-changes prompt.
test('a clean rounds screen navigates via breadcrumb without a prompt', async ({ page }) => {
  const name = uniqueEventName('Breadcrumb Clean')
  await createDraftEvent(page, name)
  await goToRounds(page)
  await addRound(page, { name: 'Round 1', advancementN: 8 })

  const nav = page.getByRole('navigation', { name: 'Breadcrumb' })
  await nav.getByRole('link', { name }).click()

  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Delete event' })).toBeVisible()

  await deleteCurrentEvent(page)
})
