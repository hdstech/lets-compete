import { expect, test } from '@playwright/test'
import {
  activateEvent,
  addAcceptableAnswer,
  addQuestion,
  addRound,
  addSegment,
  deleteEventViaApi,
  getJoinCode,
  goToLiveConsole,
  goToQuestions,
  goToRounds,
  goToSegments,
  joinEventViaApi,
  uniqueEventName,
} from './helpers'

// Covers T29: disqualifying a participant after results have already been
// calculated leaves those calculations stale (they're immutable — see the
// T16 migration), so the event detail page offers a "Recalculate results"
// action once it detects at least one already-final calculation. This suite
// verifies the whole loop: disqualify -> recalc offer -> recalculate ->
// the participant drops out of every affected scope's leaderboard -> the
// calculation history page shows both the original and the recalculated
// run, tagged with why.
async function createRoundsEvent(page: import('@playwright/test').Page, name: string) {
  await page.goto('/events/new')
  await page.getByLabel('Event name').fill(name)
  await page.getByLabel('This event has elimination rounds').check()
  await page.getByRole('button', { name: 'Create event' }).click()
  await page.waitForURL(/\/events\/[0-9a-f-]{36}$/)
}

const graderEmail = process.env.E2E_GRADER_EMAIL ?? 'playwright-e2e-grader@example.com'

test.setTimeout(90_000)

test('disqualifying a participant offers a recalc that removes them from results, recorded in history', async ({
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

  const name = uniqueEventName('Results Recalc')
  await createRoundsEvent(organizerPage, name)
  const eventId = organizerPage.url().match(/\/events\/([0-9a-f-]{36})$/)![1]
  const joinCode = await getJoinCode(organizerPage)

  await goToRounds(organizerPage)
  await addRound(organizerPage, { name: 'Round 1', isFinal: true })
  await goToSegments(organizerPage)
  await addSegment(organizerPage, { name: 'Segment A' })
  await goToQuestions(organizerPage)
  await addQuestion(organizerPage, { prompt: 'What is the capital of Italy?', windowSeconds: 6 })
  await addAcceptableAnswer(organizerPage, { value: 'Rome' })

  await organizerPage.goto(`/events/${eventId}`)
  await activateEvent(organizerPage)

  await organizerPage.getByLabel("Grader's email").fill(graderEmail)
  await organizerPage.getByRole('button', { name: 'Assign grader' }).click()
  await expect(organizerPage.getByText(/Assigned/)).toBeVisible()

  await participantPage.goto('/')
  await joinEventViaApi(participantPage, joinCode, 'Recalc Participant')
  await participantPage.goto(`/events/${eventId}/waiting-room`)

  await organizerPage.reload()
  await organizerPage.getByRole('button', { name: 'Approve' }).click()
  await expect(participantPage.getByText('approved', { exact: true })).toBeVisible({
    timeout: 8_000,
  })

  // The disqualify/eligibility affordances live on the same participant row
  // as approve/revoke.
  await expect(organizerPage.getByText('eligible', { exact: true })).toBeVisible()

  await goToRounds(organizerPage)
  await goToLiveConsole(organizerPage)

  await organizerPage.getByRole('button', { name: 'Reveal question' }).click()
  await expect(participantPage).toHaveURL(new RegExp(`/events/${eventId}/play$`), {
    timeout: 8_000,
  })
  await participantPage.getByLabel('Your answer').fill('Rome')
  await participantPage.getByRole('button', { name: 'Submit answer' }).click()
  await expect(participantPage.getByText(/submitted/i)).toBeVisible()

  await expect(organizerPage.getByText('window closed')).toBeVisible({ timeout: 10_000 })
  await organizerPage.waitForTimeout(10_500)
  await organizerPage.getByRole('button', { name: 'Close round' }).click()
  await organizerPage.getByRole('dialog').getByRole('button', { name: 'Close round' }).click()
  await expect(organizerPage.getByText(/scoring closed/)).toBeVisible()

  const roundId = organizerPage.url().match(/\/rounds\/([0-9a-f-]{36})\/live$/)![1]
  await graderPage.goto(`/events/${eventId}/rounds/${roundId}/grade`)
  await expect(graderPage.getByRole('button', { name: 'Correct' })).toBeVisible()
  await graderPage.getByRole('button', { name: 'Save grades' }).click()
  await graderPage.getByRole('dialog').getByRole('button', { name: 'Save grades' }).click()
  await expect(graderPage.getByText('Grades saved.')).toBeVisible()

  await organizerPage.goto(`/events/${eventId}`)
  await goToRounds(organizerPage)
  await organizerPage.getByRole('link', { name: 'View results' }).click()
  await organizerPage.getByRole('button', { name: 'Calculate results' }).click()
  await expect(organizerPage.getByRole('button', { name: 'Calculate results' })).toBeEnabled()

  // Both the segment and round boards show the participant ranked 1st before
  // disqualification.
  const rowsBefore = organizerPage.getByRole('row').filter({ hasText: 'Recalc Participant' })
  await expect(rowsBefore).toHaveCount(2)

  // Disqualify from the event detail page.
  await organizerPage.goto(`/events/${eventId}`)
  await organizerPage.getByRole('button', { name: 'Disqualify' }).click()
  await organizerPage.getByRole('dialog').getByRole('button', { name: 'Disqualify' }).click()
  await expect(organizerPage.getByText('disqualified', { exact: true })).toBeVisible()

  // The stale-results banner offers a recalc, since results were already
  // calculated for this event.
  await expect(organizerPage.getByText('Results may be out of date')).toBeVisible()
  await organizerPage.getByRole('button', { name: 'Recalculate results' }).click()
  await expect(organizerPage.getByText('Recalculated 2 scopes.')).toBeVisible()

  // Reinstate should be available now, and disqualify should have flipped
  // off (both driven by the same status field).
  await expect(organizerPage.getByRole('button', { name: 'Reinstate' })).toBeVisible()

  // Both leaderboards now exclude the disqualified participant.
  await organizerPage.goto(`/events/${eventId}/results`)
  const rowsAfter = organizerPage.getByRole('row').filter({ hasText: 'Recalc Participant' })
  await expect(rowsAfter).toHaveCount(0)
  await expect(
    organizerPage.getByText('No eligible participants scored in this scope.').first(),
  ).toBeVisible()

  // History shows both runs per scope, the newer one tagged with why.
  await organizerPage.getByRole('link', { name: 'View history' }).click()
  await expect(organizerPage).toHaveURL(new RegExp(`/events/${eventId}/results/history$`))
  await expect(organizerPage.getByText('2 runs').first()).toBeVisible()
  await expect(
    organizerPage.getByText('Participant Recalc Participant was disqualified').first(),
  ).toBeVisible()
  await expect(organizerPage.getByText('Current').first()).toBeVisible()
  await expect(organizerPage.getByText('Superseded').first()).toBeVisible()

  await deleteEventViaApi(organizerPage, eventId)
  await organizerContext.close()
  await participantContext.close()
  await graderContext.close()
})
