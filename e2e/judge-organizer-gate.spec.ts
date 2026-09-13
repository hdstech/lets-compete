import { expect, test } from '@playwright/test'

test('non-organizer judge cannot create an event through the API', async ({ page, request }) => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) {
    throw new Error('VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY are required for this test')
  }

  await page.goto('/dashboard')
  const session = await page.evaluate(() => {
    const authKey = Object.keys(localStorage).find(
      (key) => key.startsWith('sb-') && key.endsWith('-auth-token'),
    )
    if (!authKey) return null

    const value = localStorage.getItem(authKey)
    return value ? JSON.parse(value) : null
  })

  expect(session?.access_token).toBeTruthy()
  expect(session?.user?.id).toBeTruthy()

  const response = await request.post(`${supabaseUrl}/rest/v1/events`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    data: {
      name: `Blocked Judge Event ${Date.now()}`,
      organizer_id: session.user.id,
      format: 'quiz',
      has_rounds: false,
    },
  })

  expect(response.status()).toBe(403)
  await expect(response.json()).resolves.toMatchObject({ code: '42501' })
})
