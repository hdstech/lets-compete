import { expect, test } from '@playwright/test'
import {
  activateEvent,
  addQuestion,
  addRound,
  addSegment,
  createDraftEvent,
  deleteEventViaApi,
  getJoinCode,
  goToLiveConsole,
  goToQuestions,
  goToRounds,
  goToSegments,
  joinEventViaApi,
  uniqueEventName,
} from './helpers'

// Covers QB4 (participant live answering screen) against the real Supabase
// backend: once the organizer reveals a question (QA5), the participant's
// waiting room (QB3) hands off to the live-answer screen via Realtime, where
// they see the server-authoritative countdown and submit an answer (QA6).
// Runs under the 'participant' project (see playwright.config.ts) for the
// participant's own page; a second browser context authenticated as the e2e
// organizer drives event setup, approval, and the reveal — same two-context
// shape as participant-waiting-room.spec.ts.

test.setTimeout(60_000)

test('participant receives a revealed question live and submits an answer', async ({
  page,
  browser,
}) => {
  const organizerContext = await browser.newContext({
    storageState: 'playwright/.auth/organizer.json',
  })
  const organizerPage = await organizerContext.newPage()

  const name = uniqueEventName('Live Answer')
  await createDraftEvent(organizerPage, name)
  const eventId = organizerPage.url().match(/\/events\/([0-9a-f-]{36})$/)![1]
  const joinCode = await getJoinCode(organizerPage)

  await goToRounds(organizerPage)
  await addRound(organizerPage, { name: 'Round 1', isFinal: true })
  await goToSegments(organizerPage)
  await addSegment(organizerPage, { name: 'Segment A' })
  await goToQuestions(organizerPage)
  await addQuestion(organizerPage, { prompt: 'What is the capital of France?', windowSeconds: 15 })

  await organizerPage.goto(`/events/${eventId}`)
  await activateEvent(organizerPage)

  // localStorage isn't readable on Playwright's initial about:blank page —
  // navigate into the app's origin first.
  await page.goto('/')
  await joinEventViaApi(page, joinCode, 'Live Answer Participant')
  await page.goto(`/events/${eventId}/waiting-room`)
  await expect(page.getByText('pending', { exact: true })).toBeVisible()

  await organizerPage.reload()
  await organizerPage.getByRole('button', { name: 'Approve' }).click()
  await expect(page.getByText('approved', { exact: true })).toBeVisible({ timeout: 8_000 })

  await goToRounds(organizerPage)
  await goToLiveConsole(organizerPage)
  await organizerPage.getByRole('button', { name: 'Reveal question' }).click()

  // The participant's waiting room subscribes to question reveals and hands
  // off to the live-answer screen automatically — no manual navigation.
  await expect(page).toHaveURL(new RegExp(`/events/${eventId}/play$`), { timeout: 8_000 })
  await expect(page.getByText('What is the capital of France?')).toBeVisible()

  await page.getByLabel('Your answer').fill('Paris')
  await page.getByRole('button', { name: 'Submit answer' }).click()
  await expect(page.getByText(/submitted/i)).toBeVisible()

  // The organizer's who's-answered roster reflects the submission live.
  await expect(organizerPage.getByText(/1 of \d+ answered/)).toBeVisible({ timeout: 15_000 })

  await deleteEventViaApi(organizerPage, eventId)
  await organizerContext.close()
})

test('an unsubmitted answer survives a reload as a local draft', async ({ page, browser }) => {
  const organizerContext = await browser.newContext({
    storageState: 'playwright/.auth/organizer.json',
  })
  const organizerPage = await organizerContext.newPage()

  const name = uniqueEventName('Live Answer Draft')
  await createDraftEvent(organizerPage, name)
  const eventId = organizerPage.url().match(/\/events\/([0-9a-f-]{36})$/)![1]
  const joinCode = await getJoinCode(organizerPage)

  await goToRounds(organizerPage)
  await addRound(organizerPage, { name: 'Round 1', isFinal: true })
  await goToSegments(organizerPage)
  await addSegment(organizerPage, { name: 'Segment A' })
  await goToQuestions(organizerPage)
  await addQuestion(organizerPage, { prompt: 'Draft persistence check', windowSeconds: 30 })

  await organizerPage.goto(`/events/${eventId}`)
  await activateEvent(organizerPage)

  await page.goto('/')
  await joinEventViaApi(page, joinCode, 'Draft Participant')
  await page.goto(`/events/${eventId}/waiting-room`)

  await organizerPage.reload()
  await organizerPage.getByRole('button', { name: 'Approve' }).click()
  await expect(page.getByText('approved', { exact: true })).toBeVisible({ timeout: 8_000 })

  await goToRounds(organizerPage)
  await goToLiveConsole(organizerPage)
  await organizerPage.getByRole('button', { name: 'Reveal question' }).click()

  await expect(page).toHaveURL(new RegExp(`/events/${eventId}/play$`), { timeout: 8_000 })
  await page.getByLabel('Your answer').fill('an unsent draft')

  await page.reload()
  await expect(page.getByLabel('Your answer')).toHaveValue('an unsent draft')

  await deleteEventViaApi(organizerPage, eventId)
  await organizerContext.close()
})
