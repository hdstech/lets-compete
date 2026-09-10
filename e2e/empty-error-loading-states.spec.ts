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

// T38 (system feedback): the classifier only rewrites errors whose raw text
// tells the user nothing. The two tests above already pin the other half of
// that contract — a server-authored message reaches the UI verbatim — so
// these cover the rewriting side and the realtime-dropout signal.

// Slow by construction: supabase-js retries a transport failure, so the
// failure only becomes visible once src/lib/supabase.ts's per-request
// timeout gives up. That wait is the behaviour under test — before the
// timeout existed the request never settled at all and this page spun
// forever with no error to catch.
test('a dropped connection reads as connection copy, not "Failed to fetch"', async ({
  page,
}) => {
  test.setTimeout(90_000)

  let shouldFail = true
  await page.route('**/rest/v1/events*', async (route) => {
    if (shouldFail && route.request().method() === 'GET') {
      // A transport-level failure, which is what an actual dropped
      // connection produces — the browser surfaces it to fetch() as
      // `TypeError: Failed to fetch`.
      await route.abort('failed')
      return
    }
    await route.continue()
  })

  await page.goto('/events')

  const alert = page.getByRole('alert')
  await expect(alert).toContainText('Check your connection', { timeout: 60_000 })
  await expect(alert).not.toContainText('Failed to fetch')

  shouldFail = false
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'New event' })).toBeVisible()
})

test('a dead realtime socket is called out instead of looking like a quiet event', async ({
  page,
}) => {
  // Closing the socket as soon as it opens is what a lost connection looks
  // like to the client: the channel never reaches SUBSCRIBED, so without
  // T38's status handling the participants list would simply stop updating
  // with nothing on screen to say so.
  await page.routeWebSocket('**/realtime/v1/**', (ws) => {
    ws.close()
  })

  const name = uniqueEventName('Realtime Drop')
  await createDraftEvent(page, name)

  await expect(page.getByText('Live updates interrupted')).toBeVisible({ timeout: 15_000 })

  await deleteCurrentEvent(page)
})
