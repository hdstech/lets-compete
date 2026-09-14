import { expect, test } from '@playwright/test'
import {
  createDraftEvent,
  deleteCurrentEvent,
  getAccessToken,
  getUserId,
  uniqueEventName,
} from './helpers'

// QA19 · Organizer flag. Unlike the rest of the suite, these specs create
// brand-new accounts — the thing under test is what signup does — so they
// start with no stored session and delete every account they create with the
// secret key, rather than leaving throwaway users behind.
test.use({ storageState: { cookies: [], origins: [] } })

function requireEnv() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  const secretKey = process.env.SUPABASE_SECRET_KEY
  if (!supabaseUrl || !anonKey || !secretKey) {
    throw new Error(
      'VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY/SUPABASE_SECRET_KEY are required for the organizer signup specs',
    )
  }
  return { supabaseUrl, anonKey, secretKey }
}

function uniqueEmail(label: string) {
  return `playwright-e2e-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`
}

async function deleteAuthUser(userId: string) {
  const { supabaseUrl, secretKey } = requireEnv()
  const res = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: { apikey: secretKey },
  })
  if (!res.ok) {
    throw new Error(`Failed to delete e2e user ${userId}: ${res.status} ${await res.text()}`)
  }
}

function restAs(accessToken: string) {
  const { supabaseUrl, anonKey } = requireEnv()
  return (path: string, init: RequestInit = {}) =>
    fetch(`${supabaseUrl}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
    })
}

test('a /signup organizer is flagged, can create an event, and cannot change the flag', async ({
  page,
}) => {
  const email = uniqueEmail('qa19-signup')
  let userId: string | null = null

  try {
    await page.goto('/signup')
    await page.getByLabel('Name').fill('QA19 Signup Organizer')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill('playwright-e2e-password')
    await page.getByRole('button', { name: /^sign up$/i }).click()
    await page.waitForURL('**/dashboard')

    userId = await getUserId(page)
    const rest = restAs(await getAccessToken(page))

    const profile = await rest(`profiles?id=eq.${userId}&select=is_organizer`)
    expect(await profile.json()).toEqual([{ is_organizer: true }])

    const selfEdit = await rest(`profiles?id=eq.${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_organizer: false }),
    })
    expect(selfEdit.status).toBe(403)
    expect(await selfEdit.json()).toMatchObject({ code: '42501' })

    const rename = await rest(`profiles?id=eq.${userId}&select=name`, {
      method: 'PATCH',
      body: JSON.stringify({ name: 'QA19 Renamed Organizer' }),
    })
    expect(rename.status).toBe(200)
    expect(await rename.json()).toEqual([{ name: 'QA19 Renamed Organizer' }])

    await createDraftEvent(page, uniqueEventName('QA19 Organizer Event'))
    await deleteCurrentEvent(page)
  } finally {
    if (userId) await deleteAuthUser(userId)
  }
})

test('an account created through GoTrue directly, bypassing /signup, cannot create an event', async ({
  request,
}) => {
  const { supabaseUrl, anonKey } = requireEnv()
  let userId: string | null = null

  try {
    const signUp = await request.post(`${supabaseUrl}/auth/v1/signup`, {
      headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      data: {
        email: uniqueEmail('qa19-direct'),
        password: 'playwright-e2e-password',
        // Client-writable metadata: must not grant anything.
        data: { name: 'QA19 Direct Signup', is_organizer: true },
      },
    })
    expect(signUp.ok()).toBe(true)
    const body = await signUp.json()
    userId = body.user.id as string
    const rest = restAs(body.access_token as string)

    const profile = await rest(`profiles?id=eq.${userId}&select=is_organizer`)
    expect(await profile.json()).toEqual([{ is_organizer: false }])

    const createEvent = await rest('events', {
      method: 'POST',
      body: JSON.stringify({
        name: uniqueEventName('QA19 Blocked Event'),
        organizer_id: userId,
        format: 'quiz',
        has_rounds: false,
      }),
    })
    expect(createEvent.status).toBe(403)
    expect(await createEvent.json()).toMatchObject({ code: '42501' })
  } finally {
    if (userId) await deleteAuthUser(userId)
  }
})
