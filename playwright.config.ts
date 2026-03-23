import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',

  use: {
    baseURL:       'http://localhost:3000',
    trace:         'on-first-retry',
    screenshot:    'only-on-failure',
    locale:        'fr-CA',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /** Lance le serveur Next.js automatiquement si pas déjà démarré */
  webServer: {
    command:            'npm run dev',
    url:                'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout:            120_000,
  },
});
