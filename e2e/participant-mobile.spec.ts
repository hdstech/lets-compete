import { expect, test } from '@playwright/test'
import {
  activateEvent,
  addQuestion,
  addRound,
  addSegment,
  createDraftEvent,
  deleteEventViaApi,
  expectMinTapSize,
  expectNoHorizontalOverflow,
  getJoinCode,
  goToLiveConsole,
  goToQuestions,
  goToRounds,
  goToSegments,
  joinEventViaApi,
  uniqueEventName,
} from './helpers'

const IPHONE = { width: 375, height: 812 }
const SMALL_PHONE = { width: 320, height: 568 }

test.setTimeout(60_000)

test('join screen fits a phone without horizontal scroll or tiny tap targets', async ({
  browser,
}) => {
  const context = await browser.newContext({
    baseURL: 'http://localhost:5173',
    storageState: { cookies: [], origins: [] },
  })
  const page = await context.newPage()

  for (const viewport of [IPHONE, SMALL_PHONE]) {
    await page.setViewportSize(viewport)
    await page.goto('/join')
    await expect(page.getByRole('heading', { name: 'Join an event' })).toBeVisible()
    await expectNoHorizontalOverflow(page)

    const joinCode = page.getByLabel('Join code (participants only)')
    const fontSize = await joinCode.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
    expect(fontSize, 'inputs must stay ≥16px so iOS does not zoom on focus').toBeGreaterThanOrEqual(
      16,
    )

    await expectMinTapSize(page.getByRole('button', { name: 'Email me a sign-in link' }))
  }

  await context.close()
})

test('live answering is usable on a phone: no overflow, sticky submit, numeric keypad', async ({
  page,
  browser,
}) => {
  await page.setViewportSize(IPHONE)

  const organizerContext = await browser.newContext({
    storageState: 'playwright/.auth/organizer.json',
  })
  const organizerPage = await organizerContext.newPage()

  const name = uniqueEventName('Mobile Answer')
  await createDraftEvent(organizerPage, name)
  const eventId = organizerPage.url().match(/\/events\/([0-9a-f-]{36})$/)![1]
  const joinCode = await getJoinCode(organizerPage)

  await goToRounds(organizerPage)
  await addRound(organizerPage, { name: 'Round 1', isFinal: true })
  await goToSegments(organizerPage)
  await addSegment(organizerPage, { name: 'Segment A' })
  await goToQuestions(organizerPage)
  await addQuestion(organizerPage, {
    prompt: 'How many books are in the New Testament?',
    answerType: 'numeric',
    windowSeconds: 20,
  })

  await organizerPage.goto(`/events/${eventId}`)
  await activateEvent(organizerPage)

  await page.goto('/')
  await joinEventViaApi(page, joinCode, 'Mobile Participant')
  await page.goto(`/events/${eventId}/waiting-room`)
  await expect(page.getByText('pending', { exact: true })).toBeVisible()
  await expectNoHorizontalOverflow(page)

  await organizerPage.reload()
  await organizerPage.getByRole('button', { name: 'Approve' }).click()
  await expect(page.getByText('approved', { exact: true })).toBeVisible({ timeout: 8_000 })

  await goToRounds(organizerPage)
  await goToLiveConsole(organizerPage)
  await organizerPage.getByRole('button', { name: 'Reveal question' }).click()

  await expect(page).toHaveURL(new RegExp(`/events/${eventId}/play$`), { timeout: 8_000 })
  await expect(page.getByText('How many books are in the New Testament?')).toBeVisible()
  await expectNoHorizontalOverflow(page)

  const answer = page.getByLabel('Your answer')
  await expect(answer).toHaveAttribute('inputmode', 'decimal')
  const fontSize = await answer.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
  expect(fontSize).toBeGreaterThanOrEqual(16)

  const submit = page.getByRole('button', { name: 'Submit answer' })
  await expect(submit).toBeVisible()
  await expectMinTapSize(submit)

  const submitBox = await submit.boundingBox()
  expect(submitBox, 'submit should stay on screen at 375×812').toBeTruthy()
  expect(submitBox!.y + submitBox!.height).toBeLessThanOrEqual(IPHONE.height)

  await answer.fill('27')
  await submit.click()
  await expect(page.getByText(/submitted/i)).toBeVisible()

  await page.setViewportSize(SMALL_PHONE)
  await expectNoHorizontalOverflow(page)

  await deleteEventViaApi(organizerPage, eventId)
  await organizerContext.close()
})
