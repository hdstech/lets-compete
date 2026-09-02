import { expect, test } from '@playwright/test'
import { createDraftEvent, deleteCurrentEvent, uniqueEventName } from './helpers'

// Covers T20 (admin event CRUD + lifecycle controls) against the real
// Supabase backend: create/list/view, edit persistence, the activate_event
// RPC's error path (a fresh event has no round 1 configured yet — see
// rounds-crud.spec.ts for the T21a round builder that unblocks this), and
// delete. Deliberately skips visual-only assertions (badge colors,
// copy-to-clipboard) — see the T20 PR for what was checked manually instead.

test('creating an event lists it and shows its details', async ({ page }) => {
  const name = uniqueEventName('Create List')
  await createDraftEvent(page, name)

  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
  await expect(page.getByText('draft', { exact: true })).toBeVisible()
  await expect(page.getByText('quiz', { exact: true })).toBeVisible()

  await page.goto('/events')
  const card = page.getByRole('link', { name: new RegExp(name) })
  await expect(card).toBeVisible()
  await expect(card).toContainText('draft')
  await expect(card).toContainText('quiz')

  await card.click()
  await deleteCurrentEvent(page)
})

test('editing an event persists across a reload', async ({ page }) => {
  const name = uniqueEventName('Edit Persist')
  const renamed = `${name} renamed`
  await createDraftEvent(page, name)

  await page.getByLabel('Event name').fill(renamed)
  await page.getByLabel('Event date').fill('2026-12-01')
  await page.getByLabel('This event has elimination rounds').check()
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Saved.')).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: renamed })).toBeVisible()
  await expect(page.getByLabel('Event date')).toHaveValue('2026-12-01')
  await expect(page.getByLabel('This event has elimination rounds')).toBeChecked()

  await deleteCurrentEvent(page)
})

test('activating a fresh event surfaces the backend "no round configured" error', async ({
  page,
}) => {
  const name = uniqueEventName('Activate Error')
  await createDraftEvent(page, name)

  await page.getByRole('button', { name: 'Activate event' }).click()
  await expect(page.getByRole('alert')).toContainText('no round 1 configured')
  // The failed RPC must not have flipped the event's status.
  await expect(page.getByText('draft', { exact: true })).toBeVisible()

  await deleteCurrentEvent(page)
})

test('deleting a draft event removes it from the list', async ({ page }) => {
  const name = uniqueEventName('Delete Removes')
  await createDraftEvent(page, name)

  await deleteCurrentEvent(page)

  await expect(page).toHaveURL(/\/events$/)
  await expect(page.getByRole('link', { name: new RegExp(name) })).toHaveCount(0)
})
