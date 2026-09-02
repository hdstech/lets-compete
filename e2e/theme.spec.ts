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
