import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.PWA_E2E_PORT || 4173);
const baseURL = process.env.PWA_E2E_BASE_URL || `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './e2e/playwright',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: {
    timeout: 12_000,
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0.01,
      scale: 'css',
    },
  },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'output/playwright/report', open: 'never' }],
  ],
  outputDir: 'output/playwright/artifacts',
  use: {
    baseURL,
    testIdAttribute: 'data-testid',
    colorScheme: 'light',
    locale: 'en-US',
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    timezoneId: 'UTC',
    video: 'retain-on-failure',
  },
  webServer: process.env.PWA_E2E_BASE_URL
    ? undefined
    : {
        command: `npm run e2e:playwright:prepare && PORT=${port} npm run server:prod`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 300_000,
      },
  projects: [
    {
      name: 'chromium-mobile',
      use: {
        ...devices['Pixel 7'],
      },
    },
  ],
});
