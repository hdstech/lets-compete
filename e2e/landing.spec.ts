import { expect, test } from '@playwright/test'
import { expectNoHorizontalOverflow } from './helpers'

test.describe('signed out', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('shows the marketing page and sends the call-to-action to log in', async ({
    page,
  }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { name: "Let's Compete" })).toBeVisible()

    await page.getByRole('link', { name: "Let's get started" }).click()
    await expect(page).toHaveURL('/login')
    await expect(page.getByRole('heading', { name: 'Organizer log in' })).toBeVisible()
  })

  test('keeps the participant and organizer entry points reachable', async ({
    page,
  }) => {
    await page.goto('/')

    await page.getByRole('link', { name: 'Use your email link' }).click()
    await expect(page).toHaveURL('/join')

    await page.goto('/')
    await page.getByRole('link', { name: 'Organizer sign up' }).click()
    await expect(page).toHaveURL('/signup')
  })

  test('fits a phone viewport without sideways scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')

    await expect(page.getByRole('heading', { name: "Let's Compete" })).toBeVisible()
    await expectNoHorizontalOverflow(page)
  })
})

test('sends a signed-in organizer straight to the dashboard', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL('/dashboard')
})
