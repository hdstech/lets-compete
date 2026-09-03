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
    {
      name: 'chromium',
      testIgnore: [/participant-.*\.spec\.ts/, /grader-.*\.spec\.ts/],
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
      name: 'grader',
      testMatch: /grader-.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/grader.json',
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
