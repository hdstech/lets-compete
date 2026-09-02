import { expect, test as setup } from '@playwright/test'

const authFile = 'playwright/.auth/organizer.json'

// A single, reused organizer account for the whole e2e suite rather than a
// fresh signup per run: this app's Supabase project has no way to delete an
// auth user with just the anon key, so creating a new one every run would
// leave orphaned accounts behind indefinitely.
const email = process.env.E2E_ORGANIZER_EMAIL ?? 'playwright-e2e-organizer@example.com'
const password = process.env.E2E_ORGANIZER_PASSWORD ?? 'playwright-e2e-password'

setup('authenticate as the e2e organizer account', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: /log in/i }).click()

  const loggedIn = await page
    .waitForURL('**/dashboard', { timeout: 5_000 })
    .then(() => true)
    .catch(() => false)

  if (!loggedIn) {
    // Account doesn't exist yet on this Supabase project — create it once.
    await page.goto('/signup')
    await page.getByLabel('Name').fill('Playwright E2E Organizer')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: /^sign up$/i }).click()
    await page.waitForURL('**/dashboard')
  }

  await expect(page.getByRole('link', { name: 'Manage your events' })).toBeVisible()
  await page.context().storageState({ path: authFile })
})
