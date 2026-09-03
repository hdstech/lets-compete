import { expect, test as setup } from '@playwright/test'

const authFile = 'playwright/.auth/participant.json'

// Participants sign in via a Supabase magic-link email in production, which
// Playwright can't intercept — so this authenticates the reused e2e
// participant account directly against Supabase's GoTrue REST API (password
// grant) instead, then writes the resulting session into localStorage under
// the same key supabase-js itself persists to (`sb-<project-ref>-auth-token`)
// before saving it as this project's storageState. No product code exposes
// password login for participants; this is a test-only bypass of the OTP
// step, same reused-account rationale as auth.setup.ts.
const email = process.env.E2E_PARTICIPANT_EMAIL ?? 'playwright-e2e-participant@example.com'
const password = process.env.E2E_PARTICIPANT_PASSWORD ?? 'playwright-e2e-password'

setup('authenticate as the e2e participant account', async ({ page, request }) => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) {
    throw new Error(
      'VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY are required to set up the e2e participant session',
    )
  }

  const projectRef = new URL(supabaseUrl).hostname.split('.')[0]
  const storageKey = `sb-${projectRef}-auth-token`

  function signIn() {
    return request.post(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      data: { email, password },
    })
  }

  let res = await signIn()
  if (!res.ok()) {
    // Account doesn't exist yet on this Supabase project — create it once,
    // then sign in for a normalized token response.
    const signUpRes = await request.post(`${supabaseUrl}/auth/v1/signup`, {
      headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      data: { email, password },
    })
    if (!signUpRes.ok()) {
      throw new Error(
        `Failed to create the e2e participant account: ${signUpRes.status()} ${await signUpRes.text()}`,
      )
    }
    res = await signIn()
  }

  if (!res.ok()) {
    throw new Error(
      `Failed to authenticate the e2e participant account: ${res.status()} ${await res.text()}`,
    )
  }

  const body = await res.json()
  const nowSeconds = Math.floor(Date.now() / 1000)
  const session = {
    access_token: body.access_token,
    token_type: body.token_type ?? 'bearer',
    expires_in: body.expires_in,
    expires_at: body.expires_at ?? nowSeconds + (body.expires_in ?? 3600),
    refresh_token: body.refresh_token,
    user: body.user,
  }

  await page.goto('/')
  await page.evaluate(
    ({ key, value }) => localStorage.setItem(key, JSON.stringify(value)),
    { key: storageKey, value: session },
  )
  await page.reload()

  // Home redirects any authenticated session away from the marketing page —
  // confirms the injected session actually took.
  await expect(page).toHaveURL(/\/dashboard$/)

  await page.context().storageState({ path: authFile })
})
