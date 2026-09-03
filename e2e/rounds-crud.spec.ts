import { expect, test } from '@playwright/test'
import { addRound, createDraftEvent, deleteCurrentEvent, goToRounds, uniqueEventName } from './helpers'

// Covers T21a (admin round builder + advancement config) against the real
// Supabase backend: adding a round, the single-final-round guard, editing a
// round's config, and deleting a round. Deliberately skips visual-only
// assertions, and skips exercising activate_event's success path — once
// activated an event has no delete affordance in the UI (draft-only), which
// would leave an un-cleanable row in the shared test project.

test('adding a round shows it in the list with its advancement config', async ({ page }) => {
  const name = uniqueEventName('Round Add')
  await createDraftEvent(page, name)
  await goToRounds(page)

  await addRound(page, { name: 'Round 1', advancementN: 8 })

  await expect(page.getByRole('heading', { level: 2, name: 'Round 1: Round 1' })).toBeVisible()
  await expect(page.getByText('Top 8 advance')).toBeVisible()

  await page.goto(`/events`)
  const card = page.getByRole('link', { name: new RegExp(name) })
  await card.click()
  await deleteCurrentEvent(page)
})

test('the final-round checkbox is hidden once a round is already final', async ({ page }) => {
  const name = uniqueEventName('Round Final Guard')
  await createDraftEvent(page, name)
  await goToRounds(page)

  await addRound(page, { name: 'Round 1', advancementN: 4 })
  await addRound(page, { name: 'Round 2', isFinal: true })

  // Only one round can be final, so the "Add round" form no longer offers
  // the checkbox once one exists — this replaced a post-submit validation
  // error with hiding the impossible choice up front.
  await expect(page.getByLabel('This is the final round')).toHaveCount(0)

  // Editing the non-final round shouldn't offer it either...
  await page.getByRole('button', { name: 'Edit' }).first().click()
  await expect(page.getByLabel('This is the final round')).toHaveCount(0)
  await page.getByRole('button', { name: 'Cancel' }).click()

  // ...but editing the final round itself still does, so it can be unmarked.
  await page.getByRole('button', { name: 'Edit' }).last().click()
  await expect(page.getByLabel('This is the final round')).toBeVisible()

  await page.goto(`/events`)
  await page.getByRole('link', { name: new RegExp(name) }).click()
  await deleteCurrentEvent(page)
})

test('editing a round persists across a reload', async ({ page }) => {
  const name = uniqueEventName('Round Edit')
  await createDraftEvent(page, name)
  await goToRounds(page)

  await addRound(page, { name: 'Round 1', advancementN: 8 })

  await page.getByRole('button', { name: 'Edit' }).click()
  await page.getByLabel('Round name').fill('Semifinal')
  await page.getByLabel('Participants advancing').fill('4')
  await page.getByRole('button', { name: 'Save round' }).click()

  await expect(page.getByRole('heading', { level: 2, name: 'Round 1: Semifinal' })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { level: 2, name: 'Round 1: Semifinal' })).toBeVisible()
  await expect(page.getByText('Top 4 advance')).toBeVisible()

  await page.goto(`/events`)
  await page.getByRole('link', { name: new RegExp(name) }).click()
  await deleteCurrentEvent(page)
})

test('deleting a round removes it from the list', async ({ page }) => {
  const name = uniqueEventName('Round Delete')
  await createDraftEvent(page, name)
  await goToRounds(page)

  await addRound(page, { name: 'Round 1', advancementN: 8 })
  await expect(page.getByRole('heading', { level: 2, name: 'Round 1: Round 1' })).toBeVisible()

  await page.getByRole('button', { name: 'Delete' }).click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Delete' })
    .click()
  await expect(page.getByText('No rounds yet.')).toBeVisible()

  await page.goto(`/events`)
  await page.getByRole('link', { name: new RegExp(name) }).click()
  await deleteCurrentEvent(page)
})
