import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 90000,
  expect: {
    timeout: 15000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: [
    ['list'],
    ['json', { outputFile: 'e2e-report/test-results.json' }],
    ['html', { outputFolder: 'e2e-report/html', open: 'never' }],
  ],
  use: {
    baseURL: 'http://localhost:8081',
    headless: false, // Headed testing so the window is visible to the user
    screenshot: 'on',
    video: 'on',
    trace: 'on',
    launchOptions: {
      slowMo: 600, // Slow down operations so the user can easily observe the actions
    },
  },
  projects: [
    {
      name: 'Mobile Chrome (Pixel 7)',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'Desktop Chrome',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
  ],
});
