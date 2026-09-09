import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import {
  activateEvent,
  addAcceptableAnswer,
  addQuestion,
  addRound,
  addSegment,
  callRpcViaApi,
  createDraftEvent,
  createWalkInParticipant,
  deleteEventViaApi,
  getJoinCode,
  goToLiveConsole,
  goToQuestions,
  goToRounds,
  goToSegments,
  joinEventViaApi,
  seedFinalCalculation,
  setPageHidden,
  uniqueEventName,
} from './helpers'

// Covers T33 (full end-to-end verification walkthrough, quiz): the plan's
// "Quiz E2E" verification bullet strung together into one continuous story
// — author, activate, live-answer every edge case a real run hits (a
// correct submit, a no-show that scores 0, focus-integrity return-in-time,
// focus-integrity grace-timeout auto-submit + integrity log, a voided
// question), close, adjudicate with a real override, calculate, a genuine
// cutoff tie resolved through the sudden-death reserve pool, advance, a
// second round, declare a winner, and conclude — plus two gaps no existing
// spec covers: a rank-1 tie that exhausts the reserve pool in the FINAL
// round (blocked, unlike a non-final round's co-advance fallback) and the
// server-side elapsed-time backstop that stops a rolled-back client clock
// from forging an in-window answer. The no-rounds regression and the
// mobile-viewport sanity pass called out in the same plan bullet are
// already exercised pervasively (createDraftEvent's has_rounds:false is the
// default every other spec but the *-crud/tiebreak ones relies on, and
// participant-mobile.spec.ts/admin-mobile-sanity.spec.ts already cover the
// mobile pass) — this file adds one direct assertion of the former instead
// of re-proving the latter.

async function createRoundsEvent(page: Page, name: string) {
  await page.goto('/events/new')
  await page.getByLabel('Event name').fill(name)
  await page.getByLabel('This event has elimination rounds').check()
  await page.getByRole('button', { name: 'Create event' }).click()
  await page.waitForURL(/\/events\/[0-9a-f-]{36}$/)
}

// Segments are managed inline on each round card now (each rendered as a
// role="group" region, in round-sequence order). Adds a segment to the nth
// round card (0-indexed), opens its "Manage questions" screen, and returns
// that round's id from the resulting URL — same helper advancement-tiebreak.spec.ts
// duplicates locally for a multi-round event.
async function addSegmentAndOpenQuestions(
  page: Page,
  index: number,
  segmentName: string,
): Promise<string> {
  const card = page.getByRole('group').nth(index)
  await card.getByLabel('Segment name').fill(segmentName)
  await card.getByRole('button', { name: 'Add segment' }).click()
  const questionsLink = card.getByRole('link', { name: 'Manage questions' })
  await expect(questionsLink).toBeVisible()
  await questionsLink.click()
  await page.waitForURL(
    /\/rounds\/[0-9a-f-]{36}\/segments\/[0-9a-f-]{36}\/questions$/,
  )
  const match = page.url().match(/\/rounds\/([0-9a-f-]{36})\/segments\//)
  if (!match) throw new Error(`Expected a questions URL, got ${page.url()}`)
  return match[1]
}

// RoundsPage shows a "Live console" link for every round once the event is
// active (gated on event.status, not the individual round's own status —
// see RoundsPage.tsx), so a multi-round event always has more than one and
// the shared goToLiveConsole helper's "exactly one" assumption doesn't hold.
// Rounds render in sequence order, so 'first'/'last' picks a specific one.
async function goToRoundLiveConsole(page: Page, position: 'first' | 'last') {
  const link = page.getByRole('link', { name: 'Live console' })
  await (position === 'first' ? link.first() : link.last()).click()
  await page.waitForURL(/\/events\/[0-9a-f-]{36}\/rounds\/[0-9a-f-]{36}\/live$/)
}

// QuestionsPage gives each acceptable-answer input a unique accessible name
// ("Acceptable answer for question N"), because addAcceptableAnswer (the
// shared helper) only works when exactly one question card exists — this
// walkthrough authors six in one segment, so answers must be attached to a
// specific one by its sequence number instead.
async function addAcceptableAnswerToQuestion(page: Page, sequence: number, value: string) {
  const input = page.getByLabel(`Acceptable answer for question ${sequence}`)
  await input.fill(value)
  const form = input.locator('xpath=ancestor::form[1]')
  await form.getByRole('button', { name: 'Add answer' }).click()
  await expect(form.getByRole('button', { name: 'Add answer' })).toBeVisible()
}

// ScoringPage renders one Card per question, titled "{segment} · Q{n}",
// each with its own single "Correct"/"Incorrect" toggle button immediately
// after it in document order (before the next question's own heading) —
// so the first <button> found after a given heading is that question's own
// toggle, without needing to identify the enclosing Card element at all.
function scoringToggle(page: Page, headingLabel: string) {
  return page
    .getByRole('heading', { level: 2, name: headingLabel, exact: true })
    .locator('xpath=following::button[1]')
}

// ResultsPage titles each round's section "Round {sequence}: {name}" with
// that round's own "Calculate results" button immediately following it in
// the same BoardHeader row — same following-button trick as scoringToggle,
// needed once more than one round's section is on the page at once.
function resultsCalculateButton(page: Page, roundHeadingText: string) {
  return page
    .getByRole('heading', { name: roundHeadingText, exact: true })
    .locator('xpath=following::button[1]')
}

const judgeEmail = process.env.E2E_JUDGE_EMAIL ?? 'playwright-e2e-judge@example.com'

test.setTimeout(240_000)

test('quiz lifecycle: author, activate, every live-answer edge case, adjudicate, a tied cutoff resolved by sudden death, a second round, and conclude', async ({
  page,
  browser,
}) => {
  const organizerPage = page
  const participantContext = await browser.newContext({
    storageState: 'playwright/.auth/participant.json',
  })
  const participantPage = await participantContext.newPage()
  const judgeContext = await browser.newContext({
    storageState: 'playwright/.auth/judge.json',
  })
  const judgePage = await judgeContext.newPage()

  const name = uniqueEventName('Full Walkthrough')
  await createRoundsEvent(organizerPage, name)
  const eventId = organizerPage.url().match(/\/events\/([0-9a-f-]{36})$/)![1]
  const joinCode = await getJoinCode(organizerPage)

  await goToRounds(organizerPage)
  await addRound(organizerPage, { name: 'Round 1', advancementN: 2 })
  await addRound(organizerPage, { name: 'Final', isFinal: true })

  // Round 1: six questions in one segment — a correct answer, a no-show, a
  // focus-integrity return-in-time, a focus-integrity grace-timeout, a void,
  // and a tiebreak reserve question never touched by the normal reveal flow.
  await addSegmentAndOpenQuestions(organizerPage, 0, 'Segment A')
  await addQuestion(organizerPage, { prompt: 'Capital of France (Q1)', windowSeconds: 6 })
  await addAcceptableAnswerToQuestion(organizerPage, 1, 'Paris')
  await addQuestion(organizerPage, {
    prompt: 'Capital of Spain — will time out unanswered (Q2)',
    windowSeconds: 5,
  })
  await addQuestion(organizerPage, {
    prompt: 'Capital of Italy — focus-integrity return (Q3)',
    windowSeconds: 18,
  })
  await addAcceptableAnswerToQuestion(organizerPage, 3, 'Rome')
  await addQuestion(organizerPage, {
    prompt: 'Capital of Germany — focus-integrity timeout (Q4)',
    windowSeconds: 6,
  })
  await addAcceptableAnswerToQuestion(organizerPage, 4, 'Berlin')
  await addQuestion(organizerPage, { prompt: 'Void me (Q5)', windowSeconds: 20 })
  await addQuestion(organizerPage, {
    prompt: 'Sudden-death reserve question (Q6)',
    windowSeconds: 4,
    isTiebreak: true,
  })

  // Final round: one question only the real participant can answer, so it
  // alone determines the champion once round 1's tie is resolved.
  await organizerPage.goto(`/events/${eventId}/rounds`)
  await addSegmentAndOpenQuestions(organizerPage, 1, 'Final Segment')
  await addQuestion(organizerPage, {
    prompt: 'Capital of Japan — final round (Q7)',
    windowSeconds: 6,
  })
  await addAcceptableAnswerToQuestion(organizerPage, 1, 'Tokyo')

  await organizerPage.goto(`/events/${eventId}`)
  await activateEvent(organizerPage)

  await organizerPage.getByLabel("Judge's email").fill(judgeEmail)
  await organizerPage.getByRole('button', { name: 'Assign judge' }).click()
  await expect(organizerPage.getByText(/Assigned/)).toBeVisible()

  // The single real participant self-registers and is approved. A second,
  // distinct signed-in identity to genuinely race a tie isn't available —
  // the shared Playwright fixtures provide only one authenticated
  // participant account (the same gap advancement-tiebreak.spec.ts's own
  // comment documents) — so the cutoff tie below is fabricated the same
  // reviewed way that spec already does: two organizer-privileged walk-ins
  // that never submit, tying each other at 0.
  await participantPage.goto('/')
  await joinEventViaApi(participantPage, joinCode, 'Walkthrough Participant')
  await participantPage.goto(`/events/${eventId}/waiting-room`)

  await organizerPage.reload()
  await organizerPage.getByRole('button', { name: 'Approve' }).click()
  await expect(participantPage.getByText('approved', { exact: true })).toBeVisible({
    timeout: 8_000,
  })

  await createWalkInParticipant(page, eventId, 'Tied A')
  await createWalkInParticipant(page, eventId, 'Tied B')

  await goToRounds(organizerPage)
  await goToRoundLiveConsole(organizerPage, 'first')
  const round1Id = organizerPage.url().match(/\/rounds\/([0-9a-f-]{36})\/live$/)![1]

  // Q1 — a correct, in-window submit.
  await organizerPage.getByRole('button', { name: 'Reveal question' }).click()
  await expect(participantPage).toHaveURL(new RegExp(`/events/${eventId}/play$`), {
    timeout: 8_000,
  })
  await participantPage.getByLabel('Your answer').fill('Paris')
  await participantPage.getByRole('button', { name: 'Submit answer' }).click()
  await expect(participantPage.getByText(/submitted/i)).toBeVisible()
  // .last(): each closed question in this round adds its own "window
  // closed" status line, so later questions must scope to the newest one.
  await expect(organizerPage.getByText('window closed').last()).toBeVisible({ timeout: 10_000 })

  // Q2 — left unanswered; the window expires with nothing submitted, which
  // scores 0 downstream (calculate_results only sums rows that exist).
  await organizerPage.getByRole('button', { name: 'Reveal question' }).click()
  await expect(
    participantPage.getByText('Capital of Spain — will time out unanswered (Q2)'),
  ).toBeVisible({ timeout: 8_000 })
  await expect(organizerPage.getByText('window closed').last()).toBeVisible({ timeout: 10_000 })

  // Q3 — focus-integrity return-in-time: leaving and coming back before the
  // grace period expires cancels the countdown and doesn't lock the answer.
  await organizerPage.getByRole('button', { name: 'Reveal question' }).click()
  await expect(
    participantPage.getByText('Capital of Italy — focus-integrity return (Q3)'),
  ).toBeVisible({ timeout: 8_000 })
  await participantPage.getByLabel('Your answer').fill('a draft I will come back to')
  await setPageHidden(participantPage, true)
  await expect(participantPage.getByText(/auto-submits in/i)).toBeVisible()
  await setPageHidden(participantPage, false)
  await expect(participantPage.getByText(/auto-submits in/i)).not.toBeVisible()
  await expect(participantPage.getByLabel('Your answer')).toBeEnabled()
  await participantPage.getByLabel('Your answer').fill('Rome')
  await participantPage.getByRole('button', { name: 'Submit answer' }).click()
  await expect(participantPage.getByText(/submitted/i)).toBeVisible()
  await expect(organizerPage.getByText('window closed').last()).toBeVisible({ timeout: 20_000 })

  // Q4 — focus-integrity grace-timeout: leaving and never returning
  // auto-submits the draft via the grace-timeout path and locks the answer.
  await organizerPage.getByRole('button', { name: 'Reveal question' }).click()
  await expect(
    participantPage.getByText('Capital of Germany — focus-integrity timeout (Q4)'),
  ).toBeVisible({ timeout: 8_000 })
  await participantPage.getByLabel('Your answer').fill('Berlin')
  await setPageHidden(participantPage, true)
  await expect(participantPage.getByText(/auto-submits in/i)).toBeVisible()
  await expect(
    participantPage.getByText("Auto-submitted because you left the screen — you can't edit this answer anymore."),
  ).toBeVisible({ timeout: 15_000 })
  await expect(participantPage.getByLabel('Your answer')).toBeDisabled()
  await expect(organizerPage.getByText('window closed').last()).toBeVisible({ timeout: 10_000 })

  // A fresh load surfaces both this question's own answer tally and the
  // integrity-event log this grace-timeout auto-submit wrote.
  await organizerPage.reload()
  await expect(organizerPage.getByText(/1 of \d+ answered/)).toBeVisible({ timeout: 10_000 })
  await expect(organizerPage.getByText(/integrity event\(s\) logged/)).toBeVisible()

  // Q5 — voided immediately; it drops out of scoring entirely.
  await organizerPage.getByRole('button', { name: 'Reveal question' }).click()
  await organizerPage.getByRole('button', { name: 'Void question' }).click()
  await organizerPage.getByRole('dialog').getByRole('button', { name: 'Void question' }).click()
  await expect(organizerPage.getByText('voided', { exact: true })).toBeVisible()

  // The auto pre-mark matcher needs each closed question's own 10s
  // post-close grace period to have elapsed before closing the round will
  // mark it — Q4 closed most recently, so wait that out here (see
  // judge-adjudication.spec.ts for the same wait on a single question).
  await organizerPage.waitForTimeout(10_500)

  // Q6 (the tiebreak reserve) is deliberately never revealed here — it only
  // enters play later via the sudden-death draw below. Both close_round's
  // backend gate (QA12) and the live console's own completeness checks
  // exclude is_tiebreak questions from what counts as "done", so the
  // console correctly offers "Close round" once Q1–Q5 are window_closed or
  // voided, with Q6 still pending.
  await organizerPage.getByRole('button', { name: 'Close round' }).click()
  await organizerPage.getByRole('dialog').getByRole('button', { name: 'Close round' }).click()
  await expect(organizerPage.getByText(/scoring closed/)).toBeVisible()

  // Adjudicate: Q1 and Q4 stay auto pre-marked correct; Q3's auto-mark is
  // explicitly overridden to prove a judge's override — not the matcher —
  // is what final_correct reflects downstream.
  await judgePage.goto(`/events/${eventId}/rounds/${round1Id}/score`)
  await expect(scoringToggle(judgePage, 'Segment A · Q1')).toHaveText('Correct', { timeout: 15_000 })
  await expect(scoringToggle(judgePage, 'Segment A · Q4')).toHaveText('Correct')
  await scoringToggle(judgePage, 'Segment A · Q3').click()
  await expect(scoringToggle(judgePage, 'Segment A · Q3')).toHaveText('Incorrect')

  await judgePage.getByRole('button', { name: 'Save scores' }).click()
  await judgePage.getByRole('dialog').getByRole('button', { name: 'Save scores' }).click()
  await expect(judgePage.getByText('Scores saved.')).toBeVisible()

  // Reload to confirm the override persisted server-side, not just locally.
  await judgePage.reload()
  await expect(scoringToggle(judgePage, 'Segment A · Q3')).toHaveText('Incorrect')

  // Calculate: the participant scores 2 (Q1 + Q4; Q3 was overridden to
  // incorrect, Q2 never answered, Q5 voided) and ranks 1st. The two walk-ins
  // never submitted anything, tie each other at 0, and RANK()'s tie
  // semantics put them both at rank 2 — exactly the round's advancement
  // cutoff (advancementN: 2), so the second slot is genuinely contested.
  await organizerPage.goto(`/events/${eventId}`)
  await goToRounds(organizerPage)
  await organizerPage.getByRole('link', { name: 'View results' }).click()
  // Two rounds' sections are on this page now, each with its own
  // "Calculate results" button — scope to round 1's specifically.
  const round1CalculateButton = resultsCalculateButton(organizerPage, 'Round 1: Round 1')
  await round1CalculateButton.click()
  await expect(round1CalculateButton).toBeEnabled()

  const participantRow = organizerPage.getByRole('row').filter({ hasText: 'Walkthrough Participant' })
  await expect(participantRow.first().getByRole('cell').nth(0)).toHaveText('1')
  await expect(participantRow.first().getByRole('cell').nth(2)).toHaveText('2')
  const tiedRowsBefore = organizerPage.getByRole('row').filter({ hasText: /Tied [AB]/ })
  for (const row of await tiedRowsBefore.all()) {
    await expect(row.getByRole('cell').nth(0)).toHaveText('2')
    await expect(row.getByRole('cell').nth(2)).toHaveText('0')
  }

  // Advance: the tie at the cutoff (rank 2) is resolved through the
  // sudden-death reserve pool, one question at a time, same live mechanics
  // reused for the round's own questions.
  await organizerPage.goto(`/events/${eventId}/rounds/${round1Id}/advance`)
  await expect(organizerPage.getByText('2 participants are tied at rank 2')).toBeVisible()

  await organizerPage.getByRole('button', { name: 'Start tiebreak' }).click()
  await organizerPage.getByRole('dialog').getByRole('button', { name: 'Start tiebreak' }).click()
  await expect(organizerPage.getByText('Sudden death in progress')).toBeVisible()

  // First draw: neither walk-in has a session to answer with, so the
  // reserve question's window auto-closes unanswered and ties again at 0.
  await organizerPage.getByRole('button', { name: 'Draw next question' }).click()
  await expect(organizerPage.getByText('Current question: Sudden-death reserve question (Q6)')).toBeVisible()
  await expect(organizerPage.getByRole('button', { name: 'Resolve question' })).toBeEnabled({
    timeout: 8_000,
  })
  await organizerPage.getByRole('button', { name: 'Resolve question' }).click()
  await expect(organizerPage.getByText('still tied — another question was drawn')).toBeVisible()

  // Second draw: the one-question reserve pool is now exhausted — a
  // non-final round falls back to the standard co-advance rule.
  await organizerPage.getByRole('button', { name: 'Draw next question' }).click()
  await expect(
    organizerPage.getByText('The reserve pool was exhausted; the tied cohort co-advances by the standard rule.'),
  ).toBeVisible()
  const tiedRowsAfter = organizerPage.getByRole('row').filter({ hasText: /Tied [AB]/ })
  for (const row of await tiedRowsAfter.all()) {
    await expect(row.getByText('advanced', { exact: true })).toBeVisible()
  }

  await organizerPage.getByRole('button', { name: 'Advance round' }).click()
  await organizerPage.getByRole('dialog').getByRole('button', { name: 'Advance round' }).click()
  await expect(organizerPage.getByText('This round has already advanced.')).toBeVisible()

  // Final round: only the real participant can score, so they alone
  // determine the champion — no tie to resolve here.
  await organizerPage.goto(`/events/${eventId}/rounds`)
  await goToRoundLiveConsole(organizerPage, 'last')
  const round2Id = organizerPage.url().match(/\/rounds\/([0-9a-f-]{36})\/live$/)![1]

  await organizerPage.getByRole('button', { name: 'Reveal question' }).click()
  await expect(organizerPage.getByRole('button', { name: 'Void question' })).toBeVisible()
  // The round-to-round handoff relies on the participant's rounds-level
  // realtime subscription picking up TWO row updates from advance_round
  // (round 1 -> advanced, round 2 -> scoring_open) on a page that's been
  // open across the whole round-1 tiebreak sequence — a reload forces a
  // fresh fetch instead of depending on a long-lived websocket still being
  // healthy this far into the test; round-to-round handoff isn't what this
  // walkthrough is testing at this point (QB4/QB2 already cover the reveal
  // realtime path thoroughly earlier in round 1).
  await participantPage.reload()
  await expect(participantPage.getByText('Capital of Japan — final round (Q7)')).toBeVisible({
    timeout: 8_000,
  })
  await participantPage.getByLabel('Your answer').fill('Tokyo')
  await participantPage.getByRole('button', { name: 'Submit answer' }).click()
  await expect(participantPage.getByText(/submitted/i)).toBeVisible()
  await expect(organizerPage.getByText('window closed')).toBeVisible({ timeout: 10_000 })
  await organizerPage.waitForTimeout(10_500)

  await organizerPage.getByRole('button', { name: 'Close round' }).click()
  await organizerPage.getByRole('dialog').getByRole('button', { name: 'Close round' }).click()
  await expect(organizerPage.getByText(/scoring closed/)).toBeVisible()

  // calculate_results requires every answer's final_correct to be set —
  // auto_correct alone (QA7's provisional pre-mark) isn't enough — so the
  // judge still has to visit and save, even though "Tokyo" already matches
  // the one acceptable answer and needs no override.
  await judgePage.goto(`/events/${eventId}/rounds/${round2Id}/score`)
  await expect(judgePage.getByRole('button', { name: 'Correct' })).toBeVisible()
  await judgePage.getByRole('button', { name: 'Save scores' }).click()
  await judgePage.getByRole('dialog').getByRole('button', { name: 'Save scores' }).click()
  await expect(judgePage.getByText('Scores saved.')).toBeVisible()

  await organizerPage.goto(`/events/${eventId}`)
  await goToRounds(organizerPage)
  await organizerPage.getByRole('link', { name: 'View results' }).click()
  const round2CalculateButton = resultsCalculateButton(organizerPage, 'Round 2: Final')
  await round2CalculateButton.click()
  await expect(round2CalculateButton).toBeEnabled()

  await organizerPage.goto(`/events/${eventId}/rounds/${round2Id}/advance`)
  await expect(organizerPage.getByText(/tied at rank/)).toHaveCount(0)
  await organizerPage.getByRole('button', { name: 'Declare winner' }).click()
  await organizerPage.getByRole('dialog').getByRole('button', { name: 'Declare winner' }).click()
  await expect(
    organizerPage.getByText('Walkthrough Participant has been declared the winner of this event.'),
  ).toBeVisible()

  await organizerPage.goto(`/events/${eventId}`)
  await organizerPage.getByRole('button', { name: 'Conclude event' }).click()
  await expect(organizerPage.getByText('This event has concluded.')).toBeVisible()

  await deleteEventViaApi(organizerPage, eventId)
  await participantContext.close()
  await judgeContext.close()
})

// A genuine gap AdvancementPage's own logic exposes: a non-final round's
// reserve-pool exhaustion falls back to co-advancing everyone tied (covered
// by advancement-tiebreak.spec.ts and the walkthrough above), but the FINAL
// round has no such fallback — V1's events.winner_participant_id is a
// single slot with no co-champion representation, so an exhausted rank-1
// tie there stays permanently blocked instead of resolving one way or the
// other. Fabricated the same way advancement-tiebreak.spec.ts's exhaustion
// case is: two walk-ins tied at rank 1 with a one-question reserve pool
// neither can answer.
test('a rank-1 tie that exhausts the reserve pool in the final round blocks declaring a winner, with no co-champion fallback', async ({
  page,
}) => {
  const name = uniqueEventName('Final Tie Blocked')
  await createRoundsEvent(page, name)
  const eventId = page.url().match(/\/events\/([0-9a-f-]{36})$/)![1]

  await goToRounds(page)
  await addRound(page, { name: 'Final', isFinal: true })
  const roundId = await addSegmentAndOpenQuestions(page, 0, 'Segment A')
  await addQuestion(page, {
    prompt: 'Sudden-death reserve question',
    windowSeconds: 3,
    isTiebreak: true,
  })

  await page.goto(`/events/${eventId}`)
  await activateEvent(page)

  const tiedA = await createWalkInParticipant(page, eventId, 'Final Tied A')
  const tiedB = await createWalkInParticipant(page, eventId, 'Final Tied B')

  // The round's only question is the tiebreak reserve, so the live console's
  // completeness gate is vacuously satisfied — "Close round" is available
  // immediately, with nothing to reveal first.
  await goToRounds(page)
  await goToLiveConsole(page)
  await page.getByRole('button', { name: 'Close round' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Close round' }).click()
  await expect(page.getByText(/scoring closed/)).toBeVisible()

  await seedFinalCalculation(page, { eventId, roundId }, [
    { participantId: tiedA.id, totalScore: 0, rank: 1 },
    { participantId: tiedB.id, totalScore: 0, rank: 1 },
  ])

  await page.goto(`/events/${eventId}/rounds/${roundId}/advance`)
  await expect(page.getByText('2 participants are tied at rank 1')).toBeVisible()

  await page.getByRole('button', { name: 'Start tiebreak' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Start tiebreak' }).click()
  await expect(page.getByText('Sudden death in progress')).toBeVisible()

  await page.getByRole('button', { name: 'Draw next question' }).click()
  await expect(page.getByText('Current question: Sudden-death reserve question')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Resolve question' })).toBeEnabled({ timeout: 8_000 })
  await page.getByRole('button', { name: 'Resolve question' }).click()
  await expect(page.getByText('still tied — another question was drawn')).toBeVisible()

  await page.getByRole('button', { name: 'Draw next question' }).click()
  await expect(
    page.getByText(
      'The reserve pool was exhausted with the tie unresolved. V1 has no co-champion representation — resolve this outside the app before declaring a winner.',
    ),
  ).toBeVisible()

  await expect(
    page.getByText('Declaring a winner is blocked until the rank-1 tie is resolved outside the app.'),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Declare winner' })).toBeDisabled()

  await page.goto(`/events/${eventId}`)
  await expect(page.getByRole('button', { name: 'Conclude event' })).toBeDisabled()

  await deleteEventViaApi(page, eventId)
})

// Covers the plan's integrity bullet: "a rolled-back client clock cannot
// forge an in-window answer (token-elapsed governs)". submit_answer (QA6)
// takes the client's own elapsed-time claim (p_client_elapsed_ms) but backs
// it with an absolute, server-clock backstop
// (now() > revealed_at + window + grace) that no client-supplied value can
// talk its way past. Exercised directly at the RPC layer — a real client
// with a rolled-back Date would produce exactly this kind of artificially
// small p_client_elapsed_ms while real wall-clock time has long since moved
// past the window, so calling submit_answer with a forged small value well
// after the real window has closed is a faithful, deterministic stand-in
// for that scenario without needing to fight the browser's clock.
test("a forged low client-elapsed-time claim doesn't survive the server's own elapsed-time backstop", async ({
  page,
  browser,
}) => {
  const organizerPage = page
  const participantContext = await browser.newContext({
    storageState: 'playwright/.auth/participant.json',
  })
  const participantPage = await participantContext.newPage()

  const name = uniqueEventName('Clock Rollback')
  await createDraftEvent(organizerPage, name)
  const eventId = organizerPage.url().match(/\/events\/([0-9a-f-]{36})$/)![1]
  const joinCode = await getJoinCode(organizerPage)

  await goToRounds(organizerPage)
  await addRound(organizerPage, { name: 'Round 1', isFinal: true })
  await goToSegments(organizerPage)
  await addSegment(organizerPage, { name: 'Segment A' })
  await goToQuestions(organizerPage)
  await addQuestion(organizerPage, { prompt: 'Clock rollback check', windowSeconds: 3 })

  await organizerPage.goto(`/events/${eventId}`)
  await activateEvent(organizerPage)

  await participantPage.goto('/')
  await joinEventViaApi(participantPage, joinCode, 'Clock Rollback Participant')
  await participantPage.goto(`/events/${eventId}/waiting-room`)

  await organizerPage.reload()
  await organizerPage.getByRole('button', { name: 'Approve' }).click()
  await expect(participantPage.getByText('approved', { exact: true })).toBeVisible({
    timeout: 8_000,
  })

  await goToRounds(organizerPage)
  await goToLiveConsole(organizerPage)
  await organizerPage.getByRole('button', { name: 'Reveal question' }).click()
  await expect(participantPage).toHaveURL(new RegExp(`/events/${eventId}/play$`), {
    timeout: 8_000,
  })

  const questionId = await getRevealedQuestionId(participantPage, eventId)
  const revealToken = await getRevealToken(participantPage, questionId)

  // Let real wall-clock time carry the window (3s) plus submit_answer's own
  // 10s absolute grace well past closed, so the server's backstop
  // (now() > revealed_at + window + grace) is genuinely, unambiguously true
  // — no reliance on the UI's own auto-close timing.
  await expect(organizerPage.getByText('window closed')).toBeVisible({ timeout: 10_000 })
  await organizerPage.waitForTimeout(11_000)

  // A rolled-back device clock would make Date.now() - revealed_at compute
  // an artificially small elapsed time even though real time has moved on —
  // this forges exactly that low p_client_elapsed_ms directly against the
  // RPC. The server's own clock, not the client's claim, decides.
  await expect(
    callRpcViaApi(participantPage, 'submit_answer', {
      p_question_id: questionId,
      p_submitted_text: 'forged in-window answer',
      p_client_elapsed_ms: 100,
      p_reveal_token: revealToken,
      p_is_saved_draft: false,
    }),
  ).rejects.toThrow(/unrecoverably late/)

  await deleteEventViaApi(organizerPage, eventId)
  await participantContext.close()
})

// Reads the currently revealed question's id off the participant's own
// live-answer screen via a REST GET (no shared helper does a plain read),
// authorized with the participant's own session the same way every write
// helper in helpers.ts reads its access token out of localStorage.
async function getRevealedQuestionId(page: Page, eventId: string): Promise<string> {
  const rows = await restSelect<{ id: string }>(page, 'questions', {
    select: 'id,revealed_at',
    order: 'revealed_at.desc.nullslast',
    limit: '1',
  })
  if (rows.length === 0) throw new Error(`No revealed question found for event ${eventId}`)
  return rows[0].id
}

async function getRevealToken(page: Page, questionId: string): Promise<string> {
  const rows = await restSelect<{ reveal_token: string }>(page, 'questions', {
    id: `eq.${questionId}`,
    select: 'reveal_token',
  })
  if (rows.length === 0 || !rows[0].reveal_token) {
    throw new Error(`Question ${questionId} has no reveal_token`)
  }
  return rows[0].reveal_token
}

async function restSelect<T>(page: Page, table: string, params: Record<string, string>): Promise<T[]> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) {
    throw new Error('VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY are required to call the API')
  }
  const accessToken = await page.evaluate(() => {
    const storageKey = Object.keys(localStorage).find((k) => k.startsWith('sb-') && k.endsWith('-auth-token'))
    if (!storageKey) return null
    const raw = localStorage.getItem(storageKey)
    return raw ? (JSON.parse(raw).access_token as string) : null
  })
  if (!accessToken) {
    throw new Error('No Supabase session found in localStorage to authorize the request')
  }

  const query = new URLSearchParams(params).toString()
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}?${query}`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    throw new Error(`Select from ${table} failed via API: ${res.status} ${await res.text()}`)
  }
  return (await res.json()) as T[]
}

// Covers the plan's "no-rounds regression": createDraftEvent (the shared
// helper every non-elimination spec in this suite relies on) leaves
// has_rounds: false, and every one of those specs already exercises the
// full reveal → answer → close → score cycle against the single implicit
// round it collapses to — so the collapse itself is already proven
// pervasively. What's new here is T28's has_rounds-gated rendering: the
// results screen hides the per-round board and heading for a no-rounds
// event, showing only the flat segment board (ResultsPage.tsx).
test('a has_rounds:false quiz collapses to one implicit round, and results renders the flat segment board with no round heading or round leaderboard', async ({
  page,
  browser,
}) => {
  const organizerPage = page
  const participantContext = await browser.newContext({
    storageState: 'playwright/.auth/participant.json',
  })
  const participantPage = await participantContext.newPage()
  const judgeContext = await browser.newContext({
    storageState: 'playwright/.auth/judge.json',
  })
  const judgePage = await judgeContext.newPage()

  const name = uniqueEventName('No Rounds Regression')
  await createDraftEvent(organizerPage, name)
  const eventId = organizerPage.url().match(/\/events\/([0-9a-f-]{36})$/)![1]
  const joinCode = await getJoinCode(organizerPage)

  await goToRounds(organizerPage)
  await addRound(organizerPage, { name: 'Round 1', isFinal: true })
  await goToSegments(organizerPage)
  await addSegment(organizerPage, { name: 'Trivia' })
  await goToQuestions(organizerPage)
  await addQuestion(organizerPage, { prompt: 'Capital of Portugal', windowSeconds: 5 })
  await addAcceptableAnswer(organizerPage, { value: 'Lisbon' })

  await organizerPage.goto(`/events/${eventId}`)
  await activateEvent(organizerPage)

  await organizerPage.getByLabel("Judge's email").fill(judgeEmail)
  await organizerPage.getByRole('button', { name: 'Assign judge' }).click()
  await expect(organizerPage.getByText(/Assigned/)).toBeVisible()

  await participantPage.goto('/')
  await joinEventViaApi(participantPage, joinCode, 'No Rounds Participant')
  await participantPage.goto(`/events/${eventId}/waiting-room`)

  await organizerPage.reload()
  await organizerPage.getByRole('button', { name: 'Approve' }).click()
  await expect(participantPage.getByText('approved', { exact: true })).toBeVisible({
    timeout: 8_000,
  })

  await goToRounds(organizerPage)
  await goToLiveConsole(organizerPage)
  await organizerPage.getByRole('button', { name: 'Reveal question' }).click()
  await expect(participantPage).toHaveURL(new RegExp(`/events/${eventId}/play$`), {
    timeout: 8_000,
  })
  await participantPage.getByLabel('Your answer').fill('Lisbon')
  await participantPage.getByRole('button', { name: 'Submit answer' }).click()
  await expect(participantPage.getByText(/submitted/i)).toBeVisible()
  await expect(organizerPage.getByText('window closed')).toBeVisible({ timeout: 10_000 })
  // The auto pre-mark matcher needs its own post-close grace period before
  // it will mark the answer (closing the round is what invokes it — see
  // judge-adjudication.spec.ts for the same wait).
  await organizerPage.waitForTimeout(10_500)

  await organizerPage.getByRole('button', { name: 'Close round' }).click()
  await organizerPage.getByRole('dialog').getByRole('button', { name: 'Close round' }).click()
  await expect(organizerPage.getByText(/scoring closed/)).toBeVisible()

  // The auto pre-mark matcher (QA7) sets auto_correct at round-close time,
  // but calculate_results still requires every answer's final_correct to be
  // set before it will run — a judge has to visit and save at least once,
  // even to just confirm the auto-mark, same as every other spec that goes
  // on to calculate results.
  const roundId = organizerPage.url().match(/\/rounds\/([0-9a-f-]{36})\/live$/)![1]
  await judgePage.goto(`/events/${eventId}/rounds/${roundId}/score`)
  await expect(judgePage.getByRole('button', { name: 'Correct' })).toBeVisible()
  await judgePage.getByRole('button', { name: 'Save scores' }).click()
  await judgePage.getByRole('dialog').getByRole('button', { name: 'Save scores' }).click()
  await expect(judgePage.getByText('Scores saved.')).toBeVisible()

  await organizerPage.goto(`/events/${eventId}`)
  await goToRounds(organizerPage)
  await organizerPage.getByRole('link', { name: 'View results' }).click()
  await organizerPage.getByRole('button', { name: 'Calculate results' }).click()
  await expect(organizerPage.getByRole('button', { name: 'Calculate results' })).toBeEnabled()

  await expect(organizerPage.getByRole('heading', { name: 'Trivia' })).toBeVisible()
  const row = organizerPage.getByRole('row').filter({ hasText: 'No Rounds Participant' })
  await expect(row).toHaveCount(1)
  await expect(row.getByRole('cell').nth(0)).toHaveText('1')
  await expect(row.getByRole('cell').nth(2)).toHaveText('1')

  // has_rounds: false hides both the "Round 1: ..." heading and the round
  // leaderboard board — only the flat segment board renders.
  await expect(organizerPage.getByText(/^Round 1:/)).toHaveCount(0)
  await expect(organizerPage.getByRole('heading', { name: 'Round leaderboard' })).toHaveCount(0)

  await deleteEventViaApi(organizerPage, eventId)
  await participantContext.close()
  await judgeContext.close()
})
