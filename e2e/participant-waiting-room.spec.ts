import { expect, test } from '@playwright/test'
import {
  createDraftEvent,
  deleteEventViaApi,
  getJoinCode,
  joinEventViaApi,
  uniqueEventName,
} from './helpers'

// Covers QB3 (participant join/self-register + waiting-room dashboard)
// against the real Supabase backend. Runs under the 'participant' project
// (see playwright.config.ts), whose page is pre-authenticated as the e2e
// participant account by participant.setup.ts. Organizer-side actions
// (creating the event, reading the join code, approving/revoking) use a
// second browser context authenticated as the e2e organizer, since a single
// page can only hold one Supabase session at a time.

test('participant self-registers, waits for approval, and sees it live once approved', async ({
  page,
  browser,
}) => {
  const organizerContext = await browser.newContext({
    storageState: 'playwright/.auth/organizer.json',
  })
  const organizerPage = await organizerContext.newPage()

  const name = uniqueEventName('Waiting Room')
  await createDraftEvent(organizerPage, name)
  const eventId = organizerPage.url().match(/\/events\/([0-9a-f-]{36})$/)![1]
  const joinCode = await getJoinCode(organizerPage)

  // localStorage isn't readable on Playwright's initial about:blank page —
  // navigate into the app's origin first.
  await page.goto('/')
  await joinEventViaApi(page, joinCode, 'Test Participant')

  await page.goto(`/events/${eventId}/waiting-room`)
  await expect(page.getByText('pending', { exact: true })).toBeVisible()
  await expect(page.getByText(/waiting for the organizer/i)).toBeVisible()

  await organizerPage.reload()
  await expect(organizerPage.getByText('Test Participant')).toBeVisible()
  await organizerPage.getByRole('button', { name: 'Approve' }).click()

  await expect(page.getByText('approved', { exact: true })).toBeVisible({ timeout: 8_000 })
  await expect(page.getByText(/you're in/i)).toBeVisible()

  await deleteEventViaApi(organizerPage, eventId)
  await organizerContext.close()
})

test('revoking a participant reflects live in their waiting room', async ({ page, browser }) => {
  const organizerContext = await browser.newContext({
    storageState: 'playwright/.auth/organizer.json',
  })
  const organizerPage = await organizerContext.newPage()

  const name = uniqueEventName('Waiting Room Revoke')
  await createDraftEvent(organizerPage, name)
  const eventId = organizerPage.url().match(/\/events\/([0-9a-f-]{36})$/)![1]
  const joinCode = await getJoinCode(organizerPage)

  // localStorage isn't readable on Playwright's initial about:blank page —
  // navigate into the app's origin first.
  await page.goto('/')
  await joinEventViaApi(page, joinCode, 'Test Participant Two')

  await page.goto(`/events/${eventId}/waiting-room`)
  await expect(page.getByText('pending', { exact: true })).toBeVisible()

  await organizerPage.reload()
  await organizerPage.getByRole('button', { name: 'Approve' }).click()
  await expect(organizerPage.getByText('approved', { exact: true })).toBeVisible()

  await organizerPage.getByRole('button', { name: 'Revoke' }).click()
  await organizerPage.getByRole('dialog').getByRole('button', { name: 'Revoke' }).click()

  await expect(page.getByText('revoked', { exact: true })).toBeVisible({ timeout: 8_000 })
  await expect(page.getByText(/weren't admitted/i)).toBeVisible()

  await deleteEventViaApi(organizerPage, eventId)
  await organizerContext.close()
})
