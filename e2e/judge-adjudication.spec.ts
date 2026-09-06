import { expect, test } from '@playwright/test'
import {
  activateEvent,
  addAcceptableAnswer,
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

// Covers QB6 (judge batched adjudication screen) against the real Supabase
// backend: once a round is scoring_closed (QA9), the assigned judge (QB6's
// own assign_grader RPC, since no prior ticket wires events.grader_id) opens
// the scoring screen and sees the round's answers pre-marked by QA7's
// matcher (QA10's adjudicate_round_answers), then confirms or overrides each
// one. Runs under the 'judge' project (see playwright.config.ts) for the
// judge's own page; organizer and participant contexts drive setup, same
// two-extra-context shape as participant-live-answer.spec.ts.

test.setTimeout(90_000)

const judgeEmail = process.env.E2E_JUDGE_EMAIL ?? 'playwright-e2e-judge@example.com'

test('judge confirms an auto-correct answer and overrides another', async ({ page, browser }) => {
  const organizerContext = await browser.newContext({
    storageState: 'playwright/.auth/organizer.json',
  })
  const organizerPage = await organizerContext.newPage()
  const participantContext = await browser.newContext({
    storageState: 'playwright/.auth/participant.json',
  })
  const participantPage = await participantContext.newPage()

  const name = uniqueEventName('Judge Adjudication')
  await createDraftEvent(organizerPage, name)
  const eventId = organizerPage.url().match(/\/events\/([0-9a-f-]{36})$/)![1]
  const joinCode = await getJoinCode(organizerPage)

  await goToRounds(organizerPage)
  await addRound(organizerPage, { name: 'Round 1', isFinal: true })
  await goToSegments(organizerPage)
  await addSegment(organizerPage, { name: 'Segment A' })
  await goToQuestions(organizerPage)
  await addQuestion(organizerPage, { prompt: 'What is the capital of France?', windowSeconds: 6 })
  // Configured so the matcher (QA7) auto pre-marks a "Paris" submission
  // correct — the judge's screen should show it that way before any
  // override.
  await addAcceptableAnswer(organizerPage, { value: 'Paris' })

  await organizerPage.goto(`/events/${eventId}`)
  await activateEvent(organizerPage)

  // Assign the judge up front — RLS gates every table the scoring screen
  // reads on events.grader_id, so this must land before the judge ever
  // navigates there.
  await organizerPage.getByLabel("Judge's email").fill(judgeEmail)
  await organizerPage.getByRole('button', { name: 'Assign judge' }).click()
  await expect(organizerPage.getByText(/Assigned/)).toBeVisible()

  await participantPage.goto('/')
  await joinEventViaApi(participantPage, joinCode, 'Scoring Participant')
  await participantPage.goto(`/events/${eventId}/waiting-room`)

  await organizerPage.reload()
  await organizerPage.getByRole('button', { name: 'Approve' }).click()
  await expect(participantPage.getByText('approved', { exact: true })).toBeVisible({
    timeout: 8_000,
  })

  await goToRounds(organizerPage)
  await goToLiveConsole(organizerPage)
  const roundId = organizerPage.url().match(/\/rounds\/([0-9a-f-]{36})\/live$/)![1]

  await organizerPage.getByRole('button', { name: 'Reveal question' }).click()
  await expect(participantPage).toHaveURL(new RegExp(`/events/${eventId}/play$`), {
    timeout: 8_000,
  })
  await participantPage.getByLabel('Your answer').fill('Paris')
  await participantPage.getByRole('button', { name: 'Submit answer' }).click()
  await expect(participantPage.getByText(/submitted/i)).toBeVisible()

  await expect(organizerPage.getByText('window closed')).toBeVisible({ timeout: 10_000 })
  // The auto-mark matcher (QA7) requires its own 10s post-close grace period
  // to have elapsed before it will mark an answer — closing the round
  // triggers auto-marking (see LiveConsolePage's confirmCloseRound), so wait
  // that out here to get a deterministic auto-correct pre-mark below.
  await organizerPage.waitForTimeout(10_500)
  await organizerPage.getByRole('button', { name: 'Close round' }).click()
  await organizerPage.getByRole('dialog').getByRole('button', { name: 'Close round' }).click()
  await expect(organizerPage.getByText(/scoring closed/)).toBeVisible()

  // Judge adjudicates.
  await page.goto(`/events/${eventId}/rounds/${roundId}/score`)
  await expect(page.getByText('What is the capital of France?')).toBeVisible()
  await expect(page.getByText('Scoring Participant')).toBeVisible()
  await expect(page.getByText('Paris', { exact: true })).toBeVisible()

  // Auto pre-marked correct (matches the acceptable answer) — confirm it,
  // then override it to incorrect and save.
  await expect(page.getByRole('button', { name: 'Correct' })).toBeVisible()
  await page.getByRole('button', { name: 'Correct' }).click()
  await expect(page.getByRole('button', { name: 'Incorrect' })).toBeVisible()

  await page.getByRole('button', { name: 'Save scores' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Save scores' }).click()
  await expect(page.getByText('Scores saved.')).toBeVisible()

  // Reload to confirm the override actually persisted server-side, not just
  // in local component state.
  await page.reload()
  await expect(page.getByRole('button', { name: 'Incorrect' })).toBeVisible()

  await deleteEventViaApi(organizerPage, eventId)
  await organizerContext.close()
  await participantContext.close()
})

test("a round that hasn't closed yet shows no scoring UI", async ({ page, browser }) => {
  const organizerContext = await browser.newContext({
    storageState: 'playwright/.auth/organizer.json',
  })
  const organizerPage = await organizerContext.newPage()

  const name = uniqueEventName('Judge Not Ready')
  await createDraftEvent(organizerPage, name)
  const eventId = organizerPage.url().match(/\/events\/([0-9a-f-]{36})$/)![1]

  await goToRounds(organizerPage)
  await addRound(organizerPage, { name: 'Round 1', isFinal: true })
  await goToSegments(organizerPage)
  await addSegment(organizerPage, { name: 'Segment A' })
  await goToQuestions(organizerPage)
  await addQuestion(organizerPage, { prompt: 'Not ready yet', windowSeconds: 30 })

  await organizerPage.goto(`/events/${eventId}`)
  await activateEvent(organizerPage)

  await organizerPage.getByLabel("Judge's email").fill(judgeEmail)
  await organizerPage.getByRole('button', { name: 'Assign judge' }).click()
  await expect(organizerPage.getByText(/Assigned/)).toBeVisible()

  await goToRounds(organizerPage)
  await goToLiveConsole(organizerPage)
  const roundId = organizerPage.url().match(/\/rounds\/([0-9a-f-]{36})\/live$/)![1]

  await page.goto(`/events/${eventId}/rounds/${roundId}/score`)
  await expect(page.getByText(/hasn't closed for scoring yet/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save scores' })).toHaveCount(0)

  await deleteEventViaApi(organizerPage, eventId)
  await organizerContext.close()
})
