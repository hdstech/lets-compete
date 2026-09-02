import { expect, test } from '@playwright/test'
import {
  addAcceptableAnswer,
  addQuestion,
  addRound,
  addSegment,
  createDraftEvent,
  deleteCurrentEvent,
  goToQuestions,
  goToRounds,
  goToSegments,
  uniqueEventName,
} from './helpers'

// Covers QB1 (admin question authoring UI + tiebreak reserve pool) against
// the real Supabase backend: adding a question with its answer window and
// answer type, attaching acceptable answers for the auto pre-mark matcher,
// marking a question as part of the tiebreak reserve pool, editing a
// question, and deleting one. Deliberately skips exercising reveal/window
// lifecycle (status/reveal_token/etc.) — those belong to QA5/QA8, not this
// authoring UI.

async function setUpToQuestions(page: import('@playwright/test').Page, eventName: string) {
  await createDraftEvent(page, eventName)
  await goToRounds(page)
  await addRound(page, { name: 'Round 1', advancementN: 8 })
  await goToSegments(page)
  await addSegment(page, { name: 'History' })
  await goToQuestions(page)
}

test('adding a question shows it in the list with its config', async ({ page }) => {
  const name = uniqueEventName('Question Add')
  await setUpToQuestions(page, name)

  await addQuestion(page, { prompt: 'What year did WWII end?', windowSeconds: 20 })

  await expect(page.getByRole('heading', { level: 2, name: 'Question 1' })).toBeVisible()
  await expect(page.getByText('What year did WWII end?')).toBeVisible()
  await expect(page.getByText('20s')).toBeVisible()

  await page.goto('/events')
  await page.getByRole('link', { name: new RegExp(name) }).click()
  await deleteCurrentEvent(page)
})

test('marking a question as tiebreak reserve labels it in the list', async ({ page }) => {
  const name = uniqueEventName('Question Tiebreak')
  await setUpToQuestions(page, name)

  await addQuestion(page, {
    prompt: 'Reserve question',
    windowSeconds: 15,
    isTiebreak: true,
  })

  await expect(
    page.getByRole('heading', { level: 2, name: 'Question 1 (tiebreak reserve)' }),
  ).toBeVisible()

  await page.goto('/events')
  await page.getByRole('link', { name: new RegExp(name) }).click()
  await deleteCurrentEvent(page)
})

test('adding an acceptable answer attaches it to the question', async ({ page }) => {
  const name = uniqueEventName('Question Answer')
  await setUpToQuestions(page, name)

  await addQuestion(page, { prompt: 'What is the capital of France?', windowSeconds: 20 })
  await addAcceptableAnswer(page, { value: 'Paris' })

  await expect(page.getByText('Paris', { exact: true })).toBeVisible()

  await page.goto('/events')
  await page.getByRole('link', { name: new RegExp(name) }).click()
  await deleteCurrentEvent(page)
})

test('editing a question persists across a reload', async ({ page }) => {
  const name = uniqueEventName('Question Edit')
  await setUpToQuestions(page, name)

  await addQuestion(page, { prompt: 'Original prompt', windowSeconds: 20 })

  await page.getByRole('button', { name: 'Edit' }).click()
  await page.getByLabel('Prompt').fill('Updated prompt')
  await page.getByLabel('Answer window (seconds)').fill('45')
  await page.getByRole('button', { name: 'Save question' }).click()

  await expect(page.getByText('Updated prompt')).toBeVisible()
  await expect(page.getByText('45s')).toBeVisible()

  await page.reload()
  await expect(page.getByText('Updated prompt')).toBeVisible()
  await expect(page.getByText('45s')).toBeVisible()

  await page.goto('/events')
  await page.getByRole('link', { name: new RegExp(name) }).click()
  await deleteCurrentEvent(page)
})

test('deleting a question removes it from the list', async ({ page }) => {
  const name = uniqueEventName('Question Delete')
  await setUpToQuestions(page, name)

  await addQuestion(page, { prompt: 'Doomed question', windowSeconds: 20 })
  await expect(page.getByRole('heading', { level: 2, name: 'Question 1' })).toBeVisible()

  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByText('No questions yet.')).toBeVisible()

  await page.goto('/events')
  await page.getByRole('link', { name: new RegExp(name) }).click()
  await deleteCurrentEvent(page)
})
