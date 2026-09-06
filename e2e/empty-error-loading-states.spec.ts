import { expect, test } from '@playwright/test'
import { createDraftEvent, deleteCurrentEvent, goToRounds, uniqueEventName } from './helpers'

// Covers T32 (empty/error/loading states): a failed load surfaces a
// readable message with a "Try again" retry, and retrying re-fetches
// successfully once the backend recovers. Exercised on two different pages
// (events list, rounds list) since both route through the same shared
// ErrorState/retry pattern introduced by T32 — this is a proxy for every
// other admin list page built the same way, so it isn't repeated per page.
//
// The route mock fails every matching GET while `shouldFail` is true, not
// just the first — dev-mode effect double-invocation plus the auth-loading
// transition can fire more than one request for the same fetch, and failing
// only the first would race against a later one quietly succeeding.

test('a failed events fetch shows a retry that recovers', async ({ page }) => {
  let shouldFail = true
  await page.route('**/rest/v1/events*', async (route) => {
    if (shouldFail && route.request().method() === 'GET') {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Simulated fetch failure' }),
      })
      return
    }
    await route.continue()
  })

  await page.goto('/events')
  await expect(page.getByRole('alert')).toContainText('Simulated fetch failure')

  shouldFail = false
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'New event' })).toBeVisible()
})

test('a failed rounds fetch shows a retry that recovers', async ({ page }) => {
  const name = uniqueEventName('Rounds Retry')
  await createDraftEvent(page, name)
  await goToRounds(page)

  let shouldFail = true
  await page.route('**/rest/v1/rounds*', async (route) => {
    if (shouldFail && route.request().method() === 'GET') {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Simulated fetch failure' }),
      })
      return
    }
    await route.continue()
  })

  await page.reload()
  await expect(page.getByRole('alert')).toContainText('Simulated fetch failure')

  shouldFail = false
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByText('No rounds yet.')).toBeVisible()

  await page.getByRole('link', { name: 'Back to event' }).click()
  await deleteCurrentEvent(page)
})
