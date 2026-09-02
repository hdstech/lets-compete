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
