import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  workers: 2,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    // Pure-function tests. They import from src/ directly and never open a
    // page, so they need neither a browser context nor the auth setup —
    // Playwright is already here, so this avoids a second test runner.
    { name: 'unit', testMatch: /.*\.unit\.spec\.ts/ },
    {
      name: 'chromium',
      testIgnore: [
        /participant-.*\.spec\.ts/,
        /judge-.*\.spec\.ts/,
        /.*\.unit\.spec\.ts/,
      ],
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/organizer.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'participant',
      testMatch: /participant-.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/participant.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'judge',
      testMatch: /judge-.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/judge.json',
      },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
})
