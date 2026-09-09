import { expect, test } from '@playwright/test'

test('defaults to light theme and applies it before paint', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
})

test('persists a stored theme choice across reload with no flash', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('theme', 'dark')
  })
  await page.goto('/')
  // Attribute set by the pre-paint script, not a post-mount effect: it must
  // already be "dark" as soon as the document is available.
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})

test('falls back to light for an invalid stored value', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('theme', 'not-a-real-theme')
  })
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
})

// The theme control on the pages with no sidebar to hold it (landing, login,
// sign up, join) is a shared component wired to the same provider — check it
// actually drives the document and survives a reload from there.
test('the auth pages carry a working theme toggle', async ({ page }) => {
  await page.goto('/login')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')

  await page.getByRole('button', { name: 'Switch to dark theme' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(
    page.getByRole('button', { name: 'Switch to light theme' }),
  ).toBeVisible()
})
