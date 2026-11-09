import { defineConfig, devices } from '@playwright/test';

/**
 * Browser e2e against the RUNNING app (admin on :5173, backend on :3000) — start both first
 * (CLAUDE.md "Commands"). Every test that writes makes a TESTING row and deletes it again.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env['E2E_BASE_URL'] ?? 'http://localhost:5173',
    viewport: { width: 1366, height: 900 },
    trace: 'retain-on-failure',
    // A Chromium already on the machine, when `npx playwright install` has not been run.
    ...(process.env['E2E_CHROME']
      ? { launchOptions: { executablePath: process.env['E2E_CHROME'] } }
      : {}),
  },
  projects: [
    { name: 'light', use: { ...devices['Desktop Chrome'], colorScheme: 'light' } },
    { name: 'dark', use: { ...devices['Desktop Chrome'], colorScheme: 'dark' } },
  ],
});
