import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end config — drives the real Vite dev server (SPA + MDX blog) in a
 * desktop and a mobile Chromium profile. Distinct from `playwright.config.ts`,
 * which is the Ladle visual-regression suite; the two never share a testDir,
 * server, or port.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5199',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm dev --port 5199',
    url: 'http://localhost:5199',
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'pipe',
    timeout: 120_000,
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } },
    },
    {
      name: 'mobile',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
})
