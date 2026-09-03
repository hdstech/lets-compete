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

// Assumes the current page is an event's detail page, in draft status with
// at least one round already configured.
export async function activateEvent(page: Page) {
  await page.getByRole('button', { name: 'Activate event' }).click()
  // StatusBadge renders the raw event.status ("active") and CSS-capitalizes
  // it for display, so the accessible/DOM text is lowercase.
  await expect(page.getByText('active', { exact: true })).toBeVisible()
}

// Assumes the current page is a round's rounds list, with exactly one
// "Live console" link (i.e. the event is active).
export async function goToLiveConsole(page: Page) {
  await page.getByRole('link', { name: 'Live console' }).click()
  await page.waitForURL(
    /\/events\/[0-9a-f-]{36}\/rounds\/[0-9a-f-]{36}\/live$/,
  )
}

// Deletes an event directly via the Supabase REST API rather than through
// the UI. Once an event is activated it has no delete affordance in the
// UI (draft-only, deliberately — see rounds-crud.spec.ts), but RLS's
// events_delete_organizer policy doesn't share that draft-only restriction,
// so an authenticated organizer can still delete an active event over the
// API. This is the only way to clean up an event this suite has to activate
// (e.g. to reach the live quiz console, which only appears once a round is
// scoring_open) without leaving an un-cleanable row behind.
export async function deleteEventViaApi(page: Page, eventId: string) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) {
    throw new Error('VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY are required to clean up via the API')
  }

  const accessToken = await page.evaluate(() => {
    const storageKey = Object.keys(localStorage).find((k) => k.startsWith('sb-') && k.endsWith('-auth-token'))
    if (!storageKey) return null
    const raw = localStorage.getItem(storageKey)
    return raw ? (JSON.parse(raw).access_token as string) : null
  })
  if (!accessToken) {
    throw new Error('No Supabase session found in localStorage to authorize the cleanup request')
  }

  const res = await fetch(`${supabaseUrl}/rest/v1/events?id=eq.${eventId}`, {
    method: 'DELETE',
    headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    throw new Error(`Failed to delete event ${eventId} via API: ${res.status} ${await res.text()}`)
  }
}

// Assumes the current page is an event's detail page — reads the join code
// shown there (the only <code> element on the page).
export async function getJoinCode(page: Page): Promise<string> {
  return page.locator('code').innerText()
}

// Simulates the tab going into the background (an app switch, a tab
// switch) for focus-integrity tests. Real OS-level backgrounding isn't
// something Playwright can trigger directly, so this overrides
// `document.visibilityState` and fires the same `visibilitychange` event
// the page's own listener reacts to.
export async function setPageHidden(page: Page, hidden: boolean) {
  await page.evaluate((h) => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => (h ? 'hidden' : 'visible'),
    })
    document.dispatchEvent(new Event('visibilitychange'))
  }, hidden)
}

// Registers `page`'s already-authenticated user as a participant via the
// join_event RPC directly over the REST API, rather than through JoinPage's
// UI. JoinPage's OTP flow only runs for a session-less browser (it redirects
// straight to /dashboard once a session exists — see App.tsx's Home), and
// the e2e participant session is pre-authenticated by participant.setup.ts,
// so this is the only way to drive a fresh join_event call in these specs.
export async function joinEventViaApi(
  page: Page,
  joinCode: string,
  name: string,
  type: 'individual' | 'team' = 'individual',
): Promise<{ id: string; event_id: string }> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) {
    throw new Error('VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY are required to join via the API')
  }

  const accessToken = await page.evaluate(() => {
    const storageKey = Object.keys(localStorage).find((k) => k.startsWith('sb-') && k.endsWith('-auth-token'))
    if (!storageKey) return null
    const raw = localStorage.getItem(storageKey)
    return raw ? (JSON.parse(raw).access_token as string) : null
  })
  if (!accessToken) {
    throw new Error('No Supabase session found in localStorage to authorize the join request')
  }

  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/join_event`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_join_code: joinCode, p_name: name, p_type: type }),
  })
  if (!res.ok) {
    throw new Error(`Failed to join event via API: ${res.status} ${await res.text()}`)
  }
  return (await res.json()) as { id: string; event_id: string }
}
