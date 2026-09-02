import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

export function uniqueEventName(label: string) {
  return `${label} ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export async function createDraftEvent(page: Page, name: string) {
  await page.goto('/events/new')
  await page.getByLabel('Event name').fill(name)
  await page.getByRole('button', { name: 'Create event' }).click()
  await page.waitForURL(/\/events\/[0-9a-f-]{36}$/)
}

// Assumes the current page is an event's detail page.
export async function deleteCurrentEvent(page: Page) {
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Delete event' }).click()
  await page.waitForURL('**/events')
}

// Assumes the current page is an event's detail page.
export async function goToRounds(page: Page) {
  await page.getByRole('link', { name: 'Manage rounds' }).click()
  await page.waitForURL(/\/events\/[0-9a-f-]{36}\/rounds$/)
}

export async function addRound(
  page: Page,
  options: { name: string; sequence?: number; advancementN?: number; isFinal?: boolean },
) {
  await page.getByLabel('Round name').fill(options.name)
  if (options.sequence !== undefined) {
    await page.getByLabel('Sequence').fill(String(options.sequence))
  }
  if (options.isFinal) {
    await page.getByLabel('This is the final round').check()
  } else if (options.advancementN !== undefined) {
    await page.getByLabel('Participants advancing').fill(String(options.advancementN))
  }
  await page.getByRole('button', { name: 'Add round' }).click()
  // The submit is async (insert + refetch); wait for it to settle — success
  // or failure — before returning, so callers can safely chain another
  // addRound() without racing this one's in-flight request.
  await expect(page.getByRole('button', { name: 'Add round' })).toBeVisible()
}
