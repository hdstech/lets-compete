import { expect, test } from '@playwright/test'
import {
  activateEvent,
  addQuestion,
  addRound,
  addSegment,
  createDraftEvent,
  deleteEventViaApi,
  goToLiveConsole,
  goToQuestions,
  goToRounds,
  goToSegments,
  uniqueEventName,
} from './helpers'

// Covers QB2 (admin live quiz console) against the real Supabase backend:
// revealing a question opens a server-authoritative countdown that the
// console mirrors and auto-closes once it elapses (QA5), voiding an open
// question marks it out of play (QA8), and closing a round is gated on
// every question being window_closed/voided (QA9). Deliberately uses a
// short answer window in the reveal test so the auto-close is fast to
// observe, and cleans up via the API (deleteEventViaApi) since — like
// activate_event's success path in rounds-crud.spec.ts — an activated
// event has no delete affordance in the UI.

test('revealing a question shows a countdown that auto-closes, then the round can be closed', async ({
  page,
}) => {
  const name = uniqueEventName('Live Console Reveal')
  await createDraftEvent(page, name)
  const eventId = page.url().match(/\/events\/([0-9a-f-]{36})$/)![1]

  await goToRounds(page)
  await addRound(page, { name: 'Round 1', isFinal: true })
  await goToSegments(page)
  await addSegment(page, { name: 'Segment A' })
  await goToQuestions(page)
  await addQuestion(page, { prompt: 'What is 2+2?', windowSeconds: 3 })

  await page.goto(`/events/${eventId}`)
  await activateEvent(page)

  await goToRounds(page)
  await goToLiveConsole(page)

  await expect(page.getByText('What is 2+2?')).toBeVisible()
  await page.getByRole('button', { name: 'Reveal question' }).click()
  await expect(page.getByRole('button', { name: 'Void question' })).toBeVisible()

  // The 3s window is server-authoritative; the console polls its own
  // countdown and auto-closes once it genuinely elapses.
  await expect(page.getByText('window closed')).toBeVisible({ timeout: 8_000 })

  await page.getByRole('button', { name: 'Close round' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Close round' }).click()
  await expect(page.getByText(/scoring closed/)).toBeVisible()

  await deleteEventViaApi(page, eventId)
})

test('voiding the open question marks it voided and the round can still be closed', async ({ page }) => {
  const name = uniqueEventName('Live Console Void')
  await createDraftEvent(page, name)
  const eventId = page.url().match(/\/events\/([0-9a-f-]{36})$/)![1]

  await goToRounds(page)
  await addRound(page, { name: 'Round 1', isFinal: true })
  await goToSegments(page)
  await addSegment(page, { name: 'Segment A' })
  await goToQuestions(page)
  await addQuestion(page, { prompt: 'Void me', windowSeconds: 30 })

  await page.goto(`/events/${eventId}`)
  await activateEvent(page)

  await goToRounds(page)
  await goToLiveConsole(page)

  await page.getByRole('button', { name: 'Reveal question' }).click()
  await page.getByRole('button', { name: 'Void question' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Void question' }).click()

  await expect(page.getByText('voided', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Close round' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Close round' }).click()
  await expect(page.getByText(/scoring closed/)).toBeVisible()

  await deleteEventViaApi(page, eventId)
})
