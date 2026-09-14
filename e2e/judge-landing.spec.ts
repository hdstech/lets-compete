import { expect, test } from '@playwright/test'
import {
  activateEvent,
  addRound,
  callRpcViaApi,
  createDraftEvent,
  deleteEventViaApi,
  goToRounds,
  uniqueEventName,
} from './helpers'

test.setTimeout(90_000)

const judgeEmail =
  process.env.E2E_JUDGE_EMAIL ?? 'playwright-e2e-judge@example.com'

test('judge sees assigned events and scores ready rounds', async ({
  page,
  browser,
}) => {
  const organizerContext = await browser.newContext({
    storageState: 'playwright/.auth/organizer.json',
  })
  const organizerPage = await organizerContext.newPage()
  const eventIds: string[] = []

  try {
    const assignedName = uniqueEventName('Judge Landing')
    await createDraftEvent(organizerPage, assignedName)
    const assignedEventId = organizerPage
      .url()
      .match(/\/events\/([0-9a-f-]{36})$/)![1]
    eventIds.push(assignedEventId)

    await goToRounds(organizerPage)
    await addRound(organizerPage, { name: 'Opening round', isFinal: true })
    await organizerPage.goto(`/events/${assignedEventId}`)
    await activateEvent(organizerPage)
    await callRpcViaApi(organizerPage, 'assign_grader', {
      p_event_id: assignedEventId,
      p_email: judgeEmail,
    })

    await organizerPage.goto(`/events/${assignedEventId}/rounds`)
    const liveHref = await organizerPage
      .getByRole('link', { name: 'Live console', exact: true })
      .getAttribute('href')
    const roundId = liveHref?.match(/\/rounds\/([0-9a-f-]{36})\/live$/)?.[1]
    expect(roundId).toBeTruthy()

    await page.goto('/judge')
    await expect(page.getByText(assignedName, { exact: true })).toBeVisible()
    await page
      .getByText(assignedName, { exact: true })
      .locator('..')
      .locator('..')
      .getByRole('link', { name: 'View rounds' })
      .click()
    await expect(page).toHaveURL(`/events/${assignedEventId}/judge`)
    await expect(page.getByText('Opening round')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Score round' })).toHaveCount(0)
    await expect(page.getByText('Not ready to score yet')).toBeVisible()

    await callRpcViaApi(organizerPage, 'close_round', {
      p_round_id: roundId,
    })
    await page.getByRole('button', { name: 'Refresh' }).click()
    const scoreLink = page.getByRole('link', { name: 'Score round' })
    await expect(scoreLink).toBeVisible()
    await scoreLink.click()
    await expect(page).toHaveURL(
      `/events/${assignedEventId}/rounds/${roundId}/score`,
    )
    await expect(page.getByRole('heading', { name: /Score — Round 1/ })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Back to rounds' })).toHaveAttribute(
      'href',
      `/events/${assignedEventId}/judge`,
    )

    const unassignedName = uniqueEventName('Not Judge')
    await createDraftEvent(organizerPage, unassignedName)
    const unassignedEventId = organizerPage
      .url()
      .match(/\/events\/([0-9a-f-]{36})$/)![1]
    eventIds.push(unassignedEventId)

    await page.goto(`/events/${unassignedEventId}/judge`)
    await expect(
      page.getByText("You're not the judge for this event"),
    ).toBeVisible()
    await expect(page.getByRole('link', { name: 'Back to your events' })).toHaveAttribute(
      'href',
      '/judge',
    )
  } finally {
    for (const eventId of eventIds) {
      await deleteEventViaApi(organizerPage, eventId)
    }
    await organizerContext.close()
  }
})
