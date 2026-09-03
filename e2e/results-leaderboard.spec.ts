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

// createDraftEvent leaves "This event has elimination rounds" unchecked
// (has_rounds: false) — T28 deliberately hides the per-round board for a
// no-rounds event (ticket note: "no-rounds event ... show the single
// round's segment + overall boards exactly like the flat design"), so the
// round-board acceptance criterion needs a has_rounds:true event. Crafted
// inline here rather than widening the shared helper, which every other
// spec relies on defaulting to false.
async function createRoundsEvent(page: import('@playwright/test').Page, name: string) {
  await page.goto('/events/new')
  await page.getByLabel('Event name').fill(name)
  await page.getByLabel('This event has elimination rounds').check()
  await page.getByRole('button', { name: 'Create event' }).click()
  await page.waitForURL(/\/events\/[0-9a-f-]{36}$/)
}

// Covers T28 (admin results screen) against the real Supabase backend:
// calculating a scoring_closed round's segment + round leaderboards from
// T16's calculate_results RPC, re-calculating as a no-op, and the
// not-yet-calculated / not-yet-closed gating a round shows before it's
// ready. Ties and rank-skipping (RANK() OVER) are T16's own backend
// behavior — this suite verifies T28's genuinely new surface: reading and
// rendering the frozen result_calculation_entries, not recomputing scores
// client-side.

const graderEmail = process.env.E2E_GRADER_EMAIL ?? 'playwright-e2e-grader@example.com'

test.setTimeout(90_000)

test('calculating a closed round shows matching segment and round boards, and re-calculating no-ops', async ({
  browser,
}) => {
  const organizerContext = await browser.newContext({
    storageState: 'playwright/.auth/organizer.json',
  })
  const organizerPage = await organizerContext.newPage()
  const participantContext = await browser.newContext({
    storageState: 'playwright/.auth/participant.json',
  })
  const participantPage = await participantContext.newPage()
  const graderContext = await browser.newContext({
    storageState: 'playwright/.auth/grader.json',
  })
  const graderPage = await graderContext.newPage()

  const name = uniqueEventName('Results Leaderboard')
  await createRoundsEvent(organizerPage, name)
  const eventId = organizerPage.url().match(/\/events\/([0-9a-f-]{36})$/)![1]
  const joinCode = await getJoinCode(organizerPage)

  await goToRounds(organizerPage)
  await addRound(organizerPage, { name: 'Round 1', isFinal: true })
  await goToSegments(organizerPage)
  await addSegment(organizerPage, { name: 'Segment A' })
  await goToQuestions(organizerPage)
  await addQuestion(organizerPage, { prompt: 'What is the capital of France?', windowSeconds: 6 })
  await addAcceptableAnswer(organizerPage, { value: 'Paris' })

  await organizerPage.goto(`/events/${eventId}`)
  await activateEvent(organizerPage)

  await organizerPage.getByLabel("Grader's email").fill(graderEmail)
  await organizerPage.getByRole('button', { name: 'Assign grader' }).click()
  await expect(organizerPage.getByText(/Assigned/)).toBeVisible()

  await participantPage.goto('/')
  await joinEventViaApi(participantPage, joinCode, 'Leaderboard Participant')
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
  // The auto-mark matcher needs its own post-close grace period before
  // it marks the answer — see grader-adjudication.spec.ts for the same wait.
  await organizerPage.waitForTimeout(10_500)
  await organizerPage.getByRole('button', { name: 'Close round' }).click()
  await organizerPage.getByRole('dialog').getByRole('button', { name: 'Close round' }).click()
  await expect(organizerPage.getByText(/scoring closed/)).toBeVisible()

  // Grader adjudicates the one answer as correct.
  await graderPage.goto(`/events/${eventId}/rounds/${roundId}/grade`)
  await expect(graderPage.getByRole('button', { name: 'Correct' })).toBeVisible()
  await graderPage.getByRole('button', { name: 'Save grades' }).click()
  await graderPage.getByRole('dialog').getByRole('button', { name: 'Save grades' }).click()
  await expect(graderPage.getByText('Grades saved.')).toBeVisible()

  // Organizer opens results from the rounds page and calculates. Still on
  // the live console from closing the round above, so return to the event
  // detail page first — goToRounds assumes that's where it starts from.
  await organizerPage.goto(`/events/${eventId}`)
  await goToRounds(organizerPage)
  await organizerPage.getByRole('link', { name: 'View results' }).click()
  await expect(organizerPage).toHaveURL(new RegExp(`/events/${eventId}/results$`))

  await expect(organizerPage.getByText('Not yet calculated.').first()).toBeVisible()
  await organizerPage.getByRole('button', { name: 'Calculate results' }).click()
  await expect(organizerPage.getByRole('button', { name: 'Calculate results' })).toBeEnabled()

  // Segment board and round board both show the participant at rank 1 with
  // a score of 1 — the round total equals the sum of its (one) segment.
  await expect(organizerPage.getByRole('heading', { name: 'Segment A' })).toBeVisible()
  await expect(organizerPage.getByRole('heading', { name: 'Round leaderboard' })).toBeVisible()
  const rows = organizerPage.getByRole('row').filter({ hasText: 'Leaderboard Participant' })
  await expect(rows).toHaveCount(2)
  for (const row of await rows.all()) {
    await expect(row.getByRole('cell').nth(0)).toHaveText('1')
    await expect(row.getByRole('cell').nth(2)).toHaveText('1')
  }

  const calculatedMetaBefore = await organizerPage
    .getByText(/^Current · calculated/)
    .first()
    .innerText()

  // Re-calculating with no underlying change is a no-op: same calculation,
  // same calculated_at, read back fresh from persisted entries.
  await organizerPage.getByRole('button', { name: 'Calculate results' }).click()
  await expect(organizerPage.getByRole('button', { name: 'Calculate results' })).toBeEnabled()
  const calculatedMetaAfter = await organizerPage
    .getByText(/^Current · calculated/)
    .first()
    .innerText()
  expect(calculatedMetaAfter).toBe(calculatedMetaBefore)

  // Final round hasn't advanced yet, so the overall board stays gated.
  await expect(organizerPage.getByText('Available once the final round has advanced.')).toBeVisible()

  await deleteEventViaApi(organizerPage, eventId)
  await organizerContext.close()
  await participantContext.close()
  await graderContext.close()
})

test('a round that has not closed for scoring yet cannot be calculated', async ({ page }) => {
  const name = uniqueEventName('Results Not Ready')
  await createDraftEvent(page, name)
  const eventId = page.url().match(/\/events\/([0-9a-f-]{36})$/)![1]

  await goToRounds(page)
  await addRound(page, { name: 'Round 1', isFinal: true })
  await goToSegments(page)
  await addSegment(page, { name: 'Segment A' })

  await page.goto(`/events/${eventId}/results`)
  await expect(page.getByRole('button', { name: 'Calculate results' })).toBeDisabled()
  await expect(
    page.getByText("Results can be calculated once this round's scoring is closed."),
  ).toBeVisible()
  await expect(page.getByText('Not yet calculated.').first()).toBeVisible()

  await deleteEventViaApi(page, eventId)
})
