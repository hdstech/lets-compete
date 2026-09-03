import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import {
  activateEvent,
  addRound,
  callRpcViaApi,
  createDraftEvent,
  createWalkInParticipant,
  deleteEventViaApi,
  goToRounds,
  seedFinalCalculation,
  uniqueEventName,
} from './helpers'

// Covers QB7 (admin advancement review/commit + tiebreak trigger + winner
// declaration) against the real Supabase backend: start_tiebreak,
// draw/resolve_tiebreak_question through pool exhaustion, advance_round's
// co-advance fallback, and declare_winner. Ties are fabricated directly via
// organizer-privileged inserts (createWalkInParticipant, seedFinalCalculation)
// rather than two real participants racing to the same score live — the
// shared Playwright fixtures only provide one authenticated participant
// identity (see results-leaderboard.spec.ts's note on this gap), and QA12's
// tie/tiebreak mechanics themselves are already covered at the RPC level;
// this suite's job is proving the UI drives them correctly, not re-proving
// the scoring math.

async function createRoundsEvent(page: Page, name: string) {
  await page.goto('/events/new')
  await page.getByLabel('Event name').fill(name)
  await page.getByLabel('This event has elimination rounds').check()
  await page.getByRole('button', { name: 'Create event' }).click()
  await page.waitForURL(/\/events\/[0-9a-f-]{36}$/)
}

// Assumes the current page is a round's rounds list. Clicks the nth
// "Manage segments" link (0-indexed, in round-sequence order) and returns
// the round id from the resulting URL.
async function goToNthRoundSegments(page: Page, index: number): Promise<string> {
  await page.getByRole('link', { name: 'Manage segments' }).nth(index).click()
  const match = page.url().match(/\/rounds\/([0-9a-f-]{36})\/segments$/)
  if (!match) throw new Error(`Expected a round segments URL, got ${page.url()}`)
  return match[1]
}

test.setTimeout(60_000)

test('a tie at the advancement cutoff runs through sudden death to pool exhaustion, then co-advances on commit', async ({
  page,
}) => {
  const name = uniqueEventName('Advancement Tiebreak')
  await createRoundsEvent(page, name)
  const eventId = page.url().match(/\/events\/([0-9a-f-]{36})$/)![1]

  await goToRounds(page)
  await addRound(page, { name: 'Round 1', advancementN: 1 })
  await addRound(page, { name: 'Round 2', isFinal: true })

  const round1Id = await goToNthRoundSegments(page, 0)
  await page.getByLabel('Segment name').fill('Segment A')
  await page.getByRole('button', { name: 'Add segment' }).click()
  await expect(page.getByRole('button', { name: 'Add segment' })).toBeVisible()
  await page.getByRole('link', { name: 'Manage questions' }).click()
  await page.getByLabel('Prompt').fill('Sudden-death reserve question')
  await page.getByLabel('Answer window (seconds)').fill('3')
  await page.getByLabel('Tiebreak reserve pool question').check()
  await page.getByRole('button', { name: 'Add question' }).click()
  await expect(page.getByRole('button', { name: 'Add question' })).toBeVisible()

  await page.goto(`/events/${eventId}`)
  await activateEvent(page)

  const tiedA = await createWalkInParticipant(page, eventId, 'Tied A')
  const tiedB = await createWalkInParticipant(page, eventId, 'Tied B')

  await callRpcViaApi(page, 'close_round', { p_round_id: round1Id })
  await seedFinalCalculation(page, { eventId, roundId: round1Id }, [
    { participantId: tiedA.id, totalScore: 5, rank: 1 },
    { participantId: tiedB.id, totalScore: 5, rank: 1 },
  ])

  await page.goto(`/events/${eventId}/rounds/${round1Id}/advance`)
  await expect(page.getByText('2 participants are tied at rank 1')).toBeVisible()

  await page.getByRole('button', { name: 'Start tiebreak' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Start tiebreak' }).click()
  await expect(page.getByText('Sudden death in progress')).toBeVisible()

  // First draw: no answers are ever submitted for these two walk-in
  // participants (they have no real session to submit with), so the
  // question's window auto-closes on its own timer and resolves with both
  // entrants tied at 0 — no cut, draw again.
  await page.getByRole('button', { name: 'Draw next question' }).click()
  await expect(page.getByText('Current question: Sudden-death reserve question')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Resolve question' })).toBeEnabled({
    timeout: 8_000,
  })
  await page.getByRole('button', { name: 'Resolve question' }).click()
  await expect(page.getByText('still tied — another question was drawn')).toBeVisible()

  // Second draw: the one-question reserve pool is now exhausted.
  await page.getByRole('button', { name: 'Draw next question' }).click()
  await expect(
    page.getByText('The reserve pool was exhausted; the tied cohort co-advances by the standard rule.'),
  ).toBeVisible()

  const tiedRows = page.getByRole('row').filter({ hasText: /Tied [AB]/ })
  await expect(tiedRows).toHaveCount(2)
  for (const row of await tiedRows.all()) {
    await expect(row.getByText('advanced', { exact: true })).toBeVisible()
  }

  await page.getByRole('button', { name: 'Advance round' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Advance round' }).click()
  await expect(page.getByText('This round has already advanced.')).toBeVisible()

  await deleteEventViaApi(page, eventId)
})

test('declaring a winner with no tie at rank 1 succeeds and unlocks concluding the event', async ({
  page,
}) => {
  const name = uniqueEventName('Advancement Declare Winner')
  await createRoundsEvent(page, name)
  const eventId = page.url().match(/\/events\/([0-9a-f-]{36})$/)![1]

  await goToRounds(page)
  await addRound(page, { name: 'Final', isFinal: true })
  const roundId = await goToNthRoundSegments(page, 0)

  await page.goto(`/events/${eventId}`)
  await activateEvent(page)

  const solo = await createWalkInParticipant(page, eventId, 'Solo Winner')
  await callRpcViaApi(page, 'close_round', { p_round_id: roundId })
  await seedFinalCalculation(page, { eventId, roundId }, [
    { participantId: solo.id, totalScore: 3, rank: 1 },
  ])

  await page.goto(`/events/${eventId}/rounds/${roundId}/advance`)
  await expect(page.getByRole('row').filter({ hasText: 'Solo Winner' })).toBeVisible()
  await expect(page.getByText(/tied at rank/)).toHaveCount(0)

  await page.getByRole('button', { name: 'Declare winner' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Declare winner' }).click()
  await expect(page.getByText('Solo Winner has been declared the winner of this event.')).toBeVisible()
  await expect(page.getByText('The winner has been declared for this event.')).toBeVisible()

  await page.goto(`/events/${eventId}`)
  await expect(page.getByRole('button', { name: 'Conclude event' })).toBeEnabled()

  await deleteEventViaApi(page, eventId)
})

test('advancement review is gated until the round closes for scoring', async ({ page }) => {
  const name = uniqueEventName('Advancement Not Ready')
  await createDraftEvent(page, name)
  const eventId = page.url().match(/\/events\/([0-9a-f-]{36})$/)![1]

  await goToRounds(page)
  await addRound(page, { name: 'Round 1', isFinal: true })
  const roundId = await goToNthRoundSegments(page, 0)

  await page.goto(`/events/${eventId}/rounds/${roundId}/advance`)
  await expect(page.getByText("This round hasn't closed for scoring yet.")).toBeVisible()

  await deleteEventViaApi(page, eventId)
})
