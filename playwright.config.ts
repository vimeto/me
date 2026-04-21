import { defineConfig, devices } from '@playwright/test'

/**
 * Visual-regression config.
 *
 * Boots the Ladle preview server and visits each story URL in a desktop
 * Chromium profile, asserting the rendered DOM matches the committed PNG
 * baseline. Baselines are generated in the Ubuntu CI environment to keep
 * local and CI renders consistent — see `.github/workflows/visual.yml`.
 */
export default defineConfig({
  testDir: 'tests/visual',
  // Keep the visual suite out of the default `tests/validator.smoke.ts`
  // command surface — that still runs via `pnpm validate:smoke`.
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:61000',
    trace: 'retain-on-failure',
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
  },
  expect: {
    toHaveScreenshot: {
      // Allow a little leeway for font subpixel drift.
      maxDiffPixelRatio: 0.01,
      animations: 'disabled',
      caret: 'hide',
    },
  },
  webServer: {
    command: 'pnpm ladle serve --port 61000 --stories "stories/**/*.stories.{ts,tsx,mdx}"',
    url: 'http://localhost:61000',
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'pipe',
    timeout: 300_000,
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
