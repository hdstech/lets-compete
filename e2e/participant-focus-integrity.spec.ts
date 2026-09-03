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
  setPageHidden,
  uniqueEventName,
} from './helpers'

// Covers QB5 (focus-integrity layer) against the real Supabase backend: the
// grace-then-submit countdown that visibilitychange/pagehide/blur arm on
// the live-answer screen (QB4), and the integrity log (QA1's
// integrity_events) it writes to for the grader. beforeunload's native
// "leave site?" warning is browser-owned and not exercised here — it's a
// one-line preventDefault()/returnValue call, verified by inspection rather
// than by fighting Chromium's dialog automation in CI.

test.setTimeout(90_000)

test('returning before the grace period expires cancels the countdown', async ({ page, browser }) => {
  const organizerContext = await browser.newContext({
    storageState: 'playwright/.auth/organizer.json',
  })
  const organizerPage = await organizerContext.newPage()

  const name = uniqueEventName('Focus Integrity Return')
  await createDraftEvent(organizerPage, name)
  const eventId = organizerPage.url().match(/\/events\/([0-9a-f-]{36})$/)![1]
  const joinCode = await getJoinCode(organizerPage)

  await goToRounds(organizerPage)
  await addRound(organizerPage, { name: 'Round 1', isFinal: true })
  await goToSegments(organizerPage)
  await addSegment(organizerPage, { name: 'Segment A' })
  await goToQuestions(organizerPage)
  await addQuestion(organizerPage, { prompt: 'Focus integrity — return in time', windowSeconds: 30 })

  await organizerPage.goto(`/events/${eventId}`)
  await activateEvent(organizerPage)

  await page.goto('/')
  await joinEventViaApi(page, joinCode, 'Focus Integrity Participant')
  await page.goto(`/events/${eventId}/waiting-room`)

  await organizerPage.reload()
  await organizerPage.getByRole('button', { name: 'Approve' }).click()
  await expect(page.getByText('approved', { exact: true })).toBeVisible({ timeout: 8_000 })

  await goToRounds(organizerPage)
  await goToLiveConsole(organizerPage)
  await organizerPage.getByRole('button', { name: 'Reveal question' }).click()

  await expect(page).toHaveURL(new RegExp(`/events/${eventId}/play$`), { timeout: 8_000 })
  await page.getByLabel('Your answer').fill('a draft I will come back to')

  await setPageHidden(page, true)
  await expect(page.getByText(/auto-submits in/i)).toBeVisible()

  await setPageHidden(page, false)
  await expect(page.getByText(/auto-submits in/i)).not.toBeVisible()

  // Returning in time doesn't lock or auto-submit — editing continues
  // normally and the draft is still just a draft.
  await expect(page.getByLabel('Your answer')).toBeEnabled()
  await expect(page.getByText('Not yet submitted.')).toBeVisible()

  await deleteEventViaApi(organizerPage, eventId)
  await organizerContext.close()
})

test('leaving the screen past the grace period auto-submits the draft and locks the question', async ({
  page,
  browser,
}) => {
  const organizerContext = await browser.newContext({
    storageState: 'playwright/.auth/organizer.json',
  })
  const organizerPage = await organizerContext.newPage()

  const name = uniqueEventName('Focus Integrity Auto-submit')
  await createDraftEvent(organizerPage, name)
  const eventId = organizerPage.url().match(/\/events\/([0-9a-f-]{36})$/)![1]
  const joinCode = await getJoinCode(organizerPage)

  await goToRounds(organizerPage)
  await addRound(organizerPage, { name: 'Round 1', isFinal: true })
  await goToSegments(organizerPage)
  await addSegment(organizerPage, { name: 'Segment A' })
  await goToQuestions(organizerPage)
  // A short window bounds the grace period (min(grace, time left in the
  // window)) to a few seconds so the test doesn't have to wait out the
  // full default grace.
  await addQuestion(organizerPage, { prompt: 'Focus integrity — timeout', windowSeconds: 6 })

  await organizerPage.goto(`/events/${eventId}`)
  await activateEvent(organizerPage)

  await page.goto('/')
  await joinEventViaApi(page, joinCode, 'Focus Integrity Timeout Participant')
  await page.goto(`/events/${eventId}/waiting-room`)

  await organizerPage.reload()
  await organizerPage.getByRole('button', { name: 'Approve' }).click()
  await expect(page.getByText('approved', { exact: true })).toBeVisible({ timeout: 8_000 })

  await goToRounds(organizerPage)
  await goToLiveConsole(organizerPage)
  await organizerPage.getByRole('button', { name: 'Reveal question' }).click()

  await expect(page).toHaveURL(new RegExp(`/events/${eventId}/play$`), { timeout: 8_000 })
  await page.getByLabel('Your answer').fill('auto submit me')

  await setPageHidden(page, true)
  await expect(page.getByText(/auto-submits in/i)).toBeVisible()

  // Don't return — let the (bounded, ~6s) grace period time out.
  await expect(
    page.getByText("Auto-submitted because you left the screen — you can't edit this answer anymore."),
  ).toBeVisible({ timeout: 15_000 })
  await expect(page.getByLabel('Your answer')).toBeDisabled()

  // A fresh load re-fetches both the answers and the integrity log in one
  // request each (see LiveConsolePage's initial-load effect) — more
  // reliable here than waiting on realtime propagation, which isn't what
  // this test is about.
  await organizerPage.reload()
  await expect(organizerPage.getByText(/1 of \d+ answered/)).toBeVisible({ timeout: 10_000 })
  await expect(organizerPage.getByText(/integrity event\(s\) logged/)).toBeVisible()

  await deleteEventViaApi(organizerPage, eventId)
  await organizerContext.close()
})
