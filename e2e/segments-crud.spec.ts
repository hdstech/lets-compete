import { expect, test } from '@playwright/test'
import {
  addRound,
  addSegment,
  createDraftEvent,
  deleteCurrentEvent,
  goToRounds,
  goToSegments,
  uniqueEventName,
} from './helpers'

// Covers the segment half of QB1 (admin question authoring UI) against the
// real Supabase backend: adding a segment, editing it, and deleting it.
// Segments have no lifecycle columns of their own (T8a's total-freeze
// pattern), so unlike rounds there's no advancement config to assert on —
// just name/sequence CRUD, gated to draft events.

test('adding a segment shows it in the list', async ({ page }) => {
  const name = uniqueEventName('Segment Add')
  await createDraftEvent(page, name)
  await goToRounds(page)
  await addRound(page, { name: 'Round 1', advancementN: 8 })
  await goToSegments(page)

  await addSegment(page, { name: 'History' })

  await expect(page.getByRole('heading', { level: 2, name: 'Segment 1: History' })).toBeVisible()

  await page.goto('/events')
  await page.getByRole('link', { name: new RegExp(name) }).click()
  await deleteCurrentEvent(page)
})

test('editing a segment persists across a reload', async ({ page }) => {
  const name = uniqueEventName('Segment Edit')
  await createDraftEvent(page, name)
  await goToRounds(page)
  await addRound(page, { name: 'Round 1', advancementN: 8 })
  await goToSegments(page)

  await addSegment(page, { name: 'History' })

  await page.getByRole('button', { name: 'Edit' }).click()
  await page.getByLabel('Segment name').fill('Science')
  await page.getByRole('button', { name: 'Save segment' }).click()

  await expect(page.getByRole('heading', { level: 2, name: 'Segment 1: Science' })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { level: 2, name: 'Segment 1: Science' })).toBeVisible()

  await page.goto('/events')
  await page.getByRole('link', { name: new RegExp(name) }).click()
  await deleteCurrentEvent(page)
})

test('deleting a segment removes it from the list', async ({ page }) => {
  const name = uniqueEventName('Segment Delete')
  await createDraftEvent(page, name)
  await goToRounds(page)
  await addRound(page, { name: 'Round 1', advancementN: 8 })
  await goToSegments(page)

  await addSegment(page, { name: 'History' })
  await expect(page.getByRole('heading', { level: 2, name: 'Segment 1: History' })).toBeVisible()

  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByText('No segments yet.')).toBeVisible()

  await page.goto('/events')
  await page.getByRole('link', { name: new RegExp(name) }).click()
  await deleteCurrentEvent(page)
})
