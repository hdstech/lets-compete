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
  await page.getByRole('button', { name: 'Delete event' }).click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Delete event' })
    .click()
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

// Assumes the current page is a round's rounds list, with exactly one
// "Manage segments" link (i.e. exactly one round configured).
export async function goToSegments(page: Page) {
  await page.getByRole('link', { name: 'Manage segments' }).click()
  await page.waitForURL(/\/events\/[0-9a-f-]{36}\/rounds\/[0-9a-f-]{36}\/segments$/)
}

export async function addSegment(page: Page, options: { name: string; sequence?: number }) {
  await page.getByLabel('Segment name').fill(options.name)
  if (options.sequence !== undefined) {
    await page.getByLabel('Sequence').fill(String(options.sequence))
  }
  await page.getByRole('button', { name: 'Add segment' }).click()
  // Same async-settle rationale as addRound: wait for the submit control to
  // reappear before returning, so callers can safely chain another call.
  await expect(page.getByRole('button', { name: 'Add segment' })).toBeVisible()
}

// Assumes the current page is a segments list, with exactly one
// "Manage questions" link (i.e. exactly one segment configured).
export async function goToQuestions(page: Page) {
  await page.getByRole('link', { name: 'Manage questions' }).click()
  await page.waitForURL(
    /\/events\/[0-9a-f-]{36}\/rounds\/[0-9a-f-]{36}\/segments\/[0-9a-f-]{36}\/questions$/,
  )
}

export async function addQuestion(
  page: Page,
  options: {
    prompt: string
    answerType?: 'text' | 'numeric'
    windowSeconds?: number
    sequence?: number
    isTiebreak?: boolean
  },
) {
  await page.getByLabel('Prompt').fill(options.prompt)
  if (options.answerType === 'numeric') {
    await page.getByRole('radio', { name: 'Numeric' }).first().check()
  }
  if (options.windowSeconds !== undefined) {
    await page.getByLabel('Answer window (seconds)').fill(String(options.windowSeconds))
  }
  if (options.sequence !== undefined) {
    await page.getByLabel('Sequence').fill(String(options.sequence))
  }
  if (options.isTiebreak) {
    await page.getByLabel('Tiebreak reserve pool question').check()
  }
  await page.getByRole('button', { name: 'Add question' }).click()
  await expect(page.getByRole('button', { name: 'Add question' })).toBeVisible()
}

// Assumes the current page shows exactly one question card (i.e. exactly
// one question authored so far), and adds an acceptable answer to it.
export async function addAcceptableAnswer(
  page: Page,
  options: { value: string; isNumeric?: boolean },
) {
  await page.getByPlaceholder('Acceptable answer value').fill(options.value)
  if (options.isNumeric) {
    await page.getByRole('checkbox', { name: 'Numeric' }).check()
  }
  await page.getByRole('button', { name: 'Add answer' }).click()
  await expect(page.getByRole('button', { name: 'Add answer' })).toBeVisible()
}
